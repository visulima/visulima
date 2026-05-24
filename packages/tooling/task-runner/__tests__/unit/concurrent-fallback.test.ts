import { describe, expect, expectTypeOf, it } from "vitest";

import { runConcurrentFallback } from "../../src/concurrent-fallback";
import type { ConcurrentCommandConfig, ProcessEvent } from "../../src/types";

// Bun's child_process kill semantics differ from Node — the killTimeout
// path doesn't propagate SIGTERM to the sleep subprocess fast enough,
// so the "kill others on failure" test exceeds its 5s budget.
const isBun = (globalThis as { Bun?: unknown }).Bun !== undefined;

const makeConfig = (command: string, name?: string): ConcurrentCommandConfig => {
    return {
        command,
        name,
    };
};

describe(runConcurrentFallback, () => {
    it("should run a single echo command", async () => {
        expect.assertions(4);

        const result = await runConcurrentFallback([makeConfig("echo hello", "greeter")], {});

        expect(result.success).toBe(true);
        expect(result.closeEvents).toHaveLength(1);
        expect(result.closeEvents[0]!.exitCode).toBe(0);
        expect(result.closeEvents[0]!.name).toBe("greeter");
    });

    it("should run multiple commands", async () => {
        expect.assertions(2);

        const result = await runConcurrentFallback([makeConfig("echo one"), makeConfig("echo two"), makeConfig("echo three")], {});

        expect(result.success).toBe(true);
        expect(result.closeEvents).toHaveLength(3);
    });

    it("should detect failing commands", async () => {
        expect.assertions(3);

        const result = await runConcurrentFallback([makeConfig("exit 42")], {});

        expect(result.success).toBe(false);
        expect(result.closeEvents).toHaveLength(1);
        expect(result.closeEvents[0]!.exitCode).toBe(42);
    });

    it("should handle mixed success and failure", async () => {
        expect.assertions(2);

        const result = await runConcurrentFallback([makeConfig("echo ok"), makeConfig("exit 1")], {});

        expect(result.success).toBe(false);
        expect(result.closeEvents).toHaveLength(2);
    });

    it("should handle empty commands", async () => {
        expect.assertions(2);

        const result = await runConcurrentFallback([], {});

        expect(result.success).toBe(true);
        expect(result.closeEvents).toHaveLength(0);
    });

    it("should stream events via onEvent callback", async () => {
        expect.assertions(4);

        const events: ProcessEvent[] = [];

        const result = await runConcurrentFallback([makeConfig("echo hello")], {
            onEvent: (event) => events.push(event),
        });

        expect(result.success).toBe(true);

        const stdoutEvents = events.filter((e) => e.kind === "stdout");
        const closeEvents = events.filter((e) => e.kind === "close");

        expect(stdoutEvents.length).toBeGreaterThanOrEqual(1);
        expect(stdoutEvents.some((e) => e.text === "hello")).toBe(true);
        expect(closeEvents).toHaveLength(1);
    });

    it("should respect maxProcesses for sequential execution", async () => {
        expect.assertions(1);

        const completionOrder: number[] = [];

        await runConcurrentFallback([makeConfig("echo one"), makeConfig("echo two"), makeConfig("echo three")], {
            maxProcesses: 1,
            onEvent: (event) => {
                if (event.kind === "close") {
                    completionOrder.push(event.index);
                }
            },
        });

        // With maxProcesses=1, should complete in order
        expect(completionOrder).toStrictEqual([0, 1, 2]);
    });

    it.skipIf(process.platform === "win32")("should support success condition 'first'", async () => {
        expect.assertions(1);

        const result = await runConcurrentFallback([makeConfig("echo ok"), makeConfig("sleep 0.1 && exit 1")], { successCondition: "first" });

        // First to complete is "echo ok" (instant)
        expect(result.success).toBe(true);
    });

    it.skipIf(process.platform === "win32" || isBun)("should kill others on failure", async () => {
        expect.assertions(3);

        const start = Date.now();

        const result = await runConcurrentFallback([makeConfig("exit 1"), makeConfig("sleep 10")], { killOthers: ["failure"], killTimeout: 1000 });

        const elapsed = Date.now() - start;

        expect(result.success).toBe(false);
        expect(result.closeEvents).toHaveLength(2);
        // Should complete much faster than 10 seconds
        expect(elapsed).toBeLessThan(5000);
    });

    it("should capture stderr output", async () => {
        expect.assertions(1);

        const events: ProcessEvent[] = [];

        // cmd.exe's `echo error >&2` emits "error " (note the trailing
        // space — cmd includes the whitespace before `>` in the echo
        // argument). Trim before comparing so the assertion checks the
        // capture pipeline rather than echo's whitespace quirks.
        await runConcurrentFallback([makeConfig("echo error >&2")], {
            onEvent: (event) => events.push(event),
        });

        const stderrEvents = events.filter((e) => e.kind === "stderr");

        expect(stderrEvents.some((e) => e.text.trim() === "error")).toBe(true);
    });

    it("should pass environment variables to child processes", async () => {
        expect.assertions(1);

        const events: ProcessEvent[] = [];

        const command = process.platform === "win32" ? "echo %MY_TEST_VAR%" : "echo $MY_TEST_VAR";

        await runConcurrentFallback([{ command, env: { MY_TEST_VAR: "hello_test" } }], { onEvent: (event) => events.push(event) });

        const stdoutEvents = events.filter((e) => e.kind === "stdout");

        expect(stdoutEvents.some((e) => e.text === "hello_test")).toBe(true);
    });

    it.skipIf(process.platform === "win32")("should track duration in close events", async () => {
        expect.assertions(1);

        const result = await runConcurrentFallback([makeConfig("sleep 0.1")], {});

        expect(result.closeEvents[0]!.durationMs).toBeGreaterThan(50);
    });

    it("should handle success condition 'command-<name>'", async () => {
        expect.assertions(1);

        const result = await runConcurrentFallback([makeConfig("exit 1", "irrelevant"), makeConfig("echo ok", "important")], {
            successCondition: "command-important",
        });

        expect(result.success).toBe(true);
    });

    it.skipIf(process.platform === "win32")("should execute directly when shell is false", async () => {
        expect.assertions(2);

        const events: ProcessEvent[] = [];

        // echo is a shell builtin on Windows; direct execution (shell: false)
        // is only meaningful on POSIX where /usr/bin/echo exists as a binary.
        const result = await runConcurrentFallback([{ command: "echo hello", shell: false }], { onEvent: (event) => events.push(event) });

        expect(result.success).toBe(true);

        const stdout = events.filter((e) => e.kind === "stdout");

        expect(stdout.some((e) => e.text === "hello")).toBe(true);
    });

    it("should report stdout lines before close events", async () => {
        expect.assertions(1);

        const events: ProcessEvent[] = [];

        await runConcurrentFallback([makeConfig("echo line1 && echo line2 && echo line3")], {
            onEvent: (event) => events.push(event),
        });

        const closeIndex = events.findIndex((e) => e.kind === "close");
        const lastStdoutIndex = events.findLastIndex((e) => e.kind === "stdout");

        // Every stdout event must precede the close event — asserting the
        // max index is strictly less than closeIndex covers all of them in
        // a single expectation (compatible with expect.assertions(1)).
        expect(lastStdoutIndex).toBeLessThan(closeIndex);
    });

    it("should emit 'started' event with write function for pipe mode", async () => {
        expect.assertions(2);

        const events: ProcessEvent[] = [];

        await runConcurrentFallback([{ command: "echo pipe-test", stdin: "pipe" }], {
            onEvent: (event) => events.push(event),
        });

        const startedEvents = events.filter((e) => e.kind === "started");

        expect(startedEvents).toHaveLength(1);

        expectTypeOf(startedEvents[0]!.write).toBeFunction();

        expect(startedEvents[0]!.resize).toBeUndefined();
    });

    it("should emit 'started' event with write and resize for PTY mode", async () => {
        expect.assertions(1);

        const events: ProcessEvent[] = [];

        await runConcurrentFallback([{ command: "echo pty-test", stdin: "pty" }], {
            onEvent: (event) => events.push(event),
        });

        const startedEvents = events.filter((e) => e.kind === "started");

        expect(startedEvents).toHaveLength(1);

        expectTypeOf(startedEvents[0]!.write).toBeFunction();
        expectTypeOf(startedEvents[0]!.resize).toBeFunction();
    });

    it("should run PTY commands and capture output", async () => {
        expect.assertions(2);

        const events: ProcessEvent[] = [];

        const result = await runConcurrentFallback([{ command: "echo pty-hello", stdin: "pty" }], {
            onEvent: (event) => events.push(event),
        });

        expect(result.success).toBe(true);

        const stdoutEvents = events.filter((e) => e.kind === "stdout");

        expect(stdoutEvents.some((e) => e.text?.includes("pty-hello"))).toBe(true);
    });

    it.skipIf(process.platform === "win32")("should flush partial lines after 100ms timeout", async () => {
        expect.assertions(1);

        const events: ProcessEvent[] = [];

        // printf writes without trailing newline — should be flushed by timer.
        // printf is POSIX-only; cmd.exe `echo` always appends CRLF, so this
        // test is platform-gated.
        await runConcurrentFallback([makeConfig("printf 'no-newline'")], {
            onEvent: (event) => events.push(event),
        });

        const stdoutEvents = events.filter((e) => e.kind === "stdout");

        expect(stdoutEvents.some((e) => e.text === "no-newline")).toBe(true);
    });

    it.skipIf(process.platform === "win32")("should handle PTY with interactive read prompt", async () => {
        expect.assertions(3);

        const events: ProcessEvent[] = [];

        const result = await runConcurrentFallback([{ command: 'read -p "Name: " name && echo "Got: $name"', stdin: "pty" }], {
            onEvent: (event) => {
                events.push(event);

                if (event.kind === "started" && event.write) {
                    // Wait for prompt to appear, then send input
                    setTimeout(event.write, 500, "Alice\r");
                }
            },
        });

        expect(result.success).toBe(true);

        const stdoutText = events
            .filter((e) => e.kind === "stdout")
            .map((e) => e.text)
            .join("");

        expect(stdoutText).toContain("Name:");
        expect(stdoutText).toContain("Got: Alice");
    }, 10_000);

    it.skipIf(process.platform === "win32")("should kill PTY processes in killAll", async () => {
        expect.assertions(3);

        const start = Date.now();

        const result = await runConcurrentFallback(
            [
                { command: "exit 1", name: "failer", stdin: "pty" },
                { command: "sleep 30", name: "sleeper", stdin: "pty" },
            ],
            { killOthers: ["failure"] },
        );

        const elapsed = Date.now() - start;

        expect(result.success).toBe(false);
        expect(result.closeEvents).toHaveLength(2);
        expect(elapsed).toBeLessThan(10_000);
    }, 15_000);
});
