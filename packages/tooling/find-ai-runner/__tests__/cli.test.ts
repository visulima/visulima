import { execFileSync } from "node:child_process";
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterAll, beforeAll, describe, expect, expectTypeOf, it } from "vitest";

const CLI_PATH = fileURLToPath(new URL("../dist/cli.js", import.meta.url));
const VERSION_PATTERN = /^\d+\.\d+\.\d+/;
const PROVIDER_NAMES_PATTERN = /claude|gemini|codex|copilot|cursor|crush|amp|kimi|qwen|opencode|droid/i;

// Create a fake "claude" binary so detection works on CI (no real providers installed).
let fakeBinDirectory: string;
let fakeBinPath: string;

const run = (args: string[] = [], env?: Record<string, string>): { exitCode: number; stderr: string; stdout: string } => {
    try {
        const stdout = execFileSync(process.execPath, [CLI_PATH, ...args], {
            encoding: "utf8",
            env: { ...process.env, ...env },
            stdio: ["pipe", "pipe", "pipe"],
            timeout: 30_000,
        });

        return { exitCode: 0, stderr: "", stdout };
    } catch (caughtError: unknown) {
        const execError = caughtError as { status: number; stderr: string; stdout: string };

        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        return { exitCode: execError.status ?? 1, stderr: execError.stderr ?? "", stdout: execError.stdout ?? "" };
    }
};

describe("cLI", () => {
    beforeAll(() => {
        fakeBinDirectory = mkdtempSync(join(tmpdir(), "find-ai-runner-test-"));
        fakeBinPath = join(fakeBinDirectory, "claude");
        writeFileSync(fakeBinPath, '#!/bin/sh\necho "claude-code 1.0.0"', { mode: 0o755 });
        chmodSync(fakeBinPath, 0o755);
    });

    afterAll(() => {
        rmSync(fakeBinDirectory, { force: true, recursive: true });
    });

    describe("--help", () => {
        it("should print usage when called with --help", () => {
            expect.assertions(6);

            const result = run(["--help"]);

            expect(result.exitCode).toBe(0);
            expect(result.stdout).toContain("find-ai-runner - Detect and invoke AI CLI tools");
            expect(result.stdout).toContain("Commands:");
            expect(result.stdout).toContain("list");
            expect(result.stdout).toContain("detect");
            expect(result.stdout).toContain("run");
        });

        it("should print usage when called with -h", () => {
            expect.assertions(2);

            const result = run(["-h"]);

            expect(result.exitCode).toBe(0);
            expect(result.stdout).toContain("find-ai-runner - Detect and invoke AI CLI tools");
        });

        it("should print usage when called with no arguments", () => {
            expect.assertions(2);

            const result = run([]);

            expect(result.exitCode).toBe(0);
            expect(result.stdout).toContain("find-ai-runner - Detect and invoke AI CLI tools");
        });
    });

    describe("--version", () => {
        it("should print version", () => {
            expect.assertions(2);

            const result = run(["--version"]);

            expect(result.exitCode).toBe(0);
            expect(result.stdout.trim()).toMatch(VERSION_PATTERN);
        });

        it("should print version with -v flag", () => {
            expect.assertions(2);

            const result = run(["-v"]);

            expect(result.exitCode).toBe(0);
            expect(result.stdout.trim()).toMatch(VERSION_PATTERN);
        });
    });

    describe("list", () => {
        it("should list providers", { timeout: 30_000 }, () => {
            expect.assertions(2);

            const result = run(["list"], { CLAUDE_PATH: fakeBinPath });

            expect(result.exitCode).toBe(0);
            expect(result.stdout).toMatch(PROVIDER_NAMES_PATTERN);
        });

        it("should output JSON with --json flag", () => {
            expect.hasAssertions();

            const result = run(["list", "--json"]);

            expect(result.exitCode).toBe(0);

            const parsed = JSON.parse(result.stdout) as unknown[];

            expect(Array.isArray(parsed)).toBe(true);
            expect(parsed).toHaveLength(11);

            for (const provider of parsed) {
                expect(provider).toHaveProperty("name");
                expect(provider).toHaveProperty("available");
            }
        });
    });

    describe("detect", () => {
        it("should detect a known provider", () => {
            expect.assertions(2);

            const result = run(["detect", "claude"]);

            expect(result.exitCode).toBe(0);
            expect(result.stdout).toContain("claude");
        });

        it("should output JSON with --json flag", () => {
            expect.assertions(2);

            const result = run(["detect", "claude", "--json"]);

            expect(result.exitCode).toBe(0);

            const parsed = JSON.parse(result.stdout) as { available: boolean; name: string };

            expect(parsed.name).toBe("claude");

            expectTypeOf(parsed.available).toBeBoolean();
        });

        it("should fail without provider name", () => {
            expect.assertions(2);

            const result = run(["detect"]);

            expect(result.exitCode).toBe(1);
            expect(result.stderr).toContain("provider name required");
        });

        it("should fail with unknown provider", () => {
            expect.assertions(2);

            const result = run(["detect", "nonexistent"]);

            expect(result.exitCode).toBe(1);
            expect(result.stderr).toContain("unknown provider");
        });
    });

    describe("run", () => {
        it("should fail without provider", () => {
            expect.assertions(2);

            const result = run(["run"]);

            expect(result.exitCode).toBe(1);
            expect(result.stderr).toContain("provider and prompt required");
        });

        it("should fail without prompt", () => {
            expect.assertions(2);

            const result = run(["run", "claude"]);

            expect(result.exitCode).toBe(1);
            expect(result.stderr).toContain("provider and prompt required");
        });

        it("should fail with unknown provider", () => {
            expect.assertions(2);

            const result = run(["run", "nonexistent", "hello"]);

            expect(result.exitCode).toBe(1);
            expect(result.stderr).toContain("unknown provider");
        });
    });

    describe("args", () => {
        it("should print CLI args for a provider", () => {
            expect.assertions(2);

            const result = run(["args", "claude", "hello world"]);

            expect(result.exitCode).toBe(0);
            expect(result.stdout.trim().length).toBeGreaterThan(0);
        });

        it("should output JSON with --json flag", () => {
            expect.assertions(2);

            const result = run(["args", "claude", "hello world", "--json"]);

            expect(result.exitCode).toBe(0);

            const parsed = JSON.parse(result.stdout) as string[];

            expect(Array.isArray(parsed)).toBe(true);
        });

        it("should fail without provider", () => {
            expect.assertions(2);

            const result = run(["args"]);

            expect(result.exitCode).toBe(1);
            expect(result.stderr).toContain("provider and prompt required");
        });

        it("should fail with unknown provider", () => {
            expect.assertions(2);

            const result = run(["args", "nonexistent", "hello"]);

            expect(result.exitCode).toBe(1);
            expect(result.stderr).toContain("unknown provider");
        });
    });

    describe("unknown command", () => {
        it("should fail with unknown command", () => {
            expect.assertions(2);

            const result = run(["foobar"]);

            expect(result.exitCode).toBe(1);
            expect(result.stderr).toContain("Unknown command: foobar");
        });
    });
});
