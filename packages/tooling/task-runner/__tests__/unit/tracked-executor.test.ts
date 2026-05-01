import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

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

            const result = await executor.execute(task, options, 'echo "$CUSTOM_VAR"');

            expect(result.terminalOutput).toContain("custom_value");
        });
    });
});
