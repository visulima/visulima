import ansiRegex from "ansi-regex";
import emojiRegex from "emoji-regex";

// Pre-compile regular expressions for better performance
export const SEPARATORS_REGEX = /[-_./\s]+/;

// Regex for detecting case boundaries
export const CASE_BOUNDARY_REGEX = /([a-z0-9])([A-Z])|([A-Z])([A-Z][a-z])|([0-9])([a-zA-Z])|([a-zA-Z])([0-9])/g;

// Regex for detecting uppercase runs
export const UPPERCASE_RUN_REGEX = /[A-Z]+/g;

// Regex for detecting word boundaries
export const WORD_BOUNDARY_REGEX = /\b\w+\b/g;

// Regex for detecting numbers
export const NUMBER_REGEX = /\d+/g;

// Pre-compile ANSI and emoji regex
export const ANSI_REGEX = ansiRegex();
export const EMOJI_REGEX = emojiRegex();

// Cache for dynamically created regexes
const regexCache = new Map<string, RegExp>();

/**
 * Creates or retrieves a cached regex for custom separators
 */
export const getSeparatorsRegex = (separators: ReadonlyArray<string>): RegExp => {
    const key = separators.join("");
    let regex = regexCache.get(key);
    
    if (!regex) {
        const pattern = separators.map((s) => s.replaceAll(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
        regex = new RegExp(pattern, "g");
        regexCache.set(key, regex);
    }
    
    return regex;
};

/**
 * Split text by ANSI escape sequences
 */
export const splitByAnsi = (text: string): string[] => {
    const segments: string[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    ANSI_REGEX.lastIndex = 0;
    while ((match = ANSI_REGEX.exec(text)) !== null) {
        if (match.index > lastIndex) {
            segments.push(text.slice(lastIndex, match.index));
        }
        segments.push(match[0]);
        lastIndex = ANSI_REGEX.lastIndex;
    }

    if (lastIndex < text.length) {
        segments.push(text.slice(lastIndex));
    }

    return segments.filter(Boolean);
};

/**
 * Split text by emoji characters
 */
export const splitByEmoji = (text: string): string[] => {
    const segments: string[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    EMOJI_REGEX.lastIndex = 0;
    while ((match = EMOJI_REGEX.exec(text)) !== null) {
        if (match.index > lastIndex) {
            segments.push(text.slice(lastIndex, match.index));
        }
        segments.push(match[0]);
        lastIndex = EMOJI_REGEX.lastIndex;
    }

    if (lastIndex < text.length) {
        segments.push(text.slice(lastIndex));
    }

    return segments.filter(Boolean);
};
