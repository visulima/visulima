import { describe, expect, it } from "vitest";

import { DEFAULT_MARSHALL_CONCURRENCY, mapWithConcurrency } from "../../src/security/marshalls/concurrency";

describe(mapWithConcurrency, () => {
    it("returns an empty array for empty input without running the task", async () => {
        expect.assertions(2);

        let callCount = 0;

        const results = await mapWithConcurrency([], 4, async (item: number) => {
            callCount += 1;

            return item;
        });

        expect(results).toStrictEqual([]);
        expect(callCount).toBe(0);
    });

    it("preserves input order in the result regardless of task latency", async () => {
        expect.assertions(1);

        const items = [10, 5, 30, 1, 20, 2];

        const results = await mapWithConcurrency(items, 3, async (delay) => {
            await new Promise((resolve) => {
                setTimeout(resolve, delay);
            });

            return delay * 2;
        });

        expect(results).toStrictEqual([20, 10, 60, 2, 40, 4]);
    });

    it("respects the concurrency cap", async () => {
        expect.assertions(2);

        let inFlight = 0;
        let observedMax = 0;
        const items = Array.from({ length: 20 }, (_, index) => index);

        const results = await mapWithConcurrency(items, 4, async (index) => {
            inFlight += 1;
            observedMax = Math.max(observedMax, inFlight);

            await new Promise((resolve) => {
                setTimeout(resolve, 5);
            });

            inFlight -= 1;

            return index;
        });

        expect(observedMax).toBeLessThanOrEqual(4);
        expect(results).toHaveLength(20);
    });

    it("does not spawn more workers than items when concurrency exceeds length", async () => {
        expect.assertions(1);

        let observedMax = 0;
        let inFlight = 0;
        const items = [1, 2, 3];

        await mapWithConcurrency(items, 100, async (value) => {
            inFlight += 1;
            observedMax = Math.max(observedMax, inFlight);

            await Promise.resolve();

            inFlight -= 1;

            return value;
        });

        expect(observedMax).toBeLessThanOrEqual(items.length);
    });

    it("treats concurrency <= 0 as 1 (no infinite loop, no zero workers)", async () => {
        expect.assertions(1);

        const items = [1, 2, 3];

        const results = await mapWithConcurrency(items, 0, async (value) => value * 10);

        expect(results).toStrictEqual([10, 20, 30]);
    });

    it("propagates the first rejection to the caller", async () => {
        expect.assertions(1);

        const items = [1, 2, 3, 4];

        await expect(
            mapWithConcurrency(items, 2, async (value) => {
                if (value === 2) {
                    throw new Error("boom");
                }

                return value;
            }),
        ).rejects.toThrow("boom");
    });

    it("passes the input index as the second argument", async () => {
        expect.assertions(1);

        const items = ["a", "b", "c"];
        const seen: [string, number][] = [];

        await mapWithConcurrency(items, 2, async (item, index) => {
            seen.push([item, index]);

            return item;
        });

        seen.sort((left, right) => left[1] - right[1]);

        expect(seen).toStrictEqual([["a", 0], ["b", 1], ["c", 2]]);
    });

    it("exposes a sensible default concurrency", () => {
        expect.assertions(1);

        expect(DEFAULT_MARSHALL_CONCURRENCY).toBe(8);
    });
});
