import { describe, expect, it } from "vitest";

import { CronDate, parse } from "../src";
import { getZone, resolveLocal, startOfDay, toLocalMs, wallInstants, weekdayOf } from "../src/zone";
import { HOUR } from "./_helpers/clock-changes";

const expectedBackend = "Temporal" in globalThis ? "temporal" : "intl";

describe("zone", () => {
    it("uses the backend the runtime offers", () => {
        expect.assertions(1);

        expect(getZone("Europe/Athens").backend).toBe(expectedBackend);
    });

    it("rejects an unknown zone", () => {
        expect.assertions(1);

        expect(() => getZone("Mars/Olympus_Mons")).toThrow("CronDate: unhandled timezone: Mars/Olympus_Mons");
    });

    it("answers UTC without a lookup", () => {
        expect.assertions(3);

        expect(getZone("UTC").offset(Date.UTC(2021, 5, 1))).toBe(0);
        expect(getZone("Etc/GMT").utc).toBe(true);
        expect(getZone("UTC").backend).toBe("utc");
    });

    it("treats names that differ only in case as one zone", () => {
        expect.assertions(2);

        expect(getZone("europe/london")).toBe(getZone("Europe/London"));
        expect(getZone("EUROPE/LONDON").offset(Date.UTC(2021, 6, 1))).toBe(60);
    });

    it("reports the offset on both sides of a DST change", () => {
        expect.assertions(2);

        const newYork = getZone("America/New_York");

        expect(newYork.offset(Date.UTC(2021, 0, 15))).toBe(-300);
        expect(newYork.offset(Date.UTC(2021, 6, 15))).toBe(-240);
    });

    it("reports half-hour and 45-minute zones", () => {
        expect.assertions(2);

        expect(getZone("Asia/Kathmandu").offset(Date.UTC(2021, 0, 1))).toBe(345);
        expect(getZone("Australia/Lord_Howe").offset(Date.UTC(2021, 0, 1))).toBe(660);
    });

    it("moves a wall clock time inside a DST gap past the gap", () => {
        expect.assertions(1);

        // 2021-03-14 02:30 does not exist in New York; clocks jump from 02:00 to 03:00.
        const [epoch] = resolveLocal(Date.UTC(2021, 2, 14, 2, 30), -300, getZone("America/New_York"));

        expect(new Date(epoch).toISOString()).toBe("2021-03-14T07:30:00.000Z");
    });

    it("keeps the occurrence it is already in when a wall clock time happens twice", () => {
        expect.assertions(2);

        // 2021-11-07 01:30 happens twice in New York (EDT, then EST).
        const local = Date.UTC(2021, 10, 7, 1, 30);
        const newYork = getZone("America/New_York");

        expect(new Date(resolveLocal(local, -240, newYork)[0]).toISOString()).toBe("2021-11-07T05:30:00.000Z");
        expect(new Date(resolveLocal(local, -300, newYork)[0]).toISOString()).toBe("2021-11-07T06:30:00.000Z");
    });

    it("accepts fractional epoch milliseconds", () => {
        expect.assertions(2);

        // Europe/London was on British Standard Time (UTC+1) all of 1970.
        expect(getZone("Europe/London").offset(1000.5)).toBe(60);
        expect(parse("0 0 * * *", { currentDate: 1000.5, tz: "Europe/London" }).next().toISOString()).toBe("1970-01-01T23:00:00.000Z");
    });

    it("tells a year before the common era from the same year after it", () => {
        expect.assertions(2);

        // London's local mean time, 0:01:15 behind UTC, is rounded to the second below.
        expect(getZone("Europe/London").offset(Date.UTC(-1, 0, 1))).toBeCloseTo(-1.25, 2);
        expect(getZone("America/New_York").offset(Date.UTC(-1, 0, 1))).toBeCloseTo(-296.0333, 3);
    });
});

