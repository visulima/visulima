import type { IsStringLiteral, NodeLocale } from "../types";

type SplitterCharacter = " " | "_" | "-" | "." | "/";
type LastOfArray<T extends any[]> = T extends [...any, infer R] ? R : never;
type RemoveLastOfArray<T extends any[]> = T extends [...infer F, any] ? F : never;
type IsUpperCase<S extends string> = S extends Uppercase<S> ? true : false;
type IsLowerCase<S extends string> = S extends Lowercase<S> ? true : false;
type SameLetterCase<X extends string, Y extends string> = IsUpperCase<X> extends IsUpperCase<Y> ? true : IsLowerCase<X> extends IsLowerCase<Y> ? true : false;
type FirstOfString<S extends string> = S extends `${infer F}${string}` ? F : never;
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
     * Whether to enable caching for the case conversion.
     * @default false
     */
    cache?: boolean;

    /**
     * The maximum size of the cache. Only applicable if cache is enabled.
     * @default 1000
     */
    cacheMaxSize?: number;

    /**
     * A custom cache store for this specific case function.
     * Each case function (camelCase, pascalCase, etc.) should have its own dedicated cache store
     * to avoid conflicts and ensure optimal performance.
     * @example
     * ```typescript
     * // Create separate caches for each case function
     * const camelCaseStore = new Map<string, string>();
     * const pascalCaseStore = new Map<string, string>();
     *
     * camelCase("some-string", { cache: true, cacheStore: camelCaseStore });
     * pascalCase("some-string", { cache: true, cacheStore: pascalCaseStore });
     * ```
     */
    cacheStore?: Map<string, string>;

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
 * Converts a string to camelCase.
 * Example: "foo bar" -> "fooBar"
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
 * Converts a string to PascalCase.
 * Example: "foo bar" -> "FooBar"
 */
export type PascalCase<T extends string> = IsStringLiteral<T> extends true ? Capitalize<CamelCase<T>> : string;

/**
 * Converts a string to snake_case.
 * Example: "fooBar" -> "foo_bar"
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
 * Converts a string to kebab-case.
 * Example: "fooBar" -> "foo-bar"
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
 * Converts a string to flat case.
 * Example: "foo-barBaz" -> "foobarbaz"
 */
export type FlatCase<T extends string> = IsStringLiteral<T> extends true ? Lowercase<T extends `${infer F}${infer R}` ? `${F}${FlatCase<R>}` : T> : string;

/**
 * Converts a string to Train-Case.
 * Example: "FooBARb" -> "Foo-Ba-Rb"
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
 * Converts a string to Title Case.
 * Example: "this-IS-aTitle" -> "This is a Title"
 */
export type TitleCase<T extends string> = IsStringLiteral<T> extends true ? (T extends `${infer F}${infer R}` ? `${Capitalize<F>}${Lowercase<R>}` : T) : string;

/**
 * Converts first character to upper case.
 * Example: "hello world!" -> "Hello world!"
 */
export type UpperFirst<T extends string> = IsStringLiteral<T> extends true ? (T extends `${infer F}${infer R}` ? `${Uppercase<F>}${R}` : T) : string;

/**
 * Converts first character to lower case.
 * Example: "Hello world!" -> "hello world!"
 */
export type LowerFirst<T extends string> = IsStringLiteral<T> extends true ? (T extends `${infer F}${infer R}` ? `${Lowercase<F>}${R}` : T) : string;

/**
 * Flips the case of each character in a string.
 * Example: "FooBar" -> "fOObAR"
 */
export type FlipCase<T extends string> =
    IsStringLiteral<T> extends true
        ? T extends `${infer C}${infer Rest}`
            ? `${C extends Uppercase<C> ? Lowercase<C> : Uppercase<C>}${FlipCase<Rest>}`
            : T
        : string;

/**
 * Converts a string to dot.case.
 * Example: "fooBar" -> "foo.bar"
 */
export type DotCase<T extends string> = T & {
    __dot_case__: never;
};

/**
 * Converts a string to path/case.
 * Example: "fooBar" -> "foo/bar"
 */
export type PathCase<T extends string> = T & {
    __path_case__: never;
};

/**
 * Converts a string to no case (space separated).
 * Example: "fooBar" -> "foo bar"
 */
export type NoCase<T extends string> = T & {
    __no_case__: never;
};

/**
 * Converts a string to CONSTANT_CASE.
 * Example: "fooBar" -> "FOO_BAR"
 */
export type ConstantCase<T extends string> = T & {
    __constant_case__: never;
};

/**
 * Converts a string to Capital Case.
 * Example: "fooBar" -> "Foo Bar"
 */
export type CapitalCase<T extends string> = T & {
    __capital_case__: never;
};

/**
 * Converts a string to Sentence case.
 * Example: "fooBar" -> "Foo bar"
 */
export type SentenceCase<T extends string> = T & {
    __sentence_case__: never;
};

/**
 * Converts a string to Pascal_Snake_Case.
 * Example: "fooBar" -> "Foo_Bar"
 */
export type PascalSnakeCase<T extends string> = T & {
    __pascal_snake_case__: never;
};

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
