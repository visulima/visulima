/* eslint-disable unicorn/prefer-event-target -- the real child process exposes the EventEmitter .on/.emit API */
import type { ChildProcessWithoutNullStreams, spawn as nodeSpawn } from "node:child_process";
import { spawn } from "node:child_process";
import { EventEmitter } from "node:events";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AiProviderInfo } from "../src/index";
import { runProvider } from "../src/index";

vi.mock(import("node:child_process"), () => {
    return {
        execFile: vi.fn<typeof import("node:child_process").execFile>(),
        execFileSync: vi.fn<typeof import("node:child_process").execFileSync>(),
        spawn: vi.fn<typeof nodeSpawn>(),
    };
});

const mockSpawn = vi.mocked(spawn);

/** Minimal in-memory stand-in for a spawned child process. */
class FakeChild extends EventEmitter {
    public killed: string | undefined;

    public readonly stderr = new EventEmitter();

    public readonly stdin = { end: vi.fn<() => void>() };

    public readonly stdout = new EventEmitter();

    public kill(signal: string): boolean {
        this.killed = signal;

        return true;
    }
}

const availableProvider: AiProviderInfo = {
    available: true,
    name: "claude",
    path: "/usr/local/bin/claude",
};

describe(runProvider, () => {
    let child: FakeChild;

    beforeEach(() => {
        vi.useFakeTimers();
        child = new FakeChild();
        mockSpawn.mockReturnValue(child as unknown as ChildProcessWithoutNullStreams);
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.clearAllMocks();
    });

    it("should resolve with stdout and stderr on a clean exit", async () => {
        expect.assertions(4);

        const promise = runProvider(availableProvider, "hello");

        child.stdout.emit("data", Buffer.from("partial "));
        child.stdout.emit("data", Buffer.from("output"));
        child.stderr.emit("data", Buffer.from("a warning"));
        child.emit("close", 0);

        const result = await promise;

        expect(result.provider).toBe("claude");
        expect(result.stdout).toBe("partial output");
        expect(result.stderr).toBe("a warning");
        expect(child.stdin.end).toHaveBeenCalledWith();
    });

    it("should close stdin immediately and sanitize the environment", async () => {
        expect.assertions(3);

        const promise = runProvider(availableProvider, "hello");

        child.emit("close", 0);

        await promise;

        expect(mockSpawn).toHaveBeenCalledTimes(1);

        const [command, , spawnOptions] = mockSpawn.mock.calls[0] ?? [];

        expect(command).toBe("/usr/local/bin/claude");
        expect(spawnOptions?.env).toMatchObject({ FORCE_COLOR: "0", NO_COLOR: "1" });
    });

    it("should reject when the CLI exits with a non-zero code", async () => {
        expect.assertions(1);

        const promise = runProvider(availableProvider, "hello");

        child.stderr.emit("data", Buffer.from("boom"));
        child.emit("close", 2);

        await expect(promise).rejects.toThrow("claude CLI exited with code 2: boom");
    });

    it("should fall back to stdout in the error message when stderr is empty", async () => {
        expect.assertions(1);

        const promise = runProvider(availableProvider, "hello");

        child.stdout.emit("data", Buffer.from("only stdout"));
        child.emit("close", 1);

        await expect(promise).rejects.toThrow("claude CLI exited with code 1: only stdout");
    });

    it("should reject when the process emits an error", async () => {
        expect.assertions(1);

        const promise = runProvider(availableProvider, "hello");

        child.emit("error", new Error("ENOENT"));

        await expect(promise).rejects.toThrow("Failed to spawn claude CLI: ENOENT");
    });

    it("should reject and kill the child when the run times out", async () => {
        expect.assertions(2);

        const promise = runProvider(availableProvider, "hello", { timeoutMs: 1000 });

        // The timer callback fires synchronously and rejects the promise.
        vi.advanceTimersByTime(1000);

        await expect(promise).rejects.toThrow("claude CLI timed out after 1000ms");

        expect(child.killed).toBe("SIGTERM");
    });

    it("should escalate to SIGKILL when the child ignores SIGTERM after a timeout", async () => {
        expect.assertions(2);

        const promise = runProvider(availableProvider, "hello", { timeoutMs: 1000 });

        vi.advanceTimersByTime(1000);

        await expect(promise).rejects.toThrow("timed out");

        // The child ignores SIGTERM (never emits close); the 5s escalation must force-kill it.
        vi.advanceTimersByTime(5000);

        expect(child.killed).toBe("SIGKILL");
    });

    it("should decode multi-byte characters split across stdout chunks without corruption", async () => {
        expect.assertions(2);

        const promise = runProvider(availableProvider, "hello");

        // "é" is 0xC3 0xA9; "文" is 0xE6 0x96 0x87. Split each sequence across chunk boundaries.
        child.stdout.emit("data", Buffer.from([0xc3]));
        child.stdout.emit("data", Buffer.from([0xa9]));
        child.stdout.emit("data", Buffer.from([0xe6, 0x96]));
        child.stdout.emit("data", Buffer.from([0x87]));
        child.emit("close", 0);

        const result = await promise;

        expect(result.stdout).toBe("é文");
        expect(result.stdout).not.toContain("�");
    });

    it("should stream decoded chunks to onStdout without partial-sequence replacement characters", async () => {
        expect.assertions(1);

        const chunks: string[] = [];
        const promise = runProvider(availableProvider, "hello", { onStdout: (chunk) => chunks.push(chunk) });

        child.stdout.emit("data", Buffer.from([0xc3]));
        child.stdout.emit("data", Buffer.from([0xa9]));
        child.emit("close", 0);

        await promise;

        // The lone lead byte yields no callback; the completed code point streams once, intact.
        expect(chunks.join("")).toBe("é");
    });

    it("should ignore a close event that arrives after a timeout", async () => {
        expect.assertions(1);

        const promise = runProvider(availableProvider, "hello", { timeoutMs: 500 });

        vi.advanceTimersByTime(500);
        // A late close should not resolve the already-rejected promise.
        child.emit("close", 0);

        await expect(promise).rejects.toThrow("timed out");
    });

    it("should ignore an error event that arrives after a timeout", async () => {
        expect.assertions(1);

        const promise = runProvider(availableProvider, "hello", { timeoutMs: 500 });

        vi.advanceTimersByTime(500);
        // A late error should not produce a second rejection.
        child.emit("error", new Error("late"));

        await expect(promise).rejects.toThrow("timed out");
    });

    it("should reject without spawning when the provider is unavailable", async () => {
        expect.assertions(2);

        const promise = runProvider({ available: false, name: "claude" }, "hello");

        await expect(promise).rejects.toThrow("not available");

        expect(mockSpawn).not.toHaveBeenCalled();
    });

    it("should reject without spawning when the provider has no path", async () => {
        expect.assertions(2);

        const promise = runProvider({ available: true, name: "claude" }, "hello");

        await expect(promise).rejects.toThrow("not available");

        expect(mockSpawn).not.toHaveBeenCalled();
    });
});
