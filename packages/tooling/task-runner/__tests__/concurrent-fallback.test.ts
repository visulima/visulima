import { describe, expect, expectTypeOf, it } from "vitest";

import { runConcurrentFallback } from "../src/concurrent-fallback";
import type { ConcurrentCommandConfig, ProcessEvent } from "../src/types";

const makeConfig = (command: string, name?: string): ConcurrentCommandConfig => {
    return {
        command,
        name,
    };
};

describe(runConcurrentFallback, () => {
    it("should run a single echo command", async () => {
        const result = await runConcurrentFallback([makeConfig("echo hello", "greeter")], {});

        expect(result.success).toBe(true);
        expect(result.closeEvents).toHaveLength(1);
        expect(result.closeEvents[0]!.exitCode).toBe(0);
        expect(result.closeEvents[0]!.name).toBe("greeter");
    });

    it("should run multiple commands", async () => {
        const result = await runConcurrentFallback([makeConfig("echo one"), makeConfig("echo two"), makeConfig("echo three")], {});

        expect(result.success).toBe(true);
        expect(result.closeEvents).toHaveLength(3);
    });

    it("should detect failing commands", async () => {
        const result = await runConcurrentFallback([makeConfig("exit 42")], {});

        expect(result.success).toBe(false);
        expect(result.closeEvents).toHaveLength(1);
        expect(result.closeEvents[0]!.exitCode).toBe(42);
    });

    it("should handle mixed success and failure", async () => {
        const result = await runConcurrentFallback([makeConfig("echo ok"), makeConfig("exit 1")], {});

        expect(result.success).toBe(false);
        expect(result.closeEvents).toHaveLength(2);
    });

    it("should handle empty commands", async () => {
        const result = await runConcurrentFallback([], {});

        expect(result.success).toBe(true);
        expect(result.closeEvents).toHaveLength(0);
    });

    it("should stream events via onEvent callback", async () => {
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
        expect(completionOrder).toEqual([0, 1, 2]);
    });

    it("should support success condition 'first'", async () => {
        const result = await runConcurrentFallback([makeConfig("echo ok"), makeConfig("sleep 0.1 && exit 1")], { successCondition: "first" });

        // First to complete is "echo ok" (instant)
        expect(result.success).toBe(true);
    });

    it("should kill others on failure", async () => {
        const start = Date.now();

        const result = await runConcurrentFallback([makeConfig("exit 1"), makeConfig("sleep 10")], { killOthers: ["failure"], killTimeout: 1000 });

        const elapsed = Date.now() - start;

        expect(result.success).toBe(false);
        expect(result.closeEvents).toHaveLength(2);
        // Should complete much faster than 10 seconds
        expect(elapsed).toBeLessThan(5000);
    });

    it("should capture stderr output", async () => {
        const events: ProcessEvent[] = [];

        await runConcurrentFallback([makeConfig("echo error >&2")], {
            onEvent: (event) => events.push(event),
        });

        const stderrEvents = events.filter((e) => e.kind === "stderr");

        expect(stderrEvents.some((e) => e.text === "error")).toBe(true);
    });

    it("should pass environment variables to child processes", async () => {
        const events: ProcessEvent[] = [];

        await runConcurrentFallback([{ command: "echo $MY_TEST_VAR", env: { MY_TEST_VAR: "hello_test" } }], { onEvent: (event) => events.push(event) });

        const stdoutEvents = events.filter((e) => e.kind === "stdout");

        expect(stdoutEvents.some((e) => e.text === "hello_test")).toBe(true);
    });

    it("should track duration in close events", async () => {
        const result = await runConcurrentFallback([makeConfig("sleep 0.1")], {});

        expect(result.closeEvents[0]!.durationMs).toBeGreaterThan(50);
    });

    it("should handle success condition 'command-<name>'", async () => {
        const result = await runConcurrentFallback([makeConfig("exit 1", "irrelevant"), makeConfig("echo ok", "important")], {
            successCondition: "command-important",
        });

        expect(result.success).toBe(true);
    });

    it("should execute directly when shell is false", async () => {
        const events: ProcessEvent[] = [];

        const result = await runConcurrentFallback([{ command: "echo hello", shell: false }], { onEvent: (event) => events.push(event) });

        expect(result.success).toBe(true);

        const stdout = events.filter((e) => e.kind === "stdout");

        expect(stdout.some((e) => e.text === "hello")).toBe(true);
    });

    it("should report stdout lines before close events", async () => {
        const events: ProcessEvent[] = [];

        await runConcurrentFallback([makeConfig("echo line1 && echo line2 && echo line3")], {
            onEvent: (event) => events.push(event),
        });

        const closeIndex = events.findIndex((e) => e.kind === "close");
        const stdoutIndices = events.map((e, i) => (e.kind === "stdout" ? i : -1)).filter((i) => i >= 0);

        // All stdout events should come before the close event
        for (const index of stdoutIndices) {
            expect(index).toBeLessThan(closeIndex);
        }
    });

    it("should emit 'started' event with write function for pipe mode", async () => {
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
        const events: ProcessEvent[] = [];

        const result = await runConcurrentFallback([{ command: "echo pty-hello", stdin: "pty" }], {
            onEvent: (event) => events.push(event),
        });

        expect(result.success).toBe(true);

        const stdoutEvents = events.filter((e) => e.kind === "stdout");

        expect(stdoutEvents.some((e) => e.text?.includes("pty-hello"))).toBe(true);
    });

    it("should flush partial lines after 100ms timeout", async () => {
        const events: ProcessEvent[] = [];

        // printf writes without trailing newline — should be flushed by timer
        await runConcurrentFallback([makeConfig("printf 'no-newline'")], {
            onEvent: (event) => events.push(event),
        });

        const stdoutEvents = events.filter((e) => e.kind === "stdout");

        expect(stdoutEvents.some((e) => e.text === "no-newline")).toBe(true);
    });

    it("should handle PTY with interactive read prompt", async () => {
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

    it("should kill PTY processes in killAll", async () => {
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
