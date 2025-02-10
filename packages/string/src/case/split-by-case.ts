import type { NodeLocale } from "../types";
import type { LocaleOptions, SplitByCase } from "./types";
import { isAllUpper } from "./utils/is-locale-all-upper";
import { ANSI_REGEX, EMOJI_REGEX, getSeparatorsRegex, SEPARATORS_REGEX, splitByAnsi, splitByEmoji } from "./utils/regex";

// Pre-compile character code checks
const ESZETT_CODES = new Set([0x00_df, 0x1e_9e]); // ß and ẞ
const isEszett = (code: number) => ESZETT_CODES.has(code);

const isUpperAscii = (code: number) => code >= 65 && code <= 90; // A-Z
const isLowerAscii = (code: number) => code >= 97 && code <= 122; // a-z

// Locale-specific processing functions
const processGermanLocale = (words: string[], locale: string): string[] => {
    if (!locale.startsWith("de")) {
        return words;
    }

    return words
        .flatMap((word) => {
            if (!word) {
                return word;
            }

            // Handle all uppercase words
            const isAllUpperCase = word.split("").every((ch) => {
                const code = ch.charCodeAt(0);
                return isEszett(code) || (ch === ch.toUpperCase() && ch !== ch.toLowerCase());
            });
            if (isAllUpperCase) {
                return word;
            }

            const length_ = word.length;
            const parts: string[] = [];
            let currentStart = 0;
            let isUpperSequence = false;

            for (let index = 0; index < length_; index++) {
                const char = word[index];
                const code = char.charCodeAt(0);
                const nextChar = index + 1 < length_ ? word[index + 1] : "";
                const nextCode = nextChar ? nextChar.charCodeAt(0) : 0;

                const isUpper = isUpperAscii(code) || (code > 127 && !isEszett(code) && char === char.toUpperCase() && char !== char.toLowerCase());
                const isLower = isLowerAscii(code) || (code > 127 && !isEszett(code) && char === char.toLowerCase() && char !== char.toUpperCase());
                const eszett = isEszett(code);
                const nextEszett = isEszett(nextCode);

                // Handle eszett in uppercase sequence
                if (eszett && index > 0 && index + 1 < length_) {
                    const previousChar = word[index - 1];
                    const nextChar = word[index + 1];
                    if (previousChar === previousChar.toUpperCase() && nextChar === nextChar.toUpperCase()) {
                        isUpperSequence = true;
                        continue;
                    }
                }

                // Start of new word or sequence
                if (isUpper && !isUpperSequence && index > 0) {
                    // Don't split if previous char is eszett
                    if (!isEszett(word.charCodeAt(index - 1))) {
                        parts.push(word.slice(currentStart, index));
                        currentStart = index;
                    }
                    isUpperSequence = true;
                }
                // Continue uppercase sequence
                else if (isUpperSequence && (isUpper || eszett)) {
                    continue;
                }
                // End of uppercase sequence
                else if (isUpperSequence && isLower && !eszett && // Keep eszett with its word
                    !nextEszett) {
                        parts.push(word.slice(currentStart, index));
                        currentStart = index;
                        isUpperSequence = false;
                    }
            }

            // Handle last part
            if (currentStart < length_) {
                parts.push(word.slice(currentStart));
            }

            // Process parts
            return parts.map((part) => {
                if (!part)
return part;

                // Keep uppercase sequences with eszett intact
                const nonEszettChars = part.split("").filter((ch) => !isEszett(ch.charCodeAt(0)));
                if (nonEszettChars.every((ch) => ch === ch.toUpperCase() && ch !== ch.toLowerCase())) {
                    return part;
                }

                // Handle mixed case
                const firstCode = part.charCodeAt(0);
                if (isUpperAscii(firstCode) || (firstCode > 127 && part[0] === part[0].toUpperCase())) {
                    return part[0] + part.slice(1).toLowerCase();
                }

                return part.toLowerCase();
            });
        });
};

