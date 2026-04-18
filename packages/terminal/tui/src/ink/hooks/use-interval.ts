import { useCallback, useEffect, useLayoutEffect, useRef } from "react";

export type UseIntervalOptions = {
    /**
     * When false, the timer is paused. Flipping back to true restarts it.
     * @default true
     */
    readonly isActive?: boolean;
};

export type UseIntervalResult = {
    /**
     * Cancel the currently-running timer. The hook effect will reschedule on
     * the next re-render if `isActive` remains true.
     */
    readonly clear: () => void;
};

/**
 * A React hook that invokes `callback` every `interval` ms. The callback
 * reference is captured in a ref so it always sees the latest closure; only
 * `interval` and `isActive` cause the timer to be rebuilt.
 * @param callback Invoked on every tick. Latest closure is captured in a ref.
 * @param interval Tick period in milliseconds. Invalid values pause the timer.
 * @param options Optional `isActive` flag to pause without unmounting.
 * @returns A stable object with a `clear()` method to cancel on demand.
 */
const useInterval = (callback: () => void, interval: number, options?: UseIntervalOptions): UseIntervalResult => {
    const { isActive = true } = options ?? {};
    const callbackRef = useRef(callback);
    const timerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

    // Side effect: update the ref during the commit phase instead of render.
    // Avoids StrictMode double-invocation surprises and keeps render pure.
    useLayoutEffect(() => {
        callbackRef.current = callback;
    }, [callback]);

    useEffect(() => {
        if (!isActive || interval <= 0 || !Number.isFinite(interval)) {
            return undefined;
        }

        const id = setInterval(() => {
            callbackRef.current();
        }, interval);

        timerRef.current = id;

        return () => {
            clearInterval(id);
            timerRef.current = undefined;
        };
    }, [interval, isActive]);

    const clear = useCallback(() => {
        if (timerRef.current !== undefined) {
            clearInterval(timerRef.current);
            timerRef.current = undefined;
        }
    }, []);

    return { clear };
};

export default useInterval;
