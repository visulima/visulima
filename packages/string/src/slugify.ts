import transliterate from "./transliterate";
import type { OptionsTransliterate } from "./types";

/**
 * Escapes characters in a string for use within a RegExp character class.
 * @param input The string to escape.
 * @returns The escaped string.
 */
function escapeRegExpClassChars(input: string): string {
    // Escape -, \, ], ^
    return input.replaceAll(/[/\\]\\^\]/g, "\\$&");
}

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
        ...options,
    };

    if (options_.lowercase && options_.uppercase) {
        console.warn("slugify: Both lowercase and uppercase options are true. Defaulting to lowercase.");
        options_.uppercase = false;
    }

    let slug = transliterate(input, options_);

    // Convert case if required FIRST
    if (options_.lowercase) {
        slug = slug.toLowerCase();
    } else if (options_.uppercase) {
        slug = slug.toUpperCase();
    }

    // Replace disallowed characters with separator
    // Escape allowedChars for regex and add the separator itself to the allowed list
    const escapedAllowed = escapeRegExpClassChars(options_.allowedChars + options_.separator);
    const disallowedRegex = new RegExp(`[^${escapedAllowed}]+`, "g");
    slug = slug.replace(disallowedRegex, options_.separator);

    // Collapse multiple separators
    // Escape separator for regex
    const escapedSeparator = options_.separator.replaceAll(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const separatorRegex = new RegExp(`${escapedSeparator}+`, "g");

    slug = slug.replace(separatorRegex, options_.separator);

    // Trim leading/trailing separators
    const trimRegex = new RegExp(`^${escapedSeparator}+|${escapedSeparator}+$`, "g");

    return slug.replace(trimRegex, "");
};

export default slugify;
