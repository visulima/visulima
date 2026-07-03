/* eslint-disable import/no-relative-packages,import/no-extraneous-dependencies */
import { bench, describe } from "vitest";

// eslint-disable-next-line import/no-relative-parent-imports
import { isValidTimezone } from "../src/timezones";
// eslint-disable-next-line import/no-relative-parent-imports
import countryTimezonesData from "../src/data/timezones";

/**
 * Previous implementation of `isValidTimezone`: it rebuilt and sorted the entire
 * timezone set on every single call before linear-scanning with `includes()`.
 * Kept here purely to contrast against the precomputed-`Set.has` optimization.
 */
const allLegacy = (): string[] => {
    const timezones = new Set<string>();

    Object.values(countryTimezonesData).forEach((tzList) => {
        tzList.forEach((tz) => timezones.add(tz));
    });

    return [...timezones].toSorted((a, b) => a.localeCompare(b));
};

const isValidTimezoneLegacy = (timezone: string): boolean => allLegacy().includes(timezone);

// A mix of a valid timezone (best case for the optimized path) and an invalid one
// (worst case for the legacy `includes` linear scan).
const samples = ["Europe/London", "America/New_York", "Asia/Tokyo", "Not/AZone", "Pacific/Auckland"];

describe("isValidTimezone", () => {
    bench("optimized (precomputed Set.has)", () => {
        for (const tz of samples) {
            isValidTimezone(tz);
        }
    });

    bench("legacy (rebuild + sort + includes)", () => {
        for (const tz of samples) {
            isValidTimezoneLegacy(tz);
        }
    });
});
