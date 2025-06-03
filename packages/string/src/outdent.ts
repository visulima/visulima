import {
    RE_DETECT_INDENTATION,
    RE_LEADING_NEWLINE,
    RE_MATCH_NEWLINES,
    RE_ONLY_WHITESPACE_WITH_AT_LEAST_ONE_NEWLINE,
    RE_STARTS_WITH_NEWLINE_OR_IS_EMPTY,
    RE_TRAILING_NEWLINE,
} from "./constants";

// Safe hasOwnProperty

const hop = Object.prototype.hasOwnProperty;
const has = (object: object, property: string): boolean => hop.call(object, property);

// Copy all own enumerable properties from source to target
const extend = <T, S extends object>(target: T, source: S): S & T => {
    type Extended = S & T;

    for (const property in source) {
        if (has(source, property)) {
            // eslint-disable-next-line no-param-reassign,@typescript-eslint/no-explicit-any
            (target as any)[property] = source[property];
        }
    }

    return target as Extended;
};

/**
 * Internal helper to remove indentation from an array of strings (from template literal parts).
 * Handles indentation level detection and normalization based on options.
 * @param strings Array of string parts from a template literal.
 * @param firstInterpolatedValueSetsIndentationLevel Flag indicating special indentation handling.
 * @param options Outdent options.
 * @returns Array of strings with indentation removed.
 */
const internalOutdentArray = (strings: ReadonlyArray<string>, firstInterpolatedValueSetsIndentationLevel: boolean, options: Options): string[] => {
    // Skip processing for empty arrays
    if (strings.length === 0) {
        return [];
    }

    // If first interpolated value is a reference to outdent,
    // determine indentation level from the indentation of the interpolated value.
    let indentationLevel = 0;

    // Fast path for common case where there's no indentation or simple indentation
    const match = RE_DETECT_INDENTATION.exec(strings[0] as string);

    if (match) {
        indentationLevel = (match[1] as string).length;
    }

    // Build regex only once with the determined indentation level

    const reSource = `(\\r\\n|\\r|\\n).{0,${indentationLevel}}`;
    const reMatchIndent = new RegExp(reSource, "g");

    if (firstInterpolatedValueSetsIndentationLevel) {
        // eslint-disable-next-line no-param-reassign
        strings = strings.slice(1);
    }

    const { newline, trimLeadingNewline, trimTrailingNewline } = options;
    const normalizeNewlines = typeof newline === "string";
    const l = strings.length;

    // Pre-allocate result array with exact size
    const outdentedStrings: string[] = Array.from({ length: l });

    // Process all strings
    // eslint-disable-next-line no-plusplus
    for (let index = 0; index < l; index++) {
        let v = strings[index] as string;

        // Remove leading indentation from all lines (most expensive operation)
        v = v.replace(reMatchIndent, "$1");

        // Trim a leading newline from the first string
        if (index === 0 && trimLeadingNewline) {
            v = v.replace(RE_LEADING_NEWLINE, "");
        }

        // Trim a trailing newline from the last string
        if (index === l - 1 && trimTrailingNewline) {
            v = v.replace(RE_TRAILING_NEWLINE, "");
        }

        // Normalize newlines
        if (normalizeNewlines) {
            v = v.replaceAll(RE_MATCH_NEWLINES, newline as string);
        }

        outdentedStrings[index] = v;
    }

    return outdentedStrings;
};

/**
 * Internal helper to efficiently concatenate alternating strings and values.
 * @param strings Array of string parts.
 * @param values Array of interpolated values.
 * @returns The concatenated string.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const concatStringsAndValues = (strings: ReadonlyArray<string>, values: ReadonlyArray<any>): string => {
    const chunks: string[] = Array.from({ length: strings.length + values.length });

    // Interleave strings and values
    let index = 0;
    const l = strings.length;

    // eslint-disable-next-line no-plusplus
    for (; index < l - 1; index++) {
        chunks[index * 2] = strings[index] as string;

        chunks[index * 2 + 1] = String(values[index]);
    }

    chunks[index * 2] = strings[index] as string;

    // Join is faster than repeated string concatenation
    return chunks.join("");
};

/** Type guard to check if a value is a TemplateStringsArray. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const isTemplateStringsArray = (v: any): v is TemplateStringsArray => has(v, "raw") && has(v, "length");

// A single shared WeakMap cache for processed template literals.
const templateCache = new WeakMap<TemplateStringsArray, string[]>();

/**
 * Creates an outdent function instance with specific configuration options.
 * This allows for customizing behavior like newline normalization and caching.
 * @param options The configuration options for the outdent instance.
 * @returns An Outdent function tailored to the provided options.
 */

