import type { CaseOptions, UpperFirst } from "./types";

/**
 * Converts first character to upper case.
 *
 * @param value - The string to convert.
 * @param options - Options for case conversion.
 * @returns The string with its first character converted to uppercase.
 *
 * @example
 * ```typescript
 * upperFirst("hello world!") // => "Hello world!"
 * upperFirst("istanbul", { locale: "tr" }) // => "İstanbul"
 * ```
 */
export const upperFirst = <T extends string = string>(value?: T, options?: CaseOptions): UpperFirst<T> => {
    if (typeof value !== "string") {
        return "" as UpperFirst<T>;
    }

    const { locale } = options || {};

    const firstChar = locale ? value.charAt(0).toLocaleUpperCase(locale) : value.charAt(0).toUpperCase();

    return (firstChar + value.slice(1)) as UpperFirst<T>;
};
