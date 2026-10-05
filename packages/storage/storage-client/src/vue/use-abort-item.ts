import { dispatch } from "../core/uploader";

export interface UseAbortItemOptions {
    /** Upload endpoint URL whose uploads to act on */
    endpoint: string;
    /** @deprecated Unused: commands reach the existing uploads to `endpoint`, so there is nothing to attach metadata to. */
    metadata?: Record<string, string>;
}

export interface UseAbortItemReturn {
    /** Abort a specific upload item by ID */
    abortItem: (id: string) => void;
}

/**
 * Vue composable to abort a specific upload item.
 * Acts on the uploads every upload hook of the same `endpoint` started; an unknown id is a no-op.
 * @param options Configuration options
 * @returns Abort function
 */
export const useAbortItem = (options: UseAbortItemOptions): UseAbortItemReturn => {
    const { endpoint } = options;

    const abortItem = (id: string): void => {
        dispatch(endpoint, { id, type: "abortItem" });
    };

    return {
        abortItem,
    };
};
