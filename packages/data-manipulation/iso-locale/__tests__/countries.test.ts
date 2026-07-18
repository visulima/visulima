import { describe, expect, it } from "vitest";

import {
    all,
    alpha2ToAlpha3,
    alpha2ToNumeric,
    alpha3ToAlpha2,
    alpha3ToNumeric,
    getByAlpha2,
    getByAlpha3,
    getByNumeric,
    getCallingCode,
    getCallingCodes,
    getCountriesByLanguage,
    getCountry,
    getCountryByName,
    getEmoji,
    getIOC,
    getLanguages,
    getName,
    isValid,
    numericToAlpha2,
    numericToAlpha3,
    searchCountries,
} from "../src/countries";

describe("countries", () => {
    it("should get country by alpha-2 code", () => {
        expect.hasAssertions();

        const country = getByAlpha2("US");

        expect(country).toBeDefined();
        expect(country?.name).toBe("United States");
        expect(country?.alpha2).toBe("US");
        expect(country?.alpha3).toBe("USA");
    });

    it("should get country by alpha-3 code", () => {
        expect.hasAssertions();

        const country = getByAlpha3("USA");

        expect(country).toBeDefined();
        expect(country?.name).toBe("United States");
        expect(country?.alpha2).toBe("US");
    });

    it("should convert alpha-2 to alpha-3", () => {
        expect.hasAssertions();
        expect(alpha2ToAlpha3("US")).toBe("USA");
        expect(alpha2ToAlpha3("GB")).toBe("GBR");
        expect(alpha2ToAlpha3("DE")).toBe("DEU");
    });

    it("should convert alpha-3 to alpha-2", () => {
        expect.hasAssertions();
        expect(alpha3ToAlpha2("USA")).toBe("US");
        expect(alpha3ToAlpha2("GBR")).toBe("GB");
        expect(alpha3ToAlpha2("DEU")).toBe("DE");
    });

    it("should validate country codes", () => {
        expect.hasAssertions();
        expect(isValid("US")).toBe(true);
        expect(isValid("USA")).toBe(true);
        expect(isValid("XX")).toBe(false);
        expect(isValid("XXX")).toBe(false);
    });

    it("should handle case-insensitive codes", () => {
        expect.hasAssertions();
        expect(getByAlpha2("us")).toBeDefined();
        expect(getByAlpha2("Us")).toBeDefined();
        expect(getByAlpha3("usa")).toBeDefined();
    });

    it("should have all countries array", () => {
        expect.hasAssertions();
        expect(all.length).toBeGreaterThan(200);
        expect(all[0]).toHaveProperty("alpha2");
        expect(all[0]).toHaveProperty("alpha3");
        expect(all[0]).toHaveProperty("name");
    });

    it("should get flag emoji for country", () => {
        expect.hasAssertions();
        expect(getEmoji("US")).toBe("🇺🇸");
        expect(getEmoji("GB")).toBe("🇬🇧");
        expect(getEmoji("FR")).toBe("🇫🇷");
        expect(getEmoji("USA")).toBe("🇺🇸");
        expect(getEmoji("GBR")).toBe("🇬🇧");
    });

    it("should return undefined for invalid country code when getting emoji", () => {
        expect.hasAssertions();
        expect(getEmoji("XX")).toBeUndefined();
        expect(getEmoji("XXX")).toBeUndefined();
        expect(getEmoji("000")).toBeUndefined();
    });

    it("should get calling code for country", () => {
        expect.hasAssertions();
        expect(getCallingCode("US")).toBe("+1");
        expect(getCallingCode("GB")).toBe("+44");
        expect(getCallingCode("FR")).toBe("+33");
        expect(getCallingCode("USA")).toBe("+1");
        expect(getCallingCode("GBR")).toBe("+44");
    });

    it("should get all calling codes for country", () => {
        expect.hasAssertions();
        expect(getCallingCodes("US")).toStrictEqual(["+1"]);
        expect(getCallingCodes("GB")).toStrictEqual(["+44"]);

        // Some countries may have multiple calling codes
        const codes = getCallingCodes("US");

        expect(Array.isArray(codes)).toBe(true);
        expect(codes.length).toBeGreaterThan(0);
    });

    it("should return empty array for invalid country code when getting calling codes", () => {
        expect.hasAssertions();
        expect(getCallingCodes("XX")).toStrictEqual([]);
        expect(getCallingCodes("XXX")).toStrictEqual([]);
    });

    it("should get languages for country", () => {
        expect.hasAssertions();

        const usLanguages = getLanguages("US");

        expect(Array.isArray(usLanguages)).toBe(true);
        expect(usLanguages.length).toBeGreaterThan(0);
        expect(usLanguages).toContain("eng");

        const frLanguages = getLanguages("FR");

        expect(frLanguages).toContain("fra");
    });

    it("should return empty array for invalid country code when getting languages", () => {
        expect.hasAssertions();
        expect(getLanguages("XX")).toStrictEqual([]);
        expect(getLanguages("XXX")).toStrictEqual([]);
    });

    it("should get IOC code for country", () => {
        expect.hasAssertions();
        expect(getIOC("US")).toBe("USA");
        expect(getIOC("GB")).toBe("GBR");
        expect(getIOC("FR")).toBe("FRA");
        expect(getIOC("USA")).toBe("USA");
        expect(getIOC("GBR")).toBe("GBR");
    });

    it("should return undefined for invalid country code when getting IOC", () => {
        expect.hasAssertions();
        expect(getIOC("XX")).toBeUndefined();
        expect(getIOC("XXX")).toBeUndefined();
        expect(getIOC("000")).toBeUndefined();
    });

    it("should handle case-insensitive codes for utility functions", () => {
        expect.hasAssertions();
        expect(getEmoji("us")).toBe("🇺🇸");
        expect(getCallingCode("gb")).toBe("+44");
        expect(getLanguages("fr")).toContain("fra");
        expect(getIOC("de")).toBe("GER");
    });

    it("should get country by exact name", () => {
        expect.hasAssertions();

        const country = getCountryByName("United States");

        expect(country).toBeDefined();
        expect(country?.alpha2).toBe("US");
        expect(country?.name).toBe("United States");

        const country2 = getCountryByName("united states");

        expect(country2?.alpha2).toBe("US");

        const country3 = getCountryByName("UNITED STATES");

        expect(country3?.alpha2).toBe("US");
    });

    it("should return undefined for non-existent country name", () => {
        expect.hasAssertions();
        expect(getCountryByName("NonExistentCountry")).toBeUndefined();
        expect(getCountryByName("")).toBeUndefined();
    });

    it("should search countries by partial name", () => {
        expect.hasAssertions();

        const results = searchCountries("united");

        expect(results.length).toBeGreaterThan(0);
        expect(results.some((c) => c.alpha2 === "US")).toBe(true);
        expect(results.some((c) => c.alpha2 === "GB")).toBe(true);

        const results2 = searchCountries("United");

        expect(results2.length).toBeGreaterThan(0);
    });

    it("should return empty array for empty search query", () => {
        expect.hasAssertions();
        expect(searchCountries("")).toStrictEqual([]);
        expect(searchCountries("   ")).toStrictEqual([]);
    });

    it("should handle case-insensitive country search", () => {
        expect.hasAssertions();

        const results = searchCountries("FRANCE");

        expect(results.some((c) => c.alpha2 === "FR")).toBe(true);

        const results2 = searchCountries("france");

        expect(results2.some((c) => c.alpha2 === "FR")).toBe(true);
    });

    describe(getByNumeric, () => {
        it("should resolve a country by numeric string lookup", () => {
            expect.assertions(2);
            expect(getByNumeric("840")?.alpha2).toBe("US");
            expect(getByNumeric("840")?.alpha3).toBe("USA");
        });

        it("should pad and look up a numeric value", () => {
            expect.assertions(1);
            expect(getByNumeric(4)?.alpha2).toBe("AF");
        });

        it("should return undefined for an unassigned numeric code", () => {
            expect.assertions(1);
            expect(getByNumeric("999")).toBeUndefined();
        });
    });

    describe("numeric conversion helpers", () => {
        it("should convert alpha-2 to numeric", () => {
            expect.assertions(2);
            expect(alpha2ToNumeric("US")).toBe("840");
            expect(alpha2ToNumeric("XX")).toBeUndefined();
        });

        it("should convert alpha-3 to numeric", () => {
            expect.assertions(2);
            expect(alpha3ToNumeric("USA")).toBe("840");
            expect(alpha3ToNumeric("XXX")).toBeUndefined();
        });

        it("should convert numeric to alpha-2", () => {
            expect.assertions(2);
            expect(numericToAlpha2("840")).toBe("US");
            expect(numericToAlpha2(840)).toBe("US");
        });

        it("should convert numeric to alpha-3", () => {
            expect.assertions(2);
            expect(numericToAlpha3("840")).toBe("USA");
            expect(numericToAlpha3(840)).toBe("USA");
        });
    });

    describe("numeric input branches", () => {
        it("should treat a numeric string as a numeric code in isValid", () => {
            expect.assertions(2);
            expect(isValid("840")).toBe(true);
            expect(isValid(840)).toBe(true);
        });

        it("should return false for an unassigned numeric code in isValid", () => {
            expect.assertions(2);
            expect(isValid("999")).toBe(false);
            expect(isValid(999)).toBe(false);
        });

        it("should return false for codes that are neither alpha-2/3 nor numeric", () => {
            expect.assertions(1);
            expect(isValid("XXXX")).toBe(false);
        });

        it("should resolve getEmoji with a numeric value", () => {
            expect.assertions(1);
            expect(getEmoji(840)).toBe("🇺🇸");
        });

        it("should resolve getCallingCode via the numeric path", () => {
            expect.assertions(2);
            expect(getCallingCode("840")).toBe("+1");
            expect(getCallingCode(840)).toBe("+1");
        });

        it("should resolve getCallingCodes via the numeric path", () => {
            expect.assertions(2);
            expect(getCallingCodes("840")).toStrictEqual(["+1"]);
            expect(getCallingCodes(840)).toStrictEqual(["+1"]);
        });

        it("should resolve getLanguages via the numeric path", () => {
            expect.assertions(2);
            expect(getLanguages("840")).toStrictEqual(["eng"]);
            expect(getLanguages(840)).toStrictEqual(["eng"]);
        });

        it("should resolve getIOC via the numeric path", () => {
            expect.assertions(2);
            expect(getIOC("840")).toBe("USA");
            expect(getIOC(840)).toBe("USA");
        });
    });

    // A non-numeric string whose length is neither 2 nor 3 falls through every
    // length check, leaving the resolved country undefined.
    describe("non alpha-2/alpha-3 string lengths", () => {
        it("should return undefined for getEmoji", () => {
            expect.assertions(1);
            expect(getEmoji("X")).toBeUndefined();
        });

        it("should return undefined for getCallingCode", () => {
            expect.assertions(1);
            expect(getCallingCode("X")).toBeUndefined();
        });

        it("should return empty array for getCallingCodes", () => {
            expect.assertions(1);
            expect(getCallingCodes("X")).toStrictEqual([]);
        });

        it("should return empty array for getLanguages", () => {
            expect.assertions(1);
            expect(getLanguages("X")).toStrictEqual([]);
        });

        it("should return undefined for getIOC", () => {
            expect.assertions(1);
            expect(getIOC("X")).toBeUndefined();
        });
    });

    describe("getCountry (unified resolver)", () => {
        it("should resolve by alpha-2 code", () => {
            expect.assertions(1);
            expect(getCountry("us")?.alpha3).toBe("USA");
        });

        it("should resolve by alpha-3 code", () => {
            expect.assertions(1);
            expect(getCountry("usa")?.alpha2).toBe("US");
        });

        it("should resolve by numeric code", () => {
            expect.assertions(2);
            expect(getCountry(840)?.alpha2).toBe("US");
            expect(getCountry("840")?.alpha2).toBe("US");
        });

        it("should return undefined for an unassigned numeric code", () => {
            expect.assertions(1);
            expect(getCountry("999")).toBeUndefined();
        });

        it("should return undefined for invalid lengths", () => {
            expect.assertions(2);
            expect(getCountry("X")).toBeUndefined();
            expect(getCountry("LONG")).toBeUndefined();
        });
    });

    describe(getCountriesByLanguage, () => {
        it("should resolve countries via an ISO 639-1 code", () => {
            expect.assertions(2);

            const countries = getCountriesByLanguage("de");

            expect(countries).toContain("DE");
            expect(countries).toContain("AT");
        });

        it("should resolve countries via an ISO 639-3 code", () => {
            expect.assertions(1);
            expect(getCountriesByLanguage("deu")).toContain("DE");
        });

        it("should return an empty array for an unknown language", () => {
            expect.assertions(1);
            expect(getCountriesByLanguage("zzz")).toStrictEqual([]);
        });
    });

    describe("getName (localized)", () => {
        it("should return the English name by default", () => {
            expect.assertions(1);
            expect(getName("US")).toBe("United States");
        });

        it("should localize the name when Intl supports the region", () => {
            expect.assertions(1);
            // Intl.DisplayNames is available on Node 22+, so a French name is expected.
            expect(getName("DE", "fr")).toBe("Allemagne");
        });

        it("should fall back to the English name when the locale is invalid", () => {
            expect.assertions(1);
            // "!" is a structurally invalid BCP 47 tag and makes Intl.DisplayNames throw.
            expect(getName("DE", "!")).toBe("Germany");
        });

        it("should return undefined for an unknown country", () => {
            expect.assertions(1);
            expect(getName("ZZ")).toBeUndefined();
        });
    });
});
