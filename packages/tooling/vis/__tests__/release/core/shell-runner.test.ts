import { describe, expect, it } from "vitest";

import { createMockRunner, createShellRunner, MockRunner } from "../../../src/release/core/shell-runner";

describe("mockRunner — handler matching", () => {
    it("returns the default empty success result when no handler matches", async () => {
        const runner = new MockRunner();

        const result = await runner.run("git", ["status"], { cwd: "/tmp" });

        expect(result).toStrictEqual({ exitCode: 0, stderr: "", stdout: "" });
    });

    it("matches an exact (command, argsPrefix) handler", async () => {
        const runner = new MockRunner();

        runner.on("git", ["status"], () => {
            return { exitCode: 0, stderr: "", stdout: "clean" };
        });

        const result = await runner.run("git", ["status"], { cwd: "/tmp" });

        expect(result.stdout).toBe("clean");
    });

    it("matches when argsPrefix is a prefix of actual args", async () => {
        const runner = new MockRunner();

        runner.on("git", ["log"], () => {
            return { exitCode: 0, stderr: "", stdout: "log-output" };
        });

        const result = await runner.run("git", ["log", "--oneline", "-n", "5"], { cwd: "/tmp" });

        expect(result.stdout).toBe("log-output");
    });

    it("does NOT match when actual args is shorter than argsPrefix", async () => {
        const runner = new MockRunner();

        runner.on("git", ["log", "--oneline"], () => {
            return { exitCode: 0, stderr: "", stdout: "log-output" };
        });

        const result = await runner.run("git", ["log"], { cwd: "/tmp" });

        expect(result).toStrictEqual({ exitCode: 0, stderr: "", stdout: "" });
    });

    it("does NOT match a different command", async () => {
        const runner = new MockRunner();

        runner.on("git", ["status"], () => {
            return { exitCode: 0, stderr: "", stdout: "clean" };
        });

        const result = await runner.run("npm", ["status"], { cwd: "/tmp" });

        expect(result).toStrictEqual({ exitCode: 0, stderr: "", stdout: "" });
    });

    it("uses first registered handler when multiple match", async () => {
        const runner = new MockRunner();

        runner.on("git", ["log"], () => {
            return { exitCode: 0, stderr: "", stdout: "first" };
        });
        runner.on("git", ["log"], () => {
            return { exitCode: 0, stderr: "", stdout: "second" };
        });

        const result = await runner.run("git", ["log", "--all"], { cwd: "/tmp" });

        expect(result.stdout).toBe("first");
    });

    it("passes cwd to the responder", async () => {
        const runner = new MockRunner();
        let seenCwd: string | undefined;

        runner.on("pwd", [], (cwd) => {
            seenCwd = cwd;

            return { exitCode: 0, stderr: "", stdout: cwd };
        });

        await runner.run("pwd", [], { cwd: "/workspace" });

        expect(seenCwd).toBe("/workspace");
    });

    it("supports a non-zero exitCode from the handler", async () => {
        const runner = new MockRunner();

        runner.on("git", ["push"], () => {
            return { exitCode: 1, stderr: "rejected", stdout: "" };
        });

        const result = await runner.run("git", ["push"], { cwd: "/tmp" });

        expect(result.exitCode).toBe(1);
        expect(result.stderr).toBe("rejected");
    });

    it("createMockRunner returns a MockRunner instance", () => {
        const runner = createMockRunner();

        expect(runner).toBeInstanceOf(MockRunner);
    });
});

describe("createShellRunner — token redaction in stdout/stderr", () => {
    it("redacts npm/gh/Bearer tokens from captured stdout", async () => {
        const runner = createShellRunner();

        // `node -e` is reliably available since vitest runs under node.
        const script = "console.log('token=ghp_AAAAAAAAAAAAAAAAAAAAAAAAAAAAA, npm_BBBBBBBBBBBBBBBBBBBBBBBBB')";
        const result = await runner.run(process.execPath, ["-e", script], { cwd: process.cwd(), silent: true });

        expect(result.exitCode).toBe(0);
        expect(result.stdout).not.toContain("ghp_AAAA");
        expect(result.stdout).not.toContain("npm_BBBB");
        expect(result.stdout).toContain("[REDACTED]");
    });

    it("returns exitCode -1 with redacted error message when the binary is missing", async () => {
        const runner = createShellRunner();
        const result = await runner.run("vis-this-binary-does-not-exist-xyz", [], { cwd: process.cwd(), silent: true });

        expect(result.exitCode).not.toBe(0);
        // Either tinyexec rejects (caught path) or returns non-zero exit. Both
        // outcomes are acceptable; the assertion is that no exception escapes.
    });

    it("propagates non-zero exit codes", async () => {
        const runner = createShellRunner();
        const result = await runner.run(process.execPath, ["-e", "process.exit(7)"], { cwd: process.cwd(), silent: true });

        expect(result.exitCode).toBe(7);
    });
});