const processTurkishLocale = (words: string[], locale: string): string[] => {
    if (!locale.startsWith("tr") && !locale.startsWith("az")) {
        return words;
    }

    return words.map((word) => {
        // Handle dotted/dotless I
        if (word === "I") {
            return "\u0130"; // İ
        }

        if (word === "i") {
            return "\u0131"; // ı
        }

        return word;
    });
};

const processCJKLocale = (words: string[], locale: string): string[] => {
    if (!locale.startsWith("zh") && !locale.startsWith("ja") && !locale.startsWith("ko")) {
        return words;
    }

    const result: string[] = [];
    for (const word of words) {
        let current = "";
        let lastType = "";

        for (const ch of word) {
            const code = ch.charCodeAt(0);
            const isCJK =
                (code >= 0x4e_00 && code <= 0x9f_ff) || // CJK Unified Ideographs
                (code >= 0x30_40 && code <= 0x30_9f) || // Hiragana
                (code >= 0x30_a0 && code <= 0x30_ff) || // Katakana
                (code >= 0x11_00 && code <= 0x11_ff) || // Hangul Jamo
                (code >= 0xac_00 && code <= 0xd7_af); // Hangul Syllables

            const type = isCJK ? "cjk" : "other";

            if (type !== lastType && current) {
                result.push(current);
                current = "";
            }

            current += ch;
            lastType = type;
        }

        if (current) {
            result.push(current);
        }
    }

    // Combine consecutive CJK characters
    const finalResult: string[] = [];
    let currentCJK = "";
    for (const part of result) {
        const code = part.charCodeAt(0);
        const isCJK =
            (code >= 0x4e_00 && code <= 0x9f_ff) || // CJK Unified Ideographs
            (code >= 0x30_40 && code <= 0x30_9f) || // Hiragana
            (code >= 0x30_a0 && code <= 0x30_ff) || // Katakana
            (code >= 0x11_00 && code <= 0x11_ff) || // Hangul Jamo
            (code >= 0xac_00 && code <= 0xd7_af); // Hangul Syllables

        if (isCJK) {
            currentCJK += part;
        } else {
            if (currentCJK) {
                finalResult.push(currentCJK);
                currentCJK = "";
            }
            finalResult.push(part);
        }
    }

    if (currentCJK) {
        finalResult.push(currentCJK);
    }

    return finalResult;
};

const processRTLLocale = (words: string[], locale: string): string[] => {
    if (!locale.startsWith("ar") && !locale.startsWith("he") && !locale.startsWith("fa")) {
        return words;
    }

    const result: string[] = [];
    for (const word of words) {
        let current = "";
        let lastType = "";

        for (const ch of word) {
            const code = ch.charCodeAt(0);
            const isRTL =
                (code >= 0x05_90 && code <= 0x05_ff) || // Hebrew
                (code >= 0x06_00 && code <= 0x06_ff) || // Arabic
                (code >= 0x07_50 && code <= 0x07_7f) || // Arabic Supplement
                (code >= 0x08_a0 && code <= 0x08_ff); // Arabic Extended-A

            const type = isRTL ? "rtl" : "other";

            if (type !== lastType && current) {
                result.push(current);
                current = "";
            }

            current += ch;
            lastType = type;
        }

        if (current) {
            result.push(current);
        }
    }

    // Combine consecutive RTL characters
    const finalResult: string[] = [];
    let currentRTL = "";
    for (const part of result) {
        const code = part.charCodeAt(0);
        const isRTL =
            (code >= 0x05_90 && code <= 0x05_ff) || // Hebrew
            (code >= 0x06_00 && code <= 0x06_ff) || // Arabic
            (code >= 0x07_50 && code <= 0x07_7f) || // Arabic Supplement
            (code >= 0x08_a0 && code <= 0x08_ff); // Arabic Extended-A

        if (isRTL) {
            currentRTL += part;
        } else {
            if (currentRTL) {
                finalResult.push(currentRTL);
                currentRTL = "";
            }
            finalResult.push(part);
        }
    }

    if (currentRTL) {
        finalResult.push(currentRTL);
    }

    return finalResult;
};

