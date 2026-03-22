import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { FileAccessTracker, generatePreloadScript } from "../src/file-access-tracker";

const createTemporaryDirectory = async (base?: string): Promise<string> => {
    const parent = base ?? tmpdir();
    // eslint-disable-next-line sonarjs/pseudo-random
    const directory = join(parent, `task-runner-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);

    await mkdir(directory, { recursive: true });

    return directory;
};

describe("FileAccessTracker", () => {
    let workspaceRoot: string;

    beforeEach(async () => {
        workspaceRoot = await createTemporaryDirectory();
    });

    afterEach(async () => {
        await rm(workspaceRoot, { force: true, recursive: true });
    });

    describe("isSupported", () => {
        it("should return true on Linux", () => {
            const tracker = new FileAccessTracker(workspaceRoot);

            // We're running on Linux in this environment
            expect(tracker.isSupported()).toBe(process.platform === "linux");
        });
    });

    describe("track", () => {
        it("should run a command and return output", async () => {
            const tracker = new FileAccessTracker(workspaceRoot);
            const result = await tracker.track("echo hello", { cwd: workspaceRoot });

            expect(result.output).toContain("hello");
            expect(typeof result.code).toBe("number");
            expect(Array.isArray(result.accesses)).toBe(true);
        });

        it("should return exit code 0 for successful command", async () => {
            const tracker = new FileAccessTracker(workspaceRoot);
            const result = await tracker.track("true", { cwd: workspaceRoot });

            expect(result.code).toBe(0);
        });

        it("should track file accesses when strace is available (Linux)", async () => {
            // Use empty exclude patterns so /tmp paths are not filtered out
            const tracker = new FileAccessTracker(workspaceRoot, []);

            if (!tracker.isSupported()) {
                return;
            }

            // Create a file that the command will read
            const testFile = join(workspaceRoot, "test.txt");

            await writeFile(testFile, "test content");

            const result = await tracker.track(`cat ${testFile}`, { cwd: workspaceRoot });

            expect(result.output).toContain("test content");

            // strace should capture the file access
            const accessedPaths = result.accesses.map((a) => a.path);

            expect(accessedPaths).toContain(testFile);
        });

        it("should filter out system paths", async () => {
            const tracker = new FileAccessTracker(workspaceRoot);

            if (!tracker.isSupported()) {
                return;
            }

            const result = await tracker.track("ls /proc/self/status", { cwd: workspaceRoot });

            // /proc/ paths should be excluded
            const procAccesses = result.accesses.filter((a) => a.path.startsWith("/proc/"));

            expect(procAccesses).toHaveLength(0);
        });

        it("should only include paths within workspace root", async () => {
            const tracker = new FileAccessTracker(workspaceRoot, []);

            if (!tracker.isSupported()) {
                return;
            }

            const testFile = join(workspaceRoot, "test.txt");

            await writeFile(testFile, "data");

            const result = await tracker.track(`cat ${testFile}`, { cwd: workspaceRoot });

            for (const access of result.accesses) {
                expect(access.path.startsWith(workspaceRoot)).toBe(true);
            }
        });

        it("should use custom exclude patterns", async () => {
            // Only exclude .log files, not /tmp/ (since our workspace is in /tmp)
            const tracker = new FileAccessTracker(workspaceRoot, [/\.log$/]);

            if (!tracker.isSupported()) {
                return;
            }

            const logFile = join(workspaceRoot, "test.log");
            const txtFile = join(workspaceRoot, "test.txt");

            await writeFile(logFile, "log");
            await writeFile(txtFile, "txt");

            const result = await tracker.track(`cat ${logFile} ${txtFile}`, { cwd: workspaceRoot });

            const accessedPaths = result.accesses.map((a) => a.path);

            expect(accessedPaths).not.toContain(logFile);
        });

        it("should pass environment variables to the command", async () => {
            const tracker = new FileAccessTracker(workspaceRoot);
            const result = await tracker.track('echo "$MY_TEST_VAR"', {
                cwd: workspaceRoot,
                env: { MY_TEST_VAR: "test_value_123" },
            });

            expect(result.output).toContain("test_value_123");
        });
    });

    describe("track on unsupported platform", () => {
        it("should return empty accesses when tracking is not supported", async () => {
            const tracker = new FileAccessTracker(workspaceRoot);

            if (tracker.isSupported()) {
                // This test is for unsupported platforms; skip on Linux
                return;
            }

            const result = await tracker.track("echo hello", { cwd: workspaceRoot });

            expect(result.accesses).toEqual([]);
            expect(result.output).toContain("hello");
        });
    });
});

describe("generatePreloadScript", () => {
    it("should return a string containing the output path", () => {
        const script = generatePreloadScript("/tmp/test-log.jsonl");

        expect(script).toContain("/tmp/test-log.jsonl");
    });

    it("should patch fs.readFileSync", () => {
        const script = generatePreloadScript("/tmp/log");

        expect(script).toContain("fs.readFileSync");
        expect(script).toContain("_originalReadFileSync");
    });

    it("should patch fs/promises", () => {
        const script = generatePreloadScript("/tmp/log");

        expect(script).toContain('require("node:fs/promises")');
        expect(script).toContain("fsp.readFile");
        expect(script).toContain("fsp.stat");
        expect(script).toContain("fsp.readdir");
    });

    it("should flush on process exit", () => {
        const script = generatePreloadScript("/tmp/log");

        expect(script).toContain('process.on("exit"');
    });
});
