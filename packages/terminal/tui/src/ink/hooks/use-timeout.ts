import { useCallback, useEffect, useRef, useState } from "react";

export type UseTimeoutOptions = {
    /**
     * When false, the timer never starts. Flipping to true restarts it.
     * @default true
     */
    readonly isActive?: boolean;
};

export type UseTimeoutResult = {
    /**
     * Cancel the pending timer (no-op if already fired or never scheduled).
     */
    readonly cancel: () => void;

    /**
     * Restart the timer from now with the current delay.
     */
    readonly reset: () => void;
};

/**
 * A React hook that fires `callback` once after `delay` ms. Changing `delay`
 * or toggling `isActive` reschedules the timer from zero. Call `reset()` to
 * restart on demand.
 */
const useTimeout = (callback: () => void, delay: number, options?: UseTimeoutOptions): UseTimeoutResult => {
    const { isActive = true } = options ?? {};
    const callbackRef = useRef(callback);
    const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const [bump, setBump] = useState(0);

    callbackRef.current = callback;

    const cancel = useCallback(() => {
        if (timerRef.current !== undefined) {
            clearTimeout(timerRef.current);
            timerRef.current = undefined;
        }
    }, []);

    const reset = useCallback(() => {
        setBump((previous) => previous + 1);
    }, []);

    useEffect(() => {
        if (!isActive || delay < 0 || !Number.isFinite(delay)) {
            return undefined;
        }

        const id = setTimeout(() => {
            callbackRef.current();
        }, delay);

        timerRef.current = id;

        return () => {
            clearTimeout(id);
            timerRef.current = undefined;
        };
    }, [delay, isActive, bump]);

    return { cancel, reset };
};

export default useTimeout;
