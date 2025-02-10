import { splitByCase } from "./split-by-case";
import type { CaseOptions, TitleCase } from "./types";
import { upperFirst } from "./upper-first";
import { normalizeGermanEszett } from "./utils/normalize-german-eszett";

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
export function titleCase<T extends string>(string_: T, options?: CaseOptions): TitleCase<T>;
// eslint-disable-next-line func-style
export function titleCase<T extends string = string>(string_?: T, options: CaseOptions = {}): TitleCase<T> {
    if (typeof string_ !== "string") {
        return "" as TitleCase<T>;
    }

    return splitByCase(string_, options)
        .map((word: string) => {
            const split = normalizeGermanEszett(word, options.locale);

            return upperFirst(options.locale ? split.toLocaleLowerCase(options.locale) : split.toLowerCase(), { locale: options.locale });
        })
        .join(" ") as TitleCase<T>;
}