const processIndicLocale = (words: string[], locale: string): string[] => {
    if (!locale.startsWith("hi") && !locale.startsWith("mr") && !locale.startsWith("ne") && !locale.startsWith("th")) {
        return words;
    }

    const result: string[] = [];
    for (const word of words) {
        let current = "";
        let lastType = "";

        for (const ch of word) {
            const code = ch.charCodeAt(0);
            const isIndic =
                (code >= 0x09_00 && code <= 0x09_7f) || // Devanagari
                (code >= 0x0e_00 && code <= 0x0e_7f) || // Thai
                (code >= 0x0f_00 && code <= 0x0f_ff); // Tibetan

            const type = isIndic ? "indic" : "other";

            if (type !== lastType && current) {
                result.push(current);
                current = "";
            }

            current += ch;
            lastType = type;
        }

        if (current) {
            result.push(current);
        }
    }

    return result;
};

const processJapaneseLocale = (words: string[], locale: string): string[] => {
    if (!locale.startsWith("ja")) {
        return words;
    }

    const result: string[] = [];
    for (const word of words) {
        let current = "";
        let lastType = "";

        for (const ch of word) {
            const code = ch.charCodeAt(0);
            let type = "other";

            // Check for Latin characters
            if ((code >= 0x00_41 && code <= 0x00_5a) || (code >= 0x00_61 && code <= 0x00_7a)) {
                type = "latin";
                if (lastType !== "latin" && current) {
                    result.push(current);
                    current = "";
                }
            }
            // Check for Hiragana
            else if (code >= 0x30_40 && code <= 0x30_9f) {
                type = "hiragana";
                if (lastType === "latin" && current) {
                    result.push(current);
                    current = "";
                }
            }
            // Check for Katakana
            else if (code >= 0x30_a0 && code <= 0x30_ff) {
                type = "katakana";
                if ((lastType === "latin" || lastType === "hiragana") && current) {
                    result.push(current);
                    current = "";
                }
            }
            // Check for Kanji
            else if (code >= 0x4e_00 && code <= 0x9f_ff) {
                type = "kanji";
                if (lastType === "latin" && current) {
                    result.push(current);
                    current = "";
                }
            }
            // Other characters
            else {
                type = "other";
                if (current) {
                    result.push(current);
                    current = "";
                }
            }

            current += ch;
            lastType = type;
        }

        if (current) {
            result.push(current);
        }
    }

    return result;
};

const processCyrillicLocale = (words: string[], locale: string): string[] => {
    if (!locale.startsWith("ru") && !locale.startsWith("uk") && !locale.startsWith("be")) {
        return words;
    }

    return words.map((word) => {
        // Check if the word contains Cyrillic characters
        const isCyrillic = /[\u0400-\u04FF]/.test(word);

        if (!isCyrillic) {
            return word;
        }

        // If the word is all uppercase, keep it that way
        if (/^[\u0410-\u042F\u0401]+$/.test(word)) {
            return word;
        }

        // For Ukrainian, preserve case for proper nouns and mixed case words
        if (locale.startsWith("uk")) {
            if (/^[\u0410-\u042F\u0401]/.test(word)) {
                // Keep original case for Ukrainian proper nouns
                return word;
            }
            // Keep the case of the first letter for other words
            return word[0] + word.slice(1);
        }

        // For Belarusian, preserve proper nouns and handle special characters
        if (locale.startsWith("be")) {
            // Handle special Belarusian characters
            const belarusianMap: Record<string, string> = {
                І: "І",
                Ў: "Ў",
                і: "і",
                ў: "ў",
            };

            // Keep proper nouns capitalized
            if (/^[\u0410-\u042F\u0401]/.test(word)) {
                return word[0] + word.slice(1).toLowerCase();
            }

            // Apply Belarusian-specific character mapping
            return word
                .split("")
                .map((char, index) => {
                    if (belarusianMap[char]) {
                        return belarusianMap[char];
                    }

                    return index === 0 ? char : char.toLowerCase();
                })
                .join("");
        }

        // For Russian
        if (locale.startsWith("ru")) {
            // Keep proper nouns capitalized
            if (/^[\u0410-\u042F\u0401]/.test(word)) {
                return word[0] + word.slice(1).toLowerCase();
            }

            return word.toLowerCase();
        }

        return word.toLowerCase();
    });
};

