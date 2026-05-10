import { PassThrough } from "node:stream";

import { describe, expect, it } from "vitest";

import { runConcurrentFallback } from "../../../src/concurrent-fallback";
import { createInputHandler } from "../../../src/flow-controllers/input-handler";
import { formatTimingTable } from "../../../src/flow-controllers/log-timings";
import { withRestart } from "../../../src/flow-controllers/restart-process";
import { runTeardown } from "../../../src/flow-controllers/teardown";
import type { ConcurrentCloseEvent } from "../../../src/types";

describe(formatTimingTable, () => {
    const makeEvent = (index: number, name: string, exitCode: number, durationMs: number): ConcurrentCloseEvent => {
        return {
            command: `echo ${name}`,
            durationMs,
            exitCode,
            index,
            killed: false,
            name,
        };
    };

    it("should format a single command", () => {
        expect.assertions(3);

        const table = formatTimingTable([makeEvent(0, "build", 0, 1234)]);

        expect(table).toContain("build");
        expect(table).toContain("1.2s");
        expect(table).toContain("0");
    });

    it("should sort by duration descending", () => {
        expect.assertions(3);

        const events = [makeEvent(0, "fast", 0, 100), makeEvent(1, "slow", 0, 5000), makeEvent(2, "medium", 0, 1000)];

        const table = formatTimingTable(events);
        const lines = table.split("\n");

        // Skip header and separator (first 2 lines)
        const dataLines = lines.slice(2);

        expect(dataLines[0]).toContain("slow");
        expect(dataLines[1]).toContain("medium");
        expect(dataLines[2]).toContain("fast");
    });

    it("should show killed status", () => {
        expect.assertions(1);

        const event: ConcurrentCloseEvent = {
            command: "sleep 10",
            durationMs: 500,
            exitCode: -9,
            index: 0,
            killed: true,
            name: "long",
        };

        const table = formatTimingTable([event]);

        expect(table).toContain("yes");
    });

    it("should return empty string for no events", () => {
        expect.assertions(1);

        expect(formatTimingTable([])).toBe("");
    });

    it("should truncate long commands", () => {
        expect.assertions(1);

        const event = makeEvent(0, "x", 0, 100);

        event.command = "a".repeat(50);

        const table = formatTimingTable([event]);

        expect(table).toContain("\u2026"); // ellipsis
    });

    it("should format millisecond durations", () => {
        expect.assertions(1);

        const table = formatTimingTable([makeEvent(0, "quick", 0, 42)]);

        expect(table).toContain("42ms");
    });

    it("should format minute durations", () => {
        expect.assertions(1);

        const table = formatTimingTable([makeEvent(0, "long", 0, 90_000)]);

        expect(table).toContain("1m");
    });
});

describe(createInputHandler, () => {
    it("should route unprefixed input to default target", () => {
        expect.assertions(1);

        const stdin0 = new PassThrough();
        const inputStream = new PassThrough();
        const chunks: string[] = [];

        stdin0.on("data", (data: Buffer) => chunks.push(data.toString()));

        const cleanup = createInputHandler([{ index: 0, name: "server", stdin: stdin0 }], { defaultTarget: 0, inputStream });

        inputStream.write("hello\n");

        expect(chunks).toStrictEqual(["hello\n"]);

        cleanup();
    });

    it("should route prefixed input by name", () => {
        expect.assertions(2);

        const stdin0 = new PassThrough();
        const stdin1 = new PassThrough();
        const inputStream = new PassThrough();
        const chunks0: string[] = [];
        const chunks1: string[] = [];

        stdin0.on("data", (data: Buffer) => chunks0.push(data.toString()));
        stdin1.on("data", (data: Buffer) => chunks1.push(data.toString()));

        const cleanup = createInputHandler(
            [
                { index: 0, name: "server", stdin: stdin0 },
                { index: 1, name: "client", stdin: stdin1 },
            ],
            { inputStream },
        );

        inputStream.write("client:hello\n");

        expect(chunks0).toStrictEqual([]);
        expect(chunks1).toStrictEqual(["hello\n"]);

        cleanup();
    });

    it("should route prefixed input by index", () => {
        expect.assertions(1);

        const stdin0 = new PassThrough();
        const stdin1 = new PassThrough();
        const inputStream = new PassThrough();
        const chunks1: string[] = [];

        stdin1.on("data", (data: Buffer) => chunks1.push(data.toString()));

        const cleanup = createInputHandler(
            [
                { index: 0, stdin: stdin0 },
                { index: 1, stdin: stdin1 },
            ],
            { inputStream },
        );

        inputStream.write("1:world\n");

        expect(chunks1).toStrictEqual(["world\n"]);

        cleanup();
    });

    it("should cleanup listeners on dispose", () => {
        expect.assertions(1);

        const inputStream = new PassThrough();

        const cleanup = createInputHandler([], { inputStream });

        cleanup();

        expect(inputStream.listenerCount("data")).toBe(0);
    });
});

