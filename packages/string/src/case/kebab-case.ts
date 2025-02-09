import { splitByCase } from "./split-by-case";
import type { CaseOptions, KebabCase } from "./types";
import { normalizeGermanEszett } from "./utils/normalize-german-eszett";

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
        .map((p) => {
            const split = normalizeGermanEszett(p, options.locale);

            return options.locale ? split.toLocaleLowerCase(options.locale) : split.toLowerCase();
        })
        .join(options.joiner ?? "-") as KebabCase<T>;
};
