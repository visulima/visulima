import { splitByCase } from "./split-by-case";
import type { CaseOptions, TitleCase } from "./types";
import upperFirst from "./upper-first";
import generateCacheKey from "./utils/generate-cache-key";
import manageCache from "./utils/manage-cache";
import normalizeGermanEszett from "./utils/normalize-german-eszett";

// Cache for frequently used title case conversions
const titleCache = new Map<string, string>();
const DEFAULT_CACHE_MAX_SIZE = 1000;

// eslint-disable-next-line no-secrets/no-secrets
/**
 * With Title Case all words are capitalized, except for minor words.
 * A compact regex of common minor words (such as a for, to) is used
 * to automatically keep them lower case.
 * @example
 * ```typescript
 * titleCase("this-IS-aTitle") // => "This is a Title"
 * titleCase("XMLHttpRequest") // => "XML Http Request"
 * titleCase("AJAXRequest") // => "AJAX Request"
 * titleCase("QueryXML123String") // => "Query XML 123 String"
 * ```
 */
// eslint-disable-next-line func-style
function titleCase<T extends string = string>(string_?: T, options?: CaseOptions): TitleCase<T> {
    if (typeof string_ !== "string") {
        return "" as TitleCase<T>;
    }

    const shouldCache = options?.cache ?? false;
    const cacheMaxSize = options?.cacheMaxSize ?? DEFAULT_CACHE_MAX_SIZE;
    const cacheStore = options?.cacheStore ?? titleCache;

    let cacheKey: string | undefined;

    if (shouldCache) {
        cacheKey = generateCacheKey(string_, options);
    }

    // For cases with caching enabled, use cache with composite key
    if (shouldCache && cacheKey) {
        const cached = cacheStore.get(cacheKey);

        if (cached) {
            return cached as TitleCase<T>;
        }
    }

    const result = splitByCase(string_, {
        handleAnsi: options?.handleAnsi,
        handleEmoji: options?.handleEmoji,
        knownAcronyms: options?.knownAcronyms,
        locale: options?.locale,
        normalize: options?.normalize,
        separators: undefined,
        stripAnsi: options?.stripAnsi,
        stripEmoji: options?.stripEmoji,
    })
        .map((word: string) => {
            if (options?.locale?.startsWith("de")) {
                // eslint-disable-next-line no-param-reassign
                word = normalizeGermanEszett(word);
            }

            return upperFirst(options?.locale ? word.toLocaleLowerCase(options.locale) : word.toLowerCase(), { locale: options?.locale });
        })
        .join(" ") as TitleCase<T>;

    // Cache the result for future use if caching is enabled
    if (shouldCache && cacheKey) {
        manageCache(cacheStore, cacheKey, result, cacheMaxSize);
    }

    return result;
}

export default titleCase;
