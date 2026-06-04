class LRUCache<K, V> {
    private readonly capacity: number;

    private readonly cache: Map<K, V>;

    public constructor(capacity: number) {
        this.capacity = capacity;
        this.cache = new Map<K, V>();
    }

    public get(key: K): V | undefined {
        if (!this.cache.has(key)) {
            return undefined;
        }

        // Move key to the end (most recently used) using Map insertion order
        const value = this.cache.get(key) as V;

        this.cache.delete(key);
        this.cache.set(key, value);

        return value;
    }

    public has(key: K): boolean {
        return this.cache.has(key);
    }

    public set(key: K, value: V): void {
        if (this.cache.has(key)) {
            // Update existing key's position
            this.cache.delete(key);
        } else if (this.cache.size >= this.capacity) {
            // Remove least recently used item (first inserted key)
            const lruKey = this.cache.keys().next().value;

            if (lruKey !== undefined) {
                this.cache.delete(lruKey);
            }
        }

        this.cache.set(key, value);
    }

    public delete(key: K): void {
        this.cache.delete(key);
    }

    public clear(): void {
        this.cache.clear();
    }

    public size(): number {
        return this.cache.size;
    }
}

export default LRUCache;
