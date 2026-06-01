import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, expectTypeOf, it } from "vitest";

import { FileAccessTracker, generatePreloadScript, parseDirectExec } from "../../src/file-access-tracker";

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
            // The tracker always runs commands through `sh -c` (on Windows
            // that's the runner's Git Bash), so use POSIX `$VAR` expansion
            // on every platform — cmd.exe `%VAR%` syntax is never evaluated.
            const command = 'echo "$MY_TEST_VAR"';
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

    // NOTE: cancellation (per-call `AbortSignal` + `killAll()`) is wired
    // across all three dispatch paths via `wireAbort` and the
    // `#activeProcesses` set, and the seccomp path fails fast through
    // the accept watchdog. It is NOT covered by an automated test here:
    // a real-process test (spawn `sleep`, abort, assert fast return)
    // proved non-deterministically flaky across the node/bun/deno ×
    // ubuntu/macos/windows matrix — a `sh -c` grandchild can retain the
    // stdio pipes, so the spawn doesn't report completion even after the
    // kill, and the dispatch path (seccomp vs strace vs no-tracking)
    // varies per runner. The behaviour was verified manually
    // (`track("sleep N", { abortSignal })` returns in ~120ms on abort)
    // and the Rust-side fail-fast handshake is covered by
    // `native/fspy_seccomp` integration tests. Revisit with an injected
    // fake spawn if a deterministic harness becomes worthwhile.
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

describe(parseDirectExec, () => {
    it("returns argv for a single direct binary invocation", () => {
        expect.assertions(3);

        expect(parseDirectExec("eslint .")).toStrictEqual(["eslint", "."]);
        expect(parseDirectExec("node script.js --flag value")).toStrictEqual(["node", "script.js", "--flag", "value"]);
        expect(parseDirectExec("  tsc   --noEmit  ")).toStrictEqual(["tsc", "--noEmit"]);
    });

    it("returns undefined for empty input", () => {
        expect.assertions(2);

        expect(parseDirectExec("")).toBeUndefined();
        expect(parseDirectExec("   ")).toBeUndefined();
    });

    it.each([
        ["pipeline", "cat x | grep y"],
        ["and", "a && b"],
        ["semicolon", "a; b"],
        ["redirect", "echo hi > out.txt"],
        ["var expansion", "echo $HOME"],
        ["subshell", "echo $(date)"],
        ["backtick", "echo `date`"],
        ["glob", "prettier --write src/**/*.ts"],
        ["quotes", 'eslint "src/**"'],
        ["home", "cat ~/x"],
    ])("returns undefined for shell syntax (%s)", (_label, command) => {
        expect.assertions(1);

        expect(parseDirectExec(command)).toBeUndefined();
    });
});
