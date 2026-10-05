import { dispatch } from "../core/uploader";

export interface CreateAbortAllOptions {
    endpoint: string;
    /** @deprecated Unused: commands reach the existing uploads to `endpoint`, so there is nothing to attach metadata to. */
    metadata?: Record<string, string>;
}

export interface CreateAbortAllReturn {
    abortAll: () => void;
}

/**
 * Returns `abortAll` for every upload to `endpoint`, whichever upload hook started it.
 */
export const createAbortAll = (options: CreateAbortAllOptions): CreateAbortAllReturn => {
    const { endpoint } = options;

    return {
        abortAll: (): void => {
            dispatch(endpoint, { type: "abortAll" });
        },
    };
};
