import Cache from "lru-cache";

class Locker<K extends string = string, V extends string = string> extends Cache<K, V> {
    public constructor(options?: Cache.Options<K, V>) {
        super({
            ttl: 1000,
            ...options,
        });
    }

    lock(key: K): string {
        const locked = this.get(key);

        if (locked) {
            throw new Error(`${key} is locked`);
        }

        this.set(key, key as unknown as V);

        return key;
    }

    unlock(key: K): void {
        this.delete(key);
    }
}

export default Locker;
