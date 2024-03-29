import { describe, expect, it } from "vitest";

import { formatBytes, parseBytes } from "../../src/bytes";

describe("formatBytes", () => {
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

    it('should dont display a space between number and unit if space option is false', () => {
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
        expect(() => formatBytes("50")).toThrow('Bytesize is not a number.');
    });

    it("should throw an error when passing an invalid value", () => {
        expect.assertions(1);

        expect(() => formatBytes(Number.NaN)).toThrow("Bytesize is not a number.");
    });

    it("should return 0 Bytes", () => {
        expect.assertions(1);

        expect(formatBytes(0)).toBe("0 Bytes");
    });
});

describe("parseBytes", () => {
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

        expect(() => parseBytes("")).toThrow('Value is not a string or is empty.');
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
