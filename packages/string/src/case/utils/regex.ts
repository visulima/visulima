import ansiRegex from "ansi-regex";
import emojiRegex from "emoji-regex";

// Pre-compile regular expressions for better performance
export const SEPARATORS_REGEX = /[-_./\s]+/g;

// Pre-compile ANSI and emoji regex
export const ANSI_REGEX = ansiRegex();
export const EMOJI_REGEX = emojiRegex();

// Cache for dynamically created regexes with LRU-like behavior
const regexCache = new Map<string, RegExp>();
const regexCacheOrder: string[] = [];

/**
 * Creates or retrieves a cached regex for custom separators
 */
export const getSeparatorsRegex = (separators: ReadonlyArray<string>): RegExp => {
    const key = separators.join("");

    let regex = regexCache.get(key);

    if (regex) {
        // Move to end of LRU list
        const index = regexCacheOrder.indexOf(key);

        if (index > -1) {
            regexCacheOrder.splice(index, 1);
            regexCacheOrder.push(key);
        }
    } else {
        const pattern = separators.map((s) => s.replaceAll(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
        regex = new RegExp(pattern, "g");

        // Implement simple LRU-like caching
        if (regexCache.size >= 100) {
            const oldestKey = regexCacheOrder.shift();

            if (oldestKey) {
                regexCache.delete(oldestKey);
            }
        }

        regexCache.set(key, regex);
        regexCacheOrder.push(key);
    }

    return regex;
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

export const stripAnsi = (string_: string): string => string_.replace(ANSI_REGEX, "");

export const stripEmoji = (string_: string): string => string_.replace(EMOJI_REGEX, "");
