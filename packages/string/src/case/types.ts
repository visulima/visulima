import type { IsStringLiteral, NodeLocale } from "../types";
import type LRUCache from "../utils/lru-cache";

/**
 * Valid characters used to split strings into words.
 * Used by various case conversion functions to identify word boundaries.
 * @type {string}
 */
type SplitterCharacter = " " | "_" | "-" | "." | "/";
/**
 * Gets the type of the last element in an array type.
 * @template T - The array type to extract from
 * @returns The type of the last element, or never if array is empty
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LastOfArray<T extends any[]> = T extends [...any, infer R] ? R : never;
/**
 * Creates a new array type with the last element removed.
 * @template T - The array type to modify
 * @returns A new array type without the last element, or never if array is empty
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RemoveLastOfArray<T extends any[]> = T extends [...infer F, any] ? F : never;
/**
 * Type predicate that checks if a string type contains only uppercase characters.
 * @template S - The string type to check
 * @returns true if string is all uppercase, false otherwise
 * @example
 * type IsUpper = IsUpperCase<'ABC'> // type IsUpper = true
 * type NotUpper = IsUpperCase<'aBc'> // type NotUpper = false
 */
type IsUpperCase<S extends string> = S extends Uppercase<S> ? true : false;
/**
 * Type predicate that checks if a string type contains only lowercase characters.
 * @template S - The string type to check
 * @returns true if string is all lowercase, false otherwise
 * @example
 * type IsLower = IsLowerCase<'abc'> // type IsLower = true
 * type NotLower = IsLowerCase<'aBc'> // type NotLower = false
 */
type IsLowerCase<S extends string> = S extends Lowercase<S> ? true : false;
/**
 * Type predicate that checks if two string types have the same case pattern.
 * Both strings must be either all uppercase or all lowercase to be considered the same case.
 * @template X - First string type to compare
 * @template Y - Second string type to compare
 * @returns true if both strings have the same case pattern, false otherwise
 * @example
 * type Same = SameLetterCase<'ABC', 'XYZ'> // type Same = true
 * type Different = SameLetterCase<'abc', 'XYZ'> // type Different = false
 */
type SameLetterCase<X extends string, Y extends string> = IsUpperCase<X> extends IsUpperCase<Y> ? true : IsLowerCase<X> extends IsLowerCase<Y> ? true : false;
/**
 * Gets the first character of a string type.
 * @template S - The string type to extract from
 * @returns The first character as a string type, or never if string is empty
 * @example
 * type First = FirstOfString<'hello'> // type First = 'h'
 */
type FirstOfString<S extends string> = S extends `${infer F}${string}` ? F : never;
/**
 * Creates a new string type with the first character removed.
 * @template S - The string type to modify
 * @returns A new string type without the first character, or never if string is empty
 * @example
 * type Rest = RemoveFirstOfString<'hello'> // type Rest = 'ello'
 */
type RemoveFirstOfString<S extends string> = S extends `${string}${infer R}` ? R : never;

/**
 * Options for locale support.
 */
export interface LocaleOptions {
    /**
     * The locale to use for case conversion.
     * If not provided, the system default locale will be used.
     */
    locale?: NodeLocale;
}

/**
 * Options for case conversion with locale support.
 */
export interface CaseOptions extends LocaleOptions {
    /**
     * Uses a shared LRU cache with a fixed size.
     * @default false
     */
    cache?: boolean;

    /**
     * A custom cache store for this specific case function.
     * Each case function (camelCase, pascalCase, etc.) should have its own dedicated cache store
     * to avoid conflicts and ensure optimal performance.
     * @example
     * ```typescript
     * // Create separate caches for each case function
     * const camelCaseStore = new LRUCache<string, string>(1000);
     * const pascalCaseStore = new LRUCache<string, string>(1000);
     *
     * camelCase("some-string", { cache: true, cacheStore: camelCaseStore });
     * pascalCase("some-string", { cache: true, cacheStore: pascalCaseStore });
     * ```
     */
    cacheStore?: LRUCache<string, string>;

    /**
     * Whether to handle ANSI escape sequences.
     * @default false
     */
    handleAnsi?: boolean;

    /**
     * Whether to handle emoji sequences.
     * @default false
     */
    handleEmoji?: boolean;

    /**
     * A list of known acronyms to preserve casing for.
     */
    knownAcronyms?: ReadonlyArray<string>;

    /**
     * Whether to normalize case (e.g., convert uppercase tokens not in knownAcronyms to title case).
     */
    normalize?: boolean;