// Cache for processed parts and acronyms
const partCache = new Map<string, string[]>();
const CACHE_MAX_SIZE = 2000; // Increased cache size for better hit rate

// Optimized character checks using character codes
const isLower = (locale: NodeLocale | undefined, ch: string): boolean => {
    const code = ch.charCodeAt(0);

    if (code >= 97 && code <= 122) {
        return true;
    }

    if (!locale) {
        return false;
    }

    return ch === ch.toLocaleLowerCase(locale) && ch !== ch.toLocaleUpperCase(locale);
};

const isUpper = (locale: NodeLocale | undefined, ch: string): boolean => {
    const code = ch.charCodeAt(0);

    if (code >= 65 && code <= 90) {
        return true;
    }

    if (!locale) {
        return false;
    }

    return ch === ch.toLocaleUpperCase(locale) && ch !== ch.toLocaleLowerCase(locale);
};

const isDigit = (ch: string): boolean => {
    const code = ch.charCodeAt(0);
    return code >= 48 && code <= 57;
};

const isLetter = (ch: string): boolean => {
    const code = ch.charCodeAt(0);
    return (code >= 65 && code <= 90) || (code >= 97 && code <= 122);
};

export interface SplitOptions extends LocaleOptions {
    /**
     * Whether to handle ANSI escape sequences.
     * @default false
     */
    handleAnsi?: boolean;

    /**
     * Whether to handle emoji sequences.
     * @default false
     */
    handleEmoji?: boolean;

    /**
     * A list of known acronyms to preserve casing for.
     */
    knownAcronyms?: ReadonlyArray<string>;

    /**
     * Whether to normalize case (e.g., convert uppercase tokens not in knownAcronyms to title case).
     */
    normalize?: boolean;

    /**
     * List of additional separators to split on.
     */
    separators?: ReadonlyArray<string> | RegExp;
}

/**
 * Splits a string into "words" by:
 * – first splitting on any explicit separator (by default: "-", "_", "/", "." and space)
 * – then breaking on camel–case boundaries (including between digits and letters)
 * – and finally handling "acronym boundaries" so that for example:
 *
 *     "FOOBar"   → [ "FOO", "Bar" ]
 *     "ABCdef"   → [ "ABC", "def" ]
 *     "ATest"    → [ "A", "Test" ]
 *     "FooBARb"  → [ "Foo", "BAR", "b" ]
 *     "FIZz"     → [ "FI", "Zz" ]  (because "FIZ" isn't "known")
 *
 * The options allow you to supply:
 * – a custom list of separators,
 * – a list of known acronyms (for which an uppercase run is kept intact),
 * – and a "normalize" flag (if true, any "all–uppercase" token not in the known list is title–cased).
 *
 * @example
 *   splitByCase("XMLHttpRequest")
 *     // → [ "XML", "Http", "Request" ]
 *
 *   splitByCase("foo\Bar.fuzz-FIZz", { separators: ["\\",".","-"] })
 *     // → [ "foo", "Bar", "fuzz", "FI", "Zz" ]
 */
