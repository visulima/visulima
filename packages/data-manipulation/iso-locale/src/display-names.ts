/**
 * Cache of `Intl.DisplayNames` instances keyed by `${type}:${locale}`.
 *
 * The constructor performs locale negotiation and data loading, which dwarfs the
 * `.of()` lookup, so bulk usage (e.g. localizing every country name for a
 * dropdown) reuses one instance per type/locale instead of building a fresh one
 * on every call. Invalid locales are memoized as `undefined` so repeated failing
 * lookups stay cheap.
 */
const displayNamesCache = new Map<string, Intl.DisplayNames | undefined>();

/**
 * Resolve a memoized `Intl.DisplayNames` instance for the given type and locale.
 * @param type Display name type (e.g. "region", "language")
 * @param locale BCP 47 locale to translate names into
 * @returns A cached `Intl.DisplayNames` instance, or `undefined` when the runtime
 * lacks the API or the locale is invalid
 */
export const getDisplayNames = (type: Intl.DisplayNamesType, locale: string): Intl.DisplayNames | undefined => {
    if (typeof Intl === "undefined" || typeof Intl.DisplayNames !== "function") {
        return undefined;
    }

    const key = `${type}:${locale}`;

    if (displayNamesCache.has(key)) {
        return displayNamesCache.get(key);
    }

    let instance: Intl.DisplayNames | undefined;

    try {
        instance = new Intl.DisplayNames([locale], { type });
    } catch {
        // Invalid locale — memoize the miss.
        instance = undefined;
    }

    displayNamesCache.set(key, instance);

    return instance;
};
