/* eslint-disable unicorn/prefer-event-target -- the real child process exposes the EventEmitter .on/.emit API */
import type { ChildProcessWithoutNullStreams, spawn as nodeSpawn } from "node:child_process";
import { spawn } from "node:child_process";
import { EventEmitter } from "node:events";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AiProviderInfo } from "../src/index";
import { AiRunError, runProvider } from "../src/index";

vi.mock(import("node:child_process"), () => {
    return {
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

describe("runProvider extended", () => {
    let child: FakeChild;

    beforeEach(() => {
        child = new FakeChild();
        mockSpawn.mockReturnValue(child as unknown as ChildProcessWithoutNullStreams);
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it("should include exit code and duration on a clean exit", async () => {
        expect.assertions(2);

        const promise = runProvider(availableProvider, "hi");

        child.emit("close", 0);

        const result = await promise;

        expect(result.exitCode).toBe(0);
        expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    it("should forward cwd and merged env to spawn", async () => {
        expect.assertions(3);

        const promise = runProvider(availableProvider, "hi", { cwd: "/work/repo", env: { MY_API_KEY: "secret" } });

        child.emit("close", 0);

        await promise;

        const spawnOptions = mockSpawn.mock.calls[0]?.[2];

        expect(spawnOptions?.cwd).toBe("/work/repo");
        expect(spawnOptions?.env).toMatchObject({ MY_API_KEY: "secret" });
        // The color sanitizers still win over caller env.
        expect(spawnOptions?.env).toMatchObject({ NO_COLOR: "1" });
    });

    it("should stream stdout and stderr chunks to callbacks", async () => {
        expect.assertions(2);

        const stdoutChunks: string[] = [];
        const stderrChunks: string[] = [];

        const promise = runProvider(availableProvider, "hi", {
            onStderr: (chunk) => stderrChunks.push(chunk),
            onStdout: (chunk) => stdoutChunks.push(chunk),
        });

        child.stdout.emit("data", Buffer.from("one "));
        child.stdout.emit("data", Buffer.from("two"));
        child.stderr.emit("data", Buffer.from("warn"));
        child.emit("close", 0);

        await promise;

        expect(stdoutChunks).toStrictEqual(["one ", "two"]);
        expect(stderrChunks).toStrictEqual(["warn"]);
    });

    it("should reject with an AiRunError carrying partial output on non-zero exit", async () => {
        expect.assertions(4);

        const promise = runProvider(availableProvider, "hi");

        child.stdout.emit("data", Buffer.from("partial stdout"));
        child.stderr.emit("data", Buffer.from("boom"));
        child.emit("close", 3);

        const error = await promise.catch((error_: unknown) => error_ as AiRunError);

        expect(error).toBeInstanceOf(AiRunError);
        expect(error.exitCode).toBe(3);
        expect(error.stdout).toBe("partial stdout");
        expect(error.stderr).toBe("boom");
    });

    it("should fail fast on an already-aborted signal without spawning", async () => {
        expect.assertions(3);

        const controller = new AbortController();

        controller.abort();

        const error = await runProvider(availableProvider, "hi", { signal: controller.signal }).catch((error_: unknown) => error_ as AiRunError);

        expect(error).toBeInstanceOf(AiRunError);
        expect(error.aborted).toBe(true);
        expect(mockSpawn).not.toHaveBeenCalled();
    });

    it("should abort an in-flight run when the signal fires", async () => {
        expect.assertions(3);

        const controller = new AbortController();

        const promise = runProvider(availableProvider, "hi", { signal: controller.signal });

        child.stdout.emit("data", Buffer.from("so far"));
        controller.abort();

        const error = await promise.catch((error_: unknown) => error_ as AiRunError);

        expect(error.aborted).toBe(true);
        expect(error.stdout).toBe("so far");
        expect(child.killed).toBe("SIGTERM");
    });
});
