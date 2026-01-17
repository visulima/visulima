import { describe, expect, it } from "vitest";

import {
    all,
    alpha2ToAlpha3,
    alpha3ToAlpha2,
    getByAlpha2,
    getByAlpha3,
    getCallingCode,
    getCallingCodes,
    getCountryByName,
    getEmoji,
    getIOC,
    getLanguages,
    isValid,
    searchCountries,
} from "../src/countries.js";

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
});
