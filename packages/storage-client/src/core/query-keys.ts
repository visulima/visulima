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
        all: ["storage", "files"] as const,
        detail: (id: string, transformParams?: Record<string, string | number | boolean>): ReadonlyArray<unknown> =>
            [...storageQueryKeys.files.details(), id, transformParams] as const,
        details: (): ReadonlyArray<unknown> => [...storageQueryKeys.files.all, "detail"] as const,
        head: (id: string): ReadonlyArray<unknown> => [...storageQueryKeys.files.all, id, "head"] as const,
        list: (filters?: { limit?: number; page?: number }): ReadonlyArray<unknown> => [...storageQueryKeys.files.lists(), filters] as const,
        lists: (): ReadonlyArray<unknown> => [...storageQueryKeys.files.all, "list"] as const,
        meta: (id: string): ReadonlyArray<unknown> => [...storageQueryKeys.files.all, id, "meta"] as const,
    },

    /**
     * Transform-related query keys
     */
    transform: {
        all: ["storage", "transform"] as const,
        file: (id: string, transformParams: Record<string, string | number | boolean>): ReadonlyArray<unknown> =>
            [...storageQueryKeys.transform.all, id, transformParams] as const,
        metadata: (): ReadonlyArray<unknown> => [...storageQueryKeys.transform.all, "metadata"] as const,
    },
} as const;
