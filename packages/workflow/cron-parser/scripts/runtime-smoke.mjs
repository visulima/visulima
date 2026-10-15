// Runs the built package on whichever runtime executes this file: `node`, `bun run`, or `deno run`.
// It uses no test framework so the same file works everywhere.
import { CronDate, parse } from "../dist/index.js";
import { parseFile, parseFileSync } from "../dist/file.js";

const runtime = globalThis.Deno ? `deno ${Deno.version.deno}` : globalThis.Bun ? `bun ${Bun.version}` : `node ${process.version}`;

const expectEqual = (label, actual, expected) => {
    if (actual !== expected) {
        throw new Error(`${label}: expected ${expected}, got ${actual}`);
    }
};

// 09:00 New York, either side of the 2021-03-14 DST change.
const daily = parse("0 9 * * *", { currentDate: "2021-03-13T00:00:00Z", tz: "America/New_York" });

expectEqual("before DST", daily.next().toISOString(), "2021-03-13T14:00:00.000Z");
expectEqual("after DST", daily.next().toISOString(), "2021-03-14T13:00:00.000Z");

// 02:30 does not exist on that day; the run lands after the gap.
const gap = parse("30 2 * * *", { currentDate: "2021-03-13T12:00:00Z", tz: "America/New_York" });

expectEqual("DST gap", gap.next().toISOString(), "2021-03-14T07:30:00.000Z");

expectEqual("kathmandu offset", new CronDate("2021-01-01T00:00:00Z", "Asia/Kathmandu").getUTCOffset(), 345);
expectEqual("lord howe offset", new CronDate("2021-01-01T00:00:00Z", "Australia/Lord_Howe").getUTCOffset(), 660);
expectEqual("wall clock string", new CronDate("Mon, 4 Jan 2021 10:00:00", "America/New_York").toISOString(), "2021-01-04T15:00:00.000Z");
expectEqual(
    "previous run",
    parse("*/15 * * * *", { currentDate: "2021-06-01T10:07:00Z", tz: "UTC" }).prev().toISOString(),
    "2021-06-01T10:00:00.000Z",
);

let threw = false;

try {
    new CronDate("2021-01-01T00:00:00Z", "Mars/Olympus_Mons");
} catch {
    threw = true;
}

expectEqual("unknown zone throws", threw, true);
expectEqual("file entry loads", typeof parseFileSync, "function");

console.log(`ok ${runtime}`);
