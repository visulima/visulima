/**
 * Locale-specific character replacements applied *before* the global charmap.
 *
 * The global transliteration charmap produces a single fixed romanization for
 * each character (e.g. `ö -> o`). Some locales expect different conventions:
 * German wants `ö -> oe`, `ä -> ae`, `ü -> ue`, `ß -> ss`; Turkish wants
 * `ı -> i`, `İ -> i`; etc. These maps are merged ahead of the default charmap so
 * the locale-specific result wins.
 *
 * Each entry maps a source character to its ASCII replacement. Both the
 * lower- and upper-case forms are provided where they differ so case handling is
 * correct regardless of the `lowercase`/`uppercase` slugify options.
 *
 * The structure mirrors the per-locale tables shipped by the popular `slugify`
 * npm package, kept intentionally small and focused on the common cases.
 */
const localeCharmaps: Record<string, Record<string, string>> = {
    // Danish / Norwegian
    da: {
        Å: "AA",
        å: "aa",
        Æ: "AE",
        æ: "ae",
        Ø: "OE",
        ø: "oe",
    },
    // German
    de: {
        Ä: "AE",
        ä: "ae",
        Ö: "OE",
        ö: "oe",
        ß: "ss",
        Ü: "UE",
        ü: "ue",
    },
    // Norwegian-Bokmål (shares the Danish table)
    nb: {
        Å: "AA",
        å: "aa",
        Æ: "AE",
        æ: "ae",
        Ø: "OE",
        ø: "oe",
    },
    // Serbian (Latin) — keeps accented latin letters distinct
    sr: {
        Ć: "C",
        ć: "c",
        Č: "C",
        č: "c",
        Đ: "DJ",
        đ: "dj",
        Š: "S",
        š: "s",
        Ž: "Z",
        ž: "z",
    },
    // Turkish
    tr: {
        Ç: "C",
        ç: "c",
        Ğ: "G",
        ğ: "g",
        I: "I",
        İ: "I",
        ı: "i",
        Ö: "O",
        ö: "o",
        Ş: "S",
        ş: "s",
        Ü: "U",
        ü: "u",
    },
    // Vietnamese — a representative subset of the most common diacritics
    vi: {
        Đ: "D",
        đ: "d",
    },
};

/**
 * Returns the locale-specific replacement pairs for the given locale, or an empty
 * array when the locale is unknown. Pairs are returned as `[search, replace]`
 * tuples suitable for prepending to a transliterate `replaceBefore` option.
 * @param locale The BCP-47-ish locale tag (e.g. "de", "tr"). Only the primary
 * subtag is considered, case-insensitively (so "de-DE" resolves to "de").
 * @returns An array of `[character, replacement]` tuples.
 */
const getLocaleReplacements = (locale: string): [string, string][] => {
    const primary = locale.split("-")[0]?.toLowerCase() ?? "";
    const map = localeCharmaps[primary];

    if (!map) {
        return [];
    }

    return Object.entries(map);
};

export default getLocaleReplacements;
