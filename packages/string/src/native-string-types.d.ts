import type {
    CharAt,
    Concat,
    EndsWith,
    Includes,
    Length,
    PadEnd,
    PadStart,
    Replace,
    ReplaceAll,
    Slice,
    Split,
    StartsWith,
    ToLowerCase,
    ToUpperCase,
    Trim,
    TrimEnd,
    TrimStart,
} from "./types";

export {};

declare global {
    interface String {
        /**
         * Returns the character at the specified index.
         * @param index The zero-based index of the desired character.
         */
        charAt<T extends string = string, I extends number = number>(this: T, index: I): CharAt<T, I>;

        /**
         * Returns a string that contains the concatenation of two or more strings.
         * @param strings The strings to append to the end of the string.
         */
        concat<T extends string = string, S extends string[] | string = string>(
            this: T,
            ...strings: S extends string ? [S] : S extends string[] ? S : never
        ): S extends string ? Concat<[T, S]> : S extends string[] ? Concat<[T, ...S]> : never;

        /**
         * Returns true if the sequence of elements of searchString converted to a String is the
         * same as the corresponding elements of this object (converted to a String) starting at
         * position. Otherwise returns false.
         */
        endsWith<T extends string = string, S extends string = string, P extends number | undefined = undefined>(
            this: T,
            searchString: S,
            position?: P,
        ): EndsWith<T, S, P>;

        /**
         * Returns true if searchString appears as a substring of the result of converting this
         * object to a String, at one or more positions that are greater than or equal to
         * position; otherwise, returns false.
         * @param searchString search string
         * @param position If position is undefined, 0 is assumed, so as to search all of the String.
         */
        includes<T extends string = string, S extends string = string, P extends number = 0>(this: T, searchString: S, position?: P): Includes<T, S, P>;

        /**
         * Returns the length of a String object.
         */
        length: Length<this>;

        /**
         * Pads the current string with a given string (possibly repeated) so that the resulting string reaches a given length.
         * The padding is applied from the end (right) of the current string.
         * @param maxLength The length of the resulting string once the current string has been padded.
         * @param fillString The string to pad the current string with. If this string is too long, it will be truncated and the left-most part will be applied.
         */
        padEnd<T extends string = string, N extends number = number, P extends string = " ">(this: T, maxLength: N, fillString?: P): PadEnd<T, N, P>;

        /**
         * Pads the current string with a given string (possibly repeated) so that the resulting string reaches a given length.
         * The padding is applied from the start (left) of the current string.
         * @param maxLength The length of the resulting string once the current string has been padded.
         * @param fillString The string to pad the current string with. If this string is too long, it will be truncated and the left-most part will be applied.
         */
        padStart<T extends string = string, N extends number = number, P extends string = " ">(this: T, maxLength: N, fillString?: P): PadStart<T, N, P>;

        /**
         * Replace text in a string, using a regular expression or search string.
         * @param searchValue A string to search for.
         * @param replaceValue A string containing the text to replace for every successful match of searchValue in this string.
         */
        replace<T extends string = string, S extends RegExp | string = string, R extends string = string>(
            this: T,
            searchValue: S,
            replaceValue: R,
        ): Replace<T, S, R>;

        /**
         * Replace all instances of a substring in a string, using a regular expression or search string.
         * @param searchValue A string to search for.
         * @param replaceValue A string containing the text to replace for every successful match of searchValue in this string.
         */
        replaceAll<T extends string = string, S extends RegExp | string = string, R extends string = string>(
            this: T,
            searchValue: S,
            replaceValue: R,
        ): ReplaceAll<T, S, R>;

        /**
         * Returns a section of a string.
         * @param start The index to the beginning of the specified portion of stringObj.
         * @param end The index to the end of the specified portion of stringObj. The substring includes the characters up to, but not including, the character indicated by end.
         */
        slice<T extends string = string, S extends number = number, E extends number | undefined = undefined>(this: T, start?: S, end?: E): Slice<T, S, E>;

        /**
         * Split a string into substrings using the specified separator and return them as an array.
         * @param separator A string that identifies character or characters to use in separating the string. If omitted, a single-element array containing the entire string is returned.
         */
        split<T extends string = string, S extends string = string>(this: T, separator: S): Split<T, S>;

        /**
         * Returns true if the sequence of elements of searchString converted to a String is the
         * same as the corresponding elements of this object (converted to a String) starting at
         * position. Otherwise returns false.
         */
        startsWith<T extends string = string, S extends string = string, P extends number = 0>(this: T, searchString: S, position?: P): StartsWith<T, S, P>;

        /**
         * Converts all alphabetic characters in a string to lowercase.
         */
        toLowerCase<T extends string = string>(this: T): ToLowerCase<T>;

        /**
         * Converts all alphabetic characters in a string to uppercase.
         */
        toUpperCase<T extends string = string>(this: T): ToUpperCase<T>;

        /**
         * Returns a string with all whitespace removed from both ends of a string.
         */
        trim<T extends string = string>(this: T): Trim<T>;

        /**
         * Returns a string with all whitespace removed from the end of a string.
         */
        trimEnd<T extends string = string>(this: T): TrimEnd<T>;

        /**
         * Returns a string with all whitespace removed from the start of a string.
         */
        trimStart<T extends string = string>(this: T): TrimStart<T>;
    }
}
