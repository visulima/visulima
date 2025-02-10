import type { LocaleOptions, LowerFirst } from "./types";

/**
 * Converts first character to lower case.
 *
 * @param value - The string to convert.
 * @param options - Options for case conversion.
 * @returns The string with its first character converted to lowercase.
 *
 * @example
 * ```typescript
 * lowerFirst("Hello world!") // => "hello world!"
 * lowerFirst("İSTANBUL", { locale: "tr" }) // => "istanbul"
 * ```
 */
export const lowerFirst = <T extends string = string>(value?: T, options?: LocaleOptions): LowerFirst<T> => {
    if (typeof value !== "string") {
        return "" as LowerFirst<T>;
    }

    const firstChar = options?.locale ? value.charAt<T>(0).toLocaleLowerCase(options.locale) : value.charAt<T>(0).toLowerCase();

    // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
    return (firstChar + value.slice(1)) as LowerFirst<T>;
};
