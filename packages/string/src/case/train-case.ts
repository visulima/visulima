import type { CaseOptions, TrainCase } from "./types";
import { splitByCase } from "./split-by-case";
import { upperFirst } from "./upper-first";

/**
 * Converts a string to Train-Case.
 * @example
 * ```typescript
 * trainCase("foo bar") // => "Foo-Bar"
 * trainCase("foo-bar") // => "Foo-Bar"
 * trainCase("foo_bar") // => "Foo-Bar"
 * trainCase("XMLHttpRequest") // => "XML-Http-Request"
 * trainCase("AJAXRequest") // => "AJAX-Request"
 * trainCase("QueryXML123String") // => "Query-XML-123-String"
 * ```
 */
export const trainCase = <T extends string = string>(value: T, options: CaseOptions = {}): TrainCase<T> => {

    if (typeof value !== "string") {
        return "" as TrainCase<T>;
    }

    return splitByCase(value, options)
        .filter(Boolean)
        .map((p) => upperFirst(p, { locale: options?.locale }))
        .join("-") as TrainCase<T>;
};