// eslint-disable-next-line sonarjs/cognitive-complexity
export const splitByCase = <T extends string = string>(input: T, options?: SplitOptions): SplitByCase<T> => {
    // Fast path for empty strings
    if (!input || typeof input !== "string") {
        return [] as unknown as SplitByCase<T>;
    }

    const { handleAnsi = false, handleEmoji = false, knownAcronyms = [], locale, normalize = false, separators } = options ?? {};

    // Process one part by scanning through its characters with optimized checks
    const processPart = (part: string): string[] => {
        // Quick exit for single characters or empty strings
        if (part.length <= 1) {
            return [part];
        }

        // Check cache first
        const cached = partCache.get(part);
        if (cached) {
            return cached;
        }

        // Handle German eszett in uppercase sequences first
        if (locale?.startsWith("de")) {
            const hasEszett = part.split("").some((ch) => isEszett(ch.charCodeAt(0)));
            if (hasEszett) {
                const isAllUpperCase = part.split("").every((ch) => {
                    const code = ch.charCodeAt(0);
                    return isEszett(code) || (ch === ch.toUpperCase() && ch !== ch.toLowerCase());
                });
                if (isAllUpperCase) {
                    const result = [part];
                    if (partCache.size < CACHE_MAX_SIZE) {
                        partCache.set(part, result);
                    }
                    return result;
                }
            }
        }

        // Handle German eszett cases first
        if (locale?.startsWith("de")) {
            const hasEszett = part.split("").some((ch) => isEszett(ch.charCodeAt(0)));
            if (hasEszett) {
                // Check if this is an uppercase sequence containing eszett
                const isUpperSequence = part.split("").every((ch) => {
                    const code = ch.charCodeAt(0);
                    return isEszett(code) || (ch === ch.toUpperCase() && ch !== ch.toLowerCase());
                });
                if (isUpperSequence) {
                    const result = [part];
                    if (partCache.size < CACHE_MAX_SIZE) {
                        partCache.set(part, result);
                    }
                    return result;
                }
            }
        }

        // Check if the part is all uppercase
        if (locale && isAllUpper(part, locale)) {
            const result = [part];
            if (partCache.size < CACHE_MAX_SIZE) {
                partCache.set(part, result);
            }
            return result;
        }

        const tokens: string[] = [];
        const isTransitionBoundary = (previous: string, current: string): boolean => {
            // Special handling for German eszett in mixed case
            if (locale?.startsWith("de")) {
                const previousCode = previous.charCodeAt(0);
                const currentCode = current.charCodeAt(0);

                // If either character is eszett, don't split
                if (isEszett(previousCode) || isEszett(currentCode)) {
                    return false;
                }
            }

            // Check for transitions between different character types:
            // 1. lowercase/digit to uppercase
            // 2. letter to digit
            // 3. digit to letter
            return (
                ((isLower(locale, previous) || isDigit(previous)) && isUpper(locale, current)) ||
                (isLetter(previous) && isDigit(current)) ||
                (isDigit(previous) && isLetter(current))
            );
        };

        const findUppercaseRunStart = (startIndex: number, tokenStart: number): number => {
            let runStart = startIndex;
            // Look backwards to find the start of the uppercase sequence
            // Include eszett characters in German text
            while (runStart > tokenStart && (isUpper(locale, part[runStart - 1] as string) || isEszett(part.charCodeAt(runStart - 1)))) {
                runStart--;
            }

            return runStart;
        };

        const isUppercaseRunBoundary = (index: number): boolean => {
            const previous = part[index - 1] as string;
            const current = part[index] as string;
            const next = index + 1 < part.length ? (part[index + 1] as string) : "";

            // Special handling for German eszett in uppercase sequences
            if (locale?.startsWith("de")) {
                const previousCode = previous.charCodeAt(0);
                const currentCode = current.charCodeAt(0);
                const nextCode = next ? next.charCodeAt(0) : 0;

                const previousIsUpper = isUpper(locale, previous) || isEszett(previousCode);
                const currentIsUpper = isUpper(locale, current) || isEszett(currentCode);
                const nextIsLower = next && (isLower(locale, next) || isEszett(nextCode));

                if (previousIsUpper && currentIsUpper && nextIsLower) {
                    // Look ahead to check if this is part of a longer uppercase sequence
                    let index_ = index + 2;
                    while (index_ < part.length) {
                        const ch = part[index_];
                        if (isUpper(locale, ch) || isEszett(ch.charCodeAt(0))) {
                            return false; // Part of a longer sequence
                        }
                        if (isLower(locale, ch)) {
                            break;
                        }
                        index_++;
                    }
                    return true;
                }
                return false;
            }

            // Default handling for non-German text
            return isUpper(locale, previous) && isUpper(locale, current) && next && isLower(locale, next);
        };

        const findWordBoundary = (runStart: number, runEnd: number): number => {
            const sequence = part.slice(runStart, runEnd);

            // Special handling for German mixed case with eszett
            if (locale?.startsWith("de")) {
                // Look ahead to find any uppercase sequence containing eszett
                let index_ = runEnd;
                let hasEszett = false;
                let isUpperSequence = true;

                while (index_ < part.length) {
                    const ch = part[index_];
                    const code = ch.charCodeAt(0);

                    if (isEszett(code)) {
                        hasEszett = true;
                        index_++;
                        continue;
                    }

                    if (ch === ch.toUpperCase() && ch !== ch.toLowerCase()) {
                        // Still in uppercase sequence
                        index_++;
                        continue;
                    }

                    if (ch === ch.toLowerCase() && ch !== ch.toUpperCase()) {
                        // Found a lowercase letter
                        if (hasEszett && isUpperSequence) {
                            return index_; // Include the entire sequence
                        }
                        break;
                    }

                    isUpperSequence = false;
                    index_++;
                }
            }

            // Default handling: keep known acronyms together, otherwise split before last char
            return knownAcronyms.includes(sequence) ? runEnd : runStart + (runEnd - runStart) - 1;
        };

        let tokenStart = 0;
        let index = 1;

        while (index < part.length) {
            const previous = part[index - 1] as string;
            const current = part[index] as string;

            // Rule A: Handle transitions between different character types
            if (isTransitionBoundary(previous, current)) {
                tokens.push(part.slice(tokenStart, index));
                tokenStart = index;
                index++;
                continue;
            }

            // Rule B: Handle uppercase sequences ending in lowercase
            if (isUppercaseRunBoundary(index)) {
                const runStart = findUppercaseRunStart(index - 1, tokenStart);
                const runEnd = index + 1;
                const boundary = findWordBoundary(runStart, runEnd);

                if (boundary > tokenStart && boundary < part.length) {
                    tokens.push(part.slice(tokenStart, boundary));
                    tokenStart = boundary;
                    index = tokenStart;
                    continue;
                }
            }

            index++;
        }

        if (tokenStart < part.length) {
            tokens.push(part.slice(tokenStart));
        }

        return tokens;
    };

    // Helper function to process text segments with optimized handling
    const processTextSegment = (text: string, accumulator: string[]) => {
        // Handle ANSI escape codes first if enabled
        if (handleAnsi) {
            const ansiSegments = text.split(/(\u001B\[[0-9;]*[a-z])/i).filter(Boolean);

            for (const segment of ansiSegments) {
                if (/\u001B\[[0-9;]*[a-z]/i.test(segment)) {
                    accumulator.push(segment);
                } else {
                    // Split by numbers and dots first
                    const numericParts = segment.split(/(\d+)/).filter(Boolean);
                    for (const numberPart of numericParts) {
                        if (/^\d+$/.test(numberPart)) {
                            accumulator.push(numberPart);
                        } else if (handleEmoji) {
                            processSegmentWithEmoji(numberPart, accumulator);
                        } else {
                            // When only ANSI is enabled, remove emojis and split by case
                            const cleanText = numberPart.replaceAll(/\p{Emoji}/gu, "");
                            const caseParts = processPart(cleanText);

                            for (const part of caseParts) {
                                if (part.trim()) {
                                    accumulator.push(part.trim());
                                }
                            }
                        }
                    }
                }
            }

            return;
        }

        // If ANSI is not enabled, proceed with normal processing
        if (handleEmoji) {
            processSegmentWithEmoji(text, accumulator);
        } else {
            processNonEmojiSegment(text, accumulator);
        }
    };

    // Helper function to process segments with emoji handling
    const processSegmentWithEmoji = (text: string, accumulator: string[]) => {
        // First split by ANSI if needed
        const segments = handleAnsi ? splitByAnsi(text) : [text];

        for (const segment of segments) {
            if (handleAnsi && ANSI_REGEX.test(segment)) {
                accumulator.push(segment);
                continue;
            }

            if (handleEmoji) {
                // Split by emoji if enabled
                const emojiSegments = splitByEmoji(segment);
                for (const emojiSegment of emojiSegments) {
                    if (EMOJI_REGEX.test(emojiSegment)) {
                        accumulator.push(emojiSegment);
                    } else if (emojiSegment.trim()) {
                        processNonEmojiSegment(emojiSegment.trim(), accumulator);
                    }
                }
            } else {
                // If emoji handling is disabled, split by case and treat emojis as part of text
                const parts = segment
                    .replaceAll(/\p{Emoji}/gu, "")
                    .split(/([A-Z][a-z]+|[A-Z]{2,}(?=[A-Z][a-z]|\d|\W|$)|\d+|[a-z]+)/)
                    .filter(Boolean);

                for (const part of parts) {
                    if (part.trim()) {
                        accumulator.push(part.trim());
                    }
                }
            }
        }
    };

    // Helper function to process non-emoji segments
    const processNonEmojiSegment = (text: string, accumulator: string[]) => {
        // Split by special characters
        const subParts = text.split(/([!@#$%^&*()+=[\]{};:'",<>/?\\|~`])/).filter(Boolean);

        for (const subPart of subParts) {
            // Split by numbers and dots
            const numericParts = subPart.split(/(\d+|\.)/).filter(Boolean);

            for (const numberPart of numericParts) {
                if (/^\d+$/.test(numberPart)) {
                    accumulator.push(numberPart);
                } else if (numberPart === ".") {
                    accumulator.push(numberPart);
                } else {
                    // Process each part separately
                    const processed = processPart(numberPart);

                    accumulator.push(...processed);
                }
            }
        }
    };

    // First, split by any explicit separator
    const separatorPattern = Array.isArray(separators)
        ? getSeparatorsRegex(separators as ReadonlyArray<string>)
        : separators instanceof RegExp
          ? separators
          : SEPARATORS_REGEX;
    const parts = input.split(separatorPattern).filter(Boolean);

    // Process each part with optimized ANSI and emoji handling
    let words: string[] = [];

    for (const part of parts) {
        // Quick check if part contains ANSI sequences
        if (handleAnsi && part.includes("\u001B")) {
            // Process ANSI segments
            const ansiSegments = splitByAnsi(part);

            for (const segment of ansiSegments) {
                if (segment.startsWith("\u001B")) {
                    words.push(segment);
                    continue;
                }

                processTextSegment(segment, words);
            }
        } else {
            const cleanPart = handleAnsi ? part : part.replace(ANSI_REGEX, "");
            const cleanText = handleEmoji ? cleanPart : cleanPart.replace(EMOJI_REGEX, "");

            processTextSegment(cleanText, words);
        }
    }

    // Apply locale-specific processing before normalization
    if (locale) {
        // Process Turkish/Azerbaijani special cases first
        words = processTurkishLocale(words, locale);

        // Process German special cases
        words = processGermanLocale(words, locale);

        // Process CJK scripts
        words = processCJKLocale(words, locale);

        // Process RTL scripts
        words = processRTLLocale(words, locale);

        // Process Indic scripts
        words = processIndicLocale(words, locale);

        // Process Japanese-specific cases
        words = processJapaneseLocale(words, locale);

        // Process Cyrillic scripts
        words = processCyrillicLocale(words, locale);
    }

    // Normalize if requested
    if (normalize) {
        words = words.map((tok) => {
            if (EMOJI_REGEX.test(tok) || tok.startsWith("\u001B") || knownAcronyms.includes(tok)) {
                return tok;
            }

            if (locale && isAllUpper(tok, locale)) {
                return tok[0] + tok.slice(1).toLocaleLowerCase(locale);
            }

            return tok;
        });
    }

    return words as SplitByCase<T>;
};