    /**
     * Whether to strip ANSI escape sequences. (default: false)
     */
    stripAnsi?: boolean;

    /**
     * Whether to strip emoji sequences. (default: false)
     */
    stripEmoji?: boolean;
}

/**
 * Type-level implementation of camelCase conversion.
 * Converts a string type to camelCase format where words are joined together
 * with the first word in lowercase and subsequent words capitalized.
 * 
 * @template T - The string type to convert
 * @returns A string type in camelCase format
 * 
 * @example
 * type Result1 = CamelCase<'foo bar'> // type Result1 = 'fooBar'
 * type Result2 = CamelCase<'foo-bar'> // type Result2 = 'fooBar'
 * type Result3 = CamelCase<'foo_bar'> // type Result3 = 'fooBar'
 */
export type CamelCase<T extends string> =
    IsStringLiteral<T> extends true
        ? T extends `${infer F}_${infer R}`
            ? `${Lowercase<F>}${Capitalize<CamelCase<R>>}`
            : T extends `${infer F}-${infer R}`
              ? `${Lowercase<F>}${Capitalize<CamelCase<R>>}`
              : T extends `${infer F} ${infer R}`
                ? `${Lowercase<F>}${Capitalize<CamelCase<R>>}`
                : Lowercase<T>
        : string;

/**
 * Type-level implementation of PascalCase conversion.
 * Converts a string type to PascalCase format where words are joined together
 * with each word capitalized.
 * 
 * @template T - The string type to convert
 * @returns A string type in PascalCase format
 * 
 * @example
 * type Result1 = PascalCase<'foo bar'> // type Result1 = 'FooBar'
 * type Result2 = PascalCase<'foo-bar'> // type Result2 = 'FooBar'
 * type Result3 = PascalCase<'foo_bar'> // type Result3 = 'FooBar'
 */
export type PascalCase<T extends string> = IsStringLiteral<T> extends true ? Capitalize<CamelCase<T>> : string;

/**
 * Type-level implementation of snake_case conversion.
 * Converts a string type to snake_case format where words are in lowercase
 * and separated by underscores.
 * 
 * @template T - The string type to convert
 * @returns A string type in snake_case format
 * 
 * @example
 * type Result1 = SnakeCase<'fooBar'> // type Result1 = 'foo_bar'
 * type Result2 = SnakeCase<'foo bar'> // type Result2 = 'foo_bar'
 * type Result3 = SnakeCase<'foo-bar'> // type Result3 = 'foo_bar'
 */
export type SnakeCase<T extends string> =
    IsStringLiteral<T> extends true
        ? T extends `${infer C}${infer Rest}`
            ? C extends Uppercase<C>
                ? `_${Lowercase<C>}${SnakeCase<Rest>}`
                : `${C}${SnakeCase<Rest>}`
            : T
        : string;

/**
 * Type-level implementation of kebab-case conversion.
 * Converts a string type to kebab-case format where words are in lowercase
 * and separated by hyphens.
 * 
 * @template T - The string type to convert
 * @returns A string type in kebab-case format
 * 
 * @example
 * type Result1 = KebabCase<'fooBar'> // type Result1 = 'foo-bar'
 * type Result2 = KebabCase<'foo bar'> // type Result2 = 'foo-bar'
 * type Result3 = KebabCase<'foo_bar'> // type Result3 = 'foo-bar'
 */
export type KebabCase<T extends string> =
    IsStringLiteral<T> extends true
        ? T extends `${infer C}${infer Rest}`
            ? C extends Uppercase<C>
                ? `-${Lowercase<C>}${KebabCase<Rest>}`
                : `${C}${KebabCase<Rest>}`
            : T
        : string;

/**
 * Type-level implementation of flat case conversion.
 * Converts a string type to flat case format where all words are joined together
 * in lowercase with no separators.
 * 
 * @template T - The string type to convert
 * @returns A string type in flat case format
 * 
 * @example
 * type Result1 = FlatCase<'foo-barBaz'> // type Result1 = 'foobarbaz'
 * type Result2 = FlatCase<'foo bar'> // type Result2 = 'foobar'
 * type Result3 = FlatCase<'FOO_BAR'> // type Result3 = 'foobar'
 */
export type FlatCase<T extends string> = IsStringLiteral<T> extends true ? Lowercase<T extends `${infer F}${infer R}` ? `${F}${FlatCase<R>}` : T> : string;

