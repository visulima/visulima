import type { Stats } from "node:fs";

const isStatsIdentical = (sourceStat: Stats, destinationStat: Stats): boolean =>
    !!destinationStat.ino && !!destinationStat.dev && destinationStat.ino === sourceStat.ino && destinationStat.dev === sourceStat.dev;

export default isStatsIdentical;
