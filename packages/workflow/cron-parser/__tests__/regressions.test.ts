import { describe, expect, it } from "vitest";

import { CronParseError, parse } from "../src";
import { getZone } from "../src/zone";

/**
 * Defects the reference implementation is known to have, with the answers its reporters expected.
 * The expected values come from those reports, not from this implementation.
 */
describe("schedule lookups across clock changes", () => {
    describe("prev() after a spring-forward gap", () => {
        it("returns the run that was moved after the gap, not the day before", () => {
            expect.assertions(2);

            // 02:00 does not exist on 2020-03-08 in New York; the run lands at 03:00 EDT.
            const interval = parse("0 2 * * *", { currentDate: "2020-03-08T03:01:00.000-04:00", tz: "America/New_York" });

            expect(interval.prev().toISOString()).toBe("2020-03-08T07:00:00.000Z");
            expect(interval.next().toISOString()).toBe("2020-03-09T06:00:00.000Z");
        });

        it("agrees with next() when they are mixed", () => {
            expect.assertions(1);

            const interval = parse("0 2 * * *", { currentDate: "2020-03-08T03:01:00.000-04:00", tz: "America/New_York" });

            interval.next();

            expect(interval.prev().toISOString()).toBe("2020-03-08T07:00:00.000Z");
        });

        it.each(["2020-03-08T03:01:00.000-04:00", "2020-03-08T04:01:00.000-04:00"])("finds it from %s", (currentDate) => {
            expect.assertions(1);

            expect(parse("0 2 * * *", { currentDate, tz: "America/New_York" }).prev().toISOString()).toBe("2020-03-08T07:00:00.000Z");
        });

        it("keeps a next, next, prev walk from drifting", () => {
            expect.assertions(1);

            const interval = parse("*/5 12-23 * * *", { currentDate: "2025-07-25T06:40:00.000Z", tz: "UTC" });
            const seen: string[] = [];

            for (let index = 0; index < 6; index += 1) {
                seen.push(interval.next().toISOString());
                interval.next();
                interval.prev();
            }

            // Each round starts where the last one ended, five minutes on.
            expect(seen).toStrictEqual(["00", "05", "10", "15", "20", "25"].map((minute) => `2025-07-25T12:${minute}:00.000Z`));
        });
    });

    describe("a fall-back that moves the clock by less than an hour", () => {
        it.each(["0 8 * * *", "0 12 * * *", "0 2 * * *"])("%s steps past Lord Howe's change instead of hitting the loop limit", (expression) => {
            expect.assertions(1);

            // Lord Howe leaves daylight saving on 2024-04-07, going from 02:00 back to 01:30.
            const runs = parse(expression, { currentDate: new Date("2024-04-06T00:00:00Z"), tz: "Australia/Lord_Howe" }).take(4);

            expect(runs).toHaveLength(4);
        });

        it("returns 08:00 on the 7th at UTC+10:30", () => {
            expect.assertions(1);

            expect(
                parse("0 8 * * *", { currentDate: new Date("2024-04-06T00:00:00Z"), tz: "Australia/Lord_Howe" })
                    .next()
                    .toISOString(),
            ).toBe("2024-04-06T21:30:00.000Z");
        });

        it("runs an every-hour schedule on every wall clock hour across it", () => {
            expect.assertions(1);

            // The clock goes 02:00 -> 01:30 at 15:00Z, so after the 01:00 run at 14:00Z the next whole hour is 02:00
            // standard time, half an hour of real time later, and the hours after it stay on the half hour.

            const runs = parse("0 * * * *", { currentDate: new Date("2024-04-06T13:00:00Z"), tz: "Australia/Lord_Howe" }).take(4);

            expect(runs.map((run) => run.toISOString())).toStrictEqual([
                "2024-04-06T14:00:00.000Z",
                "2024-04-06T15:30:00.000Z",
                "2024-04-06T16:30:00.000Z",
                "2024-04-06T17:30:00.000Z",
            ]);
        });
    });

    describe("a repeated hour", () => {
        const options = { currentDate: "2025-11-02T02:00:00.000-05:00", tz: "America/New_York" };

        it("is run once going back, as it is going forward", () => {
            expect.assertions(2);

            // 01:30 happens twice on 2025-11-02 in New York: 05:30Z (EDT) and 06:30Z (EST).
            const interval = parse("0 30 1 * * *", options);

            expect(interval.prev().toISOString()).toBe("2025-11-02T05:30:00.000Z");
            expect(interval.prev().toISOString()).toBe("2025-11-01T05:30:00.000Z");
        });

        it("is run once going forward", () => {
            expect.assertions(1);

            const forward = parse("0 30 1 * * *", { currentDate: "2025-11-01T12:00:00.000Z", tz: "America/New_York" }).take(2);

            expect(forward.map((run) => run.toISOString())).toStrictEqual(["2025-11-02T05:30:00.000Z", "2025-11-03T06:30:00.000Z"]);
        });

        it("counts only the earlier pass in includesDate()", () => {
            expect.assertions(2);

            const interval = parse("0 30 1 * * *", options);

            expect(interval.includesDate(new Date("2025-11-02T05:30:00.000Z"))).toBe(true);
            expect(interval.includesDate(new Date("2025-11-02T06:30:00.000Z"))).toBe(false);
        });

        it("is run at both passes by an every-hour schedule", () => {
            expect.assertions(1);

            const runs = parse("30 * * * *", { currentDate: "2025-11-02T04:00:00.000Z", tz: "America/New_York" }).take(3);

            expect(runs.map((run) => run.toISOString())).toStrictEqual(["2025-11-02T04:30:00.000Z", "2025-11-02T05:30:00.000Z", "2025-11-02T06:30:00.000Z"]);
        });

        it("does not depend on where inside the hour the search starts", () => {
            expect.assertions(2);

            // Toronto, 2020-11-01: 01:10 happens at 05:10Z (EDT) and 06:10Z (EST). Every second of it is a run, once.
            const expression = "* 10 1 * * 0";
            const fromFirstPass = parse(expression, {
                currentDate: "2020-11-01T05:55:00.000Z",
                endDate: "2020-11-01T06:30:00.000Z",
                tz: "America/Toronto",
            });
            const fromSecondPass = parse(expression, {
                currentDate: "2020-11-01T06:00:00.000Z",
                endDate: "2020-11-01T06:30:00.000Z",
                tz: "America/Toronto",
            });

            expect(() => fromFirstPass.next()).toThrow("Out of the time span range");
            expect(() => fromSecondPass.next()).toThrow("Out of the time span range");
        });
    });

    describe("a skipped hour that starts mid-hour", () => {
        it("walks back across Chatham's 02:45 -> 03:45 gap", () => {
            expect.assertions(1);

            // Midnight on the 27th, 26th and 25th at UTC+13:45, then +12:45 before the change.
            const runs = parse("0 0 * * *", { currentDate: "2022-09-26T10:15:00.000Z", tz: "Pacific/Chatham" }).take(-3);

            expect(runs.map((run) => run.toISOString())).toStrictEqual(["2022-09-25T10:15:00.000Z", "2022-09-24T11:15:00.000Z", "2022-09-23T11:15:00.000Z"]);
        });

        it("runs a time inside the gap at the same minute of the first hour after it", () => {
            expect.assertions(2);

            // 03:00 does not exist; the gap began at 02:45, so it runs 15 minutes after the change, at 04:00 local.
            const interval = parse("0 3 * * *", { currentDate: "2022-09-24T12:00:00.000Z", tz: "Pacific/Chatham" });

            expect(interval.next().toISOString()).toBe("2022-09-24T14:15:00.000Z");
            expect(interval.next().toISOString()).toBe("2022-09-25T13:15:00.000Z");
        });
    });

    describe("sparse schedules", () => {
        it("finds the fifth Wednesday of February after 2040", () => {
            expect.assertions(1);

            expect(parse("0 0 * 2 3#5", { currentDate: "2040-03-01T00:00:00.000Z", tz: "UTC" }).next().toISOString()).toBe("2068-02-29T00:00:00.000Z");
        });
    });

    describe("start and end dates", () => {
        it("includes a run that falls exactly on startDate", () => {
            expect.assertions(1);

            const interval = parse("0 12 * * *", {
                endDate: "2020-02-19T13:00:00.000Z",
                startDate: "2020-02-19T12:00:00.000Z",
                tz: "UTC",
            });

            expect(interval.next().toISOString()).toBe("2020-02-19T12:00:00.000Z");
        });

        it("includes a run that falls exactly on endDate", () => {
            expect.assertions(1);

            const interval = parse("0 13 * * *", {
                currentDate: "2020-02-19T12:00:00.000Z",
                endDate: "2020-02-19T13:00:00.000Z",
                tz: "UTC",
            });

            expect(interval.next().toISOString()).toBe("2020-02-19T13:00:00.000Z");
        });

        it("does not return the cursor itself", () => {
            expect.assertions(1);

            const interval = parse("0 12 * * *", { currentDate: "2020-02-19T12:00:00.000Z", tz: "UTC" });

            expect(interval.next().toISOString()).toBe("2020-02-20T12:00:00.000Z");
        });

        it("returns to the start after reset()", () => {
            expect.assertions(2);

            const interval = parse("0 12 * * *", { startDate: "2020-02-19T12:00:00.000Z", tz: "UTC" });

            interval.next();
            interval.next();
            interval.reset();

            expect(interval.next().toISOString()).toBe("2020-02-19T12:00:00.000Z");
            expect(interval.next().toISOString()).toBe("2020-02-20T12:00:00.000Z");
        });
    });

    describe("a skipped calendar day", () => {
        it("drops a run on a day that never happened instead of moving it", () => {
            expect.assertions(1);

            // Samoa lost 30 December 2011, so 12:00 on the 30th has no time to run at. The next ones are
            // 12:00 on 30 December 2012 and 2013, at UTC+14.
            const runs = parse("0 12 30 12 *", { currentDate: "2011-12-01T00:00:00.000Z", tz: "Pacific/Apia" }).take(2);

            expect(runs.map((run) => run.toISOString())).toStrictEqual(["2012-12-29T22:00:00.000Z", "2013-12-29T22:00:00.000Z"]);
        });
    });

    describe("an every-second schedule across a day-long gap", () => {
        // Samoa skipped 30 December 2011 at 10:00Z: 86 400 seconds of wall clock time that never happen.
        const options = { currentDate: "2011-12-30T07:00:00.000Z", tz: "Pacific/Apia" };

        it("finds the previous run instead of giving up", () => {
            expect.assertions(2);

            const interval = parse("* * * * * *", options);

            expect(interval.hasPrev()).toBe(true);
            expect(interval.prev().toISOString()).toBe("2011-12-30T06:59:59.000Z");
        });

        it("walks back and forward over it", () => {
            expect.assertions(2);

            const after = parse("*/10 * * * * *", { currentDate: "2011-12-30T10:00:05.000Z", tz: "Pacific/Apia" });
            const before = parse("*/10 * * * * *", { currentDate: "2011-12-30T09:59:55.000Z", tz: "Pacific/Apia" });

            // The clock reads 23:59:50 on the 29th, then 00:00:00 on the 31st.
            expect(after.take(-2).map((run) => run.toISOString())).toStrictEqual(["2011-12-30T10:00:00.000Z", "2011-12-30T09:59:50.000Z"]);
            expect(before.take(2).map((run) => run.toISOString())).toStrictEqual(["2011-12-30T10:00:00.000Z", "2011-12-30T10:00:10.000Z"]);
        });

        it("recognises a run just before it in includesDate()", () => {
            expect.assertions(1);

            expect(parse("* * * * * *", options).includesDate(new Date("2011-12-30T06:59:59.000Z"))).toBe(true);
        });
    });
});

