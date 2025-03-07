/**
 * Returns a tuple of the given length with the given type.
 */
type TupleOf<L extends number, T = unknown, result extends any[] = []> = result["length"] extends L ? result : TupleOf<L, T, [...result, T]>;

/** Slice with startIndex and endIndex */
type InternalSlice<T extends string, startIndex extends number, endIndex extends number, _result extends string = ""> =
    IsNumberLiteral<endIndex | startIndex> extends true
        ? T extends `${infer head}${infer rest}`
            ? IsStringLiteral<head> extends true
                ? startIndex extends 0
                    ? endIndex extends 0
                        ? _result
                        : InternalSlice<rest, 0, Math.Subtract<Math.GetPositiveIndex<T, endIndex>, 1>, `${_result}${head}`>
                    : InternalSlice<rest, Math.Subtract<Math.GetPositiveIndex<T, startIndex>, 1>, Math.Subtract<Math.GetPositiveIndex<T, endIndex>, 1>, _result>
                : endIndex | startIndex extends 0
                  ? _result
                  : string // Head is non-literal
            : IsStringLiteral<T> extends true // Couldn't be split into head/tail
              ? _result // T ran out
              : endIndex | startIndex extends 0
                ? _result // Eg: Slice<`abc${string}`, 1, 3> -> 'bc'
                : string // Head is non-literal
        : string;

/** Slice with startIndex only */
type SliceStart<T extends string, startIndex extends number, _result extends string = ""> =
    IsNumberLiteral<startIndex> extends true
        ? T extends `${infer head}${infer rest}`
            ? IsStringLiteral<head> extends true
                ? startIndex extends 0
                    ? T
                    : SliceStart<rest, Math.Subtract<Math.GetPositiveIndex<T, startIndex>, 1>, _result>
                : string
            : IsStringLiteral<T> extends true
              ? _result
              : startIndex extends 0
                ? _result
                : string
        : string;

type _EndsWith<T extends string, S extends string, P extends number> =
    All<[IsStringLiteral<S>, IsNumberLiteral<P>]> extends true
        ? Math.IsNegative<P> extends false
            ? P extends Length<T>
                ? IsStringLiteral<T> extends true
                    ? S extends Slice<T, Math.Subtract<Length<T>, Length<S>>, Length<T>>
                        ? true
                        : false
                    : _EndsWithNoPosition<Slice<T, 0, P>, S> // Eg: EndsWith<`abc${string}xyz`, 'c', 3>
                : _EndsWithNoPosition<Slice<T, 0, P>, S> // P !== T.length, slice
            : false // P is negative, false
        : boolean;

/** Overload of EndsWith without P */
type _EndsWithNoPosition<T extends string, S extends string> = StartsWith<Reverse<T>, Reverse<S>>;

namespace Math {
    export type Subtract<A extends number, B extends number> = number extends A | B ? number : TupleOf<A> extends [...infer U, ...TupleOf<B>] ? U["length"] : 0;

    export type IsNegative<T extends number> = number extends T ? boolean : `${T}` extends `-${number}` ? true : false;

    export type Abs<T extends number> = `${T}` extends `-${infer U extends number}` ? U : T;

    export type GetPositiveIndex<T extends string, I extends number> = IsNegative<I> extends false ? I : Subtract<Length<T>, Abs<I>>;
}

export type { Math };

/**
 * Returns true if input number type is a literal
 */
export type IsNumberLiteral<T extends number> = [T] extends [number] ? ([number] extends [T] ? false : true) : false;

export type IsBooleanLiteral<T extends boolean> = [T] extends [boolean] ? ([boolean] extends [T] ? false : true) : false;

/**
 * Reverses a string.
 * - `T` The string to reverse.
 */
export type Reverse<T extends string, _accumulator extends string = ""> = T extends `${infer Head}${infer Tail}`
    ? Reverse<Tail, `${Head}${_accumulator}`>
    : _accumulator extends ""
      ? T
      : `${T}${_accumulator}`;

/**
 * Returns true if any elements in boolean array are the literal true (not false or boolean)
 */
export type Any<Array_ extends boolean[]> = Array_ extends [infer Head extends boolean, ...infer Rest extends boolean[]]
    ? IsBooleanLiteral<Head> extends true
        ? Head extends true
            ? true
            : Any<Rest>
        : Any<Rest>
    : false;

