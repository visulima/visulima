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
        };

        expect(() => {
            // @ts-expect-error - testing invalid input (missing required `y`)
            validateDurationLanguage(language);
        }).toThrow(new TypeError("Missing required property: y"));
    });

    it("should not throw when the optional future and past properties are omitted", () => {
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
        }).not.toThrow();
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

    const baseLanguage = {
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

    it("should throw a TypeError when decimal is present but not a string", () => {
        expect.assertions(1);

        const language = { ...baseLanguage, decimal: 42 };

        expect(() => {
            // @ts-expect-error - testing invalid input
            validateDurationLanguage(language);
        }).toThrow(new TypeError("Property decimal must be of type string"));
    });

    it("should throw a TypeError when delimiter is present but not a string", () => {
        expect.assertions(1);

        const language = { ...baseLanguage, delimiter: 99 };

        expect(() => {
            // @ts-expect-error - testing invalid input
            validateDurationLanguage(language);
        }).toThrow(new TypeError("Property delimiter must be of type string"));
    });

    it("should throw a TypeError when _digitReplacements is present but not an array", () => {
        expect.assertions(1);

        const language = { ...baseLanguage, _digitReplacements: "not-an-array" };

        expect(() => {
            // @ts-expect-error - testing invalid input
            validateDurationLanguage(language);
        }).toThrow(new TypeError("Property _digitReplacements must be an array"));
    });

    it("should throw a TypeError when _numberFirst is present but not a boolean", () => {
        expect.assertions(1);

        const language = { ...baseLanguage, _numberFirst: "yes" };

        expect(() => {
            // @ts-expect-error - testing invalid input
            validateDurationLanguage(language);
        }).toThrow(new TypeError("Property _numberFirst must be of type boolean"));
    });

    it("should throw a TypeError when unitMap is present but not an object", () => {
        expect.assertions(1);

        const language = { ...baseLanguage, unitMap: "not-an-object" };

        expect(() => {
            // @ts-expect-error - testing invalid input
            validateDurationLanguage(language);
        }).toThrow(new TypeError("Property unitMap must be an object"));
    });

    it("should throw a TypeError when unitMap contains non-string values", () => {
        expect.assertions(1);

        const language = { ...baseLanguage, unitMap: { d: "day", h: 1 } };

        expect(() => {
            // @ts-expect-error - testing invalid input
            validateDurationLanguage(language);
        }).toThrow(new TypeError("All values in unitMap must be of type string"));
    });

    it("should cache validated language objects and skip re-validation (WeakSet)", () => {
        expect.assertions(2);

        const language = { ...baseLanguage };

        // First call validates and caches the object reference.
        expect(() => {
            validateDurationLanguage(language);
        }).not.toThrow();

        // Mutate the same reference to an invalid shape. Because the object is
        // already cached, the validator short-circuits and does not re-check it.
        // @ts-expect-error - intentionally breaking the shape after caching
        language.future = 123;

        expect(() => {
            validateDurationLanguage(language);
        }).not.toThrow();
    });
});
