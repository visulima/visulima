import transliterate from "./transliterate";
import type { OptionReplaceArray, SlugifyOptions } from "./types";
import { escapeRegExp } from "./utilities";
import getLocaleReplacements from "./utils/locale-charmap";

/**
 * Merges locale-specific replacements (e.g. German `ö -> oe`) ahead of any
 * user-provided `replaceBefore` pairs so they are applied before the global
 * charmap. User `replaceBefore` entries still take precedence for the same
 * search term because they are applied after the locale entries.
 * @param locale The locale tag, or empty string for none.
 * @param replaceBefore The user-supplied `replaceBefore` option.
 * @returns A merged `replaceBefore` array.
 */
const mergeLocaleReplacements = (locale: string, replaceBefore: SlugifyOptions["replaceBefore"]): OptionReplaceArray => {
    const localePairs = locale ? getLocaleReplacements(locale) : [];

    const userPairs: OptionReplaceArray = Array.isArray(replaceBefore)
        ? replaceBefore
        : Object.entries(replaceBefore ?? {});

    return [...localePairs, ...userPairs];
};

/**
 * Removes all characters from a string that are not in the allowed characters list.
 * @param input The string to sanitize
 * @param allowedChars String containing allowed characters or patterns like "a-zA-Z0-9"
 * @returns - The sanitized string with only allowed characters
 */
const removeDisallowedChars = (input: string, allowedChars: string, separator: string): string => {
    const escapedChars = escapeRegExp(allowedChars).replaceAll(String.raw`\-`, "-"); // Restore dashes
    const pattern = new RegExp(`[^${escapedChars}]`, "g");

    return input.replaceAll(pattern, separator);
};

/**
 * Converts a string into a URL-friendly slug.
 *
 * It transliterates non-ASCII characters, optionally converts case,
 * removes disallowed characters (replacing with separator), and collapses separators.
 * @param input The string to convert.
 * @param options Optional configuration options.
 * @returns The generated slug.
 */
const slugify = (input: string, options?: SlugifyOptions): string => {
    const config: Required<Omit<SlugifyOptions, "locale">> & { locale?: string } = {
        allowedChars: "a-zA-Z0-9-_.~",
        fixChineseSpacing: true,
        ignore: [],
        lowercase: true,
        replaceAfter: [],
        replaceBefore: [],
        separator: "-",
        transliterate: true,
        trim: false,
        unknown: "",
        uppercase: false,
        ...options,
    };

    if (config.lowercase && config.uppercase) {
        throw new TypeError("slugify: The `lowercase` and `uppercase` options are mutually exclusive; enable at most one.");
    }

    // Apply locale-aware replacements (if any) ahead of the global charmap.
    config.replaceBefore = mergeLocaleReplacements(config.locale ?? "", config.replaceBefore);

    let slug = config.transliterate ? transliterate(input, config) : input.normalize("NFC");

    // Convert case if required FIRST
    if (config.lowercase) {
        slug = slug.toLowerCase();
    } else if (config.uppercase) {
        slug = slug.toUpperCase();
    }

    slug = removeDisallowedChars(slug, config.allowedChars, config.separator);

    const escapedSeparator = escapeRegExp(config.separator);

    if (escapedSeparator) {
        const separatorRegex = new RegExp(`${escapedSeparator}+`, "g");

        slug = slug.replace(separatorRegex, config.separator);
    }

    // Trim leading/trailing separators
    if (escapedSeparator) {
        return slug.replaceAll(new RegExp(`^${escapedSeparator}+|${escapedSeparator}+$`, "g"), "");
    }

    return slug; // If separator is empty, nothing to trim based on it
};

export default slugify;
