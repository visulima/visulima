import { beforeEach, describe, expect, it, vi } from "vitest";

import { TimerManager } from "../../src/timer-manager";

const START_MESSAGE = "Initialized timer...";
const END_MESSAGE = "Timer run for:";

const MS_REGEX = /^\d+ ms$/;
const S_REGEX = /^\d+\.\d{2} s$/;
const TIMER_RUN_REGEX = /^Timer run for:/;

describe(TimerManager, () => {
    let emit: ReturnType<typeof vi.fn>;
    let manager: TimerManager;

    beforeEach(() => {
        emit = vi.fn();
        manager = new TimerManager(emit, START_MESSAGE, END_MESSAGE);
    });

    describe("time", () => {
        it("should emit a start log and record the timer", () => {
            expect.assertions(2);

            manager.time("op");

            expect(emit).toHaveBeenCalledTimes(1);
            expect(emit).toHaveBeenCalledWith("start", false, false, { message: START_MESSAGE, prefix: "op" });
        });

        it("should default label to \"default\"", () => {
            expect.assertions(1);

            manager.time();

            expect(emit).toHaveBeenCalledWith("start", false, false, { message: START_MESSAGE, prefix: "default" });
        });

        it("should emit a warning when the label already exists", () => {
            expect.assertions(2);

            manager.time("dup");
            emit.mockClear();
            manager.time("dup");

            expect(emit).toHaveBeenCalledTimes(1);
            expect(emit).toHaveBeenCalledWith("warn", false, false, { message: "Timer 'dup' already exists", prefix: "dup" });
        });
    });

    describe("timeLog", () => {
        it("should log elapsed time for a running timer (milliseconds)", () => {
            expect.assertions(3);

            manager.time("t");
            emit.mockClear();
            manager.timeLog("t");

            expect(emit).toHaveBeenCalledTimes(1);

            const call = emit.mock.calls[0] as [string, boolean, boolean, { message: string; prefix: string }];

            expect(call[0]).toBe("info");
            expect(call[3].message).toMatch(MS_REGEX);
        });

        it("should log elapsed time in seconds when >= 1000 ms", () => {
            expect.assertions(1);

            vi.useFakeTimers();
            manager.time("slow");
            vi.advanceTimersByTime(2500);
            emit.mockClear();
            manager.timeLog("slow");
            vi.useRealTimers();

            const call = emit.mock.calls[0] as [string, boolean, boolean, { message: string }];

            expect(call[3].message).toMatch(S_REGEX);
        });

        it("should emit a warning for a missing label", () => {
            expect.assertions(1);

            manager.timeLog("missing");

            expect(emit).toHaveBeenCalledWith("warn", false, false, { context: [], message: "Timer not found", prefix: "missing" });
        });

        it("should use the most-recently-started timer when called without a label", () => {
            expect.assertions(1);

            manager.time("first");
            manager.time("second");
            emit.mockClear();
            manager.timeLog();

            const call = emit.mock.calls[0] as [string, boolean, boolean, { prefix: string }];

            expect(call[3].prefix).toBe("second");
        });

        it("should pass additional data as context", () => {
            expect.assertions(1);

            manager.time("ctx");
            emit.mockClear();
            manager.timeLog("ctx", "extra", 42);

            const call = emit.mock.calls[0] as [string, boolean, boolean, { context: unknown[] }];

            expect(call[3].context).toStrictEqual(["extra", 42]);
        });
    });

    describe("timeEnd", () => {
        it("should log total elapsed time and remove the timer", () => {
            expect.assertions(3);

            manager.time("e");
            emit.mockClear();
            manager.timeEnd("e");

            expect(emit).toHaveBeenCalledTimes(1);

            const call = emit.mock.calls[0] as [string, boolean, boolean, { message: string }];

            expect(call[0]).toBe("stop");
            expect(call[3].message).toMatch(TIMER_RUN_REGEX);
        });

        it("should emit a warning for a missing label", () => {
            expect.assertions(1);

            manager.timeEnd("gone");

            expect(emit).toHaveBeenCalledWith("warn", false, false, { message: "Timer not found", prefix: "gone" });
        });

        it("should use the most-recently-started timer when called without a label", () => {
            expect.assertions(1);

            manager.time("solo");
            emit.mockClear();
            manager.timeEnd();

            const call = emit.mock.calls[0] as [string, boolean, boolean, { prefix: string }];

            expect(call[3].prefix).toBe("solo");
        });

        it("should format elapsed time in seconds when >= 1000 ms", () => {
            expect.assertions(1);

            vi.useFakeTimers();
            manager.time("long");
            vi.advanceTimersByTime(1500);
            emit.mockClear();
            manager.timeEnd("long");
            vi.useRealTimers();

            const call = emit.mock.calls[0] as [string, boolean, boolean, { message: string }];

            expect(call[3].message).toBe("Timer run for: 1.50 s");
        });

        it("should warn when restarting a label that was ended but not cleared from seqTimers", () => {
            // Original behavior: timeEnd only removes from timersMap, not seqTimers.
            // Calling time() on the same label again therefore still triggers the duplicate warning.
            expect.assertions(2);

            manager.time("reuse");
            manager.timeEnd("reuse");
            emit.mockClear();
            manager.time("reuse");

            expect(emit).toHaveBeenCalledTimes(1);
            expect(emit).toHaveBeenCalledWith("warn", false, false, { message: "Timer 'reuse' already exists", prefix: "reuse" });
        });
    });
});