/**
 * Type-level implementation of Train-Case conversion.
 * Converts a string type to Train-Case format where words are capitalized
 * and separated by hyphens. This case style is similar to PascalCase but with
 * hyphens between words.
 * 
 * @template T - The string type to convert
 * @returns A string type in Train-Case format
 * 
 * @example
 * type Result1 = TrainCase<'FooBARb'> // type Result1 = 'Foo-Ba-Rb'
 * type Result2 = TrainCase<'foo bar'> // type Result2 = 'Foo-Bar'
 * type Result3 = TrainCase<'foo_bar'> // type Result3 = 'Foo-Bar'
 */
export type TrainCase<T extends string, N extends boolean = false> =
    IsStringLiteral<T> extends true
        ? T extends `${infer F}${infer R}`
            ? F extends Uppercase<F>
                ? R extends `${infer Next}${infer Rest}`
                    ? Next extends Uppercase<Next>
                        ? N extends true
                            ? `${Capitalize<F>}-${Lowercase<Next>}${TrainCase<Rest, N>}`
                            : `${F}${Next}${TrainCase<Rest, N>}`
                        : `${Capitalize<F>}${TrainCase<R, N>}`
                    : `${Capitalize<F>}${Lowercase<R>}`
                : `${Lowercase<F>}${TrainCase<R, N>}`
            : T
        : string;

/**
 * Type-level implementation of Title Case conversion.
 * Converts a string type to Title Case format where the first letter of each
 * significant word is capitalized. Articles, conjunctions, and prepositions
 * typically remain in lowercase unless they are the first word.
 * 
 * @template T - The string type to convert
 * @returns A string type in Title Case format
 * 
 * @example
 * type Result1 = TitleCase<'this-IS-aTitle'> // type Result1 = 'This Is A Title'
 * type Result2 = TitleCase<'hello_world'> // type Result2 = 'Hello World'
 * type Result3 = TitleCase<'theFox'> // type Result3 = 'The Fox'
 */
export type TitleCase<T extends string> = IsStringLiteral<T> extends true ? (T extends `${infer F}${infer R}` ? `${Capitalize<F>}${Lowercase<R>}` : T) : string;

/**
 * Type-level implementation of first character capitalization.
 * Converts the first character of a string type to uppercase while leaving
 * the rest of the string unchanged.
 * 
 * @template T - The string type to modify
 * @returns A string type with its first character in uppercase
 * 
 * @example
 * type Result1 = UpperFirst<'hello world!'> // type Result1 = 'Hello world!'
 * type Result2 = UpperFirst<'fooBar'> // type Result2 = 'FooBar'
 * type Result3 = UpperFirst<'123abc'> // type Result3 = '123abc'
 */
export type UpperFirst<T extends string> = IsStringLiteral<T> extends true ? (T extends `${infer F}${infer R}` ? `${Uppercase<F>}${R}` : T) : string;

/**
 * Type-level implementation of first character lowercasing.
 * Converts the first character of a string type to lowercase while leaving
 * the rest of the string unchanged.
 * 
 * @template T - The string type to modify
 * @returns A string type with its first character in lowercase
 * 
 * @example
 * type Result1 = LowerFirst<'Hello world!'> // type Result1 = 'hello world!'
 * type Result2 = LowerFirst<'FooBar'> // type Result2 = 'fooBar'
 * type Result3 = LowerFirst<'123ABC'> // type Result3 = '123ABC'
 */
export type LowerFirst<T extends string> = IsStringLiteral<T> extends true ? (T extends `${infer F}${infer R}` ? `${Lowercase<F>}${R}` : T) : string;

/**
 * Type-level implementation of case flipping.
 * Inverts the case of each character in a string type - uppercase becomes
 * lowercase and vice versa.
 * 
 * @template T - The string type to modify
 * @returns A string type with inverted character cases
 * 
 * @example
 * type Result1 = FlipCase<'FooBar'> // type Result1 = 'fOObAR'
 * type Result2 = FlipCase<'Hello World'> // type Result2 = 'hELLO wORLD'
 * type Result3 = FlipCase<'123'> // type Result3 = '123'
 */
export type FlipCase<T extends string> =
    IsStringLiteral<T> extends true
        ? T extends `${infer C}${infer Rest}`
            ? `${C extends Uppercase<C> ? Lowercase<C> : Uppercase<C>}${FlipCase<Rest>}`
            : T
        : string;

/**
 * Type-level implementation of dot.case conversion.
 * Converts a string type to dot.case format where words are in lowercase
 * and separated by dots.
 * 
 * @template T - The string type to convert
 * @returns A string type in dot.case format
 * 
 * @example
 * type Result1 = DotCase<'fooBar'> // type Result1 = 'foo.bar'
 * type Result2 = DotCase<'foo_bar'> // type Result2 = 'foo.bar'
 * type Result3 = DotCase<'foo-bar'> // type Result3 = 'foo.bar'
 */
