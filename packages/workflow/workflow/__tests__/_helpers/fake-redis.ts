import type { RedisLike } from "../../src/store/redis-store";
import { ACQUIRE_SCRIPT, RELEASE_SCRIPT } from "../../src/store/redis-store";

/**
 * A faithful in-memory {@link RedisLike} for tests: implements the exact commands
 * `RedisStore` uses (string get/set with `PX` expiry, del, the two lease Lua
 * scripts, and a sorted set for the due index). JavaScript's single thread makes
 * it atomic, so it exercises the store's command logic without a Redis server.
 */
class FakeRedis implements RedisLike {
    readonly #strings = new Map<string, { expireAt?: number; value: string }>();

    readonly #zsets = new Map<string, Map<string, number>>();

    public get(key: string): Promise<string | null> {
        return Promise.resolve(this.#readString(key));
    }

    public set(key: string, value: string, ...options: (number | string)[]): Promise<unknown> {
        let expireAt: number | undefined;

        for (let index = 0; index < options.length; index += 1) {
            if (String(options[index]).toUpperCase() === "PX") {
                expireAt = Date.now() + Number(options[index + 1]);
            }
        }

        this.#strings.set(key, expireAt === undefined ? { value } : { expireAt, value });

        return Promise.resolve("OK");
    }

    public del(...keys: string[]): Promise<number> {
        let removed = 0;

        for (const key of keys) {
            if (this.#strings.delete(key)) {
                removed += 1;
            }
        }

        return Promise.resolve(removed);
    }

    public eval(script: string, _numberOfKeys: number, ...args: (number | string)[]): Promise<unknown> {
        const key = String(args[0]);
        const token = String(args[1]);

        if (script === ACQUIRE_SCRIPT) {
            const current = this.#readString(key);

            if (current === null || current === token) {
                this.#strings.set(key, { expireAt: Date.now() + Number(args[2]), value: token });

                return Promise.resolve(1);
            }

            return Promise.resolve(0);
        }

        if (script === RELEASE_SCRIPT) {
            if (this.#readString(key) === token) {
                this.#strings.delete(key);

                return Promise.resolve(1);
            }

            return Promise.resolve(0);
        }

        throw new Error("FakeRedis received an unexpected eval script");
    }

    public zadd(key: string, score: number, member: string): Promise<unknown> {
        const set = this.#zsets.get(key) ?? new Map<string, number>();

        set.set(member, score);
        this.#zsets.set(key, set);

        return Promise.resolve(1);
    }

    public zrem(key: string, ...members: string[]): Promise<unknown> {
        const set = this.#zsets.get(key);
        let removed = 0;

        if (set) {
            for (const member of members) {
                if (set.delete(member)) {
                    removed += 1;
                }
            }
        }

        return Promise.resolve(removed);
    }

    public zrangebyscore(key: string, min: number | string, max: number | string, ...args: (number | string)[]): Promise<string[]> {
        const set = this.#zsets.get(key);

        if (!set) {
            return Promise.resolve([]);
        }

        const minimum = min === "-inf" ? Number.NEGATIVE_INFINITY : Number(min);
        const maximum = max === "+inf" ? Number.POSITIVE_INFINITY : Number(max);

        let offset = 0;
        let count = set.size;

        for (let index = 0; index < args.length; index += 1) {
            if (String(args[index]).toUpperCase() === "LIMIT") {
                offset = Number(args[index + 1]);
                count = Number(args[index + 2]);
            }
        }

        return Promise.resolve(
            [...set.entries()]
                .filter(([, score]) => score >= minimum && score <= maximum)
                .toSorted((a, b) => a[1] - b[1])
                .slice(offset, offset + count)
                .map(([member]) => member),
        );
    }

    #readString(key: string): string | null {
        const entry = this.#strings.get(key);

        if (entry === undefined) {
            return null;
        }

        if (entry.expireAt !== undefined && entry.expireAt <= Date.now()) {
            this.#strings.delete(key);

            return null;
        }

        return entry.value;
    }
}

export default FakeRedis;
