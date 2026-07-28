import { describe, expect, it } from "vitest";

import { convert6393To6391, iso6393To6391 } from "../src/data/iso-639-mapping";
import { generateBCP47Tag, getBCP47Tags, getCurrency, getLanguageName, getLocales, isValidBCP47Tag, parseBCP47Tag } from "../src/locale";

describe("locale", () => {
    it("should get currency from BCP 47 locale", () => {
        expect.hasAssertions();
        expect(getCurrency("en-US")).toBe("USD");
        expect(getCurrency("en-GB")).toBe("GBP");
        expect(getCurrency("de-DE")).toBe("EUR");
        expect(getCurrency("fr-FR")).toBe("EUR");
    });

    it("should get currency from underscore locale", () => {
        expect.hasAssertions();
        expect(getCurrency("en_US")).toBe("USD");
        expect(getCurrency("en_GB")).toBe("GBP");
        expect(getCurrency("de_DE")).toBe("EUR");
    });

    it("should get currency from mixed-separator and multi-part locales", () => {
        expect.hasAssertions();
        expect(getCurrency("en_US_POSIX")).toBe("USD");
        expect(getCurrency("en_US-POSIX")).toBe("USD");
    });

    it("should get currency from country code", () => {
        expect.hasAssertions();
        expect(getCurrency("US")).toBe("USD");
        expect(getCurrency("GB")).toBe("GBP");
        expect(getCurrency("DE")).toBe("EUR");
        expect(getCurrency("FR")).toBe("EUR");
    });

    it("should handle case-insensitive locale", () => {
        expect.hasAssertions();
        expect(getCurrency("us")).toBe("USD");
        expect(getCurrency("en-us")).toBe("USD");
    });

    it("should return undefined for invalid locale", () => {
        expect.hasAssertions();
        expect(getCurrency("XX")).toBeUndefined();
        expect(getCurrency("invalid")).toBeUndefined();
    });

    it("should skip non-country subtags when extracting the country from a BCP 47 tag", () => {
        expect.assertions(1);
        // "Hant" (4 letters) must be skipped before the "TW" country part is found.
        expect(getCurrency("zh-Hant-TW")).toBe("TWD");
    });

    it("should return undefined when the underscore locale has no 2-letter country part", () => {
        expect.assertions(1);
        expect(getCurrency("foo_bar_baz")).toBeUndefined();
    });

    it("should get locales for currency", () => {
        expect.hasAssertions();

        const locales = getLocales("EUR");

        expect(locales.length).toBeGreaterThan(0);
        expect(locales).toContain("FR");
        expect(locales).toContain("DE");
        expect(locales).toContain("ES");
    });

    it("should get locales for USD", () => {
        expect.hasAssertions();

        const locales = getLocales("USD");

        expect(locales).toContain("US");
    });

    it("should return empty array for invalid currency", () => {
        expect.hasAssertions();

        const locales = getLocales("XXX");

        expect(locales).toStrictEqual([]);
    });

    describe("bCP 47 tag parsing", () => {
        it("should parse simple BCP 47 tag", () => {
            expect.hasAssertions();

            const parsed = parseBCP47Tag("en-US");

            expect(parsed).toStrictEqual({ country: "US", language: "en" });
        });

        it("should parse BCP 47 tag with script", () => {
            expect.hasAssertions();

            const parsed = parseBCP47Tag("zh-Hant-TW");

            expect(parsed).toStrictEqual({ country: "TW", language: "zh", script: "Hant" });
        });

        it("should parse BCP 47 tag with only language", () => {
            expect.hasAssertions();

            const parsed = parseBCP47Tag("en");

            expect(parsed).toStrictEqual({ language: "en" });
        });

        it("should return undefined for invalid tag", () => {
            expect.hasAssertions();
            expect(parseBCP47Tag("")).toBeUndefined();
            expect(parseBCP47Tag("x")).toBeUndefined();
        });

        it("should handle case-insensitive language code", () => {
            expect.hasAssertions();

            const parsed = parseBCP47Tag("EN-US");

            expect(parsed?.language).toBe("en");
        });

        it("should skip empty subtags", () => {
            expect.assertions(1);
            // The empty middle subtag from the double hyphen must be skipped.
            expect(parseBCP47Tag("en--US")).toStrictEqual({ country: "US", language: "en" });
        });

        it("should ignore subtags that are neither a script nor a country", () => {
            expect.assertions(1);
            // "abc" is 3 letters: not a 4-letter script, not a 2-letter country.
            expect(parseBCP47Tag("en-abc")).toStrictEqual({ language: "en" });
        });

        it("should ignore a 2-letter subtag that is not alphabetic", () => {
            expect.assertions(1);
            // "12" is length 2 but fails the alpha-2 regex, so no country is set.
            expect(parseBCP47Tag("en-12")).toStrictEqual({ language: "en" });
        });
    });

    describe("bCP 47 tag generation", () => {
        it("should generate simple BCP 47 tag", () => {
            expect.hasAssertions();
            expect(generateBCP47Tag("en", "US")).toBe("en-US");
            expect(generateBCP47Tag("fr", "FR")).toBe("fr-FR");
        });

        it("should generate BCP 47 tag with script", () => {
            expect.hasAssertions();
            expect(generateBCP47Tag("zh", "TW", "Hant")).toBe("zh-Hant-TW");
        });

        it("should handle case-insensitive inputs", () => {
            expect.hasAssertions();
            expect(generateBCP47Tag("EN", "us")).toBe("en-US");
        });

        it("should canonicalize the script subtag to title case", () => {
            expect.assertions(2);
            expect(generateBCP47Tag("zh", "tw", "hant")).toBe("zh-Hant-TW");
            expect(generateBCP47Tag("sr", "rs", "CYRL")).toBe("sr-Cyrl-RS");
        });
    });

    describe(getLanguageName, () => {
        it("should localize an ISO 639-1 language code", () => {
            expect.assertions(1);
            expect(getLanguageName("de", "en")).toBe("German");
        });

        it("should accept an ISO 639-3 language code", () => {
            expect.assertions(1);
            expect(getLanguageName("deu", "en")).toBe("German");
        });

        it("should return undefined for an invalid locale", () => {
            expect.assertions(1);
            // "!" is a structurally invalid BCP 47 tag and makes Intl.DisplayNames throw.
            expect(getLanguageName("de", "!")).toBeUndefined();
        });
    });

    describe("bCP 47 tags for countries", () => {
        it("should get BCP 47 tags for US", () => {
            expect.hasAssertions();

            const tags = getBCP47Tags("US");

            expect(tags.length).toBeGreaterThan(0);
            expect(tags).toContain("en-US");
        });

        it("should get BCP 47 tags for Canada", () => {
            expect.hasAssertions();

            const tags = getBCP47Tags("CA");

            expect(tags.length).toBeGreaterThan(0);
            expect(tags).toContain("en-CA");
            expect(tags).toContain("fr-CA");
        });

        it("should get BCP 47 tags for Switzerland", () => {
            expect.hasAssertions();

            const tags = getBCP47Tags("CH");

            expect(tags.length).toBeGreaterThan(0);
            // Switzerland has multiple languages
            expect(tags.some((tag) => tag.startsWith("de-CH"))).toBe(true);
            expect(tags.some((tag) => tag.startsWith("fr-CH"))).toBe(true);
        });

        it("should return empty array for invalid country", () => {
            expect.hasAssertions();
            expect(getBCP47Tags("XX")).toStrictEqual([]);
        });

        it("should return empty array when no language maps to an ISO 639-1 code", () => {
            expect.assertions(2);
            // Greenland ("kal") and Somalia ("som") are valid countries whose only
            // languages have no ISO 639-1 equivalent, so no BCP 47 tag is produced.
            expect(getBCP47Tags("GL")).toStrictEqual([]);
            expect(getBCP47Tags("SO")).toStrictEqual([]);
        });
    });

    describe("bCP 47 tag validation", () => {
        it("should validate correct BCP 47 tags", () => {
            expect.hasAssertions();
            expect(isValidBCP47Tag("en-US")).toBe(true);
            expect(isValidBCP47Tag("zh-Hant-TW")).toBe(true);
            expect(isValidBCP47Tag("en")).toBe(true);
        });

        it("should invalidate incorrect BCP 47 tags", () => {
            expect.hasAssertions();
            expect(isValidBCP47Tag("")).toBe(false);
            expect(isValidBCP47Tag("x")).toBe(false);
            expect(isValidBCP47Tag("invalid")).toBe(false);
        });

        it("should reject tags with empty subtags", () => {
            expect.assertions(3);
            expect(isValidBCP47Tag("en-")).toBe(false);
            expect(isValidBCP47Tag("en--US")).toBe(false);
            expect(isValidBCP47Tag("en-US-")).toBe(false);
        });

        it("should accept private-use, extension, and extlang subtags", () => {
            expect.assertions(4);
            expect(isValidBCP47Tag("de-DE-x-goethe")).toBe(true);
            expect(isValidBCP47Tag("en-u-ca-buddhist")).toBe(true);
            expect(isValidBCP47Tag("zh-yue-HK")).toBe(true);
            expect(isValidBCP47Tag("x-private")).toBe(false);
        });

        it("should reject tags with a dangling singleton", () => {
            expect.assertions(2);
            expect(isValidBCP47Tag("en-u")).toBe(false);
            expect(isValidBCP47Tag("de-DE-x")).toBe(false);
        });
    });

    describe("iSO 639-3 to ISO 639-1 conversion", () => {
        it("should convert ISO 639-3 to ISO 639-1", () => {
            expect.hasAssertions();
            expect(iso6393To6391("eng")).toBe("en");
            expect(iso6393To6391("fra")).toBe("fr");
            expect(iso6393To6391("spa")).toBe("es");
            expect(iso6393To6391("deu")).toBe("de");
        });

        it("should return undefined for unmapped codes", () => {
            expect.hasAssertions();
            expect(iso6393To6391("xxx")).toBeUndefined();
            expect(iso6393To6391("invalid")).toBeUndefined();
        });

        it("should handle case-insensitive input", () => {
            expect.hasAssertions();
            expect(iso6393To6391("ENG")).toBe("en");
            expect(iso6393To6391("Fra")).toBe("fr");
        });

        it("should convert array of ISO 639-3 codes", () => {
            expect.hasAssertions();

            const result = convert6393To6391(["eng", "fra", "xxx"]);

            expect(result).toStrictEqual(["en", "fr"]);
        });

        it("should return empty array for all unmapped codes", () => {
            expect.hasAssertions();
            expect(convert6393To6391(["xxx", "yyy"])).toStrictEqual([]);
        });
    });
});
