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
export const flipCase = <T extends string = string>(value?: T, options?: CaseOptions): string => {
    if (typeof value !== "string" || !value) {
        return "";
    }

    return value
        .split("")
        .map((char) => {
            const lowerChar = options?.locale ? char.toLocaleLowerCase(options.locale) : char.toLowerCase();
            return char === lowerChar ? (options?.locale ? char.toLocaleUpperCase(options.locale) : char.toUpperCase()) : lowerChar;
        })
        .join("");
};
