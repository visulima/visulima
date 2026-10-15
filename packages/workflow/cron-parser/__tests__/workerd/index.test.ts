import { describe, expect, it } from "vitest";

import { CronDate, parse } from "../../src/index";

describe("@visulima/cron-parser on workerd", () => {
    it("should resolve IANA zones through Intl", () => {
        expect.assertions(2);

        const interval = parse("0 9 * * *", { currentDate: "2021-03-13T00:00:00Z", tz: "America/New_York" });

        // 09:00 EST (UTC-5) before the DST change on 2021-03-14, 09:00 EDT (UTC-4) after it.
        expect(interval.next().toISOString()).toBe("2021-03-13T14:00:00.000Z");
        expect(interval.next().toISOString()).toBe("2021-03-14T13:00:00.000Z");
    });

    it("should run a job that falls inside a spring-forward gap after the gap", () => {
        expect.assertions(1);

        const interval = parse("30 2 * * *", { currentDate: "2021-03-13T12:00:00Z", tz: "America/New_York" });

        expect(interval.next().toISOString()).toBe("2021-03-14T07:30:00.000Z");
    });

    it("should support half-hour and 45-minute offsets", () => {
        expect.assertions(2);

        expect(new CronDate("2021-01-01T00:00:00Z", "Asia/Kathmandu").getUTCOffset()).toBe(345);
        expect(new CronDate("2021-01-01T00:00:00Z", "Australia/Lord_Howe").getUTCOffset()).toBe(660);
    });

    it("should read offset-less date strings as wall clock time in the given zone", () => {
        expect.assertions(1);

        expect(new CronDate("Mon, 4 Jan 2021 10:00:00", "America/New_York").toISOString()).toBe("2021-01-04T15:00:00.000Z");
    });

    it("should reject an unknown zone", () => {
        expect.assertions(1);

        expect(() => new CronDate("2021-01-01T00:00:00Z", "Mars/Olympus_Mons")).toThrow("unhandled timezone");
    });
});
