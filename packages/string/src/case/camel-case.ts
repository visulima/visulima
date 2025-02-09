import { lowerFirst } from "./lower-first";
import { pascalCase } from "./pascal-case";
import type { CamelCase, CaseOptions } from "./types";

/**
 * Converts a string to camelCase.
 *
 * @param value - The string to convert.
 * @param options - Options for case conversion.
 * @returns The string in camelCase.
 *
 * @example
 * ```typescript
 * camelCase('foo bar') // 'fooBar'
 * camelCase('foo-bar') // 'fooBar'
 * camelCase('foo_bar') // 'fooBar'
 * camelCase('XMLHttpRequest') // 'xmlHttpRequest'
 * camelCase('AJAXRequest') // 'ajaxRequest'
 * camelCase('QueryXML123String') // 'queryXml123String'
 * ```
 */
export const camelCase = <T extends string = string>(value: T, options: CaseOptions = {}): CamelCase<T> => {
    if (typeof value !== "string" || !value) {
        return "" as CamelCase<T>;
    }

    return lowerFirst(pascalCase(value, options), { locale: options.locale }) as CamelCase<T>;
};