/**
 * Returns true if every element in boolean array is the literal true (not false or boolean)
 */
export type All<Array_ extends boolean[]> =
    IsBooleanLiteral<Array_[number]> extends true
        ? Array_ extends [infer Head extends boolean, ...infer Rest extends boolean[]]
            ? Head extends true
                ? Any<Rest>
                : false // Found `false` in array
            : true // Empty array (or all elements have already passed test)
        : false; // Array/Tuple contains `boolean` type

/**
 * Returns true if string input type is a literal
 */
export type IsStringLiteral<T extends string> = [T] extends [string]
    ? [string] extends [T]
        ? false
        : Uppercase<T> extends Uppercase<Lowercase<T>>
          ? Lowercase<T> extends Lowercase<Uppercase<T>>
              ? true
              : false
          : false
    : false;

export type IsStringLiteralArray<Array_ extends ReadonlyArray<string> | string[]> = IsStringLiteral<Array_[number]> extends true ? true : false;

/**
 * Gets the character at the given index.
 * T: The string to get the character from.
 * index: The index of the character.
 */
export type CharAt<T extends string, index extends number> = All<[IsStringLiteral<T>, IsNumberLiteral<index>]> extends true ? Split<T>[index] : string;

/**
 * Concatenates a tuple of strings.
 * T: The tuple of strings to concatenate.
 */
export type Concat<T extends string[]> = Join<T>;

/**
 * Checks if a string ends with another string.
 * T: The string to check.
 * S: The string to check against.
 * P: The position the search should end.
 */
export type EndsWith<T extends string, S extends string, P extends number | undefined = undefined> = P extends number
    ? _EndsWith<T, S, P>
    : _EndsWithNoPosition<T, S>;

/**
 * Checks if a string includes another string.
 * T: The string to check.
 * S: The string to check against.
 * P: The position to start the search.
 */
export type Includes<T extends string, S extends string, P extends number = 0> = string extends S | T
    ? boolean
    : Math.IsNegative<P> extends false
      ? P extends 0
          ? T extends `${string}${S}${string}`
              ? true
              : false
          : Includes<Slice<T, P>, S> // P is >0, slice
      : Includes<T, S>; // P is negative, ignore it

/**
 * Joins a tuple of strings with the given delimiter.
 * T: The tuple of strings to join.
 * delimiter: The delimiter.
 */
export type Join<T extends ReadonlyArray<string>, delimiter extends string = ""> =
    All<[IsStringLiteralArray<T>, IsStringLiteral<delimiter>]> extends true
        ? T extends readonly [infer first extends string, ...infer rest extends string[]]
            ? rest extends []
                ? first
                : `${first}${delimiter}${Join<rest, delimiter>}`
            : ""
        : string;

/**
 * Gets the length of a string.
 */
export type Length<T extends string> = IsStringLiteral<T> extends true ? Split<T>["length"] : number;

/**
 * Pads a string at the end with another string.
 * T: The string to pad.
 * times: The number of times to pad.
 * pad: The string to pad with.
 */
export type PadEnd<T extends string, times extends number = 0, pad extends string = " "> =
    All<[IsStringLiteral<pad | T>, IsNumberLiteral<times>]> extends true
        ? Math.IsNegative<times> extends false
            ? Math.Subtract<times, Length<T>> extends infer missing extends number
                ? `${T}${Slice<Repeat<pad, missing>, 0, missing>}`
                : never
            : T
        : string;

/**
 * Pads a string at the start with another string.
 * T: The string to pad.
 * times: The number of times to pad.
 * pad: The string to pad with.
 */
export type PadStart<T extends string, times extends number = 0, pad extends string = " "> =
    All<[IsStringLiteral<pad | T>, IsNumberLiteral<times>]> extends true
        ? Math.IsNegative<times> extends false
            ? Math.Subtract<times, Length<T>> extends infer missing extends number
                ? `${Slice<Repeat<pad, missing>, 0, missing>}${T}`
                : never
            : T
        : string;

/**
 * Repeats a string N times.
 * T: The string to repeat.
 * N: The number of times to repeat.
 */
export type Repeat<T extends string, times extends number = 0> =
    All<[IsStringLiteral<T>, IsNumberLiteral<times>]> extends true
        ? times extends 0
            ? ""
            : Math.IsNegative<times> extends false
              ? Join<TupleOf<times, T>>
              : never
        : string;

