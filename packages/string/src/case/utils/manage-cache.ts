/**
 * Manages cache operations for case conversion functions.
 * Handles cache size limits by removing the oldest entries when needed.
 */
export const manageCache = (cacheStore: Map<string, string>, key: string, value: string, maxSize: number): void => {
    // If we're at the size limit, remove the first (oldest) entry
    if (cacheStore.size >= maxSize) {
        const firstKey = cacheStore.keys().next().value;

        cacheStore.delete(firstKey);
    }

    // Add the new value
    cacheStore.set(key, value);
};
