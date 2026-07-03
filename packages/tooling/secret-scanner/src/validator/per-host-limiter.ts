/**
 * Per-host rate limiter layered on top of the global `ConcurrencyLimiter`.
 * Keeps well-intentioned scans from hammering any single provider — a repo
 * with 200 GitHub tokens won't fire 200 concurrent requests to
 * `api.github.com`, it'll fire at most `capacity`.
 *
 * When the caller reports a rate-limit (`notifyRetryAfter`) we also pause
 * every pending call for that host until the Retry-After deadline. This is
 * a cheap knob — we don't retry the failed call ourselves, but we stop
 * compounding the problem for the rest of the scan.
 */
export class PerHostLimiter {
    private readonly inFlight = new Map<string, number>();

    private readonly pauseUntil = new Map<string, number>();

    private readonly queues = new Map<string, (() => void)[]>();

    private readonly capacity: number;

    public constructor(capacity = 4) {
        this.capacity = Math.max(1, capacity);
    }

    // eslint-disable-next-line class-methods-use-this -- Kept on the limiter for API cohesion: callers pass the URL to the same object that gates requests.
    public hostFromUrl(url: string): string {
        try {
            return new URL(url).host;
        } catch {
            return "__invalid__";
        }
    }

    public async run<T>(host: string, fn: () => Promise<T>): Promise<T> {
        await this.acquire(host);

        try {
            return await fn();
        } finally {
            const remaining = (this.inFlight.get(host) ?? 1) - 1;

            if (remaining <= 0) {
                this.inFlight.delete(host);
            } else {
                this.inFlight.set(host, remaining);
            }

            const waiters = this.queues.get(host);
            const next = waiters?.shift();

            if (next) {
                next();
            }

            // Drop the entry once its queue empties — otherwise a long-running
            // process that visits many distinct hosts accumulates one empty-Vec
            // entry per host for the lifetime of the limiter.
            if (waiters?.length === 0) {
                this.queues.delete(host);
            }
        }
    }

    /**
     * Mark a host as paused until `deadlineMs` (epoch ms). Subsequent `.run`
     * calls for that host will block until the deadline passes. Intended for
     * `Retry-After` honour — we don't retry the failed request, we just stop
     * new requests piling on behind it.
     */
    public notifyRetryAfter(host: string, deadlineMs: number): void {
        const existing = this.pauseUntil.get(host) ?? 0;

        if (deadlineMs > existing) {
            this.pauseUntil.set(host, deadlineMs);
        }
    }

    /**
     * Reserve a slot for `host` — increments `inFlight` synchronously before
     * returning so concurrent callers see the updated count on the next
     * scheduler tick. `run()` pairs every successful acquire with a release
     * in its `finally`.
     */
    private async acquire(host: string): Promise<void> {
        for (;;) {
            const paused = this.pauseUntil.get(host);
            const now = Date.now();

            if (paused !== undefined && paused > now) {
                // eslint-disable-next-line no-await-in-loop -- Sequential semantics: must wait for the pause window before re-checking.
                await new Promise<void>((resolve) => {
                    setTimeout(() => {
                        resolve();
                    }, paused - now);
                });

                continue;
            }

            const current = this.inFlight.get(host) ?? 0;

            if (current < this.capacity) {
                this.inFlight.set(host, current + 1);

                return;
            }

            // eslint-disable-next-line no-await-in-loop -- Sequential semantics: must wait for a slot before re-checking capacity.
            await new Promise<void>((resolve) => {
                let waiters = this.queues.get(host);

                if (!waiters) {
                    waiters = [];
                    this.queues.set(host, waiters);
                }

                waiters.push(resolve);
            });
        }
    }
}
