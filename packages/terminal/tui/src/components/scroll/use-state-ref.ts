import type React from "react";
import { useCallback, useRef, useState } from "react";

/**
 * Hook to manage state with immediate ref synchronization.
 * Useful for values that need to be read synchronously in imperative methods
 * but also trigger re-renders when changed.
 */
const useStateRef = <T>(initialValue: T): readonly [T, (update: React.SetStateAction<T>) => void, () => T] => {
    const [state, setStateInternal] = useState(initialValue);
    const ref = useRef(initialValue);

    const setState = useCallback((update: React.SetStateAction<T>) => {
        const nextValue = typeof update === "function" ? (update as (previous: T) => T)(ref.current) : update;

        ref.current = nextValue;
        setStateInternal(nextValue);
    }, []);

    const getState = useCallback((): T => ref.current, []);

    return [state, setState, getState] as const;
};

export default useStateRef;
