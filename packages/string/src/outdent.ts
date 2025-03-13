// Safe hasOwnProperty
// eslint-disable-next-line @typescript-eslint/unbound-method
import {
    RE_DETECT_INDENTATION,
    RE_LEADING_NEWLINE,
    RE_MATCH_NEWLINES,
    RE_ONLY_WHITESPACE_WITH_AT_LEAST_ONE_NEWLINE, RE_STARTS_WITH_NEWLINE_OR_IS_EMPTY,
    RE_TRAILING_NEWLINE
} from "./constants";

const hop = Object.prototype.hasOwnProperty;
const has = (object: object, property: string): boolean => hop.call(object, property);

// Copy all own enumerable properties from source to target
const extend = <T, S extends object>(target: T, source: S): S & T => {
    type Extended = S & T;

    // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax
    for (const property in source) {
        if (has(source, property)) {
            // eslint-disable-next-line no-param-reassign,@typescript-eslint/no-explicit-any,security/detect-object-injection
            (target as any)[property] = source[property];
        }
    }

    return target as Extended;
};

/**
 * Optimized version of internalOutdentArray that processes strings more efficiently
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
    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    const reSource = `(\\r\\n|\\r|\\n).{0,${indentationLevel}}`;
    // eslint-disable-next-line @rushstack/security/no-unsafe-regexp,security/detect-non-literal-regexp
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
    // eslint-disable-next-line no-plusplus,no-loops/no-loops
    for (let index = 0; index < l; index++) {
        // eslint-disable-next-line security/detect-object-injection
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

        // eslint-disable-next-line security/detect-object-injection
        outdentedStrings[index] = v;
    }

    return outdentedStrings;
};

// Optimized string concatenation
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const concatStringsAndValues = (strings: ReadonlyArray<string>, values: ReadonlyArray<any>): string => {
    const chunks: string[] = Array.from({ length: strings.length + values.length });

    // Interleave strings and values
    let index = 0;
    const l = strings.length;

    // eslint-disable-next-line no-loops/no-loops,no-plusplus
    for (; index < l - 1; index++) {
        // eslint-disable-next-line security/detect-object-injection
        chunks[index * 2] = strings[index] as string;
        // eslint-disable-next-line security/detect-object-injection
        chunks[index * 2 + 1] = String(values[index]);
    }

    // eslint-disable-next-line security/detect-object-injection
    chunks[index * 2] = strings[index] as string;

    // Join is faster than repeated string concatenation
    return chunks.join("");
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const isTemplateStringsArray = (v: any): v is TemplateStringsArray => has(v, "raw") && has(v, "length");

/**
 * A single shared WeakMap cache for template literals.
 * Using WeakMap allows cached templates to be garbage collected when they're no longer referenced.
 *
 * Note: We avoid caching templates with specific newline options to ensure correct results.
 */
const templateCache = new WeakMap<TemplateStringsArray, string[]>();

/**
 * Creates a new instance of the outdent function with the specified options.
 *
 * @param options Configuration options for the outdent function
 * @returns A new outdent function instance with the specified configuration
 *
 * @example
 * // Create a default outdent function
 * const dedent = outdent();
 *
 * // Create an outdent function with custom options
 * const customDedent = outdent({
 *   trimLeadingNewline: false,
 *   cache: true
 * });
 *
 * // Use the outdent function with template literals
 * const text = dedent`
 *   This text will have its indentation removed
 *   while preserving relative indentation.
 * `;
 */
// eslint-disable-next-line sonarjs/cognitive-complexity
const createInstance = (options: Options): Outdent => {
    /**
     * Cache configuration
     */
    // Determine if caching is enabled (default is true)
    const enableCache = options.cache !== false;

    // Use provided cache store or fall back to global template cache
    const cache = enableCache ? (options.cacheStore ?? templateCache) : null;

    // Create a flag to indicate special newline handling
    // We disable caching for templates with special newline options to ensure correct output
    const hasNewlineOption = options.newline !== undefined;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function outdent(stringsOrOptions: TemplateStringsArray, ...values: any[]): string;
    function outdent(stringsOrOptions: Options): Outdent;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any,func-style
    function outdent(stringsOrOptions: Options | TemplateStringsArray, ...values: any[]): Outdent | string {
        if (isTemplateStringsArray(stringsOrOptions)) {
            const strings = stringsOrOptions;
            const valuesLength = values.length;

            // Fast path for empty template literals
            if (strings.length === 1 && strings[0] === "") {
                return "";
            }

            // Fast path for no interpolated values
            if (valuesLength === 0) {
                // Check cache if enabled and no special newline options are set
                if (enableCache && cache && !hasNewlineOption) {
                    const cached = cache.get(strings);
                    if (cached) {
                        return cached[0] as string; // Return the cached result
                    }
                }

                // Process the string
                const result = internalOutdentArray(strings, false, options);

                // Cache the result if caching is enabled
                if (enableCache && cache) {
                    cache.set(strings, result);
                }

                return result[0] as string;
            }

            // Check for the special case where first value is outdent
            // eslint-disable-next-line @typescript-eslint/no-use-before-define
            const firstValueIsOutdent = values[0] === outdent || values[0] === defaultOutdent;
            const firstInterpolatedValueSetsIndentationLevel =
                firstValueIsOutdent &&
                RE_ONLY_WHITESPACE_WITH_AT_LEAST_ONE_NEWLINE.test(strings[0] as string) &&
                RE_STARTS_WITH_NEWLINE_OR_IS_EMPTY.test(strings[1] as string);

            let renderedArray;

            // Try to get from cache if enabled and no special newline options are set
            if (enableCache && cache && !hasNewlineOption) {
                renderedArray = cache.get(strings);
            }

            // If not found in cache, process the strings
            if (!renderedArray) {
                renderedArray = internalOutdentArray(strings, firstInterpolatedValueSetsIndentationLevel, options);

                // Cache the result if enabled
                if (enableCache && cache) {
                    cache.set(strings, renderedArray);
                }
            }

            // Concatenate string literals with interpolated values
            return concatStringsAndValues(renderedArray, firstInterpolatedValueSetsIndentationLevel ? values.slice(1) : values);
        }

        // Create a new instance with merged options
        return createInstance(extend(extend({}, options), stringsOrOptions));
    }

    // Add optimized string method to the outdent function
    return extend(outdent, {
        string(string_: string): string {
            // Fast path for empty strings
            if (string_ === "" || !string_) {
                return "";
            }

            return internalOutdentArray([string_], false, options)[0] as string;
        },
    });
};

const defaultOutdent: Outdent = createInstance({
    trimLeadingNewline: true,
    trimTrailingNewline: true,
});

export const outdent = defaultOutdent;

export interface Outdent {
    /**
     * Remove indentation from a template literal.
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (strings: TemplateStringsArray, ...values: any[]): string;
    /**
     * Create and return a new Outdent instance with the given options.
     */
    (options: Options): Outdent;

    /**
     * Remove indentation from a string
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
     *
     * @example
     * // Create an outdent function with caching enabled (default)
     * const dedent = outdent();
     *
     * // Create an outdent function with caching disabled
     * const noCacheDedent = outdent({ cache: false });
     *
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
     *
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
     *
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