/**
 * Replaces all the occurrences of a string with another string.
 * sentence: The sentence to replace.
 * lookup: The lookup string to be replaced.
 * replacement: The replacement string.
 */
export type ReplaceAll<sentence extends string, lookup extends RegExp | string, replacement extends string = ""> = lookup extends string
    ? IsStringLiteral<lookup | replacement | sentence> extends true
        ? sentence extends `${infer rest}${lookup}${infer rest2}`
            ? `${rest}${replacement}${ReplaceAll<rest2, lookup, replacement>}`
            : sentence
        : string
    : string; // Regex used, can't preserve literal

/**
 * Replaces the first occurrence of a string with another string.
 * sentence: The sentence to replace.
 * lookup: The lookup string to be replaced.
 * replacement: The replacement string.
 */
export type Replace<sentence extends string, lookup extends RegExp | string, replacement extends string = ""> = lookup extends string
    ? IsStringLiteral<lookup | replacement | sentence> extends true
        ? sentence extends `${infer rest}${lookup}${infer rest2}`
            ? `${rest}${replacement}${rest2}`
            : sentence
        : string
    : string; // Regex used, can't preserve literal

/**
 * Slices a string from a startIndex to an endIndex.
 * T: The string to slice.
 * startIndex: The start index.
 * endIndex: The end index.
 */
export type Slice<T extends string, startIndex extends number = 0, endIndex extends number | undefined = undefined> = endIndex extends number
    ? InternalSlice<T, startIndex, endIndex>
    : SliceStart<T, startIndex>;

/**
 * Splits a string into an array of substrings.
 * T: The string to split.
 * delimiter: The delimiter.
 */
export type Split<T extends string, delimiter extends string = ""> =
    IsStringLiteral<delimiter | T> extends true
        ? T extends `${infer first}${delimiter}${infer rest}`
            ? [first, ...Split<rest, delimiter>]
            : T extends ""
              ? []
              : [T]
        : string[];

/**
 * Checks if a string starts with another string.
 * T: The string to check.
 * S: The string to check against.
 * P: The position to start the search.
 */
export type StartsWith<T extends string, S extends string, P extends number = 0> =
    All<[IsStringLiteral<S>, IsNumberLiteral<P>]> extends true
        ? Math.IsNegative<P> extends false
            ? P extends 0
                ? S extends `${infer SHead}${infer SRest}`
                    ? T extends `${infer THead}${infer TRest}`
                        ? IsStringLiteral<SHead | THead> extends true
                            ? THead extends SHead
                                ? StartsWith<TRest, SRest>
                                : false // Heads weren't equal
                            : boolean // THead is non-literal
                        : IsStringLiteral<T> extends true // Couldn't split T
                          ? false // T ran out, but we still have S
                          : boolean // T (or TRest) is not a literal
                    : true // Couldn't split S, we've already ruled out non-literal
                : StartsWith<Slice<T, P>, S> // P is >0, slice
            : StartsWith<T, S> // P is negative, ignore it
        : boolean;

/**
 * Trims all whitespaces at the end of a string.
 * T: The string to trim.
 */
export type TrimEnd<T extends string> = T extends `${infer rest} ` ? TrimEnd<rest> : T;

/**
 * Trims all whitespaces at the start of a string.
 * T: The string to trim.
 */
export type TrimStart<T extends string> = T extends ` ${infer rest}` ? TrimStart<rest> : T;

/**
 * Trims all whitespaces at the start and end of a string.
 * T: The string to trim.
 */
export type Trim<T extends string> = TrimEnd<TrimStart<T>>;

