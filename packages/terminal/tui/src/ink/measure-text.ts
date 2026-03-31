/* eslint-disable @typescript-eslint/no-non-null-assertion, @typescript-eslint/no-use-before-define, e18e/prefer-static-regex, import/exports-last, no-for-of-array/no-for-of-array, no-plusplus, sonarjs/cognitive-complexity */
import type { StyledChar } from "@alcalzone/ansi-tokenize";
import { styledCharsFromTokens, tokenize } from "@alcalzone/ansi-tokenize";
import { getStringWidth } from "@visulima/string";

import DataLimitedLruMap from "./data-limited-lru-map";

export type StringWidthFunction = (text: string) => number;

type Output = {
    height: number;
    width: number;
};

// Use LRU cache with bounded size to prevent unbounded memory growth
// in long-running applications. Limits: 10,000 entries, 1MB of key data.
const cache = new DataLimitedLruMap<Output>(10_000, 1_000_000);

// Cache for character width lookups (single characters, bounded by Unicode range)
const widthCache = new Map<string, number>();

// Cache for styled character tokenization
const styledCharsCache = new DataLimitedLruMap<StyledChar[]>(10_000, 1_000_000);

let styledCharsCacheEnabled = true;

let currentStringWidth: StringWidthFunction = getStringWidth;

/**
 * Enable or disable the StyledChar tokenization cache at runtime.
 * Disabling clears the existing cache.
 */
export const setEnableToStyledCharactersCache = (enabled: boolean): void => {
    styledCharsCacheEnabled = enabled;

    if (!enabled) {
        styledCharsCache.clear();
    }
};

/**
 * Clear only the StyledChar tokenization cache.
 */
export const clearToStyledCharactersCache = (): void => {
    styledCharsCache.clear();
};

/**
 * Replace the string width function used for text measurement.
 * Useful for terminals with non-standard character widths.
 * Clears the measurement cache when called.
 */
export const setStringWidthFunction = (function_: StringWidthFunction): void => {
    currentStringWidth = function_;
    clearStringWidthCache();
};

/**
 * Clear the string width measurement cache. Call this if the terminal
 * environment changes in a way that affects character widths.
 */
export const clearStringWidthCache = (): void => {
    cache.clear();
    widthCache.clear();
    styledCharsCache.clear();
};

/**
 * Get the visual width of a single character, with caching and error handling.
 *
 * Ported from jacob314/ink fork (Google LLC, Apache-2.0).
 */
export const inkCharacterWidth = (text: string): number => {
    const cached = widthCache.get(text);

    if (cached !== undefined) {
        return cached;
    }

    let calculatedWidth: number;

    try {
        calculatedWidth = currentStringWidth(text);
    } catch {
        // Avoid crashing on invalid characters (e.g. lone surrogates).
        calculatedWidth = 1;
    }

    widthCache.set(text, calculatedWidth);

    return calculatedWidth;
};

/**
 * Get the total visual width of a StyledChar array.
 */
export const styledCharsWidth = (styledChars: ReadonlyArray<StyledChar>): number => {
    let length = 0;

    for (const char of styledChars) {
        length += inkCharacterWidth(char.value);
    }

    return length;
};

/**
 * Convert a text string (possibly containing ANSI codes) to an array of StyledChar.
 * Handles combining characters, emoji sequences (ZWJ, regional indicators, skin tones),
 * and tabs.
 *
 * Ported from jacob314/ink fork (Google LLC, Apache-2.0).
 */
