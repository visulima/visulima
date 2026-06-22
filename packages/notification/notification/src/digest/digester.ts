import type { Duration } from "@visulima/workflow";
import { Cron } from "croner";

import MemoryDigestStore from "./memory-digest-store";
import type { Digester, DigesterOptions, DigestEvent } from "./types";

const UNIT_MS: Record<string, number> = {
    days: 86_400_000,
    hours: 3_600_000,
    milliseconds: 1,
    minutes: 60_000,
    ms: 1,
    seconds: 1000,
    weeks: 604_800_000,
};

/** Resolve a digest {@link Duration} window to an absolute wake-at epoch ms. */
const resolveWakeAt = (window: Duration, from: number): number => {
    if (typeof window === "number") {
        return from + Math.max(0, window);
    }

    if ("cron" in window) {
        const next = new Cron(window.cron, window.tz ? { timezone: window.tz } : {}).nextRun(new Date(from));

        if (next === null) {
            throw new TypeError(`Cron expression "${window.cron}" has no future occurrence.`);
        }

        return next.getTime();
    }

    return from + Math.max(0, window.amount) * (UNIT_MS[window.unit] ?? 1);
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

    const add = async (event: PayloadT): Promise<{ key: string; opened: boolean }> => {
        const key = options.key(event);
        const window = typeof options.window === "function" ? options.window(event) : options.window;
        const digestEvent: DigestEvent<PayloadT> = { id: generateEventId(), payload: event, time: Date.now() };
        const opened = await store.append(key, digestEvent, resolveWakeAt(window, Date.now()));

        return { key, opened };
    };

    const sweep = async (now: number = Date.now(), limit = 100): Promise<number> => {
        const due = await store.due(now, limit);
        let flushed = 0;

        for (const key of due) {
            // eslint-disable-next-line no-await-in-loop -- windows drain/flush sequentially to keep onFlush ordering deterministic
            const window = await store.drain(key);

            if (window !== undefined && window.events.length > 0) {
                // eslint-disable-next-line no-await-in-loop -- see above
                await options.onFlush(window.events, key);
                flushed += 1;
            }
        }

        return flushed;
    };

    return { add, sweep };
};

export default createDigester;
