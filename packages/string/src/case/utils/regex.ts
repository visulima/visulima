// @ts-expect-error: TODO: find why this typing is not working
import { stripVTControlCharacters } from "node:util";

// eslint-disable-next-line import/no-extraneous-dependencies
import emojiRegex from "emoji-regex-xs";

// Cache for dynamically created regexes with LRU-like behavior
const regexCache = new Map<string, RegExp>();
const regexCacheOrder: string[] = [];

// Pre-compile regular expressions for better performance
export const SEPARATORS_REGEX = /[-_./\s]+/g;

// Pre-compile ANSI and emoji regex
export const EMOJI_REGEX = emojiRegex();

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

        // eslint-disable-next-line @rushstack/security/no-unsafe-regexp,security/detect-non-literal-regexp
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

    // eslint-disable-next-line no-loops/no-loops,no-cond-assign
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

/**
 * Strips ANSI escape sequences from a string.
 * Uses Node.js's native stripVTControlCharacters for optimal performance.
 *
 * @param string_ - The string to strip ANSI sequences from
 * @returns The string without ANSI sequences
 */
export const stripAnsi = (string_: string): string => stripVTControlCharacters(string_);

export const stripEmoji = (string_: string): string => string_.replace(EMOJI_REGEX, "");

// Script pattern regex for efficient character type detection
export const ARABIC_REGEX = /\p{Script=Arabic}/u;
export const BENGALI_REGEX = /\p{Script=Bengali}/u;
export const CYRILLIC_REGEX = /\p{Script=Cyrillic}/u;
export const DEVANAGARI_REGEX = /\p{Script=Devanagari}/u;
export const ETHIOPIC_REGEX = /\p{Script=Ethiopic}/u;
// Precompiled regex patterns for Greek script handling
export const GREEK_REGEX = /\p{Script=Greek}/u;
export const GREEK_LATIN_SPLIT_REGEX = /\p{Script=Greek}+|\p{Script=Latin}+|[^\p{Script=Greek}\p{Script=Latin}]+/gu;
export const GUJARATI_REGEX = /\p{Script=Gujarati}/u;
export const GURMUKHI_REGEX = /\p{Script=Gurmukhi}/u;
export const HANGUL_REGEX = /\p{Script=Hangul}/u;
export const HEBREW_REGEX = /\p{Script=Hebrew}/u;
export const HIRAGANA_REGEX = /\p{Script=Hiragana}/u;
export const KANJI_REGEX = /\p{Script=Han}/u;
export const KANNADA_REGEX = /\p{Script=Kannada}/u;
export const KATAKANA_REGEX = /\p{Script=Katakana}/u;
export const KHMER_REGEX = /\p{Script=Khmer}/u;
export const LAO_REGEX = /\p{Script=Lao}/u;
export const LATIN_REGEX = /\p{Script=Latin}/u;
export const MALAYALAM_REGEX = /\p{Script=Malayalam}/u;
export const MYANMAR_REGEX = /\p{Script=Myanmar}/u;
export const ORIYA_REGEX = /\p{Script=Oriya}/u;
export const SINHALA_REGEX = /\p{Script=Sinhala}/u;
export const TAMIL_REGEX = /\p{Script=Tamil}/u;
export const TELUGU_REGEX = /\p{Script=Telugu}/u;
export const THAI_REGEX = /\p{Script=Thai}/u;
export const TIBETAN_REGEX = /\p{Script=Tibetan}/u;
// Special modifiers for Uzbek Latin script
export const UZBEK_LATIN_MODIFIER_REGEX = /[\u02BB\u02BC\u0027]/u;

// eslint-disable-next-line no-control-regex,regexp/no-control-character
export const FAST_ANSI_REGEX = /(\u001B\[[0-9;]*[a-z])/i;
