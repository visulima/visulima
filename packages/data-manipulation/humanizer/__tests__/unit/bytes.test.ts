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
});
