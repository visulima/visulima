import transliterate from "./transliterate";
import type { OptionsTransliterate } from "./types";
import { escapeRegExp } from "./utils";

/**
 * Options for the slugify function.
 */
export interface SlugifyOptions extends OptionsTransliterate {
    /**
     * Allowed characters. Other characters will be converted to `separator`.
     * @default "a-zA-Z0-9-_.~"
     */
    allowedChars?: string;
    /**
     * Fix Chinese spacing passed to transliterate. If you don't need to transliterate Chinese characters, set it to false to improve performance.
     * @default true // Matches transliterate's default
     */
    fixChineseSpacing?: boolean;
    /**
     * Whether the result should be converted into lowercase.
     * Cannot be true if `uppercase` is true.
     * @default true
     */
    lowercase?: boolean;
    /**
     * Custom separator string.
     * @default "-"
     */
    separator?: string;
    /**
     * Whether the result should be converted into uppercase.
     * Cannot be true if `lowercase` is true.
     * @default false
     */
    uppercase?: boolean;

    /**
     * Whether to transliterate the input string.
     * @default true
     */
    transliterate?: boolean;
}

/**
 * Removes all characters from a string that are not in the allowed characters list
 * @param {string} input - The string to sanitize
 * @param {string} allowedChars - String containing allowed characters or patterns like "a-zA-Z0-9"
 * @return {string} - The sanitized string with only allowed characters
 */
const removeDisallowedChars = (input: string, allowedChars: string, separator: string): string => {
    const escapedChars = escapeRegExp(allowedChars).replaceAll(/\\\-/g, '-'); // Restore dashes

    const pattern = new RegExp(`[^${escapedChars}]`, 'g');

    return input.replaceAll(pattern, separator);
}

/**
 * Converts a string into a URL-friendly slug.
 *
 * It transliterates non-ASCII characters, optionally converts case,
 * removes disallowed characters (replacing with separator), and collapses separators.
 *
 * @param input The string to convert.
 * @param options Optional configuration options.
 * @returns The generated slug.
 */
const slugify = (input: string, options?: SlugifyOptions): string => {
    const options_: Required<SlugifyOptions> = {
        allowedChars: "a-zA-Z0-9-_.~",
        fixChineseSpacing: true,
        ignore: [],
        lowercase: true,
        replaceAfter: [],
        replaceBefore: [],
        separator: "-",
        trim: false,
        unknown: "",
        uppercase: false,
        transliterate: true,
        ...options,
    };

    if (options_.lowercase && options_.uppercase) {
        console.warn("slugify: Both lowercase and uppercase options are true. Defaulting to lowercase.");
        options_.uppercase = false;
    }

    let slug = options_.transliterate ? transliterate(input, options_) : input;

    // Convert case if required FIRST
    if (options_.lowercase) {
        slug = slug.toLowerCase();
    } else if (options_.uppercase) {
        slug = slug.toUpperCase();
    }

    slug = removeDisallowedChars(slug, options_.allowedChars, options_.separator)

    const escapedSeparator = escapeRegExp(options_.separator);
    const separatorRegex = new RegExp(`${escapedSeparator}+`, "g");

    slug = slug.replace(separatorRegex, options_.separator);

    // Trim leading/trailing separators
    return slug.replace(new RegExp(`^${escapedSeparator}+|${escapedSeparator}+$`, "g"), "");
};

export default slugify;
