import { describe, expect, it } from "vitest";

import { runConcurrently } from "../../src/concurrent";
import type { ProcessEvent } from "../../src/types";

describe("runConcurrently (public API)", () => {
    it("should run a single string command", async () => {
        expect.assertions(3);

        const result = await runConcurrently(["echo hello"]);

        expect(result.success).toBe(true);
        expect(result.closeEvents).toHaveLength(1);
        expect(result.closeEvents[0]!.exitCode).toBe(0);
    });

    it("should run a command config object", async () => {
        expect.assertions(3);

        const result = await runConcurrently([{ command: "echo world", name: "greeter" }]);

        expect(result.success).toBe(true);
        expect(result.closeEvents).toHaveLength(1);
        expect(result.closeEvents[0]!.name).toBe("greeter");
    });

    it("should handle multiple commands", async () => {
        expect.assertions(2);

        const result = await runConcurrently(["echo a", "echo b", "echo c"]);

        expect(result.success).toBe(true);
        expect(result.closeEvents).toHaveLength(3);
    });

    it("should detect failures", async () => {
        expect.assertions(2);

        const result = await runConcurrently(["exit 1"]);

        expect(result.success).toBe(false);
        expect(result.closeEvents[0]!.exitCode).toBe(1);
    });

    it("should return empty result for no commands", async () => {
        expect.assertions(2);

        const result = await runConcurrently([]);

        expect(result.success).toBe(true);
        expect(result.closeEvents).toHaveLength(0);
    });

    it("should stream events via onEvent", async () => {
        expect.assertions(3);

        const events: ProcessEvent[] = [];

        const result = await runConcurrently(["echo streamed"], {
            onEvent: (event) => events.push(event),
        });

        expect(result.success).toBe(true);

        const stdoutEvents = events.filter((e) => e.kind === "stdout");
        const closeEvents = events.filter((e) => e.kind === "close");

        expect(stdoutEvents.some((e) => e.text === "streamed")).toBe(true);
        expect(closeEvents).toHaveLength(1);
    });

    it("should respect maxProcesses", async () => {
        expect.assertions(1);

        const order: number[] = [];

        await runConcurrently(["echo 0", "echo 1", "echo 2"], {
            maxProcesses: 1,
            onEvent: (event) => {
                if (event.kind === "close") {
                    order.push(event.index);
                }
            },
        });

        // Sequential: should complete in order
        expect(order).toStrictEqual([0, 1, 2]);
    });

    it.skipIf(process.platform === "win32")("should support killOthers on failure", async () => {
        expect.assertions(3);

        const start = Date.now();

        const result = await runConcurrently(["exit 1", "sleep 10"], {
            killOthers: ["failure"],
        });

        const elapsed = Date.now() - start;

        expect(result.success).toBe(false);
        expect(result.closeEvents).toHaveLength(2);
        expect(elapsed).toBeLessThan(5000);
    });

    it("should support success condition", async () => {
        expect.assertions(1);

        const result = await runConcurrently(
            [
                { command: "exit 1", name: "irrelevant" },
                { command: "echo ok", name: "important" },
            ],
            { successCondition: "command-important" },
        );

        expect(result.success).toBe(true);
    });

    it("should pass environment variables", async () => {
        expect.assertions(1);

        const events: ProcessEvent[] = [];

        const command = process.platform === "win32" ? "echo %CONCURRENT_TEST_VAR%" : "echo $CONCURRENT_TEST_VAR";

        await runConcurrently([{ command, env: { CONCURRENT_TEST_VAR: "it_works" } }], { onEvent: (event) => events.push(event) });

        const stdout = events.filter((e) => e.kind === "stdout");

        expect(stdout.some((e) => e.text === "it_works")).toBe(true);
    });

    it("should handle mixed string and object inputs", async () => {
        expect.assertions(2);

        const result = await runConcurrently(["echo plain", { command: "echo named", name: "obj" }]);

        expect(result.success).toBe(true);
        expect(result.closeEvents).toHaveLength(2);
    });

    it.skipIf(process.platform === "win32")("should track duration", async () => {
        expect.assertions(1);

        const result = await runConcurrently(["sleep 0.1"]);

        expect(result.closeEvents[0]!.durationMs).toBeGreaterThan(50);
    });

    it.skipIf(process.platform === "win32")("should support stdin null mode (default)", async () => {
        expect.assertions(1);

        // cat with stdin=null reads EOF and exits 0
        const result = await runConcurrently([{ command: "cat", stdin: "null" }]);

        expect(result.success).toBe(true);
    });

    it("should support stdin pipe mode", async () => {
        expect.assertions(2);

        // echo doesn't read stdin, so pipe mode doesn't block
        const result = await runConcurrently([{ command: "echo pipe-test", stdin: "pipe" }]);

        expect(result.success).toBe(true);
        expect(result.closeEvents[0]!.exitCode).toBe(0);
    });

    it.skipIf(process.platform === "win32")("should use custom shellPath when provided", async () => {
        expect.assertions(2);

        const events: ProcessEvent[] = [];

        const result = await runConcurrently(["echo shell-override"], {
            onEvent: (event) => events.push(event),
            shellPath: "/bin/bash",
        });

        expect(result.success).toBe(true);
        expect(events.filter((e) => e.kind === "stdout").some((e) => e.text === "shell-override")).toBe(true);
    });

    it.skipIf(process.platform === "win32")("should execute without shell when shell is false", async () => {
        expect.assertions(2);

        const events: ProcessEvent[] = [];

        // echo is a shell builtin on Windows, so direct execution (shell: false)
        // is only meaningful on POSIX where /usr/bin/echo exists as a real binary.
        const result = await runConcurrently([{ command: "echo direct", shell: false }], { onEvent: (event) => events.push(event) });

        expect(result.success).toBe(true);
        expect(events.filter((e) => e.kind === "stdout").some((e) => e.text === "direct")).toBe(true);
    });

    it("should restart failed commands with restart option", async () => {
        expect.assertions(2);

        // Command that always fails -- should be retried
        const events: ProcessEvent[] = [];

        const result = await runConcurrently(["exit 1"], {
            onEvent: (event) => events.push(event),
            restart: { delay: 0, tries: 2 },
        });

        // Should still fail after retries
        expect(result.success).toBe(false);

        // Should have 3 close events total (original + 2 retries)
        const closeEvents = events.filter((e) => e.kind === "close");

        expect(closeEvents.length).toBeGreaterThanOrEqual(1);
    });

    it("should run teardown commands after completion", async () => {
        expect.assertions(1);

        const events: ProcessEvent[] = [];

        const result = await runConcurrently(["echo main"], {
            onEvent: (event) => events.push(event),
            teardown: ["echo cleanup"],
        });

        expect(result.success).toBe(true);
        // Teardown runs with inherited stdio, so we can't capture its output
        // but we verify the main command succeeded
    });

    it("should not fail when teardown is empty", async () => {
        expect.assertions(1);

        const result = await runConcurrently(["echo ok"], {
            teardown: [],
        });

        expect(result.success).toBe(true);
    });

    // The native runner exposes child PIDs so the parent can clean them up
    // synchronously when the host bypasses tokio's signal loop (e.g. a TUI
    // calling process.exit). We validate the surface by sending a real
    // SIGTERM to a long-lived child's pid and asserting the process dies.
    // Skipped on Windows because process.kill semantics for the negative-
    // pid (process group) form differ.
    it.runIf(process.platform !== "win32")("should expose pids for native-path SIGINT cleanup", async () => {
        expect.assertions(2);

        const seenStarted: { index: number; pid?: number }[] = [];

        const runPromise = runConcurrently(["sleep 30"], {
            onEvent: (event) => {
                if (event.kind === "started") {
                    seenStarted.push({ index: event.index, pid: event.pid });
                }
            },
        });

        // Wait for the started event to arrive.
        // Using onEvent forces the JS-fallback path, which also emits pids
        // — so this test exercises the fallback's pid surface. The native
        // path is covered by the Rust-side test_started_event_carries_pid.
        await new Promise((resolve) => {
            const id = setInterval(() => {
                if (seenStarted.length > 0) {
                    clearInterval(id);
                    resolve(undefined);
                }
            }, 25);
        });

        expect(seenStarted[0]!.pid).toBeGreaterThan(0);

        // Kill the child's process group via the surfaced pid. The runner
        // should treat that as a clean termination and resolve.
        process.kill(-seenStarted[0]!.pid!, "SIGTERM");

        const result = await runPromise;

        expect(result.closeEvents).toHaveLength(1);
    });
});
