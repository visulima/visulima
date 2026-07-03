import { useCallback, useEffect, useRef, useState } from "react";

import useAnimation from "./use-animation";

export type UseTimerOptions = {
    /**
     * Whether to start the timer immediately.
     * @default false
     */
    readonly autoStart?: boolean;

    /**
     * Total countdown duration in milliseconds.
     */
    readonly duration: number;

    /**
     * Tick interval in milliseconds.
     * @default 1000
     */
    readonly interval?: number;

    /**
     * Called once when the timer reaches zero.
     */
    readonly onTimeout?: () => void;
};

export type UseTimerResult = {
    /** Whether the countdown has reached zero. */
    readonly isFinished: boolean;

    /** Whether the timer is currently counting down. */
    readonly isRunning: boolean;

    /** Milliseconds remaining (clamped to >= 0). */
    readonly remaining: number;

    /** Reset the timer to the original duration and stop it. */
    readonly reset: () => void;

    /** Start the countdown. */
    readonly start: () => void;

    /** Stop (pause) the countdown. */
    readonly stop: () => void;

    /** Toggle between running and stopped. */
    readonly toggle: () => void;
};

/**
 * A countdown timer hook built on `useAnimation`.
 *
 * ```tsx
 * const { remaining, isRunning, start, stop, reset, isFinished } = useTimer({
 *   duration: 60_000,
 *   onTimeout: () => console.log("Time's up!"),
 * });
 * ```
 */
export default function useTimer(options: UseTimerOptions): UseTimerResult {
    const { autoStart = false, duration, interval = 1000, onTimeout } = options;

    const [running, setRunning] = useState(autoStart);
    const onTimeoutRef = useRef(onTimeout);

    onTimeoutRef.current = onTimeout;

    const firedRef = useRef(false);

    const { reset: resetAnimation, time } = useAnimation({ interval, isActive: running });

    const remaining = Math.max(0, duration - time);
    const isFinished = remaining <= 0;

    // Stop and fire callback when finished
    useEffect(() => {
        if (isFinished && running) {
            setRunning(false);

            if (!firedRef.current) {
                firedRef.current = true;
                onTimeoutRef.current?.();
            }
        }
    }, [isFinished, running]);

    const start = useCallback(() => {
        if (!isFinished) {
            setRunning(true);
        }
    }, [isFinished]);

    const stop = useCallback(() => {
        setRunning(false);
    }, []);

    const toggle = useCallback(() => {
        setRunning((r) => {
            if (r) {
                return false;
            }

            // Don't restart a finished timer via toggle
            return remaining > 0;
        });
    }, [remaining]);

    const reset = useCallback(() => {
        setRunning(false);
        firedRef.current = false;
        resetAnimation();
    }, [resetAnimation]);

    return { isFinished, isRunning: running, remaining, reset, start, stop, toggle };
}

export { useTimer };
