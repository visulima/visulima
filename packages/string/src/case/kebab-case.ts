import type { KebabCase, LocaleOptions } from "../types";
import { splitByCase } from "./split-by-case";

interface KebabCaseOptions extends LocaleOptions {
    /**
     * The string to use as a joiner between words.
     * @default "-"
     */
    joiner?: string;
}

/**
 * Converts a string to kebab-case.
 * @example
 * ```typescript
 * kebabCase("fooBar") // => "foo-bar"
 * kebabCase("foo bar") // => "foo-bar"
 * kebabCase("foo_bar") // => "foo-bar"
 * kebabCase("XMLHttpRequest") // => "xml-http-request"
 * kebabCase("AJAXRequest") // => "ajax-request"
 * kebabCase("QueryXML123String") // => "query-xml-123-string"
 * ```
 */
export const kebabCase = <T extends string = string>(value: T, options: KebabCaseOptions = {}): KebabCase<T> => {
    const { joiner = "-", locale } = options;

    if (typeof value !== "string") {
        return "" as KebabCase<T>;
    }

    return splitByCase(value as string, { locale })
        .map((p) => p.toLowerCase())
        .join(joiner ?? "-") as KebabCase<T>;
};
