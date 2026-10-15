/* eslint-disable vitest/prefer-expect-assertions, vitest/prefer-strict-equal -- ported from the reference implementation's suite; kept close to the original for easy comparison */
import { describe, expect, it } from "vitest";

import { seededRandom } from "../src/utils/random";

describe(seededRandom, () => {
    it("should return a random value each call when no seed is provided", () => {
        const rand = seededRandom();

        const first = rand();

        expect(first).toEqual(expect.any(Number));

        const second = rand();

        expect(second).toEqual(expect.any(Number));
        expect(second).not.toBe(first);

        const rand2 = seededRandom();

        const third = rand2();

        expect(third).toEqual(expect.any(Number));
        expect(third).not.toBe(first);

        const fourth = rand2();

        expect(fourth).toEqual(expect.any(Number));
        expect(fourth).not.toBe(third);
        expect(fourth).not.toBe(second);
    });

    it("should return the same value each ordered call when a seed is provided", () => {
        const rand = seededRandom("F00D");

        expect(Math.floor(rand() * 100_000)).toBe(8440);
        expect(Math.floor(rand() * 100_000)).toBe(57_228);
        expect(Math.floor(rand() * 100_000)).toBe(66_401);
        expect(Math.floor(rand() * 100_000)).toBe(60_998);
    });
});
