import type { Duration, MaybePromise } from "@visulima/workflow";

/** A single event buffered inside a digest window. */
export interface DigestEvent<PayloadT> {
    /** Stable id of this event within the window. */
    id: string;
    /** The event payload. */
    payload: PayloadT;
    /** Epoch ms the event was added. */
    time: number;
}

/** An open digest window: the events collected so far for a key, and when it closes. */
export interface DigestWindow<PayloadT> {
    events: DigestEvent<PayloadT>[];
    key: string;
    /** Epoch ms at which the window is due to flush. */
    wakeAt: number;
}

/**
 * Durability contract for `createDigester`. Implementations own the buffered
 * windows and the "what is due" query; the digester stays storage-agnostic.
 *
 * `read` and `remove` are separate (rather than a single destructive `drain`) so
 * the digester can flush a window's events *before* removing it — a failed flush
 * leaves the window in place to be retried (at-least-once).
 */
export interface DigestStore<PayloadT> {
    /**
     * Append an event to the window for `key`, opening it (with `wakeAt`) if absent.
     * The window's `wakeAt` is fixed when it opens — later events do not extend it.
     * @returns `true` if this call opened a new window.
     */
    append: (key: string, event: DigestEvent<PayloadT>, wakeAt: number) => Promise<boolean>;
    /** Keys whose window `wakeAt` is at or before `now`, up to `limit`. */
    due: (now: number, limit: number) => Promise<string[]>;
    /** Return the window for `key` without removing it, or `undefined` if none. */
    read: (key: string) => Promise<DigestWindow<PayloadT> | undefined>;
    /** Permanently remove the window for `key`. */
    remove: (key: string) => Promise<void>;
}

/** Options for `createDigester`. */
export interface DigesterOptions<PayloadT> {
    /** Group events into windows by this key (e.g. `subscriberId` or `subscriberId:postId`). */
    key: (event: PayloadT) => string;

    /**
     * Called once per window when it closes, with every event collected. Delivery is
     * **at-least-once**: the window is removed only after `onFlush` resolves, so a
     * throwing `onFlush` is retried on the next sweep (and may run again if removal
     * later fails). Make it idempotent.
     */
    onFlush: (events: DigestEvent<PayloadT>[], key: string) => MaybePromise<void>;
    /** The durable store; defaults to an in-memory store. */
    store?: DigestStore<PayloadT>;
    /** How long a window stays open from its first event (a {@link Duration} or a per-event function). */
    window: ((event: PayloadT) => Duration) | Duration;
}

/** Aggregates many events into windowed batches, flushing each as one notification. */
export interface Digester<PayloadT> {
    /** Buffer an event; returns `true` if it opened a new window for its key. */
    add: (event: PayloadT) => Promise<boolean>;
    /** Flush every window whose wake-at has passed; returns the number flushed. */
    sweep: (now?: number, limit?: number) => Promise<number>;
}
