import { createStorage } from "unstorage";
import { describe, expect, it } from "vitest";

import createDigester from "../src/digest/digester";
import type { DigestEvent, DigestStore } from "../src/digest/types";
import UnstorageDigestStore from "../src/digest/unstorage-digest-store";

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

            expect(first.opened).toBe(true);
            expect(second.opened).toBe(false);

            await digester.sweep(Date.now() + 2000);

            expect(flushes).toStrictEqual([{ count: 2, key: "u1:p1" }]);
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

        expect(result.opened).toBe(true);
        expect(flushes).toBe(0);
    });
});
