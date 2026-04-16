/**
 * Tiny global concurrency limiter — no `p-limit` dep. Tracks in-flight promises
 * and blocks `.run()` when at capacity. Fine for the validator's use case
 * (findings ≪ 10_000; per-scan work measured in seconds).
 */
export class ConcurrencyLimiter {
    private active = 0;

    private readonly capacity: number;

    private readonly queue: (() => void)[] = [];

    public constructor(capacity: number) {
        this.capacity = Math.max(1, capacity);
    }

    public async run<T>(fn: () => Promise<T>): Promise<T> {
        if (this.active >= this.capacity) {
            await new Promise<void>((resolve) => {
                this.queue.push(resolve);
            });
        }

        this.active += 1;

        try {
            return await fn();
        } finally {
            this.active -= 1;
            const next = this.queue.shift();

            if (next) {
                next();
            }
        }
    }
}
