/**
 * Creates a tuple type of specified length filled with a given type.
 * @template L - The desired length of the tuple
 * @template T - The type to fill the tuple with (defaults to unknown)
 * @template Result - Internal accumulator for recursive type building
 * @returns A tuple type of length L filled with type T
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TupleOf<L extends number, T = unknown, Result extends any[] = []> = Result["length"] extends L ? Result : TupleOf<L, T, [...Result, T]>;

/**
 * Internal type for implementing string slicing with both start and end indices.
 * Handles edge cases and type safety for string literal types.
 * @template T - The input string type
 * @template StartIndex - The starting index for the slice
 * @template EndIndex - The ending index for the slice
 * @template Result - Internal accumulator for building the result string
 */
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

/**
 * Internal type for implementing string slicing with only a start index.
 * Provides type-safe string slicing functionality for string literal types.
 * @template T - The input string type
 * @template StartIndex - The starting index for the slice
 * @template Result - Internal accumulator for building the result string
 */
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

/**
 * Internal type for implementing EndsWith functionality without a position parameter.
 * Uses string reversal to check if a string ends with another string.
 * @template T - The string to check
 * @template S - The suffix to check for
 */
type EndsWithNoPositionType<T extends string, S extends string> = StartsWith<Reverse<T>, Reverse<S>>;

/**
 * Namespace containing type-level mathematical operations.
 * These utilities provide type-safe arithmetic and number manipulation.
 */
// eslint-disable-next-line @typescript-eslint/no-namespace
namespace Math {
    /**
     * Type-level subtraction operation.
     * @template A - The minuend (number to subtract from)
     * @template B - The subtrahend (number to subtract)
     * @returns The difference as a number type
     */
    // eslint-disable-next-line import/no-unused-modules
    export type Subtract<A extends number, B extends number> = number extends A | B ? number : TupleOf<A> extends [...infer U, ...TupleOf<B>] ? U["length"] : 0;

    /**
     * Type predicate that checks if a number is negative.
     * @template T - The number type to check
     * @returns true if T is negative, false otherwise
     */
    // eslint-disable-next-line import/no-unused-modules
    export type IsNegative<T extends number> = number extends T ? boolean : `${T}` extends `-${number}` ? true : false;

    /**
     * Type-level absolute value operation.
     * @template T - The number type to get the absolute value of
     * @returns The absolute value as a number type
     */
    // eslint-disable-next-line import/no-unused-modules
    export type Abs<T extends number> = `${T}` extends `-${infer U extends number}` ? U : T;

    /**
     * Converts a potentially negative index to a positive index for a string.
     * @template T - The string type to reference
     * @template I - The index to convert
     * @returns A positive index as a number type
     */
    // eslint-disable-next-line import/no-unused-modules
    export type GetPositiveIndex<T extends string, I extends number> = IsNegative<I> extends false ? I : Subtract<Length<T>, Abs<I>>;
}

export type { Math };

/**
 * Type predicate that determines if a number type is a literal type rather than the general 'number' type.
 * For example: IsNumberLiteral<42> is true, but IsNumberLiteral<number> is false.
 * @template T - The number type to check
 * @returns true if T is a number literal type, false otherwise
 */

export type IsNumberLiteral<T extends number> = [T] extends [number] ? ([number] extends [T] ? false : true) : false;

export type IsBooleanLiteral<T extends boolean> = [T] extends [boolean] ? ([boolean] extends [T] ? false : true) : false;

/**
 * Type-level string reversal utility.
 * Recursively builds the reversed string using template literal types.
 * @template T - The string type to reverse
 * @template Accumulator - Internal accumulator for building the reversed string
 * @returns A type representing the reversed string
 * @example
 * type ReversedHello = Reverse<'hello'> // type ReversedHello = 'olleh'
 */
export type Reverse<T extends string, Accumulator extends string = ""> = T extends `${infer Head}${infer Tail}`
    ? Reverse<Tail, `${Head}${Accumulator}`>
    : Accumulator extends ""
      ? T
      : `${T}${Accumulator}`;

/**
 * Type predicate that checks if any element in a boolean array type is the literal 'true'.
 * Distinguishes between literal true/false and the general boolean type.
 * @template T - Array of boolean types to check
 * @returns true if any element is the literal true, false otherwise
 * @example
 * type HasTrue = Any<[true, false, boolean]> // type HasTrue = true
 */

export type Any<BoolArray extends boolean[]> = BoolArray extends [infer Head extends boolean, ...infer Rest extends boolean[]]
    ? IsBooleanLiteral<Head> extends true
        ? Head extends true
            ? true
            : Any<Rest>
        : Any<Rest>
    : false;

