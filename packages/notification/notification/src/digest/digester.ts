import type { Duration, DurationUnit } from "@visulima/workflow";

import NotificationError from "../errors/notification-error";
import MemoryDigestStore from "./memory-digest-store";
import type { Digester, DigesterOptions, DigestEvent } from "./types";

const UNIT_MS: Record<DurationUnit, number> = {
    days: 86_400_000,
    hours: 3_600_000,
    milliseconds: 1,
    minutes: 60_000,
    ms: 1,
    seconds: 1000,
    weeks: 604_800_000,
};

/**
 * Resolve a digest {@link Duration} window to an absolute wake-at epoch ms. Mirrors
 * the workflow engine's resolver (kept local to avoid exposing an internal engine
 * helper); rejects non-finite values so a bad window cannot strand or instantly
 * flush a window. `croner` is imported lazily so time-only digests do not need it.
 */
const resolveWakeAt = async (window: Duration, from: number): Promise<number> => {
    if (typeof window === "number") {
        if (!Number.isFinite(window)) {
            throw new NotificationError("digest", `Window must be a finite number of milliseconds. Received: ${String(window)}.`);
        }

        return from + Math.max(0, window);
    }

    if ("cron" in window) {
        const { Cron } = await import("croner");
        const next = new Cron(window.cron, window.tz ? { timezone: window.tz } : {}).nextRun(new Date(from));

        if (next === null) {
            throw new NotificationError("digest", `Cron expression "${window.cron}" has no future occurrence.`);
        }

        return next.getTime();
    }

    if (!Number.isFinite(window.amount)) {
        throw new NotificationError("digest", `Window amount must be a finite number. Received: ${String(window.amount)}.`);
    }

    return from + Math.max(0, window.amount) * UNIT_MS[window.unit];
};

// eslint-disable-next-line n/no-unsupported-features/node-builtins -- Web Crypto global keeps the digester edge-safe with no node:crypto import
const generateEventId = (): string => globalThis.crypto.randomUUID();

/**
 * Create a {@link Digester} that batches events into time/cron windows keyed by
 * `options.key`, flushing each closed window once via `options.onFlush` — turning
 * a burst of N events into a single notification.
 *
 * Windows close on a poll: call {@link Digester.sweep} from a cron job, a
 * Cloudflare alarm, or any timer (alongside a workflow runtime's `sweep`).
 * @param options Key function, window duration, flush handler and optional store.
 * @returns A {@link Digester}.
 * @example
 * ```ts
 * const digester = createDigester<{ subscriberId: string; postId: string }>({
 *     key: (event) => `${event.subscriberId}:${event.postId}`,
 *     window: { amount: 10, unit: "minutes" },
 *     onFlush: (events) => runtime.trigger(summaryWorkflow, { count: events.length, events }),
 * });
 *
 * await digester.add({ subscriberId: "u1", postId: "p1" }); // opens a 10-minute window
 * // …later, on a timer:
 * await digester.sweep();
 * ```
 */
const createDigester = <PayloadT>(options: DigesterOptions<PayloadT>): Digester<PayloadT> => {
    const store = options.store ?? new MemoryDigestStore<PayloadT>();

    const add = async (event: PayloadT): Promise<boolean> => {
        const key = options.key(event);
        const window = typeof options.window === "function" ? options.window(event) : options.window;
        const digestEvent: DigestEvent<PayloadT> = { id: generateEventId(), payload: event, time: Date.now() };

        return store.append(key, digestEvent, await resolveWakeAt(window, Date.now()));
    };

    const sweep = async (now: number = Date.now(), limit = 100): Promise<number> => {
        if (!Number.isInteger(limit) || limit <= 0) {
            throw new NotificationError("digest", `sweep limit must be a positive integer. Received: ${String(limit)}.`);
        }

        const due = await store.due(now, limit);
        let flushed = 0;

        for (const key of due) {
            // eslint-disable-next-line no-await-in-loop -- windows flush sequentially to keep onFlush ordering deterministic
            const window = await store.read(key);

            if (window !== undefined && window.events.length > 0) {
                // Flush BEFORE removing: a throwing onFlush leaves the window in place to retry (at-least-once).
                // eslint-disable-next-line no-await-in-loop -- see above
                await options.onFlush(window.events, key);
                flushed += 1;
            }

            if (window !== undefined) {
                // eslint-disable-next-line no-await-in-loop -- see above
                await store.remove(key);
            }
        }

        return flushed;
    };

    return { add, sweep };
};

export default createDigester;
