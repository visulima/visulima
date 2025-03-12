/**
 * Returns a tuple of the given length with the given type.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TupleOf<L extends number, T = unknown, Result extends any[] = []> = Result["length"] extends L ? Result : TupleOf<L, T, [...Result, T]>;

/** Slice with StartIndex and EndIndex */
type InternalSliceType<T extends string, StartIndex extends number, EndIndex extends number, Result extends string = ""> =
    IsNumberLiteral<EndIndex | StartIndex> extends true
        ? T extends `${infer Head}${infer Rest}`
            ? IsStringLiteral<Head> extends true
                ? StartIndex extends 0
                    ? EndIndex extends 0
                        ? Result
                        : InternalSliceType<Rest, 0, Math.Subtract<Math.GetPositiveIndex<T, EndIndex>, 1>, `${Result}${Head}`>
                    : InternalSliceType<
                          Rest,
                          Math.Subtract<Math.GetPositiveIndex<T, StartIndex>, 1>,
                          Math.Subtract<Math.GetPositiveIndex<T, EndIndex>, 1>,
                          Result
                      >
                : EndIndex | StartIndex extends 0
                  ? Result
                  : string // Head is non-literal
            : IsStringLiteral<T> extends true // Couldn't be split into head/tail
              ? Result // T ran out
              : EndIndex | StartIndex extends 0
                ? Result // Eg: Slice<`abc${string}`, 1, 3> -> 'bc'
                : string // Head is non-literal
        : string;

/** Slice with StartIndex only */
type SliceStartType<T extends string, StartIndex extends number, Result extends string = ""> =
    IsNumberLiteral<StartIndex> extends true
        ? T extends `${infer Head}${infer Rest}`
            ? IsStringLiteral<Head> extends true
                ? StartIndex extends 0
                    ? T
                    : SliceStartType<Rest, Math.Subtract<Math.GetPositiveIndex<T, StartIndex>, 1>, Result>
                : string
            : IsStringLiteral<T> extends true
              ? Result
              : StartIndex extends 0
                ? Result
                : string
        : string;

type InternalEndsWithType<T extends string, S extends string, P extends number> =
    All<[IsStringLiteral<S>, IsNumberLiteral<P>]> extends true
        ? Math.IsNegative<P> extends false
            ? P extends Length<T>
                ? IsStringLiteral<T> extends true
                    ? S extends Slice<T, Math.Subtract<Length<T>, Length<S>>, Length<T>>
                        ? true
                        : false
                    : EndsWithNoPositionType<Slice<T, 0, P>, S> // Eg: EndsWith<`abc${string}xyz`, 'c', 3>
                : EndsWithNoPositionType<Slice<T, 0, P>, S> // P !== T.length, slice
            : false // P is negative, false
        : boolean;

/** Overload of EndsWith without P */
type EndsWithNoPositionType<T extends string, S extends string> = StartsWith<Reverse<T>, Reverse<S>>;

// eslint-disable-next-line @typescript-eslint/no-namespace
namespace Math {
    // eslint-disable-next-line import/no-unused-modules
    export type Subtract<A extends number, B extends number> = number extends A | B ? number : TupleOf<A> extends [...infer U, ...TupleOf<B>] ? U["length"] : 0;

    // eslint-disable-next-line import/no-unused-modules
    export type IsNegative<T extends number> = number extends T ? boolean : `${T}` extends `-${number}` ? true : false;

    // eslint-disable-next-line import/no-unused-modules
    export type Abs<T extends number> = `${T}` extends `-${infer U extends number}` ? U : T;

