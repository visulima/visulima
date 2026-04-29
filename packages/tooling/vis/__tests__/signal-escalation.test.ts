import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { scheduleTimeoutKill } from "../src/signal-escalation";

describe(scheduleTimeoutKill, () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("sends SIGTERM when the timeout fires and SIGKILL after the grace window", () => {
        expect.assertions(4);

        const signals: ("SIGKILL" | "SIGTERM")[] = [];
        const onTimeout = vi.fn();

        scheduleTimeoutKill({
            killGracePeriodMs: 1000,
            onTimeout,
            sendSignal: (signal) => {
                signals.push(signal);
            },
            timeoutMs: 5000,
        });

        vi.advanceTimersByTime(4999);
        expect(signals).toStrictEqual([]);

        vi.advanceTimersByTime(1);
        expect(onTimeout).toHaveBeenCalledTimes(1);
        expect(signals).toStrictEqual(["SIGTERM"]);

        vi.advanceTimersByTime(1000);
        expect(signals).toStrictEqual(["SIGTERM", "SIGKILL"]);
    });

    it("cancel() before the timeout suppresses both signals", () => {
        expect.assertions(2);

        const signals: ("SIGKILL" | "SIGTERM")[] = [];
        const onTimeout = vi.fn();

        const handle = scheduleTimeoutKill({
            killGracePeriodMs: 1000,
            onTimeout,
            sendSignal: (signal) => {
                signals.push(signal);
            },
            timeoutMs: 5000,
        });

        vi.advanceTimersByTime(4000);
        handle.cancel();
        vi.advanceTimersByTime(10_000);

        expect(onTimeout).not.toHaveBeenCalled();
        expect(signals).toStrictEqual([]);
    });

    it("cancel() between SIGTERM and SIGKILL prevents the escalation", () => {
        expect.assertions(2);

        const signals: ("SIGKILL" | "SIGTERM")[] = [];

        const handle = scheduleTimeoutKill({
            killGracePeriodMs: 1000,
            sendSignal: (signal) => {
                signals.push(signal);
            },
            timeoutMs: 5000,
        });

        vi.advanceTimersByTime(5000);
        expect(signals).toStrictEqual(["SIGTERM"]);

        // Process exits cleanly within the grace window — the host
        // cancels the handle, which must clear the pending SIGKILL.
        vi.advanceTimersByTime(500);
        handle.cancel();
        vi.advanceTimersByTime(10_000);

        expect(signals).toStrictEqual(["SIGTERM"]);
    });

    it("killGracePeriodMs: 0 sends SIGTERM only and never escalates", () => {
        expect.assertions(2);

        const signals: ("SIGKILL" | "SIGTERM")[] = [];

        scheduleTimeoutKill({
            killGracePeriodMs: 0,
            sendSignal: (signal) => {
                signals.push(signal);
            },
            timeoutMs: 1000,
        });

        vi.advanceTimersByTime(1000);
        expect(signals).toStrictEqual(["SIGTERM"]);

        vi.advanceTimersByTime(60_000);
        expect(signals).toStrictEqual(["SIGTERM"]);
    });

    it("defaults killGracePeriodMs to 5000 when omitted", () => {
        expect.assertions(2);

        const signals: ("SIGKILL" | "SIGTERM")[] = [];

        scheduleTimeoutKill({
            sendSignal: (signal) => {
                signals.push(signal);
            },
            timeoutMs: 1000,
        });

        vi.advanceTimersByTime(1000);
        expect(signals).toStrictEqual(["SIGTERM"]);

        // Default grace is 5000ms.
        vi.advanceTimersByTime(4999);
        expect(signals).toStrictEqual(["SIGTERM"]);
    });

    it("timeoutMs <= 0 returns a no-op handle that never schedules anything", () => {
        expect.assertions(2);

        const sendSignal = vi.fn();
        const onTimeout = vi.fn();

        const handle = scheduleTimeoutKill({
            onTimeout,
            sendSignal,
            timeoutMs: 0,
        });

        vi.advanceTimersByTime(60_000);
        handle.cancel();
        vi.advanceTimersByTime(60_000);

        expect(sendSignal).not.toHaveBeenCalled();
        expect(onTimeout).not.toHaveBeenCalled();
    });

    it("treats a negative killGracePeriodMs as 'skip escalation' (defensive clamp)", () => {
        expect.assertions(2);

        const signals: ("SIGKILL" | "SIGTERM")[] = [];

        scheduleTimeoutKill({
            killGracePeriodMs: -1,
            sendSignal: (signal) => {
                signals.push(signal);
            },
            timeoutMs: 1000,
        });

        vi.advanceTimersByTime(1000);
        expect(signals).toStrictEqual(["SIGTERM"]);

        vi.advanceTimersByTime(60_000);
        expect(signals).toStrictEqual(["SIGTERM"]);
    });

    it("onTimeout is invoked once before the SIGTERM is dispatched", () => {
        expect.assertions(1);

        const log: string[] = [];

        scheduleTimeoutKill({
            killGracePeriodMs: 1000,
            onTimeout: () => {
                log.push("onTimeout");
            },
            sendSignal: (signal) => {
                log.push(signal);
            },
            timeoutMs: 100,
        });

        vi.advanceTimersByTime(100);

        expect(log).toStrictEqual(["onTimeout", "SIGTERM"]);
    });
});