export type DotCase<T extends string> = T & {
    __dot_case__: never;
};

/**
 * Type-level implementation of path/case conversion.
 * Converts a string type to path/case format where words are in lowercase
 * and separated by forward slashes, making it suitable for file paths.
 * 
 * @template T - The string type to convert
 * @returns A string type in path/case format
 * 
 * @example
 * type Result1 = PathCase<'fooBar'> // type Result1 = 'foo/bar'
 * type Result2 = PathCase<'foo_bar'> // type Result2 = 'foo/bar'
 * type Result3 = PathCase<'foo-bar'> // type Result3 = 'foo/bar'
 */
export type PathCase<T extends string> = T & {
    __path_case__: never;
};

/**
 * Type-level implementation of no case conversion.
 * Converts a string type to space-separated lowercase words, removing all
 * special case formatting.
 * 
 * @template T - The string type to convert
 * @returns A string type in space-separated lowercase format
 * 
 * @example
 * type Result1 = NoCase<'fooBar'> // type Result1 = 'foo bar'
 * type Result2 = NoCase<'foo_bar'> // type Result2 = 'foo bar'
 * type Result3 = NoCase<'FOO-BAR'> // type Result3 = 'foo bar'
 */
export type NoCase<T extends string> = T & {
    __no_case__: never;
};

/**
 * Type-level implementation of CONSTANT_CASE conversion.
 * Converts a string type to CONSTANT_CASE format where words are in uppercase
 * and separated by underscores. Commonly used for constant/enum values.
 * 
 * @template T - The string type to convert
 * @returns A string type in CONSTANT_CASE format
 * 
 * @example
 * type Result1 = ConstantCase<'fooBar'> // type Result1 = 'FOO_BAR'
 * type Result2 = ConstantCase<'foo-bar'> // type Result2 = 'FOO_BAR'
 * type Result3 = ConstantCase<'foo bar'> // type Result3 = 'FOO_BAR'
 */
export type ConstantCase<T extends string> = T & {
    __constant_case__: never;
};

/**
 * Type-level implementation of Capital Case conversion.
 * Converts a string type to Capital Case format where each word starts with
 * a capital letter and words are separated by spaces.
 * 
 * @template T - The string type to convert
 * @returns A string type in Capital Case format
 * 
 * @example
 * type Result1 = CapitalCase<'fooBar'> // type Result1 = 'Foo Bar'
 * type Result2 = CapitalCase<'foo_bar'> // type Result2 = 'Foo Bar'
 * type Result3 = CapitalCase<'foo-bar'> // type Result3 = 'Foo Bar'
 */
export type CapitalCase<T extends string> = T & {
    __capital_case__: never;
};

/**
 * Type-level implementation of Sentence case conversion.
 * Converts a string type to Sentence case format where only the first word
 * starts with a capital letter and all other words are lowercase.
 * 
 * @template T - The string type to convert
 * @returns A string type in Sentence case format
 * 
 * @example
 * type Result1 = SentenceCase<'fooBar'> // type Result1 = 'Foo bar'
 * type Result2 = SentenceCase<'FOO_BAR'> // type Result2 = 'Foo bar'
 * type Result3 = SentenceCase<'foo-bar'> // type Result3 = 'Foo bar'
 */
export type SentenceCase<T extends string> = T & {
    __sentence_case__: never;
};

/**
 * Type-level implementation of Pascal_Snake_Case conversion.
 * Converts a string type to Pascal_Snake_Case format where words are capitalized
 * and separated by underscores. This is a hybrid between PascalCase and snake_case.
 * 
 * @template T - The string type to convert
 * @returns A string type in Pascal_Snake_Case format
 * 
 * @example
 * type Result1 = PascalSnakeCase<'fooBar'> // type Result1 = 'Foo_Bar'
 * type Result2 = PascalSnakeCase<'foo bar'> // type Result2 = 'Foo_Bar'
 * type Result3 = PascalSnakeCase<'foo-bar'> // type Result3 = 'Foo_Bar'
 */
export type PascalSnakeCase<T extends string> = T & {
    __pascal_snake_case__: never;
};