    // eslint-disable-next-line import/no-unused-modules
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
export type Reverse<T extends string, Accumulator extends string = ""> = T extends `${infer Head}${infer Tail}`
    ? Reverse<Tail, `${Head}${Accumulator}`>
    : Accumulator extends ""
      ? T
      : `${T}${Accumulator}`;

/**
 * Returns true if any elements in boolean array are the literal true (not false or boolean)
 */

export type Any<BoolArray extends boolean[]> = BoolArray extends [infer Head extends boolean, ...infer Rest extends boolean[]]
    ? IsBooleanLiteral<Head> extends true
        ? Head extends true
            ? true
            : Any<Rest>
        : Any<Rest>
    : false;

/**
 * Returns true if every element in boolean array is the literal true (not false or boolean)
 */

export type All<BoolArray extends boolean[]> =
    IsBooleanLiteral<BoolArray[number]> extends true
        ? BoolArray extends [infer Head extends boolean, ...infer Rest extends boolean[]]
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

export type IsStringLiteralArray<StringArray extends ReadonlyArray<string>> = IsStringLiteral<StringArray[number]> extends true ? true : false;

/**
 * Gets the character at the given index.
 * T: The string to get the character from.
 * index: The index of the character.
 */
export type CharAt<T extends string, Index extends number> = All<[IsStringLiteral<T>, IsNumberLiteral<Index>]> extends true ? Split<T>[Index] : string;

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
    ? InternalEndsWithType<T, S, P>
    : EndsWithNoPositionType<T, S>;

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
export type Join<T extends ReadonlyArray<string>, Delimiter extends string = ""> =
    All<[IsStringLiteralArray<T>, IsStringLiteral<Delimiter>]> extends true
        ? T extends readonly [infer First extends string, ...infer Rest extends string[]]
            ? Rest extends []
                ? First
                : `${First}${Delimiter}${Join<Rest, Delimiter>}`
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
export type PadEnd<T extends string, Times extends number = 0, Pad extends string = " "> =
    All<[IsStringLiteral<Pad | T>, IsNumberLiteral<Times>]> extends true
        ? Math.IsNegative<Times> extends false
            ? Math.Subtract<Times, Length<T>> extends infer Missing extends number
                ? `${T}${Slice<Repeat<Pad, Missing>, 0, Missing>}`
                : never
            : T
        : string;

/**
 * Pads a string at the start with another string.
 * T: The string to pad.
 * times: The number of times to pad.
 * pad: The string to pad with.
 */
export type PadStart<T extends string, Times extends number = 0, Pad extends string = " "> =
    All<[IsStringLiteral<Pad | T>, IsNumberLiteral<Times>]> extends true
        ? Math.IsNegative<Times> extends false
            ? Math.Subtract<Times, Length<T>> extends infer Missing extends number
                ? `${Slice<Repeat<Pad, Missing>, 0, Missing>}${T}`
                : never
            : T
        : string;

/**
 * Repeats a string N times.
 * T: The string to repeat.
 * N: The number of times to repeat.
 */
export type Repeat<T extends string, Times extends number = 0> =
    All<[IsStringLiteral<T>, IsNumberLiteral<Times>]> extends true
        ? Times extends 0
            ? ""
            : Math.IsNegative<Times> extends false
              ? Join<TupleOf<Times, T>>
              : never
        : string;

/**
 * Replaces all the occurrences of a string with another string.
 * sentence: The sentence to replace.
 * lookup: The lookup string to be replaced.
 * replacement: The replacement string.
 */
export type ReplaceAll<Sentence extends string, Lookup extends RegExp | string, Replacement extends string = ""> = Lookup extends string
    ? IsStringLiteral<Lookup | Replacement | Sentence> extends true
        ? Sentence extends `${infer Rest}${Lookup}${infer Rest2}`
            ? `${Rest}${Replacement}${ReplaceAll<Rest2, Lookup, Replacement>}`
            : Sentence
        : string
    : string; // Regex used, can't preserve literal

/**
 * Replaces the first occurrence of a string with another string.
 * sentence: The sentence to replace.
 * lookup: The lookup string to be replaced.
 * replacement: The replacement string.
 */
export type Replace<Sentence extends string, Lookup extends RegExp | string, Replacement extends string = ""> = Lookup extends string
    ? IsStringLiteral<Lookup | Replacement | Sentence> extends true
        ? Sentence extends `${infer Rest}${Lookup}${infer Rest2}`
            ? `${Rest}${Replacement}${Rest2}`
            : Sentence
        : string
    : string; // Regex used, can't preserve literal

/**
 * Slices a string from a StartIndex to an EndIndex.
 * T: The string to slice.
 * StartIndex: The start index.
 * EndIndex: The end index.
 */
export type Slice<T extends string, StartIndex extends number = 0, EndIndex extends number | undefined = undefined> = EndIndex extends number
    ? InternalSliceType<T, StartIndex, EndIndex>
    : SliceStartType<T, StartIndex>;

/**
 * Splits a string into an array of substrings.
 * T: The string to split.
 * delimiter: The delimiter.
 */
export type Split<T extends string, Delimiter extends string = ""> =
    IsStringLiteral<Delimiter | T> extends true
        ? T extends `${infer First}${Delimiter}${infer Rest}`
            ? [First, ...Split<Rest, Delimiter>]
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
export type TrimEnd<T extends string> = T extends `${infer Rest} ` ? TrimEnd<Rest> : T;

/**
 * Trims all whitespaces at the start of a string.
 * T: The string to trim.
 */
export type TrimStart<T extends string> = T extends ` ${infer Rest}` ? TrimStart<Rest> : T;

/**
 * Trims all whitespaces at the start and end of a string.
 * T: The string to trim.
 */
export type Trim<T extends string> = TrimEnd<TrimStart<T>>;

export type NodeLocale =
    // eslint-disable-next-line @typescript-eslint/sort-type-constituents
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
