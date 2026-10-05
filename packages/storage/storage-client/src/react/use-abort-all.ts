import { useCallback } from "react";

import { dispatch } from "../core/uploader";

export interface UseAbortAllOptions {
    /** Upload endpoint URL whose uploads to act on */
    endpoint: string;
    /** @deprecated Unused: commands reach the existing uploads to `endpoint`, so there is nothing to attach metadata to. */
    metadata?: Record<string, string>;
}

export interface UseAbortAllReturn {
    /** Abort all active uploads */
    abortAll: () => void;
}

/**
 * React hook to abort all active uploads.
 * Acts on every upload to `endpoint`, whichever upload hook started it.
 * @param options Configuration options
 * @returns Abort all function
 */
export const useAbortAll = (options: UseAbortAllOptions): UseAbortAllReturn => {
    const { endpoint } = options;

    const abortAll = useCallback((): void => {
        dispatch(endpoint, { type: "abortAll" });
    }, [endpoint]);

    return {
        abortAll,
    };
};