/**
 * Type-level utility that identifies the case pattern of a string type.
 * Analyzes the string to determine if it follows a specific case convention
 * such as camelCase, PascalCase, snake_case, etc.
 * 
 * @template T - The string type to analyze
 * @returns A string literal type indicating the detected case pattern:
 * - 'snake' for snake_case
 * - 'kebab' for kebab-case
 * - 'flat' for flatcase
 * - 'lower' for lowercase
 * - 'upper' for UPPERCASE
 * - 'train' for Train-Case
 * - 'pascal' for PascalCase
 * - 'camel' for camelCase
 * - 'title' for Title Case
 * - 'mixed' for mixed case patterns
 * - string type for non-literal strings
 * 
 * @example
 * type Case1 = IdentifyCase<'foo_bar'> // type Case1 = 'snake'
 * type Case2 = IdentifyCase<'foo-bar'> // type Case2 = 'kebab'
 * type Case3 = IdentifyCase<'fooBar'> // type Case3 = 'camel'
 * type Case4 = IdentifyCase<'FooBar'> // type Case4 = 'pascal'
 * type Case5 = IdentifyCase<'FOO_BAR'> // type Case5 = 'upper'
 */
export type IdentifyCase<T extends string> =
    IsStringLiteral<T> extends true
        ? T extends Lowercase<T>
            ? T extends `${string}_${string}`
                ? "snake"
                : T extends `${string}-${string}`
                  ? "kebab"
                  : T extends `${string}${string}`
                    ? "flat"
                    : "lower"
            : T extends Uppercase<T>
              ? "upper"
              : T extends Capitalize<string>
                ? T extends `${Uppercase<string>}${string}`
                    ? T extends `${string}-${string}`
                        ? "train"
                        : "pascal"
                    : T extends `${Lowercase<string>}${Capitalize<string>}`
                      ? "camel"
                      : T extends `${Capitalize<string>} ${Lowercase<string>}`
                        ? "title"
                        : "mixed"
                : "mixed"
        : string;

/**
 * Type-level utility that splits a string type into an array of substrings based on case boundaries
 * and separator characters. This is particularly useful for breaking down strings in various case
 * formats into their constituent words.
 * 
 * The utility handles multiple scenarios:
 * - Case boundaries (e.g., camelCase -> ['camel', 'Case'])
 * - Separator characters (e.g., snake_case -> ['snake', 'case'])
 * - Mixed patterns (e.g., FOO-Bar -> ['FOO', 'Bar'])
 * 
 * @template T - The string type to split
 * @template Separator - The separator character(s) to split on (defaults to SplitterCharacter)
 * @template Accumulator - Internal accumulator for building the result array
 * @returns A tuple type containing the split string parts, or string[] for non-literal strings
 * 
 * @example
 * type Split1 = SplitByCase<'camelCase'> // type Split1 = ['camel', 'Case']
 * type Split2 = SplitByCase<'foo_bar'> // type Split2 = ['foo', 'bar']
 * type Split3 = SplitByCase<'FOO-Bar'> // type Split3 = ['FOO', 'Bar']
 * type Split4 = SplitByCase<'simpletext'> // type Split4 = ['simpletext']
 */
export type SplitByCase<T, Separator extends string = SplitterCharacter, Accumulator extends unknown[] = []> = string extends Separator
    ? string[]
    : T extends `${infer F}${infer R}`
      ? [LastOfArray<Accumulator>] extends [never]
          ? SplitByCase<R, Separator, [F]>
          : LastOfArray<Accumulator> extends string
            ? R extends ""
                ? SplitByCase<R, Separator, [...RemoveLastOfArray<Accumulator>, `${LastOfArray<Accumulator>}${F}`]>
                : SameLetterCase<F, FirstOfString<R>> extends true
                  ? F extends Separator
                      ? FirstOfString<R> extends Separator
                          ? SplitByCase<R, Separator, [...Accumulator, ""]>
                          : IsUpperCase<FirstOfString<R>> extends true
                            ? SplitByCase<RemoveFirstOfString<R>, Separator, [...Accumulator, FirstOfString<R>]>
                            : SplitByCase<R, Separator, [...Accumulator, ""]>
                      : SplitByCase<R, Separator, [...RemoveLastOfArray<Accumulator>, `${LastOfArray<Accumulator>}${F}`]>
                  : IsLowerCase<F> extends true
                    ? SplitByCase<RemoveFirstOfString<R>, Separator, [...RemoveLastOfArray<Accumulator>, `${LastOfArray<Accumulator>}${F}`, FirstOfString<R>]>
                    : SplitByCase<R, Separator, [...Accumulator, F]>
            : never
      : Accumulator extends []
        ? T extends ""
            ? []
            : string[]
        : Accumulator;