/**
 * Type predicate that checks if all elements in a boolean array type are the literal 'true'.
 * Distinguishes between literal true/false and the general boolean type.
 * @template T - Array of boolean types to check
 * @returns true if all elements are the literal true, false otherwise
 * @example
 * type AllTrue = All<[true, true]> // type AllTrue = true
 * type NotAllTrue = All<[true, false]> // type NotAllTrue = false
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
 * Type predicate that determines if a string type is a literal type rather than the general 'string' type.
 * @template T - The string type to check
 * @returns true if T is a string literal type, false if it's the general string type
 * @example
 * type IsLiteral = IsStringLiteral<'hello'> // type IsLiteral = true
 * type NotLiteral = IsStringLiteral<string> // type NotLiteral = false
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
 * Type-safe utility to get the character at a specific index in a string literal type.
 * @template T - The string type to extract a character from
 * @template index - The numeric index of the desired character
 * @returns The character type at the specified index, or never if the index is invalid
 * @example
 * type FirstChar = CharAt<'hello', 0> // type FirstChar = 'h'
 */
export type CharAt<T extends string, Index extends number> = All<[IsStringLiteral<T>, IsNumberLiteral<Index>]> extends true ? Split<T>[Index] : string;

/**
 * Type-level string concatenation for tuples of string literals.
 * Joins all strings in the tuple into a single string type.
 * @template T - Tuple of string types to concatenate
 * @returns A single string type representing the concatenated result
 * @example
 * type Combined = Concat<['hello', ' ', 'world']> // type Combined = 'hello world'
 */
export type Concat<T extends string[]> = Join<T>;

/**
 * Type-level implementation of string.endsWith() functionality.
 * Checks if a string type ends with another string type at a given position.
 * @template T - The string type to check
 * @template S - The suffix to check for
 * @template P - Optional position at which to end the search
 * @returns A boolean type indicating if T ends with S at position P
 * @example
 * type EndsWithWorld = EndsWith<'hello world', 'world'> // type EndsWithWorld = true
 * type DoesNotEnd = EndsWith<'hello world', 'hello'> // type DoesNotEnd = false
 */
export type EndsWith<T extends string, S extends string, P extends number | undefined = undefined> = P extends number
    ? InternalEndsWithType<T, S, P>
    : EndsWithNoPositionType<T, S>;

/**
 * Type-level implementation of string.includes() functionality.
 * Determines if one string type contains another string type starting at an optional position.
 * @template T - The string type to search within
 * @template S - The string type to search for
 * @template P - Optional position to start the search from
 * @returns A boolean type indicating if S is found within T starting at P
 * @example
 * type HasWorld = Includes<'hello world', 'world'> // type HasWorld = true
 * type NoWorld = Includes<'hello', 'world'> // type NoWorld = false
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
 * Type-level implementation of Array.join() functionality for string tuples.
 * Combines string literal types in a tuple using a delimiter.
 * @template T - Tuple of string types to join
 * @template delimiter - The delimiter to insert between elements
 * @returns A string type representing the joined result
 * @example
 * type Joined = Join<['a', 'b', 'c'], '.'> // type Joined = 'a.b.c'
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
 * Type-level utility to compute the length of a string literal type.
 * @template T - The string type to measure
 * @returns A number literal type representing the string's length
 * @example
 * type Len = Length<'hello'> // type Len = 5
 */
export type Length<T extends string> = IsStringLiteral<T> extends true ? Split<T>["length"] : number;

/**
 * Type-level implementation of string.padEnd() functionality.
 * Adds padding to the end of a string type until it reaches a specified length.
 * @template T - The string type to pad
 * @template times - The number of times to repeat the padding
 * @template pad - The string to use as padding (defaults to space)
 * @returns A string type with the padding added to the end
 * @example
 * type Padded = PadEnd<'hello', 2, '_'> // type Padded = 'hello__'
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
 * Type-level implementation of string.padStart() functionality.
 * Adds padding to the beginning of a string type until it reaches a specified length.
 * @template T - The string type to pad
 * @template times - The number of times to repeat the padding
 * @template pad - The string to use as padding (defaults to space)
 * @returns A string type with the padding added to the start
 * @example
 * type Padded = PadStart<'hello', 2, '_'> // type Padded = '__hello'
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
 * Type-level implementation of string.repeat() functionality.
 * Creates a new string type by repeating the input string a specified number of times.
 * @template T - The string type to repeat
 * @template N - The number of times to repeat the string
 * @returns A string type containing T repeated N times
 * @example
 * type Repeated = Repeat<'abc', 2> // type Repeated = 'abcabc'
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
 * Type-level implementation of string.replaceAll() functionality.
 * Replaces all occurrences of a substring with another string.
 * @template sentence - The string type to perform replacements on
 * @template lookup - The string type to search for
 * @template replacement - The string type to replace matches with
 * @returns A string type with all occurrences of lookup replaced with replacement
 * @example
 * type Replaced = ReplaceAll<'hello hello', 'hello', 'hi'> // type Replaced = 'hi hi'
 */