describe("wall clock arithmetic for years 0 to 99", () => {
    it("keeps the year", () => {
        expect.assertions(2);

        expect(new Date(toLocalMs({ day: 1, hour: 0, millisecond: 0, minute: 0, month: 1, second: 0, year: 50 })).getUTCFullYear()).toBe(50);
        expect(new Date(startOfDay(99, 12, 31)).getUTCFullYear()).toBe(99);
    });

    it("rolls an overflowing time into the next day or year without losing the year", () => {
        expect.assertions(2);

        const rolled = new Date(toLocalMs({ day: 31, hour: 24, millisecond: 0, minute: 0, month: 12, second: 0, year: 99 }));

        expect(rolled.getUTCFullYear()).toBe(100);
        expect(rolled.getUTCDate()).toBe(1);
    });

    it("finds the weekday", () => {
        expect.assertions(1);

        // 1 January of year 1 is a Monday in the proleptic Gregorian calendar.
        expect(weekdayOf(1, 1, 1)).toBe(1);
    });

    it("schedules there", () => {
        expect.assertions(3);

        expect(parse("0 0 * * *", { currentDate: "0050-01-01T00:00:00.000Z", tz: "UTC" }).next().toISOString()).toBe(
            "0050-01-02T00:00:00.000Z",
        );
        expect(parse("0 0 1 * *", { currentDate: "0002-01-15T00:00:00.000Z", tz: "UTC" }).next().toISOString()).toBe(
            "0002-02-01T00:00:00.000Z",
        );
        expect(parse("0 0 * * *", { currentDate: "0050-01-05T00:00:00.000Z", tz: "UTC" }).prev().toISOString()).toBe(
            "0050-01-04T00:00:00.000Z",
        );
    });
});

describe(wallInstants, () => {
    it("finds none, one or two instants and reports the gap", () => {
        expect.assertions(5);

        const newYork = getZone("America/New_York");
        const inGap = wallInstants(newYork, Date.UTC(2021, 2, 14, 2, 30));
        const overlap = wallInstants(newYork, Date.UTC(2021, 10, 7, 1, 30));

        expect(inGap.instants).toStrictEqual([]);
        expect(inGap.gap).toStrictEqual({ end: Date.UTC(2021, 2, 14, 3), start: Date.UTC(2021, 2, 14, 2) });
        expect(new Date(inGap.landing as number).toISOString()).toBe("2021-03-14T07:30:00.000Z");
        expect(overlap.instants).toStrictEqual([Date.UTC(2021, 10, 7, 5, 30), Date.UTC(2021, 10, 7, 6, 30)]);
        expect(wallInstants(newYork, Date.UTC(2021, 0, 15, 12)).instants).toStrictEqual([Date.UTC(2021, 0, 15, 17)]);
    });

    it("drops a gap of a whole day", () => {
        expect.assertions(2);

        // Samoa skipped 30 December 2011.
        const skipped = wallInstants(getZone("Pacific/Apia"), Date.UTC(2011, 11, 30, 12));

        expect(skipped.landing).toBeUndefined();
        expect(skipped.gap?.end).toBe(Date.UTC(2011, 11, 31));
    });
});

describe("remembered offsets", () => {
    const ZONES = [
        "America/New_York",
        "Europe/London",
        "Australia/Lord_Howe",
        "Pacific/Chatham",
        "Africa/Casablanca",
        "Pacific/Apia",
        "America/St_Johns",
        "Asia/Kathmandu",
        "America/Santiago",
        "Antarctica/Troll",
    ];

    it.each(ZONES)("%s gives the raw offset everywhere, around every transition", (name) => {
        expect.assertions(1);

        const zone = getZone(name);
        const wrong: string[] = [];

        // Out of order and repeated, so segments are made and reused in every way, and densely around each change.
        const instants: number[] = [];

        for (let instant = Date.UTC(2010, 0, 1); instant < Date.UTC(2030, 0, 1); instant += 7 * HOUR + 13 * 60_000) {
            instants.push(instant);
        }

        for (const instant of [...instants.toReversed(), ...instants]) {
            if (zone.offset(instant) !== zone.rawOffset(instant) && wrong.length < 5) {
                wrong.push(new Date(instant).toISOString());
            }
        }

        expect(wrong).toStrictEqual([]);
    });

    it("is exact at the second a transition happens", () => {
        expect.assertions(2);

        // New York springs forward at 07:00:00Z on 2021-03-14.
        const zone = getZone("America/New_York");
        const transition = Date.UTC(2021, 2, 14, 7);

        zone.offset(transition - 5 * HOUR);
        zone.offset(transition + 5 * HOUR);

        expect(zone.offset(transition - 1000)).toBe(-300);
        expect(zone.offset(transition)).toBe(-240);
    });

    it("counts a date as whatever the zone says", () => {
        expect.assertions(1);

        expect(new CronDate("2021-07-01T12:00:00Z", "Europe/Berlin").getUTCOffset()).toBe(120);
    });
});