export type NodeLocale =
    | "af" // Afrikaans
    | "am" // Amharic
    | "ar" // Arabic
    | "az" // Azerbaijani
    | "be" // Belarusian
    | "bg" // Bulgarian
    | "bn" // Bengali
    | "bs" // Bosnian
    | "ca" // Catalan
    | "cs" // Czech
    | "cy" // Welsh
    | "da" // Danish
    | "de" // German
    | "el" // Greek
    | "en" // English
    | "en-AU" // English (Australia)
    | "en-CA" // English (Canada)
    | "en-GB" // English (United Kingdom)
    | "en-US" // English (United States)
    | "es" // Spanish
    | "es-ES" // Spanish (Spain)
    | "et" // Estonian
    | "fa" // Persian
    | "fi" // Finnish
    | "fil" // Filipino
    | "fr" // French
    | "ga" // Irish
    | "gl" // Galician
    | "gu" // Gujarati
    | "he" // Hebrew
    | "hi" // Hindi
    | "hr" // Croatian
    | "hu" // Hungarian
    | "hy" // Armenian
    | "id" // Indonesian
    | "is" // Icelandic
    | "it" // Italian
    | "ja" // Japanese
    | "ka" // Georgian
    | "kk" // Kazakh
    | "km" // Khmer
    | "kn" // Kannada
    | "ko" // Korean
    | "ky" // Kyrgyz
    | "lo" // Lao
    | "lt" // Lithuanian
    | "lv" // Latvian
    | "mk" // Macedonian
    | "ml" // Malayalam
    | "mn" // Mongolian
    | "mr" // Marathi
    | "ms" // Malay
    | "mt" // Maltese
    | "ne" // Nepali
    | "nl" // Dutch
    | "no" // Norwegian
    | "pa" // Punjabi
    | "pl" // Polish
    | "pt" // Portuguese
    | "pt-BR" // Portuguese (Brazil)
    | "pt-PT" // Portuguese (Portugal)
    | "ro" // Romanian
    | "ru" // Russian
    | "si" // Sinhala
    | "sk" // Slovak
    | "sl" // Slovenian
    | "sq" // Albanian
    | "sr" // Serbian
    | "sv" // Swedish
    | "ta" // Tamil
    | "te" // Telugu
    | "th" // Thai
    | "tr" // Turkish
    | "uk" // Ukrainian
    | "ur" // Urdu
    | "uz" // Uzbek
    | "vi" // Vietnamese
    | "zh" // Chinese
    | "zh-CN" // Chinese (Simplified)
    | "zh-HK" // Chinese (Hong Kong)
    | "zh-TW"; // Chinese (Traditional)

/**
 * Converts all alphabetic characters in a string to lowercase.
 * T: The string to convert.
 */
export type ToLowerCase<T extends string> = IsStringLiteral<T> extends true ? Lowercase<T> : string;

/**
 * Converts all alphabetic characters in a string to uppercase.
 * T: The string to convert.
 */
export type ToUpperCase<T extends string> = IsStringLiteral<T> extends true ? Uppercase<T> : string;

export interface StringWidthOptions {
    /**
     * Whether ambiguous characters should be treated as narrow
     * @default false
     */
    ambiguousIsNarrow?: boolean;

    /**
     * Width of ambiguous-width characters
     * @default 1
     */
    ambiguousWidth?: number;

    /**
     * Whether to count ANSI escape codes in width calculation
     * @default false
     */
    countAnsiEscapeCodes?: boolean;

    /**
     * Width of ANSI escape sequences
     * @default 0
     */
    ansiWidth?: number;

    /**
     * Width of control characters
     * @default 0
     */
    controlWidth?: number;

    /**
     * String to append when truncation occurs
     * @default ''
     */
    ellipsis?: string;

    /**
     * Width of the ellipsis string
     * If not provided, it will be calculated using getStringTruncatedWidth
     */
    ellipsisWidth?: number;

    /**
     * Width of emoji characters
     * @default 2
     */
    emojiWidth?: number;

    /**
     * Width of full-width characters
     * @default 2
     */
    fullWidthWidth?: number;

    /**
     * Maximum width limit for the string
     * @default Infinity
     */
    limit?: number;

    /**
     * Width of regular characters
     * @default 1
     */
    regularWidth?: number;

    /**
     * Width of tab characters
     * @default 8
     */
    tabWidth?: number;

    /**
     * Width of wide characters
     * @default 2
     */
    wideWidth?: number;
}

export interface StringWidthResult {
    /**
     * Whether an ellipsis was added
     */
    ellipsed: boolean;

    /**
     * The index at which truncation occurred (if any)
     */
    index: number;

    /**
     * Whether the string was truncated
     */
    truncated: boolean;

    /**
     * The calculated width of the string
     */
    width: number;

    /**
     * The truncated content
     */
    content: string;

    /**
     * The truncated content with ANSI sequences stripped
     */
    strippedContent: string;
}