const createInstance = (options: Options): Outdent => {
    const enableCache = options.cache !== false;
    const cache = enableCache ? options.cacheStore ?? templateCache : null;
    const hasNewlineOption = options.newline !== undefined;

    // Define the actual outdent function returned by the factory
    // It handles both template literal calls and option-setting calls.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function outdent(stringsOrOptions: TemplateStringsArray, ...values: any[]): string;
    function outdent(stringsOrOptions: Options): Outdent;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function outdent(stringsOrOptions: Options | TemplateStringsArray, ...values: any[]): Outdent | string {
        // Call signature: outdent`template literal`
        if (isTemplateStringsArray(stringsOrOptions)) {
            const strings = stringsOrOptions;
            const valuesLength = values.length;

            if (strings.length === 1 && strings[0] === "") {
                return "";
            }

            // Optimization: No interpolated values
            if (valuesLength === 0) {
                if (enableCache && cache && !hasNewlineOption) {
                    const cached = cache.get(strings);

                    if (cached) {
                        return cached[0] as string;
                    }
                }

                const result = internalOutdentArray(strings, false, options);

                if (enableCache && cache) {
                    cache.set(strings, result);
                }

                return result[0] as string;
            }

            // Special case: indentation level set by the first interpolated value (if it's also outdent)
            // eslint-disable-next-line @typescript-eslint/no-use-before-define
            const firstValueIsOutdent = values[0] === outdent || values[0] === defaultOutdent;
            const firstInterpolatedValueSetsIndentationLevel
                = firstValueIsOutdent
                    && RE_ONLY_WHITESPACE_WITH_AT_LEAST_ONE_NEWLINE.test(strings[0] as string)
                    && RE_STARTS_WITH_NEWLINE_OR_IS_EMPTY.test(strings[1] as string);

            let renderedArray: string[] | undefined;

            if (enableCache && cache && !hasNewlineOption) {
                renderedArray = cache.get(strings);
            }

            if (!renderedArray) {
                renderedArray = internalOutdentArray(strings, firstInterpolatedValueSetsIndentationLevel, options);

                if (enableCache && cache) {
                    cache.set(strings, renderedArray);
                }
            }

            return concatStringsAndValues(renderedArray, firstInterpolatedValueSetsIndentationLevel ? values.slice(1) : values);
        }

        // Call signature: outdent(options)
        // Create and return a new instance with merged options
        return createInstance(extend(extend({}, options), stringsOrOptions));
    }

    // Attach the .string method to the outdent function instance
    return extend(outdent, {
        string(string_: string): string {
            if (string_ === "" || !string_) {
                return "";
            }

            return internalOutdentArray([string_], false, options)[0] as string;
        },
    });
};

// Create the default outdent instance with default options
const defaultOutdent: Outdent = createInstance({
    cache: true, // Enable caching by default
    newline: null,
    trimLeadingNewline: true,
    trimTrailingNewline: true,
});

export const outdent = defaultOutdent;

/**
 * Represents the outdent function, which can be called as a template tag
 * or as a function to create a new instance with specific options.
 * It also includes a `.string()` method for processing regular strings.
 */
export interface Outdent {
    /**
     * Remove indentation from a template literal.
     * Tag function for template literals.
     * @param strings The static string parts of the template literal.
     * @param values The interpolated values.
     * @returns The processed string with indentation removed.
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (strings: TemplateStringsArray, ...values: any[]): string;

    /**
     * Create and return a new Outdent instance with the given options.
     * @param options Configuration options for the new instance.
     * @returns A new Outdent function instance.
     */
    (options: Options): Outdent;

    /**
     * Remove indentation from a string
     * @param string_ The raw string to process.
     * @returns The processed string with indentation removed.
     */
    string: (string_: string) => string;
}

/**
 * Configuration options for the outdent function.
 */
export interface Options {
    /**
     * Whether to cache processed template literals for better performance when
     * using the same template multiple times.
     *
     * Enabling caching can significantly improve performance when the same template
     * is used repeatedly, such as in loops or frequently called functions.
     * @example
     * // Create an outdent function with caching enabled (default)
     * const dedent = outdent();
     *
     * // Create an outdent function with caching disabled
     * const noCacheDedent = outdent({ cache: false });
     * @default true
     */
    cache?: boolean;

    /**
     * Custom cache store to use instead of the default WeakMap.
     * Must be a WeakMap instance.
     *
     * This allows you to provide your own WeakMap instance for caching,
     * which can be useful for advanced use cases or for sharing cache
     * between multiple outdent instances.
     * @example
     * // Create a custom cache
     * const customCache = new WeakMap();
     *
     * // Create an outdent function with a custom cache
     * const customCacheDedent = outdent({ cacheStore: customCache });
     */
    cacheStore?: WeakMap<TemplateStringsArray, string[]>;

    /**
     * Normalize all newlines in the template literal to this value.
     *
     * If `null`, newlines are left untouched.
     *
     * Newlines that get normalized are '\r\n', '\r', and '\n'.
     *
     * Newlines within interpolated values are *never* normalized.
     *
     * Although intended for normalizing to '\n' or '\r\n',
     * you can also set to any string; for example ' '.
     * @default null
     */
    newline?: string | null;

    /**
     * Whether to trim the leading newline in the template literal.
     * @default true
     */
    trimLeadingNewline?: boolean;

    /**
     * Whether to trim the trailing newline in the template literal.
     * @default true
     */
    trimTrailingNewline?: boolean;
}
