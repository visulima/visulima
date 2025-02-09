import type { CaseOptions } from "./types";

/**
 * Flips the case of each character in a string.
 * @example
 * ```typescript
 * flipCase("FooBar") // => "fOObAR"
 * flipCase("foobar") // => "FOOBAR"
 * flipCase("FOOBAR") // => "foobar"
 * flipCase("XMLHttpRequest") // => "xmlhTTPrEQUEST"
 * ```
 */
export const flipCase = (value: string, options: CaseOptions = {}): string => {
    const { locale } = options;

    if (typeof value !== "string") {
        return "";
    }

    return value
        .split("")
        .map((char) => {
            const lowerChar = locale ? char.toLocaleLowerCase(locale) : char.toLowerCase();
            return char === lowerChar ? (locale ? char.toLocaleUpperCase(locale) : char.toUpperCase()) : lowerChar;
        })
        .join("");
};
