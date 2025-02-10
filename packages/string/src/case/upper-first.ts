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

    const firstChar = options?.locale ? value.charAt<T>(0).toLocaleUpperCase(options.locale) : value.charAt<T>(0).toUpperCase();

    // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
    return (firstChar + value.slice(1)) as UpperFirst<T>;
};
