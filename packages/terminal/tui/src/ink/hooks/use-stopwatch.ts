import { useCallback, useRef, useState } from "react";

import useAnimation from "./use-animation";

export type UseStopwatchOptions = {
    /**
     * Whether to start counting immediately.
     * @default false
     */
    readonly autoStart?: boolean;

    /**
     * Tick interval in milliseconds.
     * @default 1000
     */
    readonly interval?: number;
};

export type UseStopwatchResult = {
    /** Milliseconds elapsed since start (or last reset). */
    readonly elapsed: number;

    /** Whether the stopwatch is currently running. */
    readonly isRunning: boolean;

    /** Capture the current elapsed time as a lap. Returns the elapsed value. */
    readonly lap: () => number;

    /** Accumulated lap times. */
    readonly laps: ReadonlyArray<number>;

    /** Reset elapsed to 0, clear laps, and stop the stopwatch. */
    readonly reset: () => void;

    /** Start counting. */
    readonly start: () => void;

    /** Pause counting. */
    readonly stop: () => void;

    /** Toggle between running and stopped. */
    readonly toggle: () => void;
};

/**
 * A count-up stopwatch hook built on `useAnimation`.
 *
 * ```tsx
 * const { elapsed, isRunning, start, stop, reset, lap, laps } = useStopwatch();
 * ```
 */
export default function useStopwatch(options?: UseStopwatchOptions): UseStopwatchResult {
    const { autoStart = false, interval = 1000 } = options ?? {};

    const [running, setRunning] = useState(autoStart);
    const [laps, setLaps] = useState<ReadonlyArray<number>>([]);

    const { reset: resetAnimation, time: elapsed } = useAnimation({ interval, isActive: running });

    const start = useCallback(() => {
        setRunning(true);
    }, []);

    const stop = useCallback(() => {
        setRunning(false);
    }, []);

    const toggle = useCallback(() => {
        setRunning((r) => !r);
    }, []);

    const reset = useCallback(() => {
        setRunning(false);
        setLaps([]);
        resetAnimation();
    }, [resetAnimation]);

    const elapsedRef = useRef(elapsed);

    elapsedRef.current = elapsed;

    const lap = useCallback((): number => {
        const { current } = elapsedRef;

        setLaps((previous) => [...previous, current]);

        return current;
    }, []);

    return { elapsed, isRunning: running, lap, laps, reset, start, stop, toggle };
}

export { useStopwatch };
