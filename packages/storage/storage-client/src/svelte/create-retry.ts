import { dispatch } from "../core/uploader";

export interface CreateRetryOptions {
    endpoint: string;
    /** @deprecated Unused: commands reach the existing uploads to `endpoint`, so there is nothing to attach metadata to. */
    metadata?: Record<string, string>;
}

export interface CreateRetryReturn {
    retryItem: (id: string) => void;
}

/**
 * Returns `retryItem` for the uploads every upload hook of the same `endpoint` started; an unknown id is a no-op.
 */
export const createRetry = (options: CreateRetryOptions): CreateRetryReturn => {
    const { endpoint } = options;

    return {
        retryItem: (id: string): void => {
            dispatch(endpoint, { id, type: "retryItem" });
        },
    };
};
