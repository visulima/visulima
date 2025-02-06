import type { LocaleOptions, PascalCase } from "../types";
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
export const pascalCase = <T extends string = string>(value: T, options: LocaleOptions = {}): PascalCase<T> => {
    const { locale } = options;

    if (typeof value !== "string" || !value) {
        return "" as PascalCase<T>;
    }

    return splitByCase(value, { locale })
        .map((word: string) => upperFirst(locale ? word.toLocaleLowerCase(locale) : word.toLowerCase(), { locale }))
        .join("") as PascalCase<T>;
};