describe(withRestart, () => {
    it("should not restart when tries is 0", async () => {
        expect.assertions(2);

        let callCount = 0;

        const result = await withRestart(
            async (commands, options) => {
                callCount++;

                return runConcurrentFallback(commands, options);
            },
            [{ command: "exit 1" }],
            {},
            { delay: 0, tries: 0 },
        );

        expect(callCount).toBe(1);
        expect(result.success).toBe(false);
    });

    it("should restart failing commands up to N tries", async () => {
        expect.assertions(2);

        let callCount = 0;

        const result = await withRestart(
            async (commands, options) => {
                callCount++;

                return runConcurrentFallback(commands, options);
            },
            [{ command: "exit 1" }],
            {},
            { delay: 0, tries: 2 },
        );

        // Original + 2 retries = 3 calls
        expect(callCount).toBe(3);
        expect(result.success).toBe(false);
    });

    it("should not restart successful commands", async () => {
        expect.assertions(2);

        let callCount = 0;

        const result = await withRestart(
            async (commands, options) => {
                callCount++;

                return runConcurrentFallback(commands, options);
            },
            [{ command: "echo ok" }],
            {},
            { delay: 0, tries: 3 },
        );

        expect(callCount).toBe(1);
        expect(result.success).toBe(true);
    });

    it("should invoke onRetry before each scheduled restart with attempt + exit code", async () => {
        expect.assertions(2);

        const calls: { attempt: number; commandIndex: number; prevExitCode: number }[] = [];

        await withRestart(
            (commands, options) => runConcurrentFallback(commands, options),
            [{ command: "exit 7" }],
            {},
            {
                delay: 0,
                onRetry: (attempt, commandIndex, prevExitCode) => {
                    calls.push({ attempt, commandIndex, prevExitCode });
                },
                tries: 2,
            },
        );

        // tries=2 → original failure + 2 retries → onRetry fires twice (1, 2)
        expect(calls).toStrictEqual([
            { attempt: 1, commandIndex: 0, prevExitCode: 7 },
            { attempt: 2, commandIndex: 0, prevExitCode: 7 },
        ]);
        // Throwing inside onRetry must propagate; verified separately below.
        expect(calls).toHaveLength(2);
    });

    it("should propagate onRetry throws and abort the restart batch", async () => {
        expect.assertions(2);

        let runCalls = 0;

        await expect(
            withRestart(
                (commands, options) => {
                    runCalls++;

                    return runConcurrentFallback(commands, options);
                },
                [{ command: "exit 1" }],
                {},
                {
                    delay: 1000,
                    onRetry: () => {
                        throw new Error("budget exhausted");
                    },
                    tries: 5,
                },
            ),
        ).rejects.toThrow("budget exhausted");

        // The original run completed (1 call); onRetry threw before sleep,
        // so no retry was scheduled.
        expect(runCalls).toBe(1);
    });
});

describe(runTeardown, () => {
    it("should run teardown commands sequentially", async () => {
        expect.assertions(1);

        const results = await runTeardown({
            commands: ["echo cleanup1", "echo cleanup2"],
        });

        expect(results).toStrictEqual([0, 0]);
    });

    it("should return non-zero for failing commands", async () => {
        expect.assertions(1);

        const results = await runTeardown({
            commands: ["exit 42"],
        });

        expect(results).toStrictEqual([42]);
    });

    it("should continue after a failure", async () => {
        expect.assertions(1);

        const results = await runTeardown({
            commands: ["exit 1", "echo ok"],
        });

        expect(results).toStrictEqual([1, 0]);
    });

    it("should handle empty commands", async () => {
        expect.assertions(1);

        const results = await runTeardown({ commands: [] });

        expect(results).toStrictEqual([]);
    });
});
