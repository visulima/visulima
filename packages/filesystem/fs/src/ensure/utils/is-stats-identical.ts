import type { BigIntStats } from "node:fs";

/**
 * Whether two stats describe the same file (same device and inode).
 *
 * Takes `bigint` stats on purpose: NTFS file ids are 64-bit, so as plain numbers the `ino` of two
 * different files can round to the same value and be mistaken for the same file on Windows.
 * @param sourceStat Stats of the source, read with `{ bigint: true }`.
 * @param destinationStat Stats of the destination, read with `{ bigint: true }`.
 * @returns `true` when both stats refer to the same file.
 */
const isStatsIdentical = (sourceStat: BigIntStats, destinationStat: BigIntStats): boolean =>
    destinationStat.ino !== 0n && destinationStat.dev !== 0n && destinationStat.ino === sourceStat.ino && destinationStat.dev === sourceStat.dev;

export default isStatsIdentical;
