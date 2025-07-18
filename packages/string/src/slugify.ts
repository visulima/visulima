import transliterate from "./transliterate";
import type { SlugifyOptions } from "./types";
import { escapeRegExp } from "./utilities";

/**
 * Removes all characters from a string that are not in the allowed characters list
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
    const config: Required<SlugifyOptions> = {
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
        // eslint-disable-next-line no-console
        console.warn("slugify: Both lowercase and uppercase options are true. Defaulting to lowercase.");
        config.uppercase = false;
    }

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
