import type { CaseOptions, PascalCase } from "./types";
import { splitByCase } from "./split-by-case";
import { upperFirst } from "./upper-first";

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
export const pascalCase = <T extends string = string>(value: T, options: CaseOptions = {}): PascalCase<T> => {
    if (typeof value !== "string" || !value) {
        return "" as PascalCase<T>;
    }

    return splitByCase(value, options)
        .map((word: string) => upperFirst(options?.locale ? word.toLocaleLowerCase(options.locale) : word.toLowerCase(), { locale: options?.locale }))
        .join("") as PascalCase<T>;
};
