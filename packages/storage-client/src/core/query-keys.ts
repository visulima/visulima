/**
 * Query key factory for storage operations
 * Provides consistent query key generation across all hooks
 */

export const storageQueryKeys = {
    /**
     * Base key for all storage queries
     */
    all: ["storage"] as const,

    /**
     * File-related query keys
     */
    files: {
        all: (endpoint: string): ReadonlyArray<unknown> => ["storage", "files", endpoint] as const,
        detail: (endpoint: string, id: string, transformParams?: Record<string, string | number | boolean>): ReadonlyArray<unknown> =>
            [...storageQueryKeys.files.details(endpoint), id, transformParams] as const,
        details: (endpoint: string): ReadonlyArray<unknown> => [...storageQueryKeys.files.all(endpoint), "detail"] as const,
        head: (endpoint: string, id: string): ReadonlyArray<unknown> => [...storageQueryKeys.files.all(endpoint), id, "head"] as const,
        list: (endpoint: string, filters?: { limit?: number; page?: number }): ReadonlyArray<unknown> => [...storageQueryKeys.files.lists(endpoint), filters] as const,
        lists: (endpoint: string): ReadonlyArray<unknown> => [...storageQueryKeys.files.all(endpoint), "list"] as const,
        meta: (endpoint: string, id: string): ReadonlyArray<unknown> => [...storageQueryKeys.files.all(endpoint), id, "meta"] as const,
    },

    /**
     * Transform-related query keys
     */
    transform: {
        all: (endpoint: string): ReadonlyArray<unknown> => ["storage", "transform", endpoint] as const,
        file: (endpoint: string, id: string, transformParams: Record<string, string | number | boolean>): ReadonlyArray<unknown> =>
            [...storageQueryKeys.transform.all(endpoint), id, transformParams] as const,
        metadata: (endpoint: string): ReadonlyArray<unknown> => [...storageQueryKeys.transform.all(endpoint), "metadata"] as const,
    },
} as const;
