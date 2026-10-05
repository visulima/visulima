import { dispatch } from "../core/uploader";

export interface CreateAbortItemOptions {
    endpoint: string;
    /** @deprecated Unused: commands reach the existing uploads to `endpoint`, so there is nothing to attach metadata to. */
    metadata?: Record<string, string>;
}

export interface CreateAbortItemReturn {
    abortItem: (id: string) => void;
}

/**
 * Returns `abortItem` for the uploads every upload hook of the same `endpoint` started; an unknown id is a no-op.
 */
export const createAbortItem = (options: CreateAbortItemOptions): CreateAbortItemReturn => {
    const { endpoint } = options;

    return {
        abortItem: (id: string): void => {
            dispatch(endpoint, { id, type: "abortItem" });
        },
    };
};
