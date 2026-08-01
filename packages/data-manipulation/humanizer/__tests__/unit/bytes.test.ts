import { describe, expect, it } from "vitest";

import { formatBytes, parseBytes } from "../../src/bytes";

describe(formatBytes, () => {
    it("should use the closest unit without any decimals in a short format", () => {
        expect.assertions(1);

        expect(formatBytes(50.4 * 1024 * 1024)).toBe("50 MB");
    });

    it("should use the closest unit with base 10", () => {
        expect.assertions(1);

        expect(formatBytes(50.4 * 1024 * 1024, { base: 10, decimals: 2 })).toBe("52.85 MB");
    });

    it("should throw an error when passing an invalid base value", () => {
        expect.assertions(1);

        // @ts-expect-error - Testing invalid input
        expect(() => formatBytes(50, { base: 3 })).toThrow("Unsupported base.");
    });

    it("should use the specified unit", () => {
        expect.assertions(1);

        expect(formatBytes(50.4 * 1024 * 1024, { unit: "KB" })).toBe("51,610 KB");
    });

    it("should dont display a space between number and unit if space option is false", () => {
        expect.assertions(2);

        expect(formatBytes(50.4 * 1024 * 1024, { space: false })).toBe("50MB");
        expect(formatBytes(0, { space: false })).toBe("0Bytes");
    });

    it("should use the specified number of decimals", () => {
        expect.assertions(1);

        expect(formatBytes(50.4 * 1024 * 1024, { decimals: 2 })).toBe("50.40 MB");
    });

    it("should use the long form of the unit", () => {
        expect.assertions(1);

        expect(formatBytes(50.4 * 1024 * 1024, { long: true })).toBe("50 Megabytes");
    });

    it("should use the specified locale", () => {
        expect.assertions(1);

        expect(formatBytes(50.4 * 1024 * 1024, { decimals: 2, locale: "de", unit: "KB" })).toBe("51.609,60 KB");
    });

    it("should use all options", () => {
        expect.assertions(1);

        expect(formatBytes(50.4 * 1024 * 1024, { decimals: 2, locale: "de", long: true, unit: "KB" })).toBe("51.609,60 Kilobytes");
    });

    it("should return a negative bytes string", () => {
        expect.assertions(1);

        expect(formatBytes(-50)).toBe("-50 Bytes");
    });

    it("should throw an error if value is not a number", () => {
        expect.assertions(1);

        // @ts-expect-error - Testing invalid input
        expect(() => formatBytes("50")).toThrow("Bytesize is not a number.");
    });

    it("should throw an error when passing an invalid value", () => {
        expect.assertions(1);

        expect(() => formatBytes(Number.NaN)).toThrow("Bytesize is not a number.");
    });

    it("should return 0 Bytes", () => {
        expect.assertions(1);

        expect(formatBytes(0)).toBe("0 Bytes");
    });

    it("should return the long unit name when formatting zero bytes", () => {
        expect.assertions(1);

        expect(formatBytes(0, { long: true })).toBe("0 Bytes");
    });

    it("should fall back to the locale default fraction digits when decimals is negative", () => {
        expect.assertions(1);

        expect(formatBytes(50.4 * 1024 * 1024, { decimals: -1 })).toBe("50.4 MB");
    });

    const testCases = [
        // Metric
        { description: "metric 10", expectedUnit: "Bytes", expectedValue: "10", value: 10 },
        { description: "metric 1000", expectedUnit: "Bytes", expectedValue: "1,000", value: 1000 },
        { description: "metric -1000", expectedUnit: "Bytes", expectedValue: "-1,000", value: -1000 },
        { description: "metric 10000", expectedUnit: "KB", expectedValue: "10", value: 10_000 },
        { description: "metric 34560000", expectedUnit: "MB", expectedValue: "33", value: 34_560_000 },
        { description: "metric 34560000000", expectedUnit: "GB", expectedValue: "32", value: 34_560_000_000 },
        { description: "metric 34560000000000", expectedUnit: "TB", expectedValue: "31", value: 34_560_000_000_000 },
        { description: "metric 34560000000000000", expectedUnit: "PB", expectedValue: "31", value: 34_560_000_000_000_000 },
        { description: "metric 34560000000000000000", expectedUnit: "EB", expectedValue: "30", value: 34_560_000_000_000_000_000 },
        { description: "metric 34560000000000000000000", expectedUnit: "ZB", expectedValue: "29", value: 34_560_000_000_000_000_000_000 },
        { description: "metric 34560000000000000000000000", expectedUnit: "YB", expectedValue: "29", value: 34_560_000_000_000_000_000_000_000 },
        {
            description: "metric 34560000000000000000000000000",
            expectedUnit: "YB",
            expectedValue: "28,587",
            value: 34_560_000_000_000_000_000_000_000_000,
        },
        {
            description: "metric -34560000000000000000000000000",
            expectedUnit: "YB",
            expectedValue: "-28,587",
            value: -34_560_000_000_000_000_000_000_000_000,
        },

        // Metric Octet
        { description: "metric_octet 10", expectedUnit: "o", expectedValue: "10", options: { units: "metric_octet" }, value: 10 },
        { description: "metric_octet 1000", expectedUnit: "o", expectedValue: "1,000", options: { units: "metric_octet" }, value: 1000 },
        { description: "metric_octet -1000", expectedUnit: "o", expectedValue: "-1,000", options: { units: "metric_octet" }, value: -1000 },
        { description: "metric_octet 10000", expectedUnit: "ko", expectedValue: "10", options: { units: "metric_octet" }, value: 10_000 },
        { description: "metric_octet 34560000", expectedUnit: "Mo", expectedValue: "33", options: { units: "metric_octet" }, value: 34_560_000 },
        { description: "metric_octet 34560000000", expectedUnit: "Go", expectedValue: "32", options: { units: "metric_octet" }, value: 34_560_000_000 },
        { description: "metric_octet 34560000000000", expectedUnit: "To", expectedValue: "31", options: { units: "metric_octet" }, value: 34_560_000_000_000 },
        {
            description: "metric_octet 34560000000000000",
            expectedUnit: "Po",
            expectedValue: "31",
            options: { units: "metric_octet" },
            value: 34_560_000_000_000_000,
        },
        {
            description: "metric_octet 34560000000000000000",
            expectedUnit: "Eo",
            expectedValue: "30",
            options: { units: "metric_octet" },
            value: 34_560_000_000_000_000_000,
        },
        {
            description: "metric_octet 34560000000000000000000",
            expectedUnit: "Zo",
            expectedValue: "29",
            options: { units: "metric_octet" },
            value: 34_560_000_000_000_000_000_000,
        },
        {
            description: "metric_octet 34560000000000000000000000",
            expectedUnit: "Yo",
            expectedValue: "29",
            options: { units: "metric_octet" },
            value: 34_560_000_000_000_000_000_000_000,
        },
        {
            description: "metric_octet 34560000000000000000000000000",
            expectedUnit: "Yo",
            expectedValue: "28,587",
            options: { units: "metric_octet" },
            value: 34_560_000_000_000_000_000_000_000_000,
        },
        {
            description: "metric_octet -34560000000000000000000000000",
            expectedUnit: "Yo",
            expectedValue: "-28,587",
            options: { units: "metric_octet" },
            value: -34_560_000_000_000_000_000_000_000_000,
        },

        // IEC
        { description: "iec 10", expectedUnit: "B", expectedValue: "10", options: { units: "iec" }, value: 10 },
        { description: "iec 1000", expectedUnit: "B", expectedValue: "1,000", options: { units: "iec" }, value: 1000 },
        { description: "iec -1000", expectedUnit: "B", expectedValue: "-1,000", options: { units: "iec" }, value: -1000 },
        { description: "iec 10000", expectedUnit: "KiB", expectedValue: "10", options: { units: "iec" }, value: 10_000 },
        { description: "iec 34560000", expectedUnit: "MiB", expectedValue: "33", options: { units: "iec" }, value: 34_560_000 },
        { description: "iec 34560000000", expectedUnit: "GiB", expectedValue: "32", options: { units: "iec" }, value: 34_560_000_000 },
        { description: "iec 34560000000000", expectedUnit: "TiB", expectedValue: "31", options: { units: "iec" }, value: 34_560_000_000_000 },
        { description: "iec 34560000000000000", expectedUnit: "PiB", expectedValue: "31", options: { units: "iec" }, value: 34_560_000_000_000_000 },
        { description: "iec 34560000000000000000", expectedUnit: "EiB", expectedValue: "30", options: { units: "iec" }, value: 34_560_000_000_000_000_000 },
        {
            description: "iec 34560000000000000000000",
            expectedUnit: "ZiB",
            expectedValue: "29",
            options: { units: "iec" },
            value: 34_560_000_000_000_000_000_000,
        },
        {
            description: "iec 34560000000000000000000000",
            expectedUnit: "YiB",
            expectedValue: "29",
            options: { units: "iec" },
            value: 34_560_000_000_000_000_000_000_000,
        },
        {
            description: "iec 34560000000000000000000000000",
            expectedUnit: "YiB",
            expectedValue: "28,587",
            options: { units: "iec" },
            value: 34_560_000_000_000_000_000_000_000_000,
        },
        {
            description: "iec -34560000000000000000000000000",
            expectedUnit: "YiB",
            expectedValue: "-28,587",
            options: { units: "iec" },
            value: -34_560_000_000_000_000_000_000_000_000,
        },

        // IEC Octet
        { description: "iec_octet 10", expectedUnit: "o", expectedValue: "10", options: { units: "iec_octet" }, value: 10 },
        { description: "iec_octet 1000", expectedUnit: "o", expectedValue: "1,000", options: { units: "iec_octet" }, value: 1000 },
        { description: "iec_octet -1000", expectedUnit: "o", expectedValue: "-1,000", options: { units: "iec_octet" }, value: -1000 },
        { description: "iec_octet 10000", expectedUnit: "Kio", expectedValue: "10", options: { units: "iec_octet" }, value: 10_000 },
        { description: "iec_octet 34560000", expectedUnit: "Mio", expectedValue: "33", options: { units: "iec_octet" }, value: 34_560_000 },
        { description: "iec_octet 34560000000", expectedUnit: "Gio", expectedValue: "32", options: { units: "iec_octet" }, value: 34_560_000_000 },
        { description: "iec_octet 34560000000000", expectedUnit: "Tio", expectedValue: "31", options: { units: "iec_octet" }, value: 34_560_000_000_000 },
        {
            description: "iec_octet 34560000000000000",
            expectedUnit: "Pio",
            expectedValue: "31",
            options: { units: "iec_octet" },
            value: 34_560_000_000_000_000,
        },
        {
            description: "iec_octet 34560000000000000000",
            expectedUnit: "Eio",
            expectedValue: "30",
            options: { units: "iec_octet" },
            value: 34_560_000_000_000_000_000,
        },
        {
            description: "iec_octet 34560000000000000000000",
            expectedUnit: "Zio",
            expectedValue: "29",
            options: { units: "iec_octet" },
            value: 34_560_000_000_000_000_000_000,
        },
        {
            description: "iec_octet 34560000000000000000000000",
            expectedUnit: "Yio",
            expectedValue: "29",
            options: { units: "iec_octet" },
            value: 34_560_000_000_000_000_000_000_000,
        },
        {
            description: "iec_octet 34560000000000000000000000000",
            expectedUnit: "Yio",
            expectedValue: "28,587",
            options: { units: "iec_octet" },
            value: 34_560_000_000_000_000_000_000_000_000,
        },
        {
            description: "iec_octet -34560000000000000000000000000",
            expectedUnit: "Yio",
            expectedValue: "-28,587",
            options: { units: "iec_octet" },
            value: -34_560_000_000_000_000_000_000_000_000,
        },
    ];

    it.each<{
        description: string;
        expectedUnit: string;
        expectedValue: string;
        options?: Record<string, unknown>;
        value: number;
    }>(testCases)("should support $description", ({ expectedUnit, expectedValue, options = {}, value }) => {
        expect.assertions(1);

        expect(formatBytes(value, { ...options })).toBe(`${expectedValue} ${expectedUnit}`);
    });

    it("should not throw a TypeError for 0 < |bytes| < 1 and clamp the unit level", () => {
        expect.assertions(3);

        expect(formatBytes(0.5)).toBe("1 Bytes");
        expect(formatBytes(0.5, { decimals: 1 })).toBe("0.5 Bytes");
        expect(formatBytes(-0.25, { decimals: 2 })).toBe("-0.25 Bytes");
    });

    it("should format in bits when bits is true", () => {
        expect.assertions(3);

        // 1 byte = 8 bits
        expect(formatBytes(1, { bits: true })).toBe("8 bit");
        expect(formatBytes(1000, { bits: true })).toBe("8 kbit");
        expect(formatBytes(1_000_000, { base: 10, bits: true, decimals: 1 })).toBe("8.0 Mbit");
    });

    it("should format bits with the long unit form", () => {
        expect.assertions(1);

        expect(formatBytes(1000, { bits: true, long: true })).toBe("8 Kilobits");
    });

    it("should honor a byte-unit pin in bits mode by mapping it to the bit level (regression)", () => {
        expect.assertions(3);

        // The `unit` option is typed as a byte short ("MB"), which never matched
        // the bit reference table, so bits+unit silently fell back to the
        // auto-computed level. It now pins the equivalent bit unit level.
        expect(formatBytes(1_000_000, { base: 10, bits: true, decimals: 1, unit: "MB" })).toBe("8.0 Mbit");
        expect(formatBytes(1_000_000, { base: 10, bits: true, decimals: 3, unit: "KB" })).toBe("8,000.000 kbit");
        expect(formatBytes(1_000_000, { base: 10, bits: true, long: true, unit: "GB" })).toBe("0 Gigabits");
    });

    it("should prefix positive values with a sign when signed is true", () => {
        expect.assertions(3);

        expect(formatBytes(50.4 * 1024 * 1024, { signed: true })).toBe("+50 MB");
        expect(formatBytes(-50.4 * 1024 * 1024, { signed: true })).toBe("-50 MB");
        // Zero is never signed.
        expect(formatBytes(0, { signed: true })).toBe("0 Bytes");
    });

    it("should accept open BCP-47 locale tags not in the known union (e.g. de-DE)", () => {
        expect.assertions(2);

        // `de-DE` is a valid tag rejected by the old closed `IntlLocale` union.
        // German uses "." for grouping and "," for the decimal separator.
        expect(formatBytes(1234.5 * 1024, { decimals: 1, locale: "de-DE", unit: "KB" })).toBe("1.234,5 KB");
        expect(formatBytes(0, { locale: "de-DE" })).toBe("0 Bytes");
    });

    it("should walk the whole metric unit table at exact powers of 1024", () => {
        expect.assertions(9);

        const expected = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];

        for (const [level, unit] of expected.entries()) {
            expect(formatBytes(1024 ** level)).toBe(`1 ${unit}`);
        }
    });

    it("should walk the whole IEC unit table at exact powers of 1024", () => {
        expect.assertions(9);

        const expected = ["B", "KiB", "MiB", "GiB", "TiB", "PiB", "EiB", "ZiB", "YiB"];

        for (const [level, unit] of expected.entries()) {
            expect(formatBytes(1024 ** level, { units: "iec" })).toBe(`1 ${unit}`);
        }
    });

    it("should round to the requested number of decimals", () => {
        expect.assertions(3);

        expect(formatBytes(1536, { decimals: 2 })).toBe("1.50 KB");
        expect(formatBytes(1536, { decimals: 1 })).toBe("1.5 KB");
        // decimals: 0 rounds rather than truncates.
        expect(formatBytes(1536, { decimals: 0 })).toBe("2 KB");
    });

    it("should format zero in bits mode with the bare bit unit", () => {
        expect.assertions(1);

        expect(formatBytes(0, { bits: true })).toBe("0 bit");
    });

    it("should group with the locale's own separator rather than a hard-coded one", () => {
        expect.assertions(3);

        // fr-FR groups with a narrow no-break space (U+202F) in modern CLDR and
        // ar-EG uses Eastern Arabic digits. Assert against Intl's own output so
        // these document the separator/digits the runtime actually emits instead
        // of pinning a code point that a CLDR bump can move.
        const frGrouped = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0, minimumFractionDigits: 0 }).format(1024);
        const arOne = new Intl.NumberFormat("ar-EG", { maximumFractionDigits: 0, minimumFractionDigits: 0 }).format(1);

        expect(formatBytes(1024 ** 2, { locale: "fr-FR", unit: "KB" })).toBe(`${frGrouped} KB`);
        expect(frGrouped).not.toBe("1024");
        expect(formatBytes(1024, { locale: "ar-EG" })).toBe(`${arOne} KB`);
    });

    it("should format with a Japanese locale", () => {
        expect.assertions(1);

        expect(formatBytes(1536, { decimals: 1, locale: "ja-JP" })).toBe("1.5 KB");
    });

    it("should honour passthrough Intl.NumberFormat options", () => {
        expect.assertions(2);

        expect(formatBytes(1536, { locale: "en-US", maximumFractionDigits: 3, minimumFractionDigits: 3 })).toBe("1.500 KB");
        expect(formatBytes(1024 ** 2, { locale: "en-US", unit: "KB", useGrouping: false })).toBe("1024 KB");
    });

    it("should return consistent results across repeated calls (cached formatters/separators)", () => {
        expect.assertions(1);

        // Exercises the per-locale+options Intl.NumberFormat cache and the
        // memoized separator lookup: repeated identical calls must stay correct.
        const results = Array.from({ length: 5 }, () => formatBytes(50.4 * 1024 * 1024, { decimals: 2, locale: "en-US" }));

        expect(new Set(results)).toStrictEqual(new Set(["50.40 MB"]));
    });
});

