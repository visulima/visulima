import type { LocaleOptions, TitleCase } from "../types";
import { splitByCase } from "./split-by-case";
import { upperFirst } from "./upper-first";

/**
 * With Title Case all words are capitalized, except for minor words.
 * A compact regex of common minor words (such as a for, to) is used
 * to automatically keep them lower case.
 * @example
 * ```typescript
 * titleCase("this-IS-aTitle") // => "This is a Title"
 * titleCase("XMLHttpRequest") // => "XML Http Request"
 * titleCase("AJAXRequest") // => "AJAX Request"
 * titleCase("QueryXML123String") // => "Query XML 123 String"
 * ```
 */
export function titleCase(): "";
export function titleCase<T extends string>(string_: T, options?: LocaleOptions): TitleCase<T>;
// eslint-disable-next-line func-style
export function titleCase<T extends string = string>(string_?: T, options: LocaleOptions = {}): TitleCase<T> {
    const { locale } = options;

    if (typeof string_ !== "string" && !Array.isArray(string_)) {
        return "" as TitleCase<T>;
    }

    return splitByCase(string_, { locale })
        .filter(Boolean)
        .map((p) => upperFirst(locale ? p.toLocaleLowerCase(locale) : p.toLowerCase(), { locale }))
        .join(" ") as TitleCase<T>
}
