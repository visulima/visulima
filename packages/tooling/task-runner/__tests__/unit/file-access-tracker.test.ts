import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, expectTypeOf, it } from "vitest";

import { FileAccessTracker, generatePreloadScript } from "../../src/file-access-tracker";

const createTemporaryDirectory = async (base?: string): Promise<string> => {
    const parent = base ?? tmpdir();
    // eslint-disable-next-line sonarjs/pseudo-random
    const directory = join(parent, `task-runner-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);

    await mkdir(directory, { recursive: true });

    return directory;
};

describe(FileAccessTracker, () => {
    let workspaceRoot: string;

    beforeEach(async () => {
        workspaceRoot = await createTemporaryDirectory();
    });

    afterEach(async () => {
        await rm(workspaceRoot, { force: true, recursive: true });
    });

    describe("isSupported", () => {
        it.skipIf(process.platform === "linux")("should return false on non-Linux platforms", () => {
            expect.assertions(1);

            const tracker = new FileAccessTracker(workspaceRoot);

            expect(tracker.isSupported()).toBe(false);
        });
    });

    describe("track", () => {
        it("should run a command and return output", async () => {
            expect.assertions(2);

            const tracker = new FileAccessTracker(workspaceRoot);
            const result = await tracker.track("echo hello", { cwd: workspaceRoot });

            expect(result.output).toContain("hello");

            expectTypeOf(result.code).toBeNumber();

            expect(Array.isArray(result.accesses)).toBe(true);
        });

        it("should return exit code 0 for successful command", async () => {
            expect.assertions(1);

            const tracker = new FileAccessTracker(workspaceRoot);
            const result = await tracker.track("true", { cwd: workspaceRoot });

            expect(result.code).toBe(0);
        });

        it.skipIf(!new FileAccessTracker(tmpdir(), []).isSupported())("should track file accesses when strace is available (Linux)", async () => {
            expect.assertions(2);

            // Use empty exclude patterns so /tmp paths are not filtered out
            const tracker = new FileAccessTracker(workspaceRoot, []);

            // Create a file that the command will read
            const testFile = join(workspaceRoot, "test.txt");

            await writeFile(testFile, "test content");

            const result = await tracker.track(`cat ${testFile}`, { cwd: workspaceRoot });

            expect(result.output).toContain("test content");

            // strace should capture the file access
            const accessedPaths = result.accesses.map((a) => a.path);

            expect(accessedPaths).toContain(testFile);
        });

        it.skipIf(!new FileAccessTracker(tmpdir()).isSupported())("should filter out system paths", async () => {
            expect.assertions(1);

            const tracker = new FileAccessTracker(workspaceRoot);

            const result = await tracker.track("ls /proc/self/status", { cwd: workspaceRoot });

            // /proc/ paths should be excluded
            const procAccesses = result.accesses.filter((a) => a.path.startsWith("/proc/"));

            expect(procAccesses).toHaveLength(0);
        });

        it.skipIf(!new FileAccessTracker(tmpdir(), []).isSupported())("should only include paths within workspace root", async () => {
            expect.hasAssertions();

            const tracker = new FileAccessTracker(workspaceRoot, []);

            const testFile = join(workspaceRoot, "test.txt");

            await writeFile(testFile, "data");

            const result = await tracker.track(`cat ${testFile}`, { cwd: workspaceRoot });

            for (const access of result.accesses) {
                expect(access.path.startsWith(workspaceRoot)).toBe(true);
            }
        });

        it.skipIf(!new FileAccessTracker(tmpdir(), [/\.log$/]).isSupported())("should use custom exclude patterns", async () => {
            expect.assertions(1);

            // Only exclude .log files, not /tmp/ (since our workspace is in /tmp)
            const tracker = new FileAccessTracker(workspaceRoot, [/\.log$/]);

            const logFile = join(workspaceRoot, "test.log");
            const txtFile = join(workspaceRoot, "test.txt");

            await writeFile(logFile, "log");
            await writeFile(txtFile, "txt");

            const result = await tracker.track(`cat ${logFile} ${txtFile}`, { cwd: workspaceRoot });

            const accessedPaths = result.accesses.map((a) => a.path);

            expect(accessedPaths).not.toContain(logFile);
        });

        it("should pass environment variables to the command", async () => {
            expect.assertions(1);

            const tracker = new FileAccessTracker(workspaceRoot);
            const command = process.platform === "win32" ? "echo %MY_TEST_VAR%" : 'echo "$MY_TEST_VAR"';
            const result = await tracker.track(command, {
                cwd: workspaceRoot,
                env: { MY_TEST_VAR: "test_value_123" },
            });

            expect(result.output).toContain("test_value_123");
        });

        it.skipIf(!new FileAccessTracker(tmpdir(), []).isSupported())("emits a write access when a file is modified", async () => {
            expect.assertions(1);

            const tracker = new FileAccessTracker(workspaceRoot, []);
            const target = join(workspaceRoot, "out.txt");

            // sh -c 'echo hi > out.txt' — openat(O_WRONLY|O_CREAT|O_TRUNC)
            const result = await tracker.track(`sh -c 'echo hi > ${target}'`, { cwd: workspaceRoot });

            expect(result.accesses.some((a) => a.path === target && a.type === "write")).toBe(true);
        });

        it.skipIf(!new FileAccessTracker(tmpdir(), []).isSupported())("records both read and write for a self-modifying command", async () => {
            expect.assertions(2);

            const tracker = new FileAccessTracker(workspaceRoot, []);
            const target = join(workspaceRoot, "roundtrip.txt");

            await writeFile(target, "before");

            // Read the file then overwrite it in the same shell invocation.
            const result = await tracker.track(`sh -c 'cat ${target} > /dev/null && echo after > ${target}'`, { cwd: workspaceRoot });

            const types = new Set(result.accesses.filter((a) => a.path === target).map((a) => a.type));

            expect(types.has("read")).toBe(true);
            expect(types.has("write")).toBe(true);
        });
    });

    describe("track on unsupported platform", () => {
        it.skipIf(new FileAccessTracker(tmpdir()).isSupported())("should return empty accesses when tracking is not supported", async () => {
            expect.assertions(2);

            const tracker = new FileAccessTracker(workspaceRoot);

            const result = await tracker.track("echo hello", { cwd: workspaceRoot });

            expect(result.accesses).toStrictEqual([]);
            expect(result.output).toContain("hello");
        });
    });

    describe("cancellation", () => {
        // These spawn a real `sleep` and assert cancellation returns
        // far sooner than the command's natural duration. The bound
        // (10s) is well under `sleep 30` yet generous enough for a
        // slow/cold CI box plus the seccomp helper's fail-fast
        // fallback path. The explicit 20s per-test timeout keeps a
        // genuine hang (cancellation broken) from being masked by — or
        // racing against — vitest's 5s default, so the assertion can
        // actually run and report rather than the runner killing it.
        const CANCEL_TIMEOUT_MS = 20_000;
        const CANCEL_BOUND_MS = 10_000;

        it.runIf(new FileAccessTracker(tmpdir()).isSupported())(
            "aborts a long-running command via AbortSignal",
            async () => {
                expect.assertions(1);

                const tracker = new FileAccessTracker(workspaceRoot);
                const controller = new AbortController();

                const abortTimer = setTimeout(() => {
                    controller.abort();
                }, 100);

                const start = Date.now();

                await tracker.track("sleep 30", {
                    abortSignal: controller.signal,
                    cwd: workspaceRoot,
                });

                clearTimeout(abortTimer);

                expect(Date.now() - start).toBeLessThan(CANCEL_BOUND_MS);
            },
            CANCEL_TIMEOUT_MS,
        );

        it.runIf(new FileAccessTracker(tmpdir()).isSupported())(
            "killAll terminates active spawns",
            async () => {
                expect.assertions(1);

                const tracker = new FileAccessTracker(workspaceRoot);
                const start = Date.now();

                const trackPromise = tracker.track("sleep 30", { cwd: workspaceRoot });

                setTimeout(() => {
                    tracker.killAll();
                }, 150);

                await trackPromise;

                expect(Date.now() - start).toBeLessThan(CANCEL_BOUND_MS);
            },
            CANCEL_TIMEOUT_MS,
        );
    });
});

describe(generatePreloadScript, () => {
    it("should return a string containing the output path", () => {
        expect.assertions(1);

        const script = generatePreloadScript("/tmp/test-log.jsonl");

        expect(script).toContain("/tmp/test-log.jsonl");
    });

    it("should patch fs sync and async methods", () => {
        expect.assertions(3);

        const script = generatePreloadScript("/tmp/log");

        expect(script).toContain('"readFileSync"');
        expect(script).toContain('"statSync"');
        expect(script).toContain('"readdirSync"');
    });

    it("should patch fs/promises", () => {
        expect.assertions(4);

        const script = generatePreloadScript("/tmp/log");

        expect(script).toContain('require("node:fs/promises")');
        expect(script).toContain('"readFile"');
        expect(script).toContain('"stat"');
        expect(script).toContain('"readdir"');
    });

    it("should patch write-family methods", () => {
        expect.assertions(4);

        const script = generatePreloadScript("/tmp/log");

        expect(script).toContain('"writeFileSync"');
        expect(script).toContain('"appendFile"');
        expect(script).toContain('"unlinkSync"');
        expect(script).toContain('"renameSync"');
    });

    it("should flush on process exit", () => {
        expect.assertions(1);

        const script = generatePreloadScript("/tmp/log");

        expect(script).toContain('process.on("beforeExit"');
    });
});
