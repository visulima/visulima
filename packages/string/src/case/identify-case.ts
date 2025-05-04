import type { IdentifyCase } from "./types";

// eslint-disable-next-line security/detect-unsafe-regex,regexp/no-unused-capturing-group
const IS_PASCAL_CASE = /^([A-Z][a-z]*)+$/;
const CONTAINS_LETTER_CASE_INSENSITIVE = /[a-z]/i;
const IS_UPPER_SNAKE_CASE = /^[A-Z0-9_]+$/;
const IS_LOWER_SNAKE_CASE = /^[a-z0-9_]+$/;
// eslint-disable-next-line security/detect-unsafe-regex
const IS_KEBAB_CASE = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const IS_LOWERCASE_WITH_SPACE = /^[a-z ]+$/;
const IS_UPPERCASE = /^[A-Z][A-Z0-9]*$/; // Checks for all caps, allowing underscores and numbers
const WHITESPACE_REGEX = /\s+/;
const IS_NUMERIC = /^\d+$/;
// eslint-disable-next-line security/detect-unsafe-regex
const IS_CAMEL_CASE_LIKE = /^[a-z][a-z0-9]*(?:[A-Z][a-z0-9]*)+$/;
const CONTAINS_PUNCTUATION_MID_WORD = /[.!?;:,](?!\s|$)/;

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
// eslint-disable-next-line sonarjs/cognitive-complexity
const identifyCase = <T extends string = string>(value?: T): IdentifyCase<T> => {
    if (typeof value !== "string") {
        throw new TypeError("Expected input to be a string");
    }

    if (!value) {
        return "unknown";
    }

    // Check if the string contains any letter
    if (!CONTAINS_LETTER_CASE_INSENSITIVE.test(value)) {
        return "unknown";
    }

    if (value.includes("_")) {
        if (IS_UPPER_SNAKE_CASE.test(value)) {
            return "upper_snake";
        }

        if (IS_LOWER_SNAKE_CASE.test(value)) {
            return "snake";
        }

        return "mixed";
    }

    if (value.includes("-")) {
        if (IS_KEBAB_CASE.test(value)) {
            return "kebab";
        }

        return "mixed";
    }

    if (IS_LOWERCASE_WITH_SPACE.test(value)) {
        return "lower";
    }

    if (IS_UPPERCASE.test(value)) {
        return "upper";
    }

    const words = value.split(WHITESPACE_REGEX);

    if (words.length > 1 && words.every((word) => IS_PASCAL_CASE.test(word))) {
        return "title";
    }

    // The exception to previous is when the first word is a number
    // making the second word a candidate for pascal case
    if (words.length > 1 && IS_NUMERIC.test(words[0] as string) && IS_PASCAL_CASE.test(words[1] as string)) {
        return "title";
    }

    if (words.length > 1 && IS_PASCAL_CASE.test(words[0] as string) && /^[a-z]/.test(words[1] as string)) {
        return "sentence";
    }

    if (IS_PASCAL_CASE.test(value)) {
        return "pascal";
    }

    if (IS_CAMEL_CASE_LIKE.test(value)) {
        return "camel";
    }

    if (CONTAINS_PUNCTUATION_MID_WORD.test(value)) {
        return "unknown";
    }

    return "mixed";
};

export default identifyCase;
