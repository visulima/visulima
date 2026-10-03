import type { BigIntStats } from "node:fs";

import { describe, expect, it } from "vitest";

import isStatsIdentical from "../../../../src/ensure/utils/is-stats-identical";

const stats = (dev: bigint, ino: bigint): BigIntStats => ({ dev, ino }) as BigIntStats;

describe(isStatsIdentical, () => {
    it("should treat the same device and inode as the same file", () => {
        expect.assertions(1);

        expect(isStatsIdentical(stats(1n, 42n), stats(1n, 42n))).toBe(true);
    });

    it("should tell apart 64-bit inodes that collide as numbers (NTFS file ids on Windows)", () => {
        expect.assertions(2);

        const ino = 2n ** 60n;

        // As plain numbers both inodes round to the same value...
        expect(Number(ino)).toBe(Number(ino + 1n));
        // ...but they are different files
        expect(isStatsIdentical(stats(1n, ino), stats(1n, ino + 1n))).toBe(false);
    });

    it("should not treat files on different devices as identical", () => {
        expect.assertions(1);

        expect(isStatsIdentical(stats(1n, 42n), stats(2n, 42n))).toBe(false);
    });

    it("should not trust a zero inode or device", () => {
        expect.assertions(2);

        expect(isStatsIdentical(stats(1n, 0n), stats(1n, 0n))).toBe(false);
        expect(isStatsIdentical(stats(0n, 42n), stats(0n, 42n))).toBe(false);
    });
});
