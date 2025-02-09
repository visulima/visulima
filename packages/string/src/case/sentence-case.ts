import { noCase } from "./no-case";
import type { CaseOptions, SentenceCase } from "./types";
import { upperFirst } from "./upper-first";

/**
 * Converts a string to Sentence case.
 * @example
 * ```typescript
 * sentenceCase("foo bar") // => "Foo bar"
 * sentenceCase("foo-bar") // => "Foo bar"
 * sentenceCase("foo_bar") // => "Foo bar"
 * sentenceCase("XMLHttpRequest") // => "Xml http request"
 * sentenceCase("AJAXRequest") // => "Ajax request"
 * sentenceCase("QueryXML123String") // => "Query xml 123 string"
 * ```
 */
export const sentenceCase = <T extends string = string>(value: T, options: CaseOptions = {}): SentenceCase<T> => {
    const words = noCase(value, options);

    return upperFirst(words, options) as SentenceCase<T>;
};