describe("input that used to be read as something else", () => {
    it("rejects a range with more than two parts instead of dropping the rest", () => {
        expect.assertions(1);

        expect(() => parse("0 1-5-9 * * *")).toThrow("Invalid range: 1-5-9");
    });

    it.each(["8L", "15L", "65L"])("rejects %s as a day of week", (text) => {
        expect.assertions(1);

        expect(() => parse(`0 0 * * ${text}`)).toThrow("Validation error");
    });

    it.each(["0L", "5L", "7L"])("accepts %s as a day of week", (text) => {
        expect.assertions(1);

        expect(parse(`0 0 * * ${text}`).stringify()).toBe(`0 0 * * ${text}`);
    });

    it("looks up an offset a fraction of a second after a clock change", () => {
        expect.assertions(1);

        // The first probe lands 500 ms after New York's 2026-03-08 transition; narrowing used to stall there for good.
        expect(getZone("America/New_York").offset(Date.UTC(2026, 2, 7, 7, 0, 0, 500))).toBe(-300);
    });
    it.each(["*/2-3", "1-10/2-3"])("rejects a step that is not a plain integer: %s", (expression) => {
        expect.assertions(1);

        expect(() => parse(`${expression} * * * *`)).toThrow(expect.objectContaining({ code: "INVALID_STEP" }));
    });

    it.each(["constructor", "toString", "__proto__", "hasOwnProperty"])("treats the inherited name %s as an invalid expression", (name) => {
        expect.assertions(1);

        expect(() => parse(name)).toThrow(CronParseError);
    });
});
