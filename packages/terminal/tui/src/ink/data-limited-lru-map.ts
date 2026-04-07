/**
 * A specialized LRU map that enforces limits on both the number of entries and
 * the total character length of the keys.
 *
 * When adding a new item, if the new key's length would exceed `maxDataSize`,
 * it evicts the least recently used items until space is available.
 *
 * Ported from jacob314/ink fork (Google LLC, Apache-2.0).
 */
class DataLimitedLruMap<V> {
    private readonly map: Map<string, V>;

    private readonly maxDataSize: number;

    private readonly maxKeys: number;

    private currentDataSize = 0;

    constructor(maxKeys: number, maxDataSize: number) {
        this.map = new Map<string, V>();
        this.maxKeys = maxKeys;
        this.maxDataSize = maxDataSize;
    }

    get size(): number {
        return this.map.size;
    }

    clear(): void {
        this.map.clear();
        this.currentDataSize = 0;
    }

    get(key: string): V | undefined {
        if (!this.map.has(key)) {
            return undefined;
        }

        const value = this.map.get(key) as V;

        // Move to end (most recently used) by re-inserting
        this.map.delete(key);
        this.map.set(key, value);

        return value;
    }

    set(key: string, value: V): void {
        const size = key.length;

        // Don't cache keys that individually exceed the data size limit
        if (size > this.maxDataSize) {
            return;
        }

        const hasKey = this.map.has(key);

        if (hasKey) {
            // Remove old entry first
            this.map.delete(key);
            this.currentDataSize -= size;
        }

        // Evict LRU entries to make room for data size
        while (this.currentDataSize + size > this.maxDataSize && this.map.size > 0) {
            const lruKey = this.map.keys().next().value;

            if (lruKey === undefined) {
                break;
            }

            this.map.delete(lruKey);
            this.currentDataSize -= lruKey.length;
        }

        // Evict LRU entries to make room for max keys
        while (this.map.size >= this.maxKeys) {
            const lruKey = this.map.keys().next().value;

            if (lruKey === undefined) {
                break;
            }

            this.map.delete(lruKey);
            this.currentDataSize -= lruKey.length;
        }

        this.map.set(key, value);
        this.currentDataSize += size;
    }
}

export default DataLimitedLruMap;
