/**
 * Case style identifiers
 */
export type CaseStyle = "camel" | "kebab" | "lower" | "mixed" | "pascal" | "snake" | "upper";

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
const identifyCase = (value?: string): CaseStyle => {
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

    if (/^[A-Z][a-z0-9]+(?:[A-Z][a-z0-9]+)*$/.test(value)) {
        return "pascal";
    }

    if (/^[a-z0-9]+(?:[A-Z][a-z0-9]+)*$/.test(value)) {
        return "camel";
    }

    return "mixed";
};

export default identifyCase;