export const toStyledCharacters = (text: string): StyledChar[] => {
    if (styledCharsCacheEnabled) {
        const cached = styledCharsCache.get(text);

        if (cached !== undefined) {
            return cached;
        }
    }

    const tokens = tokenize(text);
    const characters = styledCharsFromTokens(tokens);
    const combinedCharacters: StyledChar[] = [];

    for (let index = 0; index < characters.length; index++) {
        const character = characters[index];

        if (!character) {
            continue;
        }

        // Convert tabs to 4 spaces
        if (character.value === "\t") {
            const spaceCharacter: StyledChar = { ...character, value: " " };

            combinedCharacters.push(spaceCharacter, spaceCharacter, spaceCharacter, spaceCharacter);
            continue;
        }

        // Skip backspace characters
        if (character.value === "\b") {
            continue;
        }

        let { value } = character;
        let isCombined = false;
        const firstCodePoint = value.codePointAt(0);

        // Regional Indicators (Flag emoji) — combine in pairs
        if (firstCodePoint && firstCodePoint >= 0x1_f1_e6 && firstCodePoint <= 0x1_f1_ff && index + 1 < characters.length) {
            const nextCharacter = characters[index + 1];

            if (nextCharacter) {
                const nextFirstCodePoint = nextCharacter.value.codePointAt(0);

                if (nextFirstCodePoint && nextFirstCodePoint >= 0x1_f1_e6 && nextFirstCodePoint <= 0x1_f1_ff) {
                    value += nextCharacter.value;
                    index++;
                    combinedCharacters.push({ ...character, value });
                    continue;
                }
            }
        }

        // Combining characters: Unicode marks, skin tone modifiers, ZWJ sequences, tags block
        while (index + 1 < characters.length) {
            const nextCharacter = characters[index + 1];

            if (!nextCharacter) {
                break;
            }

            const nextFirstCodePoint = nextCharacter.value.codePointAt(0);

            if (!nextFirstCodePoint) {
                break;
            }

            const isUnicodeMark = /\p{Mark}/u.test(nextCharacter.value);
            const isSkinToneModifier = nextFirstCodePoint >= 0x1_f3_fb && nextFirstCodePoint <= 0x1_f3_ff;
            const isZeroWidthJoiner = nextFirstCodePoint === 0x20_0d;
            const isTagsBlock = nextFirstCodePoint >= 0xe_00_00 && nextFirstCodePoint <= 0xe_00_7f;

            const isCombining = isUnicodeMark || isSkinToneModifier || isZeroWidthJoiner || isTagsBlock;

            if (!isCombining) {
                break;
            }

            value += nextCharacter.value;
            index++;
            isCombined = true;

            // If it was a ZWJ, also consume the character after it
            if (isZeroWidthJoiner && index + 1 < characters.length) {
                const characterAfterZwj = characters[index + 1];

                if (characterAfterZwj) {
                    value += characterAfterZwj.value;
                    index++;
                }
            }
        }

        if (isCombined) {
            combinedCharacters.push({ ...character, value });
        } else {
            combinedCharacters.push(character);
        }
    }

    if (styledCharsCacheEnabled) {
        styledCharsCache.set(text, combinedCharacters);
    }

    return combinedCharacters;
};

/**
 * Split a StyledChar array by newline characters into lines.
 */
export const splitStyledCharsByNewline = (styledChars: StyledChar[]): StyledChar[][] => {
    const lines: StyledChar[][] = [[]];

    for (const char of styledChars) {
        if (char.value === "\n") {
            lines.push([]);
        } else {
            lines.at(-1)!.push(char);
        }
    }

    return lines;
};

/**
 * Measure the dimensions of a StyledChar array (width of widest line, height in lines).
 */
export const measureStyledChars = (styledChars: StyledChar[]): { height: number; width: number } => {
    if (styledChars.length === 0) {
        return { height: 0, width: 0 };
    }

    const lines = splitStyledCharsByNewline(styledChars);
    let maxWidth = 0;

    for (const line of lines) {
        maxWidth = Math.max(maxWidth, styledCharsWidth(line));
    }

    return { height: lines.length, width: maxWidth };
};

/**
 * Convert a StyledChar array back to a plain string (discarding style information).
 */
export const styledCharsToString = (styledChars: ReadonlyArray<StyledChar>): string => {
    let result = "";

    for (const char of styledChars) {
        result += char.value;
    }

    return result;
};

/**
 * Get the visual width of a string, with error handling for invalid characters.
 */
const safeGetStringWidth = (text: string): number => {
    try {
        return currentStringWidth(text);
    } catch {
        return 1;
    }
};

const measureText = (text: string): Output => {
    if (text.length === 0) {
        return {
            height: 0,
            width: 0,
        };
    }

    const cachedDimensions = cache.get(text);

    if (cachedDimensions) {
        return cachedDimensions;
    }

    const lines = text.split("\n");
    const width = Math.max(...lines.map((line) => safeGetStringWidth(line)));
    const height = lines.length;
    const dimensions = { height, width };

    cache.set(text, dimensions);

    return dimensions;
};

export default measureText;
