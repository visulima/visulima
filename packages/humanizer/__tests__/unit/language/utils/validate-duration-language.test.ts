import { describe, expect, it } from "vitest";

import type { DurationDigitReplacements } from "../../../../src";
import validateDurationLanguage from "../../../../src/language/util/validate-duration-language";

describe(validateDurationLanguage, () => {
    it("should not throw any error when all required properties are present and have the correct types", () => {
        expect.assertions(1);

        const language = {
            d: "day",
            future: "in the future",
            h: "hour",
            m: "minute",
            mo: "month",
            ms: "millisecond",
            past: "in the past",
            s: "second",
            w: "week",
            y: "year",
        };

        expect(() => {
            validateDurationLanguage(language);
        }).not.toThrow();
    });

    it("should not throw any error when all properties are present and have the correct types", () => {
        expect.assertions(1);

        const language = {
            _digitReplacements: ["test", "test", "test", "test", "test", "test", "test", "test", "test", "test"] as DurationDigitReplacements,
            _numberFirst: true,
            d: "day",
            decimal: ".",
            delimiter: ",",
            future: "in the future",
            h: "hour",
            m: "minute",
            mo: "month",
            ms: "millisecond",
            past: "in the past",
            s: "second",
            w: "week",
            y: "year",
        };

        expect(() => {
            validateDurationLanguage(language);
        }).not.toThrow();
    });

    it("should throw a TypeError when any of the required properties is missing", () => {
        expect.assertions(1);

        const language = {
            d: "day",
            h: "hour",
            m: "minute",
            mo: "month",
            ms: "millisecond",
            s: "second",
            w: "week",
            y: "year",
        };

        expect(() => {
            validateDurationLanguage(language);
        }).toThrow(TypeError);
    });

    it("should throw a TypeError when future or past properties are not strings", () => {
        expect.assertions(1);

        const language = {
            d: "day",
            future: 123,
            h: "hour",
            m: "minute",
            mo: "month",
            ms: "millisecond",
            past: 456,
            s: "second",
            w: "week",
            y: "year",
        };

        expect(() => {
            // @ts-expect-error - testing invalid input
            validateDurationLanguage(language);
        }).toThrow(TypeError);
    });

    it("should throw a TypeError when any of the y, mo, w, d, h, m, s, and ms properties is not a string or a function", () => {
        expect.assertions(1);

        const language = {
            d: "day",
            future: "in the future",
            h: "hour",
            m: "minute",
            mo: "month",
            ms: 123,
            past: "in the past",
            s: "second",
            w: "week",
            y: "year",
        };

        expect(() => {
            // @ts-expect-error - testing invalid input
            validateDurationLanguage(language);
        }).toThrow(TypeError);
    });
});
