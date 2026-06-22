import { createStorage } from "unstorage";
import { describe, expect, it } from "vitest";

import createDigester from "../src/digest/digester";
import type { DigestEvent, DigestStore } from "../src/digest/types";
import UnstorageDigestStore from "../src/digest/unstorage-digest-store";

const FINITE_PATTERN = /finite/i;

interface Liked {
    postId: string;
    subscriberId: string;
}

const runDigesterContract = (name: string, makeStore: () => DigestStore<Liked> | undefined): void => {
    describe(name, () => {
        it("opens a window on the first event and batches later ones for the same key", async () => {
            expect.assertions(3);

            const flushes: { count: number; key: string }[] = [];
            const digester = createDigester<Liked>({
                key: (event) => `${event.subscriberId}:${event.postId}`,
                onFlush: (events: DigestEvent<Liked>[], key) => {
                    flushes.push({ count: events.length, key });
                },
                store: makeStore(),
                window: 1000,
            });

            const first = await digester.add({ postId: "p1", subscriberId: "u1" });
            const second = await digester.add({ postId: "p1", subscriberId: "u1" });

            expect(first).toBe(true);
            expect(second).toBe(false);

            await digester.sweep(Date.now() + 2000);

            expect(flushes).toStrictEqual([{ count: 2, key: "u1:p1" }]);
        });

        it("opens a fresh window after a previous one is flushed", async () => {
            expect.assertions(3);

            let flushes = 0;
            const digester = createDigester<Liked>({
                key: (event) => event.subscriberId,
                onFlush: () => {
                    flushes += 1;
                },
                store: makeStore(),
                window: 1000,
            });

            await digester.add({ postId: "p", subscriberId: "u1" });
            await digester.sweep(Date.now() + 2000);

            // A new event for the same key after the flush opens a brand-new window.
            const reopened = await digester.add({ postId: "p", subscriberId: "u1" });

            expect(reopened).toBe(true);

            const flushedAgain = await digester.sweep(Date.now() + 4000);

            expect(flushedAgain).toBe(1);
            expect(flushes).toBe(2);
        });

        it("retries a window whose onFlush throws (at-least-once)", async () => {
            expect.assertions(2);

            let attempts = 0;
            const digester = createDigester<Liked>({
                key: (event) => event.subscriberId,
                onFlush: () => {
                    attempts += 1;

                    if (attempts === 1) {
                        throw new Error("transient");
                    }
                },
                store: makeStore(),
                window: 1000,
            });

            await digester.add({ postId: "p", subscriberId: "u1" });

            // First sweep: onFlush throws, so the window is NOT removed.
            await expect(digester.sweep(Date.now() + 2000)).rejects.toThrow("transient");

            // Second sweep: the window is still there and flushes successfully.
            const flushed = await digester.sweep(Date.now() + 2000);

            expect(flushed).toBe(1);
        });

        it("caps a sweep at `limit` and carries the rest to the next sweep", async () => {
            expect.assertions(2);

            const digester = createDigester<Liked>({
                key: (event) => event.subscriberId,
                onFlush: () => undefined,
                store: makeStore(),
                window: 1000,
            });

            await digester.add({ postId: "p", subscriberId: "u1" });
            await digester.add({ postId: "p", subscriberId: "u2" });
            await digester.add({ postId: "p", subscriberId: "u3" });

            const now = Date.now() + 2000;

            await expect(digester.sweep(now, 2)).resolves.toBe(2);
            await expect(digester.sweep(now, 2)).resolves.toBe(1);
        });

        it("rejects a non-positive sweep limit", async () => {
            expect.assertions(1);

            const digester = createDigester<Liked>({
                key: (event) => event.subscriberId,
                onFlush: () => undefined,
                store: makeStore(),
                window: 1000,
            });

            await expect(digester.sweep(Date.now(), 0)).rejects.toThrow("limit");
        });

        it("keeps separate windows per key and only flushes due ones", async () => {
            expect.assertions(3);

            const flushed: string[] = [];
            const digester = createDigester<Liked>({
                key: (event) => `${event.subscriberId}:${event.postId}`,
                onFlush: (_events, key) => {
                    flushed.push(key);
                },
                store: makeStore(),
                window: 1000,
            });

            await digester.add({ postId: "p1", subscriberId: "u1" });
            await digester.add({ postId: "p2", subscriberId: "u2" });

            // Not due yet.
            await expect(digester.sweep(Date.now())).resolves.toBe(0);

            const flushedCount = await digester.sweep(Date.now() + 2000);

            expect(flushedCount).toBe(2);
            expect(flushed.toSorted((a, b) => a.localeCompare(b))).toStrictEqual(["u1:p1", "u2:p2"]);
        });

        it("isolates a user key named like the metadata key from the wake index", async () => {
            expect.assertions(2);

            const flushed: string[] = [];
            const digester = createDigester<Liked>({
                // A key of "index" would collide with a naive shared namespace.
                key: (event) => event.subscriberId,
                onFlush: (_events, key) => {
                    flushed.push(key);
                },
                store: makeStore(),
                window: 1000,
            });

            await digester.add({ postId: "p", subscriberId: "index" });
            await digester.add({ postId: "p", subscriberId: "other" });

            const flushedCount = await digester.sweep(Date.now() + 2000);

            expect(flushedCount).toBe(2);
            expect(flushed.toSorted((a, b) => a.localeCompare(b))).toStrictEqual(["index", "other"]);
        });
    });
};

runDigesterContract("MemoryDigestStore (default)", () => undefined);
runDigesterContract("UnstorageDigestStore", () => new UnstorageDigestStore<Liked>(createStorage()));

describe("createDigester windows", () => {
    it("supports a cron window that is not yet due", async () => {
        expect.assertions(2);

        let flushes = 0;
        const digester = createDigester<Liked>({
            key: (event) => event.subscriberId,
            onFlush: () => {
                flushes += 1;
            },
            window: { cron: "0 0 1 1 *" },
        });

        const result = await digester.add({ postId: "p1", subscriberId: "u1" });

        // The next "Jan 1st midnight" is in the future, so a now-sweep flushes nothing.
        await digester.sweep(Date.now());

        expect(result).toBe(true);
        expect(flushes).toBe(0);
    });

    it("supports a per-event window function", async () => {
        expect.assertions(2);

        let flushed = 0;
        const digester = createDigester<Liked>({
            key: (event) => event.subscriberId,
            onFlush: () => {
                flushed += 1;
            },
            window: (event) => {
                const ms = event.postId === "fast" ? 100 : 10_000;

                return ms;
            },
        });

        await digester.add({ postId: "fast", subscriberId: "u1" });
        await digester.add({ postId: "slow", subscriberId: "u2" });

        // Only the short (100ms) window is due at +1s; the 10s one is not.
        const count = await digester.sweep(Date.now() + 1000);

        expect(count).toBe(1);
        expect(flushed).toBe(1);
    });

    it("rejects a non-finite window", async () => {
        expect.assertions(1);

        const digester = createDigester<Liked>({
            key: (event) => event.subscriberId,
            onFlush: () => undefined,
            window: Number.NaN,
        });

        await expect(digester.add({ postId: "p", subscriberId: "u1" })).rejects.toThrow(FINITE_PATTERN);
    });
});
