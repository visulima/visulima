import { dispatch } from "../core/uploader";

export interface UseRetryOptions {
    /** Upload endpoint URL whose uploads to act on */
    endpoint: string;
    /** @deprecated Unused: commands reach the existing uploads to `endpoint`, so there is nothing to attach metadata to. */
    metadata?: Record<string, string>;
}

export interface UseRetryReturn {
    /** Retry a failed upload item by ID */
    retryItem: (id: string) => void;
}

/**
 * Vue composable to retry a failed upload item.
 * Acts on the uploads every upload hook of the same `endpoint` started; an unknown id is a no-op.
 * @param options Configuration options
 * @returns Retry function
 */
export const useRetry = (options: UseRetryOptions): UseRetryReturn => {
    const { endpoint } = options;

    const retryItem = (id: string): void => {
        dispatch(endpoint, { id, type: "retryItem" });
    };

    return {
        retryItem,
    };
};
