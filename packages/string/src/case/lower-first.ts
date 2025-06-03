import type { LocaleOptions, LowerFirst } from "./types";

/**
 * Converts first character to lower case.
 * @param value The string to convert.
 * @param options Options for case conversion.
 * @returns The string with its first character converted to lowercase.
 * @example
 * ```typescript
 * lowerFirst("Hello world!") // => "hello world!"
 * lowerFirst("İSTANBUL", { locale: "tr" }) // => "istanbul"
 * ```
 */
const lowerFirst = <T extends string = string>(value?: T, options?: LocaleOptions): LowerFirst<T> => {
    if (typeof value !== "string" || value === "") {
        return "" as LowerFirst<T>;
    }

    const firstChar = options?.locale ? (value[0] as string).toLocaleLowerCase(options.locale) : (value[0] as string).toLowerCase();

    return (firstChar + value.slice(1)) as LowerFirst<T>;
};

export default lowerFirst;
