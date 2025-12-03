import LRUCache from "../utils/lru-cache";
import { splitByCase } from "./split-by-case";
import type { CaseOptions, TrainCase } from "./types";
import upperFirst from "./upper-first";
import generateCacheKey from "./utils/generate-cache-key";
import joinSegments from "./utils/join-segments";

const defaultCacheStore = new LRUCache<string, string>(1000);

/**
 * Converts a string to Train-Case.
 * @example
 * ```typescript
 * trainCase("foo bar") // => "Foo-Bar"
 * trainCase("foo-bar") // => "Foo-Bar"
 * trainCase("foo_bar") // => "Foo-Bar"
 * trainCase("XMLHttpRequest") // => "XML-Http-Request"
 * trainCase("AJAXRequest") // => "AJAX-Request"
 * trainCase("QueryXML123String") // => "Query-XML-123-String"
 * ```
 */
const trainCase = <T extends string = string>(value?: T, options?: CaseOptions): TrainCase<T> => {
    if (typeof value !== "string") {
        return "" as TrainCase<T>;
    }

    const shouldCache = options?.cache ?? false;
    const cacheStore = options?.cacheStore ?? defaultCacheStore;
    let cacheKey: string | undefined;

    if (shouldCache) {
        cacheKey = generateCacheKey(value, options);
    }

    // For cases with caching enabled, use cache with composite key
    if (shouldCache && cacheKey && cacheStore.has(cacheKey)) {
        return cacheStore.get(cacheKey) as TrainCase<T>;
    }

    const result = joinSegments<TrainCase<T>>(
        splitByCase(value, {
            handleAnsi: options?.handleAnsi,
            handleEmoji: options?.handleEmoji,
            knownAcronyms: options?.knownAcronyms,
            locale: options?.locale,
            normalize: options?.normalize,
            separators: undefined,
            stripAnsi: options?.stripAnsi,
            stripEmoji: options?.stripEmoji,
        }).map((p) => upperFirst(p, { locale: options?.locale })),
        "-",
    );

    // Cache the result for future use if caching is enabled
    if (shouldCache && cacheKey) {
        cacheStore.set(cacheKey, result);
    }

    return result;
};

export default trainCase;