describe(parseBytes, () => {
    it("should parse the number", () => {
        expect.assertions(1);

        expect(parseBytes("50")).toBe(50);
    });

    it("should parse the number and unit", () => {
        expect.assertions(1);

        expect(parseBytes("50 KB")).toBe(50 * 1024);
    });

    it("should parse with a number and long unit", () => {
        expect.assertions(1);

        expect(parseBytes("50 Kilobytes")).toBe(50 * 1024);
    });

    it("should parse with a number and long unit and a locale", () => {
        expect.assertions(1);

        expect(parseBytes("50 Kilobytes", { locale: "de" })).toBe(50 * 1024);
    });

    it("should parse with a number and unit and a locale", () => {
        expect.assertions(1);

        expect(parseBytes("50 KB", { locale: "de" })).toBe(50 * 1024);
    });

    it("should parse with a longer number and unit and a locale", () => {
        expect.assertions(1);

        expect(parseBytes("50.000,5 KB", { locale: "de" })).toBe(50_000.5 * 1024);
    });

    it("should parse locales whose group separator is a space or apostrophe (regression)", () => {
        expect.assertions(3);

        // fr-FR/sv-SE group with a no-break space and de-CH with an apostrophe;
        // the entry regex used to admit only "." and "," between digit groups, so
        // these inputs never matched and parseBytes returned NaN. Build the inputs
        // from the locale formatter so the exact grouping code point is exercised.
        const frInput = `${new Intl.NumberFormat("fr-FR").format(1234.5)} Mo`;
        const svInput = `${new Intl.NumberFormat("sv-SE").format(1234)} KB`;
        const chInput = `${new Intl.NumberFormat("de-CH").format(1234)} KB`;

        expect(parseBytes(frInput, { locale: "fr-FR", units: "metric_octet" })).toBe(1234.5 * 1024 ** 2);
        expect(parseBytes(svInput, { locale: "sv-SE" })).toBe(1234 * 1024);
        expect(parseBytes(chInput, { locale: "de-CH" })).toBe(1234 * 1024);
    });

    it("should throw an error with an empty string", () => {
        expect.assertions(1);

        expect(() => parseBytes("")).toThrow("Value is not a string or is empty.");
    });

    it("should throw an error with a number", () => {
        expect.assertions(1);

        // @ts-expect-error - Testing invalid input
        expect(() => parseBytes(50)).toThrow("Value is not a string or is empty.");
    });

    it("should throw an error with a string that exceeds 100 characters", () => {
        expect.assertions(1);

        expect(() => parseBytes("x".repeat(101))).toThrow("Value exceeds the maximum length of 100 characters.");
    });

    it("should return NaN when the value cannot be matched by the parser", () => {
        expect.assertions(3);

        expect(parseBytes("abc")).toBeNaN();
        // A well-formed number with an unknown unit, and a unit with no number.
        expect(parseBytes("1 Parsecs")).toBeNaN();
        expect(parseBytes("KB")).toBeNaN();
    });

    it("should parse every metric suffix at its own magnitude", () => {
        expect.assertions(9);

        const suffixes = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];

        for (const [level, suffix] of suffixes.entries()) {
            expect(parseBytes(`1${suffix}`)).toBe(1024 ** level);
        }
    });

    it("should be case-insensitive about the suffix", () => {
        expect.assertions(3);

        expect(parseBytes("1kb")).toBe(1024);
        expect(parseBytes("1Kb")).toBe(1024);
        expect(parseBytes("1 KB")).toBe(1024);
    });

    it("should parse negative values", () => {
        expect.assertions(2);

        expect(parseBytes("-1KB")).toBe(-1024);
        expect(parseBytes("-100")).toBe(-100);
    });

    it("should round-trip formatBytes output for every metric unit", () => {
        expect.assertions(5);

        for (const bytes of [1024, 1024 ** 2, 5 * 1024 ** 3, 1024 ** 4]) {
            expect(parseBytes(formatBytes(bytes))).toBe(bytes);
        }

        // A value that only survives the round trip once fraction digits are kept.
        expect(parseBytes(formatBytes(1536, { decimals: 1 }))).toBe(1536);
    });

    it("should round-trip a German-formatted value", () => {
        expect.assertions(1);

        const formatted = formatBytes(1536, { decimals: 1, locale: "de-DE" });

        expect(parseBytes(formatted, { locale: "de-DE" })).toBe(1536);
    });

    describe("iec units", () => {
        it("should parse an IEC suffix against the iec table", () => {
            expect.assertions(6);

            expect(parseBytes("1KiB", { units: "iec" })).toBe(1024);
            expect(parseBytes("1MiB", { units: "iec" })).toBe(1024 ** 2);
            expect(parseBytes("1 Kibibytes", { units: "iec" })).toBe(1024);
            expect(parseBytes("1B", { units: "iec" })).toBe(1);
            expect(parseBytes("1Kio", { units: "iec_octet" })).toBe(1024);
            expect(parseBytes("1 Kibioctets", { units: "iec_octet" })).toBe(1024);
        });

        it("should parse an IEC suffix against the default metric table", () => {
            expect.assertions(3);

            // A suffix the configured table does not know is resolved against the
            // other tables, so an explicitly spelled unit is never rejected just
            // because `units` points elsewhere.
            expect(parseBytes("1KiB")).toBe(1024);
            expect(parseBytes("1 Kibibytes")).toBe(1024);
            expect(parseBytes("1Kio")).toBe(1024);
        });

        it("should parse an SI suffix against the iec table", () => {
            expect.assertions(3);

            // The SI suffix is not in the iec table, so it falls through to the
            // metric table and is scaled by `base` (default 2 -> 1024).
            expect(parseBytes("1KB", { units: "iec" })).toBe(1024);
            expect(parseBytes("1 Kilobytes", { units: "iec" })).toBe(1024);
            expect(parseBytes("1KB", { base: 10, units: "iec" })).toBe(1000);
        });

        it("should scale an IEC suffix by 1024 regardless of the base option", () => {
            expect.assertions(3);

            // IEC prefixes are defined as powers of 1024, so they pin the
            // multiplier; only the ambiguous SI prefixes follow `base`.
            expect(parseBytes("1KiB", { base: 10 })).toBe(1024);
            expect(parseBytes("1MiB", { base: 10, units: "iec" })).toBe(1024 ** 2);
            expect(parseBytes("1KB", { base: 10 })).toBe(1000);
        });

        it("should return NaN for a bare prefix with no byte or octet indicator", () => {
            expect.assertions(3);

            // "1K" is ambiguous by design (kilobyte? kibibyte? plain thousand?) and
            // is not a unit in any table, so it stays unparseable.
            expect(parseBytes("1K", { units: "iec" })).toBeNaN();
            expect(parseBytes("1K")).toBeNaN();
            expect(parseBytes("1Ki", { units: "iec" })).toBeNaN();
        });

        it("should round-trip formatBytes output for every iec unit", () => {
            expect.assertions(9);

            for (const level of [0, 1, 2, 3, 4, 5, 6, 7, 8]) {
                const bytes = 1024 ** level;

                expect(parseBytes(formatBytes(bytes, { units: "iec" }), { units: "iec" })).toBe(bytes);
            }
        });
    });
});
