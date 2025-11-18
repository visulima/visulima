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
        detail: (id: string, transformParams?: Record<string, string | number | boolean>) =>
            [...storageQueryKeys.files.details(), id, transformParams] as const,
        details: () => [...storageQueryKeys.files.all, "detail"] as const,
        head: (id: string) => [...storageQueryKeys.files.all, id, "head"] as const,
        list: (filters?: { limit?: number; page?: number }) => [...storageQueryKeys.files.lists(), filters] as const,
        lists: () => [...storageQueryKeys.files.all, "list"] as const,
        meta: (id: string) => [...storageQueryKeys.files.all, id, "meta"] as const,
    },

    /**
     * Transform-related query keys
     */
    transform: {
        all: ["storage", "transform"] as const,
        file: (id: string, transformParams: Record<string, string | number | boolean>) => [...storageQueryKeys.transform.all, id, transformParams] as const,
        metadata: () => [...storageQueryKeys.transform.all, "metadata"] as const,
    },
} as const;