export type ReplaceAll<Sentence extends string, Lookup extends RegExp | string, Replacement extends string = ""> = Lookup extends string
    ? IsStringLiteral<Lookup | Replacement | Sentence> extends true
        ? Sentence extends `${infer Rest}${Lookup}${infer Rest2}`
            ? `${Rest}${Replacement}${ReplaceAll<Rest2, Lookup, Replacement>}`
            : Sentence
        : string
    : string; // Regex used, can't preserve literal

/**
 * Type-level implementation of string.replace() functionality.
 * Replaces the first occurrence of a substring with another string.
 * @template sentence - The string type to perform replacement on
 * @template lookup - The string type to search for
 * @template replacement - The string type to replace the match with
 * @returns A string type with the first occurrence of lookup replaced with replacement
 * @example
 * type Replaced = Replace<'hello hello', 'hello', 'hi'> // type Replaced = 'hi hello'
 */
export type Replace<Sentence extends string, Lookup extends RegExp | string, Replacement extends string = ""> = Lookup extends string
    ? IsStringLiteral<Lookup | Replacement | Sentence> extends true
        ? Sentence extends `${infer Rest}${Lookup}${infer Rest2}`
            ? `${Rest}${Replacement}${Rest2}`
            : Sentence
        : string
    : string; // Regex used, can't preserve literal

/**
 * Type-level implementation of string.slice() functionality.
 * Extracts a portion of a string type between start and end indices.
 * @template T - The string type to slice
 * @template StartIndex - The starting index of the slice
 * @template EndIndex - The ending index of the slice (optional)
 * @returns A string type containing the characters between the indices
 * @example
 * type Sliced = Slice<'hello world', 0, 5> // type Sliced = 'hello'
 * type ToEnd = Slice<'hello world', 6> // type ToEnd = 'world'
 */
export type Slice<T extends string, StartIndex extends number = 0, EndIndex extends number | undefined = undefined> = EndIndex extends number
    ? InternalSliceType<T, StartIndex, EndIndex>
    : SliceStartType<T, StartIndex>;

/**
 * Type-level implementation of string.split() functionality.
 * Splits a string type into a tuple of string types based on a delimiter.
 * @template T - The string type to split
 * @template delimiter - The string type to use as a separator
 * @returns A tuple type containing the split string parts
 * @example
 * type Parts = Split<'a,b,c', ','> // type Parts = ['a', 'b', 'c']
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
 * Type-level implementation of string.startsWith() functionality.
 * Checks if a string type begins with another string type at a given position.
 * @template T - The string type to check
 * @template S - The prefix to check for
 * @template P - Optional position at which to start the search
 * @returns A boolean type indicating if T starts with S at position P
 * @example
 * type StartsWithHello = StartsWith<'hello world', 'hello'> // type StartsWithHello = true
 * type DoesNotStart = StartsWith<'hello world', 'world'> // type DoesNotStart = false
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
 * Type-level implementation of string.trimEnd() functionality.
 * Removes whitespace characters from the end of a string type.
 * @template T - The string type to trim
 * @returns A string type with trailing whitespace removed
 * @example
 * type Trimmed = TrimEnd<'hello  '> // type Trimmed = 'hello'
 */
export type TrimEnd<T extends string> = T extends `${infer Rest} ` ? TrimEnd<Rest> : T;

/**
 * Type-level implementation of string.trimStart() functionality.
 * Removes whitespace characters from the beginning of a string type.
 * @template T - The string type to trim
 * @returns A string type with leading whitespace removed
 * @example
 * type Trimmed = TrimStart<'  hello'> // type Trimmed = 'hello'
 */
export type TrimStart<T extends string> = T extends ` ${infer Rest}` ? TrimStart<Rest> : T;

/**
 * Type-level implementation of string.trim() functionality.
 * Removes whitespace characters from both ends of a string type.
 * @template T - The string type to trim
 * @returns A string type with both leading and trailing whitespace removed
 * @example
 * type Trimmed = Trim<'  hello  '> // type Trimmed = 'hello'
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
 * Type-level implementation of string.toLowerCase() functionality.
 * Converts all alphabetic characters in a string type to lowercase.
 * @template T - The string type to convert
 * @returns A string type with all characters converted to lowercase
 * @example
 * type Lower = ToLowerCase<'HELLO'> // type Lower = 'hello'
 */
export type ToLowerCase<T extends string> = IsStringLiteral<T> extends true ? Lowercase<T> : string;

/**
 * Type-level implementation of string.toUpperCase() functionality.
 * Converts all alphabetic characters in a string type to uppercase.
 * @template T - The string type to convert
 * @returns A string type with all characters converted to uppercase
 * @example
 * type Upper = ToUpperCase<'hello'> // type Upper = 'HELLO'
 */
export type ToUpperCase<T extends string> = IsStringLiteral<T> extends true ? Uppercase<T> : string;
