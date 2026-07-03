import { describe, expect, expectTypeOf, it } from "vitest";

import { all, getCountriesForTimezone, getCountriesWithTimezones, getPrimaryTimezone, getTimezonesByCountry, isValidTimezone } from "../src/timezones";

const IANA_TIMEZONE_REGEX = /^[A-Z_]+\/[A-Z_/-]+$/i;

describe("timezones", () => {
    describe(getTimezonesByCountry, () => {
        it("should get timezones for US", () => {
            expect.hasAssertions();

            const timezones = getTimezonesByCountry("US");

            expect(timezones.length).toBeGreaterThan(20);
            expect(timezones).toContain("America/New_York");
            expect(timezones).toContain("America/Los_Angeles");
            expect(timezones).toContain("America/Chicago");
            expect(timezones).toContain("Pacific/Honolulu");
        });

        it("should get timezones for GB", () => {
            expect.hasAssertions();

            const timezones = getTimezonesByCountry("GB");

            expect(timezones).toStrictEqual(["Europe/London"]);
        });

        it("should get timezones for Canada", () => {
            expect.hasAssertions();

            const timezones = getTimezonesByCountry("CA");

            expect(timezones.length).toBeGreaterThan(10);
            expect(timezones).toContain("America/Toronto");
            expect(timezones).toContain("America/Vancouver");
        });

        it("should get timezones for Australia", () => {
            expect.hasAssertions();

            const timezones = getTimezonesByCountry("AU");

            expect(timezones.length).toBeGreaterThan(5);
            expect(timezones).toContain("Australia/Sydney");
            expect(timezones).toContain("Australia/Melbourne");
            expect(timezones).toContain("Australia/Perth");
        });

        it("should get timezones for Russia", () => {
            expect.hasAssertions();

            const timezones = getTimezonesByCountry("RU");

            expect(timezones.length).toBeGreaterThan(20);
            expect(timezones).toContain("Europe/Moscow");
            expect(timezones).toContain("Asia/Vladivostok");
        });

        it("should return empty array for invalid country", () => {
            expect.hasAssertions();
            expect(getTimezonesByCountry("XX")).toStrictEqual([]);
        });

        it("should handle case-insensitive country codes", () => {
            expect.hasAssertions();
            expect(getTimezonesByCountry("us")).toStrictEqual(getTimezonesByCountry("US"));
            expect(getTimezonesByCountry("Gb")).toStrictEqual(getTimezonesByCountry("GB"));
        });
    });

    describe(getCountriesForTimezone, () => {
        it("should get countries for Europe/London", () => {
            expect.hasAssertions();

            const countries = getCountriesForTimezone("Europe/London");

            expect(countries).toContain("GB");
            expect(countries.length).toBeGreaterThan(0);
        });

        it("should get countries for America/New_York", () => {
            expect.hasAssertions();

            const countries = getCountriesForTimezone("America/New_York");

            expect(countries).toContain("US");
        });

        it("should get countries for Asia/Tokyo", () => {
            expect.hasAssertions();

            const countries = getCountriesForTimezone("Asia/Tokyo");

            expect(countries).toContain("JP");
        });

        it("should return empty array for invalid timezone", () => {
            expect.hasAssertions();
            expect(getCountriesForTimezone("Invalid/Timezone")).toStrictEqual([]);
        });

        it("should handle timezones used by multiple countries", () => {
            expect.hasAssertions();

            // Some timezones might be shared (though rare)
            const countries = getCountriesForTimezone("Europe/London");

            expect(Array.isArray(countries)).toBe(true);
        });

        it("should return a fresh array on each call (cached reverse map is not leaked)", () => {
            expect.assertions(2);

            const first = getCountriesForTimezone("Europe/London");
            const second = getCountriesForTimezone("Europe/London");

            expect(first).toStrictEqual(second);
            expect(first).not.toBe(second);
        });
    });

    describe(all, () => {
        it("should return all timezones", () => {
            expect.hasAssertions();

            const timezones = all();

            expect(timezones.length).toBeGreaterThan(400);
            expect(timezones).toContain("Europe/London");
            expect(timezones).toContain("America/New_York");
            expect(timezones).toContain("Asia/Tokyo");
        });

        it("should return sorted timezones", () => {
            expect.hasAssertions();

            const timezones = all();

            expect(timezones).toStrictEqual(timezones.toSorted((a, b) => a.localeCompare(b)));
        });
    });

    describe(getCountriesWithTimezones, () => {
        it("should return all countries with timezone data", () => {
            expect.hasAssertions();

            const countries = getCountriesWithTimezones();

            expect(countries.length).toBeGreaterThan(200);
            expect(countries).toContain("US");
            expect(countries).toContain("GB");
            expect(countries).toContain("JP");
        });

        it("should return sorted countries", () => {
            expect.hasAssertions();

            const countries = getCountriesWithTimezones();

            expect(countries).toStrictEqual(countries.toSorted((a, b) => a.localeCompare(b)));
        });
    });

    describe(isValidTimezone, () => {
        it("should validate known timezones", () => {
            expect.hasAssertions();
            expect(isValidTimezone("Europe/London")).toBe(true);
            expect(isValidTimezone("America/New_York")).toBe(true);
            expect(isValidTimezone("Asia/Tokyo")).toBe(true);
            expect(isValidTimezone("Australia/Sydney")).toBe(true);
        });

        it("should invalidate unknown timezones", () => {
            expect.hasAssertions();
            expect(isValidTimezone("Invalid/Timezone")).toBe(false);
            expect(isValidTimezone("")).toBe(false);
        });
    });

    describe(getPrimaryTimezone, () => {
        it("should get primary timezone for US", () => {
            expect.hasAssertions();

            const timezone = getPrimaryTimezone("US");

            expect(timezone).toBeDefined();

            expectTypeOf(timezone).toBeString();
        });

        it("should get primary timezone for GB", () => {
            expect.hasAssertions();

            const timezone = getPrimaryTimezone("GB");

            expect(timezone).toBe("Europe/London");
        });

        it("should get primary timezone for single-timezone countries", () => {
            expect.hasAssertions();

            const timezone = getPrimaryTimezone("FR");

            expect(timezone).toBe("Europe/Paris");
        });

        it("should return undefined for invalid country", () => {
            expect.hasAssertions();
            expect(getPrimaryTimezone("XX")).toBeUndefined();
        });
    });

    describe("data validation", () => {
        it("should have timezones for major countries", () => {
            expect.hasAssertions();

            const majorCountries = ["US", "GB", "FR", "DE", "JP", "CN", "IN", "BR", "AU", "CA"];

            majorCountries.forEach((code) => {
                const timezones = getTimezonesByCountry(code);

                expect(timezones.length).toBeGreaterThan(0);
            });
        });

        it("should have valid IANA timezone format", () => {
            expect.hasAssertions();

            const timezones = all();

            timezones.forEach((tz) => {
                // IANA timezones follow pattern: Area/Location or Area/SubArea/Location
                // Can contain letters, underscores, hyphens, and slashes
                expect(tz).toMatch(IANA_TIMEZONE_REGEX);
            });
        });

        it("should not have duplicate timezones in country lists", () => {
            expect.hasAssertions();

            Object.entries({
                AU: getTimezonesByCountry("AU"),
                CA: getTimezonesByCountry("CA"),
                RU: getTimezonesByCountry("RU"),
                US: getTimezonesByCountry("US"),
            }).forEach(([_country, timezones]) => {
                const unique = new Set(timezones);

                expect(unique.size).toBe(timezones.length);
            });
        });
    });
});
