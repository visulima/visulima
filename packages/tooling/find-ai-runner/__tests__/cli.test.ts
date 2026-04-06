import { execFileSync } from "node:child_process";
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { afterAll, beforeAll, describe, expect, expectTypeOf, it } from "vitest";

const CLI_PATH = resolve(import.meta.dirname, "..", "dist", "cli.js");
const VERSION_PATTERN = /^\d+\.\d+\.\d+/;
const PROVIDER_NAMES_PATTERN = /claude|gemini|codex|copilot|cursor|crush|amp|kimi|qwen|opencode|droid/i;

// Create a fake "claude" binary so detection works on CI (no real providers installed).
let fakeBinDir: string;
let fakeBinPath: string;

beforeAll(() => {
    fakeBinDir = mkdtempSync(join(tmpdir(), "find-ai-runner-test-"));
    fakeBinPath = join(fakeBinDir, "claude");
    writeFileSync(fakeBinPath, '#!/bin/sh\necho "claude-code 1.0.0"', { mode: 0o755 });
    chmodSync(fakeBinPath, 0o755);
});

afterAll(() => {
    rmSync(fakeBinDir, { force: true, recursive: true });
});

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

        return { exitCode: execError.status ?? 1, stderr: execError.stderr ?? "", stdout: execError.stdout ?? "" };
    }
};

describe("cLI", () => {
    describe("--help", () => {
        it("should print usage when called with --help", () => {
            const result = run(["--help"]);

            expect(result.exitCode).toBe(0);
            expect(result.stdout).toContain("find-ai-runner - Detect and invoke AI CLI tools");
            expect(result.stdout).toContain("Commands:");
            expect(result.stdout).toContain("list");
            expect(result.stdout).toContain("detect");
            expect(result.stdout).toContain("run");
        });

        it("should print usage when called with -h", () => {
            const result = run(["-h"]);

            expect(result.exitCode).toBe(0);
            expect(result.stdout).toContain("find-ai-runner - Detect and invoke AI CLI tools");
        });

        it("should print usage when called with no arguments", () => {
            const result = run([]);

            expect(result.exitCode).toBe(0);
            expect(result.stdout).toContain("find-ai-runner - Detect and invoke AI CLI tools");
        });
    });

    describe("--version", () => {
        it("should print version", () => {
            const result = run(["--version"]);

            expect(result.exitCode).toBe(0);
            expect(result.stdout.trim()).toMatch(VERSION_PATTERN);
        });

        it("should print version with -v flag", () => {
            const result = run(["-v"]);

            expect(result.exitCode).toBe(0);
            expect(result.stdout.trim()).toMatch(VERSION_PATTERN);
        });
    });

    describe("list", () => {
        it("should list providers", { timeout: 30_000 }, () => {
            const result = run(["list"], { CLAUDE_PATH: fakeBinPath });

            expect(result.exitCode).toBe(0);
            expect(result.stdout).toMatch(PROVIDER_NAMES_PATTERN);
        });

        it("should output JSON with --json flag", () => {
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
            const result = run(["detect", "claude"]);

            expect(result.exitCode).toBe(0);
            expect(result.stdout).toContain("claude");
        });

        it("should output JSON with --json flag", () => {
            const result = run(["detect", "claude", "--json"]);

            expect(result.exitCode).toBe(0);

            const parsed = JSON.parse(result.stdout) as { available: boolean; name: string };

            expect(parsed.name).toBe("claude");

            expectTypeOf(parsed.available).toBeBoolean();
        });

        it("should fail without provider name", () => {
            const result = run(["detect"]);

            expect(result.exitCode).toBe(1);
            expect(result.stderr).toContain("provider name required");
        });

        it("should fail with unknown provider", () => {
            const result = run(["detect", "nonexistent"]);

            expect(result.exitCode).toBe(1);
            expect(result.stderr).toContain("unknown provider");
        });
    });

    describe("run", () => {
        it("should fail without provider", () => {
            const result = run(["run"]);

            expect(result.exitCode).toBe(1);
            expect(result.stderr).toContain("provider and prompt required");
        });

        it("should fail without prompt", () => {
            const result = run(["run", "claude"]);

            expect(result.exitCode).toBe(1);
            expect(result.stderr).toContain("provider and prompt required");
        });

        it("should fail with unknown provider", () => {
            const result = run(["run", "nonexistent", "hello"]);

            expect(result.exitCode).toBe(1);
            expect(result.stderr).toContain("unknown provider");
        });
    });

    describe("args", () => {
        it("should print CLI args for a provider", () => {
            const result = run(["args", "claude", "hello world"]);

            expect(result.exitCode).toBe(0);
            expect(result.stdout.trim().length).toBeGreaterThan(0);
        });

        it("should output JSON with --json flag", () => {
            const result = run(["args", "claude", "hello world", "--json"]);

            expect(result.exitCode).toBe(0);

            const parsed = JSON.parse(result.stdout) as string[];

            expect(Array.isArray(parsed)).toBe(true);
        });

        it("should fail without provider", () => {
            const result = run(["args"]);

            expect(result.exitCode).toBe(1);
            expect(result.stderr).toContain("provider and prompt required");
        });

        it("should fail with unknown provider", () => {
            const result = run(["args", "nonexistent", "hello"]);

            expect(result.exitCode).toBe(1);
            expect(result.stderr).toContain("unknown provider");
        });
    });

    describe("unknown command", () => {
        it("should fail with unknown command", () => {
            const result = run(["foobar"]);

            expect(result.exitCode).toBe(1);
            expect(result.stderr).toContain("Unknown command: foobar");
        });
    });
});
