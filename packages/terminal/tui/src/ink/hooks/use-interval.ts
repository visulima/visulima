import { useEffect, useRef } from "react";

export type UseIntervalOptions = {
    /**
     * When false, the timer is paused. Flipping back to true restarts it.
     * @default true
     */
    readonly isActive?: boolean;
};

/**
 * A React hook that invokes `callback` every `interval` ms. The callback
 * reference is captured in a ref so it always sees the latest closure; only
 * `interval` and `isActive` cause the timer to be rebuilt.
 *
 * Returns a `clear()` function to cancel on demand.
 */
const useInterval = (callback: () => void, interval: number, options?: UseIntervalOptions): { readonly clear: () => void } => {
    const { isActive = true } = options ?? {};
    const callbackRef = useRef(callback);
    const timerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

    callbackRef.current = callback;

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

    return {
        clear: () => {
            if (timerRef.current !== undefined) {
                clearInterval(timerRef.current);
                timerRef.current = undefined;
            }
        },
    };
};

export default useInterval;
