import type { DurableObjectStorageLike } from "../../src/store/durable-object-store";

/**
 * Faithful in-memory {@link DurableObjectStorageLike} for tests: serialises stored
 * values (like real DO storage), returns `list` keys in UTF-8 order, and tracks a
 * single alarm. Plain JS is single-threaded, so it models the DO's serial execution.
 */
class FakeDurableObjectStorage implements DurableObjectStorageLike {
    readonly #data = new Map<string, unknown>();

    #alarm: number | null = null;

    public get<T = unknown>(key: string): Promise<T | undefined> {
        const value = this.#data.get(key);

        return Promise.resolve(value === undefined ? undefined : (structuredClone(value) as T));
    }

    public put(key: string, value: unknown): Promise<void> {
        this.#data.set(key, structuredClone(value));

        return Promise.resolve();
    }

    public delete(key: string): Promise<boolean> {
        return Promise.resolve(this.#data.delete(key));
    }

    public list<T = unknown>(options?: { limit?: number; prefix?: string }): Promise<Map<string, T>> {
        const prefix = options?.prefix ?? "";
        // Durable Object storage orders keys by UTF-8 code units, not locale.
        const keys = [...this.#data.keys()]
            .filter((key) => key.startsWith(prefix))
            .toSorted((a, b) => {
                if (a < b) {
                    return -1;
                }

                return a > b ? 1 : 0;
            });
        const limited = options?.limit === undefined ? keys : keys.slice(0, options.limit);

        return Promise.resolve(new Map(limited.map((key) => [key, structuredClone(this.#data.get(key)) as T])));
    }

    public getAlarm(): Promise<number | null> {
        return Promise.resolve(this.#alarm);
    }

    public setAlarm(scheduledTime: number): Promise<void> {
        this.#alarm = scheduledTime;

        return Promise.resolve();
    }
}

export default FakeDurableObjectStorage;
