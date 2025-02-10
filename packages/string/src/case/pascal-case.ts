import { splitByCase } from "./split-by-case";
import type { CaseOptions, PascalCase } from "./types";
import { upperFirst } from "./upper-first";
import { normalizeGermanEszett } from "./utils/normalize-german-eszett";

/**
 * Converts a string to PascalCase.
 *
 * @param value - The string to convert.
 * @param options - Options for case conversion.
 * @returns The string in PascalCase.
 *
 * @example
 * ```typescript
 * pascalCase('foo bar') // 'FooBar'
 * pascalCase('foo-bar') // 'FooBar'
 * pascalCase('foo_bar') // 'FooBar'
 * pascalCase('XMLHttpRequest') // 'XmlHttpRequest'
 * pascalCase('AJAXRequest') // 'AjaxRequest'
 * pascalCase('QueryXML123String') // 'QueryXml123String'
 * ```
 */
export const pascalCase = <T extends string = string>(value?: T, options?: CaseOptions): PascalCase<T> => {
    if (typeof value !== "string" || !value) {
        return "" as PascalCase<T>;
    }

    return splitByCase(value, { ...options, separators: undefined })
        .map((word: string) => {
            const split = normalizeGermanEszett(word, options?.locale);

            return upperFirst(options?.locale ? split.toLocaleLowerCase(options.locale) : split.toLowerCase(), { locale: options?.locale });
        })
        .join("") as PascalCase<T>;
};
