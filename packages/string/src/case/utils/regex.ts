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

// Script pattern regex for efficient character type detection
export const CYRILLIC_REGEX = /[\p{Script=Cyrillic}]/u;
export const LATIN_REGEX = /[\p{Script=Latin}]/u;
export const GREEK_REGEX = /[\p{Script=Greek}]/u;
export const HIRAGANA_REGEX = /[\p{Script=Hiragana}]/u;
export const KATAKANA_REGEX = /[\p{Script=Katakana}]/u;
export const KANJI_REGEX = /[\p{Script=Han}]/u;
export const HANGUL_REGEX = /[\p{Script=Hangul}]/u;
// Special modifiers for Uzbek Latin script
export const UZBEK_LATIN_MODIFIER_REGEX = /[\u02BB\u02BC\u0027]/u;

// eslint-disable-next-line no-control-regex,regexp/no-control-character
export const FAST_ANSI_REGEX = /(\u001B\[[0-9;]*[a-z])/i;
