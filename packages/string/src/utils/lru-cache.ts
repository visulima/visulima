class LRUCache<K, V> {
    private readonly capacity: number;

    private readonly cache: Map<K, V>;

    private keyOrder: K[];

    public constructor(capacity: number) {
        this.capacity = capacity;
        this.cache = new Map<K, V>();
        this.keyOrder = [];
    }

    public get(key: K): V | undefined {
        if (!this.cache.has(key)) {
            return undefined;
        }

        // Move key to the end (most recently used)
        this.keyOrder = this.keyOrder.filter((k) => k !== key);
        this.keyOrder.push(key);

        return this.cache.get(key);
    }

    public has(key: K): boolean {
        return this.cache.has(key);
    }

    public set(key: K, value: V): void {
        if (this.cache.has(key)) {
            // Update existing key's position
            this.keyOrder = this.keyOrder.filter((k) => k !== key);
        } else if (this.cache.size >= this.capacity) {
            // Remove least recently used item
            const lruKey = this.keyOrder.shift();
            if (lruKey !== undefined) {
                this.cache.delete(lruKey);
            }
        }

        // Add new key
        this.cache.set(key, value);
        this.keyOrder.push(key);
    }

    public delete(key: K): void {
        this.cache.delete(key);
        this.keyOrder = this.keyOrder.filter((k) => k !== key);
    }

    public clear(): void {
        this.cache.clear();
        this.keyOrder = [];
    }

    public size(): number {
        return this.cache.size;
    }
}

export default LRUCache;
