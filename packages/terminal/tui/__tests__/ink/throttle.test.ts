import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { throttle } from "../../src/ink/utils/throttle";

describe(throttle, () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("should invoke on the leading edge with leading=true", () => {
        expect.assertions(2);

        const function_ = vi.fn();
        const throttled = throttle(function_, 100, { leading: true, trailing: true });

        throttled("a");

        expect(function_).toHaveBeenCalledTimes(1);
        expect(function_).toHaveBeenLastCalledWith("a");
    });

    it("should not invoke on leading edge with leading=false", () => {
        expect.assertions(1);

        const function_ = vi.fn();
        const throttled = throttle(function_, 100, { leading: false, trailing: true });

        throttled("a");

        expect(function_).not.toHaveBeenCalled();
    });

    it("should invoke trailing call with the last args once the wait elapses", () => {
        expect.assertions(3);

        const function_ = vi.fn();
        const throttled = throttle(function_, 100, { leading: true, trailing: true });

        throttled("a");
        throttled("b");
        throttled("c");

        expect(function_).toHaveBeenCalledTimes(1);

        vi.advanceTimersByTime(100);

        expect(function_).toHaveBeenCalledTimes(2);
        expect(function_).toHaveBeenLastCalledWith("c");
    });

    it("should not fire trailing when no calls came after the leading invoke", () => {
        expect.assertions(2);

        const function_ = vi.fn();
        const throttled = throttle(function_, 100, { leading: true, trailing: true });

        throttled("a");

        vi.advanceTimersByTime(200);

        expect(function_).toHaveBeenCalledTimes(1);
        expect(function_).toHaveBeenLastCalledWith("a");
    });

    it("should force an invocation when continuous demand exceeds the wait window (maxWait)", () => {
        expect.assertions(2);

        const function_ = vi.fn();
        const throttled = throttle(function_, 100, { leading: true, trailing: true });

        throttled("a");
        vi.advanceTimersByTime(50);
        throttled("b");
        vi.advanceTimersByTime(60);

        // 110ms have elapsed since the leading invoke; the next call must
        // force-fire because we exceeded the throttle window.
        throttled("c");

        expect(function_).toHaveBeenCalledTimes(2);
        expect(function_).toHaveBeenLastCalledWith("c");
    });

    it("should flush a pending trailing invocation synchronously", () => {
        expect.assertions(3);

        const function_ = vi.fn();
        const throttled = throttle(function_, 100, { leading: true, trailing: true });

        throttled("a");
        throttled("b");

        expect(function_).toHaveBeenCalledTimes(1);

        throttled.flush();

        expect(function_).toHaveBeenCalledTimes(2);
        expect(function_).toHaveBeenLastCalledWith("b");
    });

    it("should drop a pending trailing invocation on cancel", () => {
        expect.assertions(2);

        const function_ = vi.fn();
        const throttled = throttle(function_, 100, { leading: true, trailing: true });

        throttled("a");
        throttled("b");
        throttled.cancel();

        vi.advanceTimersByTime(200);

        expect(function_).toHaveBeenCalledTimes(1);
        expect(function_).toHaveBeenLastCalledWith("a");
    });

    it("should treat a call after the timer settled as a fresh leading edge", () => {
        expect.assertions(2);

        const function_ = vi.fn();
        const throttled = throttle(function_, 100, { leading: true, trailing: true });

        throttled("a");

        vi.advanceTimersByTime(200);

        throttled("b");

        expect(function_).toHaveBeenCalledTimes(2);
        expect(function_).toHaveBeenLastCalledWith("b");
    });

    it("flush returns the most recent result", () => {
        expect.assertions(2);

        let counter = 0;
        const function_ = vi.fn(() => {
            counter += 1;

            return counter;
        });
        const throttled = throttle(function_, 100, { leading: true, trailing: true });

        throttled();
        throttled();

        expect(function_).toHaveBeenCalledTimes(1);
        expect(throttled.flush()).toBe(2);
    });

    it("default options are leading=true and trailing=true", () => {
        expect.assertions(2);

        const function_ = vi.fn();
        const throttled = throttle(function_, 100);

        throttled("a");
        throttled("b");

        expect(function_).toHaveBeenCalledTimes(1);

        vi.advanceTimersByTime(100);

        expect(function_).toHaveBeenCalledTimes(2);
    });
});
