import { useCallback, useContext, useLayoutEffect, useRef, useState } from "react";

import AnimationContext from "../../components/animation-context";

const defaultAnimationInterval = 100;
const maximumTimerInterval = 2_147_483_647;
const zeroAnimState = { delta: 0, frame: 0, time: 0 };

type Options = {
    /**
     * Time between ticks in milliseconds.
     * @default 100
     */
    readonly interval?: number;

    /**
     * Whether the animation is running. When set to `false`, the animation stops.
     * When toggled back to `true`, all values reset to `0`.
     * @default true
     */
    readonly isActive?: boolean;
};

export type AnimationResult = {
    /**
     * Time in milliseconds since the previous rendered tick. Accounts for throttled renders.
     * Useful for physics-based or velocity-driven motion: `position += speed * delta`.
     */
    readonly delta: number;

    /**
     * Discrete counter that increments by 1 each interval.
     * Useful for indexed sequences like spinner frames.
     */
    readonly frame: number;

    /**
     * Resets `frame`, `time`, and `delta` to `0` and restarts timing from the current moment.
     * Useful for one-shot animations triggered by events.
     */
    readonly reset: () => void;

    /**
     * Total elapsed time in milliseconds since the animation started or was last reset.
     * Useful for continuous math-based animations like sine waves: `Math.sin(time / 1000 * Math.PI * 2)`.
     */
    readonly time: number;
};

/**
 * A React hook that drives animations. Returns a frame counter, elapsed time, frame delta, and a reset function.
 * All animations share a single timer internally, so multiple animated components consolidate into one render cycle.
 */
export default function useAnimation(options?: Options): AnimationResult {
    const { interval = defaultAnimationInterval, isActive = true } = options ?? {};
    const safeInterval = normalizeAnimationInterval(interval);

    const { renderThrottleMs, subscribe } = useContext(AnimationContext);

    const [resetKey, setResetKey] = useState(0);
    const [animState, setAnimState] = useState(zeroAnimState);

    const nextRenderTimeRef = useRef(0);
    const lastRenderTimeRef = useRef(0);
    const previousOptionsRef = useRef({ isActive, resetKey, safeInterval });

    const previousOptions = previousOptionsRef.current;
    const shouldReset = isActive && (safeInterval !== previousOptions.safeInterval || !previousOptions.isActive || resetKey !== previousOptions.resetKey);

    const reset = useCallback(() => {
        setResetKey((k) => k + 1);
    }, []);

    useLayoutEffect(() => {
        if (!isActive) {
            return undefined;
        }

        // Reset to zero immediately so any render that occurs between this
        // effect commit and the first tick shows zeros, not stale values.
        // On initial mount this is a no-op: Object.is bails out because the
        // state was initialized with the same zeroAnimState reference.
        setAnimState(zeroAnimState);

        // startTime is captured by the callback closure below. It is safe because
        // subscribe() returns synchronously and the callback is only invoked
        // asynchronously via setTimeout, so the assignment on the line after
        // subscribe() is guaranteed to have completed before the first invocation.
        let startTime = 0;

        const { startTime: subscriberStartTime, unsubscribe } = subscribe((currentTime) => {
            const isThrottled = renderThrottleMs > 0 && currentTime < nextRenderTimeRef.current;

            if (isThrottled) {
                // Coalesce intermediate ticks while Ink is inside the current
                // render-throttle window; the next allowed render will jump
                // straight to the latest elapsed values.
                return;
            }

            const elapsed = currentTime - startTime;
            const nextDelta = currentTime - lastRenderTimeRef.current;

            lastRenderTimeRef.current = currentTime;
            nextRenderTimeRef.current = currentTime + renderThrottleMs;

            setAnimState({
                delta: nextDelta,
                frame: Math.floor(elapsed / safeInterval),
                time: elapsed,
            });
        }, safeInterval);

        // Use the scheduler's start time instead of sampling our own clock so the
        // first delivered tick cannot start one frame late.
        startTime = subscriberStartTime;
        lastRenderTimeRef.current = subscriberStartTime;
        nextRenderTimeRef.current = startTime + renderThrottleMs;

        return unsubscribe;
    }, [safeInterval, isActive, subscribe, renderThrottleMs, resetKey]);

    useLayoutEffect(() => {
        previousOptionsRef.current = { isActive, resetKey, safeInterval };
    }, [isActive, safeInterval, resetKey]);

    if (shouldReset) {
        return { ...zeroAnimState, reset };
    }

    return { ...animState, reset };
}

function normalizeAnimationInterval(interval: number): number {
    if (!Number.isFinite(interval)) {
        return defaultAnimationInterval;
    }

    return Math.min(maximumTimerInterval, Math.max(1, interval));
}

export { useAnimation };
