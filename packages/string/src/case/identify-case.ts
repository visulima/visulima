import type { IdentifyCase } from "./types";

/**
 * Identifies the case style of a string.
 * @example
 * ```typescript
 * identifyCase("fooBar") // => "camel"
 * identifyCase("FooBar") // => "pascal"
 * identifyCase("foo_bar") // => "snake"
 * identifyCase("foo-bar") // => "kebab"
 * identifyCase("foo") // => "lower"
 * identifyCase("FOO") // => "upper"
 * identifyCase("FooBAR") // => "mixed"
 * ```
 */
const identifyCase = <T extends string = string>(value?: T): IdentifyCase<T> => {
    if (typeof value !== "string" || !value) {
        return "lower";
    }

    if (value === value.toLowerCase()) {
        if (value.includes("_")) {
            return "snake";
        }

        if (value.includes("-")) {
            return "kebab";
        }

        return "lower";
    }

    if (value === value.toUpperCase()) {
        return "upper";
    }

    // eslint-disable-next-line security/detect-unsafe-regex
    if (/^[A-Z][a-z0-9]+(?:[A-Z][a-z0-9]+)*$/.test(value)) {
        return "pascal";
    }

    // eslint-disable-next-line security/detect-unsafe-regex
    if (/^[a-z0-9]+(?:[A-Z][a-z0-9]+)*$/.test(value)) {
        return "camel";
    }

    return "mixed";
};

export default identifyCase;
