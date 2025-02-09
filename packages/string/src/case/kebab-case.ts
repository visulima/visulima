import { splitByCase } from "./split-by-case";
import type { CaseOptions, KebabCase } from "./types";

export interface KebabCaseOptions extends CaseOptions {
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
    if (typeof value !== "string") {
        return "" as KebabCase<T>;
    }

    return splitByCase(value, options)
        .map((p) => (options.locale ? p.toLocaleLowerCase(options.locale) : p.toLowerCase()))
        .join(options.joiner ?? "-") as KebabCase<T>;
};
