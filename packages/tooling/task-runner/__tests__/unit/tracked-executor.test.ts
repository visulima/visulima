import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TRACKER_INJECTED_ENV_NAMES } from "../../src/child-env";
import { FileAccessTracker } from "../../src/file-access-tracker";
import { TrackedTaskExecutor } from "../../src/tracked-executor";
import type { Task, TaskExecutionOptions } from "../../src/types";

const createTemporaryDirectory = async (): Promise<string> => {
    // eslint-disable-next-line sonarjs/pseudo-random
    const directory = join(tmpdir(), `task-runner-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);

    await mkdir(directory, { recursive: true });

    return directory;
};

const createTask = (overrides: Partial<Task> = {}): Task => {
    return {
        id: "test-project:build",
        outputs: [],
        overrides: {},
        target: { project: "test-project", target: "build" },
        ...overrides,
    };
};

describe(TrackedTaskExecutor, () => {
    let workspaceRoot: string;
    let executor: TrackedTaskExecutor;

    beforeEach(async () => {
        workspaceRoot = await createTemporaryDirectory();
        executor = new TrackedTaskExecutor(workspaceRoot);
    });

    afterEach(async () => {
        await rm(workspaceRoot, { force: true, recursive: true });
    });

    describe("isTrackingSupported", () => {
        it("should always return true (preload script works cross-platform)", () => {
            expect.assertions(1);

            expect(executor.isTrackingSupported).toBe(true);
        });
    });

    describe("isStraceSupported", () => {
        it.runIf(process.platform !== "linux")("should return false on non-Linux platforms", () => {
            expect.assertions(1);

            expect(executor.isStraceSupported).toBe(false);
        });
    });

    describe("execute", () => {
        it("should execute a command and return output", async () => {
            expect.assertions(3);

            const task = createTask();
            const options: TaskExecutionOptions = { cwd: workspaceRoot };

            const result = await executor.execute(task, options, "echo test-output");

            expect(result.terminalOutput).toContain("test-output");
            expect(result.code).toBe(0);
            expect(Array.isArray(result.accesses)).toBe(true);
        });

        it("should return non-zero exit code for failing command", async () => {
            expect.assertions(1);

            const task = createTask();
            const options: TaskExecutionOptions = { cwd: workspaceRoot };

            const result = await executor.execute(task, options, "false");

            expect(result.code).not.toBe(0);
        });

        it("should use task projectRoot to resolve cwd when options.cwd is not provided", async () => {
            expect.assertions(2);

            const projectDirectory = join(workspaceRoot, "packages", "my-pkg");

            await mkdir(projectDirectory, { recursive: true });
            await writeFile(join(projectDirectory, "marker.txt"), "found");

            const task = createTask({ projectRoot: "packages/my-pkg" });
            const options: TaskExecutionOptions = {};

            const result = await executor.execute(task, options, "cat marker.txt");

            expect(result.terminalOutput).toContain("found");
            expect(result.code).toBe(0);
        });

        it.runIf(new TrackedTaskExecutor(tmpdir()).isStraceSupported)("should track file accesses on Linux", async () => {
            expect.assertions(2);

            // Use a workspace root outside /tmp since default exclude patterns filter /tmp/
            const homeWorkspace = join(process.cwd(), "node_modules", ".cache", "task-runner-test-workspace");

            await mkdir(homeWorkspace, { recursive: true });

            try {
                const homeExecutor = new TrackedTaskExecutor(homeWorkspace);
                const testFile = join(homeWorkspace, "input.txt");

                await writeFile(testFile, "input data");

                const task = createTask();
                const options: TaskExecutionOptions = { cwd: homeWorkspace };

                const result = await homeExecutor.execute(task, options, `cat ${testFile}`);

                expect(result.terminalOutput).toContain("input data");

                const accessedPaths = result.accesses.map((a) => a.path);

                expect(accessedPaths).toContain(testFile);
            } finally {
                await rm(homeWorkspace, { force: true, recursive: true });
            }
        });

        it("should pass environment variables to the command", async () => {
            expect.assertions(1);

            const task = createTask();
            const options: TaskExecutionOptions = {
                cwd: workspaceRoot,
                env: { CUSTOM_VAR: "custom_value" },
            };

            const command = process.platform === "win32" ? "echo %CUSTOM_VAR%" : 'echo "$CUSTOM_VAR"';
            const result = await executor.execute(task, options, command);

            expect(result.terminalOutput).toContain("custom_value");
        });

        it("reports the tracker kind that produced the accesses", async () => {
            expect.assertions(1);

            // Shell syntax never takes the direct-exec native trackers, so this
            // run is the Linux syscall tracker there and the Node preload elsewhere.
            const result = await executor.execute(createTask(), { cwd: workspaceRoot }, "node -e 0 && true");

            const expectedKinds = executor.isStraceSupported ? ["seccomp", "strace"] : ["preload"];

            expect(expectedKinds).toContain(result.tracker);
        });
    });

    describe("child environment", () => {
        const PARENT_ONLY = "TRACKED_ENV_PARENT_ONLY";
        const ALLOWED = "TRACKED_ENV_ALLOWED";

        // Writes the child's whole environment to a file, so the assertion reads
        // exactly what the real spawned process received.
        const dumpScript = async (): Promise<string> => {
            const script = join(workspaceRoot, "dump.cjs");
            const out = join(workspaceRoot, "child-env.json");

            await writeFile(script, `require("node:fs").writeFileSync(${JSON.stringify(out)}, JSON.stringify(process.env));\n`);

            return out;
        };

        const readChildEnv = async (out: string): Promise<Record<string, string>> => JSON.parse(await readFile(out, "utf8")) as Record<string, string>;

        const savedNodeOptions = process.env["NODE_OPTIONS"];

        beforeEach(() => {
            process.env[PARENT_ONLY] = "parent";
            // A parent NODE_OPTIONS must not reach a clean child; the preload's
            // `--import` is appended to the child's own value only.
            process.env["NODE_OPTIONS"] = "--max-old-space-size=96";
        });

        afterEach(() => {
            Reflect.deleteProperty(process.env, PARENT_ONLY);
            Reflect.deleteProperty(process.env, ALLOWED);

            if (savedNodeOptions === undefined) {
                Reflect.deleteProperty(process.env, "NODE_OPTIONS");
            } else {
                process.env["NODE_OPTIONS"] = savedNodeOptions;
            }
        });

        it("inherit: the child sees the parent environment with the given overlay", async () => {
            expect.assertions(3);

            const out = await dumpScript();

            process.env[ALLOWED] = "parent-value";

            const result = await executor.execute(createTask(), { cwd: workspaceRoot, env: { [ALLOWED]: "overlay" } }, "node dump.cjs");
            const env = await readChildEnv(out);

            expect(result.code).toBe(0);
            expect(env[PARENT_ONLY]).toBe("parent");
            expect(env[ALLOWED]).toBe("overlay");
        });

        it("clean: the child sees only the given environment plus the tracker's own variables", async () => {
            expect.assertions(4);

            const out = await dumpScript();
            const result = await executor.execute(
                createTask(),
                { cwd: workspaceRoot, env: { [ALLOWED]: "allowed", PATH: process.env["PATH"] ?? "" }, inheritEnv: false },
                "node dump.cjs",
            );
            const env = await readChildEnv(out);

            expect(result.code).toBe(0);
            expect(env[ALLOWED]).toBe("allowed");
            expect(env).not.toHaveProperty(PARENT_ONLY);
            // The parent's NODE_OPTIONS is dropped; the preload only appends to the child's value.
            expect(env["NODE_OPTIONS"] ?? "").not.toContain("max-old-space-size");
        });

        it("clean: keeps every tracker-injected variable the run actually sets", async () => {
            expect.hasAssertions();

            const out = await dumpScript();
            const result = await executor.execute(createTask(), { cwd: workspaceRoot, env: { PATH: process.env["PATH"] ?? "" }, inheritEnv: false }, "node dump.cjs");
            const env = await readChildEnv(out);

            // NODE_OPTIONS carries the `--import` preload only on the preload path;
            // strace records file accesses without it.
            for (const name of TRACKER_INJECTED_ENV_NAMES) {
                if (name === "NODE_OPTIONS" && result.tracker !== "preload") {
                    expect(env[name] ?? "").not.toContain("--import");
                } else {
                    expect(env[name], `${name} dropped under a clean environment`).toBeDefined();
                }
            }
        });

        it("clean: never runs a native tracker, which would inherit the parent environment", async () => {
            expect.assertions(1);

            const result = await executor.execute(createTask(), { cwd: workspaceRoot, env: { PATH: process.env["PATH"] ?? "" }, inheritEnv: false }, "node dump.cjs");

            expect(["strace", "preload"]).toContain(result.tracker);
        });
    });

    describe("trackerKindFor", () => {
        // The orchestrator validates stored traces against this prediction before the run,
        // so it must name the tracker execute() actually reports, for shell and direct commands alike.
        it.each(["node -e 0 && true", "node -e 0"])("predicts the tracker execute() reports for %s", async (command) => {
            expect.assertions(1);

            const predicted = executor.trackerKindFor(command);
            const result = await executor.execute(createTask(), { cwd: workspaceRoot }, command);

            expect(result.tracker).toBe(predicted);
        });

        it.each(["node -e 0 && true", "node -e 0"])("predicts the tracker execute() reports under a clean environment for %s", async (command) => {
            expect.assertions(1);

            const clean = { cwd: workspaceRoot, env: { PATH: process.env["PATH"] ?? "" }, inheritEnv: false };
            const predicted = executor.trackerKindFor(command, { inheritEnv: false });
            const result = await executor.execute(createTask(), clean, command);

            expect(result.tracker).toBe(predicted);
        });

        // The host decides which native tracker is available, so each dispatch branch is forced
        // here: the prediction must name the same branch execute() takes.
        describe("per dispatch branch", () => {
            const noAccesses = { accesses: [], code: 0, output: "" };

            afterEach(() => {
                vi.restoreAllMocks();
            });

            it("predicts interpose for a direct command, and preload for shell syntax", async () => {
                expect.assertions(3);

                vi.spyOn(FileAccessTracker.prototype, "isSupported").mockReturnValue(false);
                vi.spyOn(FileAccessTracker.prototype, "isInterposeSupported").mockReturnValue(true);
                vi.spyOn(FileAccessTracker.prototype, "isIatHookSupported").mockReturnValue(false);
                vi.spyOn(FileAccessTracker.prototype, "trackInterpose").mockResolvedValue(noAccesses);

                expect(executor.trackerKindFor("node -e 0")).toBe("interpose");

                const direct = await executor.execute(createTask(), { cwd: workspaceRoot }, "node -e 0");

                expect(direct.tracker).toBe("interpose");
                expect(executor.trackerKindFor("node -e 0 && true")).toBe("preload");
            });

            it("predicts iat for a direct command when only the Windows hook is available", async () => {
                expect.assertions(2);

                vi.spyOn(FileAccessTracker.prototype, "isSupported").mockReturnValue(false);
                vi.spyOn(FileAccessTracker.prototype, "isInterposeSupported").mockReturnValue(false);
                vi.spyOn(FileAccessTracker.prototype, "isIatHookSupported").mockReturnValue(true);
                vi.spyOn(FileAccessTracker.prototype, "trackIatHook").mockResolvedValue(noAccesses);

                expect(executor.trackerKindFor("node -e 0")).toBe("iat");

                const result = await executor.execute(createTask(), { cwd: workspaceRoot }, "node -e 0");

                expect(result.tracker).toBe("iat");
            });

            it("predicts preload, not a native tracker, under a clean environment", () => {
                expect.assertions(3);

                vi.spyOn(FileAccessTracker.prototype, "isSupported").mockReturnValue(true);
                vi.spyOn(FileAccessTracker.prototype, "isStraceAvailable").mockReturnValue(false);
                vi.spyOn(FileAccessTracker.prototype, "isInterposeSupported").mockReturnValue(true);
                vi.spyOn(FileAccessTracker.prototype, "isIatHookSupported").mockReturnValue(true);

                // Native trackers would add their variables to the parent environment, so a clean run skips them.
                expect(executor.trackerKindFor("node -e 0", { inheritEnv: false })).toBe("preload");
                expect(executor.trackerKindFor("node -e 0 && true", { inheritEnv: false })).toBe("preload");

                vi.spyOn(FileAccessTracker.prototype, "isStraceAvailable").mockReturnValue(true);

                expect(executor.trackerKindFor("node -e 0", { inheritEnv: false })).toBe("strace");
            });

            it("predicts the Linux syscall tracker whenever it is supported", async () => {
                expect.assertions(2);

                vi.spyOn(FileAccessTracker.prototype, "isSupported").mockReturnValue(true);
                vi.spyOn(FileAccessTracker.prototype, "linuxTrackerKind").mockReturnValue("strace");
                vi.spyOn(FileAccessTracker.prototype, "track").mockResolvedValue(noAccesses);

                expect(executor.trackerKindFor("node -e 0 && true")).toBe("strace");

                const result = await executor.execute(createTask(), { cwd: workspaceRoot }, "node -e 0 && true");

                expect(result.tracker).toBe("strace");
            });
        });
    });
});
