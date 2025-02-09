import type { CapitalCase, CaseOptions } from "./types";
import { noCase } from "./no-case";
import { upperFirst } from "./upper-first";

/**
 * Converts a string to Capital Case.
 * @example
 * ```typescript
 * capitalCase("foo bar") // => "Foo Bar"
 * capitalCase("foo-bar") // => "Foo Bar"
 * capitalCase("foo_bar") // => "Foo Bar"
 * capitalCase("XMLHttpRequest") // => "Xml Http Request"
 * capitalCase("AJAXRequest") // => "Ajax Request"
 * capitalCase("QueryXML123String") // => "Query Xml 123 String"
 * ```
 */
export const capitalCase = <T extends string = string>(value: T, options: CaseOptions = {}): CapitalCase<T> => {
    const words = noCase(value, options).split(" ");

    return words.map((word) => upperFirst(word, { locale: options?.locale })).join(" ") as CapitalCase<T>;
};
