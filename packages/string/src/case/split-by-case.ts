import type { NodeLocale } from "../types";
import type { LocaleOptions, SplitByCase } from "./types";
import {
    CYRILLIC_REGEX,
    EMOJI_REGEX,
    getSeparatorsRegex,
    GREEK_REGEX,
    HANGUL_REGEX,
    HIRAGANA_REGEX,
    KANJI_REGEX,
    KATAKANA_REGEX,
    LATIN_REGEX,
    SEPARATORS_REGEX,
    splitByEmoji,
    stripAnsi,
    stripEmoji,
    UZBEK_LATIN_MODIFIER_REGEX
} from "./utils/regex";

// ─────────────────────────────
// Fast Path: No locale (assume ASCII)
// ─────────────────────────────

// Fast lookup tables for performance optimization
const isUpperCode = new Uint8Array(128);
const isLowerCode = new Uint8Array(128);
const isDigitCode = new Uint8Array(128);

// Initialize lookup tables once
for (let index = 0; index < 128; index++) {
    isUpperCode[index] = index >= 65 && index <= 90 ? 1 : 0; // A-Z
    isLowerCode[index] = index >= 97 && index <= 122 ? 1 : 0; // a-z
    isDigitCode[index] = index >= 48 && index <= 57 ? 1 : 0; // 0-9
}

const splitCamelCaseFast = (s: string, knownAcronyms: Set<string> = new Set()): string[] => {
    if (s.length === 0) {
        return [];
    }

    // Quick early return for all uppercase
    if (s.toUpperCase() === s) {
        return [s];
    }

    const tokens: string[] = [];
    let start = 0;
    const length_ = s.length;

    // No special case handling - we'll use a general algorithm

    // Main tokenization loop - optimized for speed
    for (let index = 1; index < length_; index++) {
        const previousCode = s.charCodeAt(index - 1);
        const currentCode = s.charCodeAt(index);

        // Check for known acronyms
        if (knownAcronyms.size > 0) {
            for (const acronym of knownAcronyms) {
                if (s.startsWith(acronym, start)) {
                    tokens.push(acronym);
                    start += acronym.length;
                    index = start - 1; // Move past the acronym
                    break; // Stop checking other acronyms
                }
            }
            // Ensure we haven't already moved start forward
            if (index < start) {
                continue;
            }
        }

        // Fast checks using lookup tables for common character types
        const previousIsUpper = previousCode < 128 && isUpperCode[previousCode];
        const currentIsUpper = currentCode < 128 && isUpperCode[currentCode];
        const previousIsLower = previousCode < 128 && isLowerCode[previousCode];
        const previousIsDigit = previousCode < 128 && isDigitCode[previousCode];
        const currentIsDigit = currentCode < 128 && isDigitCode[currentCode];

        // Lower-to-Upper transition: [a-z] -> [A-Z]
        if (previousIsLower && currentIsUpper) {
            tokens.push(s.slice(start, index));
            start = index;
            continue;
        }

        // Digit-Letter transition
        if ((previousIsDigit && !currentIsDigit) || (!previousIsDigit && currentIsDigit)) {
            tokens.push(s.slice(start, index));
            start = index;
            continue;
        }

        // Handle pattern sequences like R2D2, C3PO with special attention to single digit followed by uppercase letter
        if (currentIsDigit && !previousIsDigit) {
            // Get the next character if available
            let isNextUpper = false;
            let isNextDigit = false;

            if (index + 1 < length_) {
                const nextCode = s.charCodeAt(index + 1);
                isNextUpper = nextCode < 128 && isUpperCode[nextCode];
                isNextDigit = nextCode < 128 && isDigitCode[nextCode];
            }

            // Pattern: letter + single digit + uppercase letter (like R2D or C3P)
            if (!isNextDigit && isNextUpper) {
                tokens.push(s.slice(start, index));
                tokens.push(s.slice(index, index + 1)); // The digit
                start = index + 1;
                continue;
            }
        }

        // Uppercase acronym boundary detection
        if (index + 1 < length_) {
            const nextCode = s.charCodeAt(index + 1);
            const nextIsLower = nextCode < 128 && isLowerCode[nextCode];

            if (previousIsUpper && currentIsUpper && nextIsLower) {
                const candidate = s.slice(start, index + 1);
                if (!knownAcronyms.has(candidate)) {
                    tokens.push(s.slice(start, index));
                    start = index;
                    continue;
                }
            }
        }
    }

    // Capture the last segment
    if (start < length_) {
        tokens.push(s.slice(start));
    }

    // Filter out empty tokens which can occur in edge cases
    return tokens.filter((token) => token !== "");
};

// ─────────────────────────────
// Locale-Aware Splitting
// ─────────────────────────────

enum CharType {
    CJK,
    RTL,
    Indic,
    Other,
}

// eslint-disable-next-line sonarjs/cognitive-complexity
const getCharType = (code: number): CharType => {
    // CJK ranges
    if (code >= 0x4e_00 && code <= 0x9f_ff) {
        // CJK Unified
        return CharType.CJK;
    }

    // RTL ranges
    if (
        (code >= 0x05_90 && code <= 0x05_ff) || // Hebrew
        (code >= 0x06_00 && code <= 0x06_ff) || // Arabic
        (code >= 0x07_50 && code <= 0x07_7f) || // Arabic Supplement
        (code >= 0x08_a0 && code <= 0x08_ff)
    ) {
        // Arabic Extended-A
        return CharType.RTL;
    }

    // Indic ranges
    if (
        (code >= 0x09_00 && code <= 0x09_7f) || // Devanagari
        (code >= 0x09_80 && code <= 0x09_ff) || // Bengali
        (code >= 0x0a_00 && code <= 0x0a_7f) || // Gurmukhi
        (code >= 0x0a_80 && code <= 0x0a_ff) || // Gujarati
        (code >= 0x0b_00 && code <= 0x0b_7f) || // Oriya
        (code >= 0x0b_80 && code <= 0x0b_ff) || // Tamil
        (code >= 0x0c_00 && code <= 0x0c_7f) || // Telugu
        (code >= 0x0c_80 && code <= 0x0c_ff) || // Kannada
        (code >= 0x0d_00 && code <= 0x0d_7f) || // Malayalam
        (code >= 0x0d_80 && code <= 0x0d_ff) || // Sinhala
        (code >= 0x0e_00 && code <= 0x0e_7f) || // Thai
        (code >= 0x0e_80 && code <= 0x0e_ff) || // Lao
        (code >= 0x0f_00 && code <= 0x0f_ff) || // Tibetan
        (code >= 0x10_00 && code <= 0x10_9f) || // Myanmar
        (code >= 0x12_00 && code <= 0x13_7f) || // Ethiopic
        (code >= 0x17_80 && code <= 0x17_ff) // Khmer
    ) {
        return CharType.Indic;
    }

    return CharType.Other;
};

/**
 * Splits a string segment using locale‑aware camel‑case rules.
 * Additionally, if both adjacent characters are non‑Latin (i.e. not A–Z or 0–9),
 * it does not split them.
 *
 * @param s The input segment.
 * @param locale The locale to use.
 * @param knownAcronyms A Set of known acronyms.
 * @returns Array of tokens.
 */
const shouldKeepScriptTogether = (type: CharType): boolean => type === CharType.CJK || type === CharType.RTL || type === CharType.Indic;

const shouldSplitAtIndex = (lastCharType: CharType, currentCharType: CharType): boolean => {
    // Don't split if both characters are the same script (except Latin)
    if (shouldKeepScriptTogether(lastCharType) && lastCharType === currentCharType) {
        return false;
    }

    // Always split on script transitions
    return shouldKeepScriptTogether(lastCharType) !== shouldKeepScriptTogether(currentCharType);
};

/**
 * Determines if a split should occur at the specified index
 * @param s - The input string
 * @param index - The index to check
 * @param locale - The locale to use for locale-specific rules
 * @param lastCharType - The character type of the previous character
 * @param currentCharType - The character type of the current character
 * @returns true if a split should occur, false otherwise
 */
const splitCamelCaseLocale = (s: string, locale: NodeLocale, knownAcronyms: Set<string>): string[] => {
    if (s.length === 0) {
        return [];
    }

    // Fast path: if no known acronyms and string is all uppercase,
    // return the string as a single token
    const isUpperCase = s === s.toLocaleUpperCase(locale);

    // Special case for German: check for eszett, the big ß was added in 2017
    if (locale.startsWith("de") && !isUpperCase && s.replaceAll("ß", "SS") === s.toLocaleUpperCase(locale)) {
        return [s];
    }

    // Special handling for Ukrainian and other Cyrillic scripts
    if (
        locale.startsWith("uk") ||
        locale.startsWith("ru") ||
        locale.startsWith("bg") ||
        locale.startsWith("sr") ||
        locale.startsWith("mk") ||
        locale.startsWith("be")
    ) {
        // Early return if no Cyrillic or Latin characters
        if (!CYRILLIC_REGEX.test(s) && !LATIN_REGEX.test(s)) {
            return [s];
        }

        const chars: string[] = [...s]; // Convert to array once for better Unicode handling
        const length__ = chars.length;
        const result: string[] = [];
        let currentSegment = chars[0] as string;

        // Determine initial type (1=cyrillic, 2=latin, 0=other)
        let previousType = CYRILLIC_REGEX.test(chars[0] as string) ? 1 : LATIN_REGEX.test(chars[0] as string) ? 2 : 0;
        let previousIsUpper = (chars[0] as string) === (chars[0] as string).toLocaleUpperCase(locale);

        for (let index = 1; index < length__; index++) {
            const char = chars[index] as string;
            const currentType = CYRILLIC_REGEX.test(char) ? 1 : LATIN_REGEX.test(char) ? 2 : 0;
            const isUpper = char === char.toLocaleUpperCase(locale);

            // Split on script transitions or case changes within the same script
            if (
                (previousType !== currentType && (previousType === 1 || previousType === 2) && (currentType === 1 || currentType === 2)) ||
                (currentType === previousType && !previousIsUpper && isUpper)
            ) {
                result.push(currentSegment);
                currentSegment = char;
            } else {
                currentSegment += char;
            }

            previousType = currentType;
            previousIsUpper = isUpper;
        }

        if (currentSegment) {
            result.push(currentSegment);
        }

        // Post-process: merge single Latin characters with following Cyrillic if they form a word
        const finalResult: string[] = [];

        for (let index = 0; index < result.length; index++) {
            if (
                index < result.length - 1 &&
                result[index].length === 1 &&
                LATIN_REGEX.test(result[index]) &&
                CYRILLIC_REGEX.test(result[index + 1][0])
            ) {
                finalResult.push(result[index] + result[index + 1]);
                index++; // Skip the next segment since we merged it
            } else {
                finalResult.push(result[index]);
            }
        }

        return finalResult;
    }

    // Special handling for Greek scripts
    if (locale.startsWith("el")) {
        // Early return if no Greek or Latin characters
        if (!GREEK_REGEX.test(s) && !LATIN_REGEX.test(s)) {
            return [s];
        }

        // Fast-path processing for Greek scripts
        const chars = [...s]; // Convert to array once for better Unicode handling
        const length__ = chars.length;
        const result: string[] = [];
        let currentSegment = chars[0];

        // Determine initial type (1=greek, 2=latin, 0=other)
        let previousType = GREEK_REGEX.test(chars[0]) ? 1 : LATIN_REGEX.test(chars[0]) ? 2 : 0;
        let previousIsUpper = chars[0] === chars[0].toLocaleUpperCase(locale);

        for (let index = 1; index < length__; index++) {
            const char = chars[index];
            const currentType = GREEK_REGEX.test(char) ? 1 : LATIN_REGEX.test(char) ? 2 : 0;
            const isUpper = char === char.toLocaleUpperCase(locale);

            // Split on script transitions or case changes within the same script
            if (
                (previousType !== currentType && (previousType === 1 || previousType === 2) && (currentType === 1 || currentType === 2)) ||
                ((currentType === 1 || currentType === 2) && !previousIsUpper && isUpper)
            ) {
                result.push(currentSegment);
                currentSegment = char;
            } else {
                currentSegment += char;
            }

            previousType = currentType;
            previousIsUpper = isUpper;
        }

        if (currentSegment) {
            result.push(currentSegment);
        }

        return result;
    }

    // Special handling for Japanese and Korean scripts
    if (locale.startsWith("ja") || locale.startsWith("ko")) {
        const isJapanese = locale.startsWith("ja");
        // Early return if no relevant characters
        if (
            isJapanese &&
            !HIRAGANA_REGEX.test(s) &&
            !KATAKANA_REGEX.test(s) &&
            !KANJI_REGEX.test(s) &&
            !LATIN_REGEX.test(s)
        ) {
            return [s];
        }
        if (!isJapanese && !HANGUL_REGEX.test(s) && !LATIN_REGEX.test(s)) {
            return [s];
        }

        const chars = [...s]; // Convert to array once for better Unicode handling
        const result: string[] = [];
        let currentSegment: string | undefined = chars[0] as string;

        // Pre-compiled Set for Japanese particles - defined once and cached
        const particles = new Set(["と", "に", "へ", "を", "は", "が", "の", "で", "や", "も"]);

        // Determine initial type
        let previousType;

        if (isJapanese) {
            previousType = HIRAGANA_REGEX.test(chars[0])
                ? "hiragana"
                : KATAKANA_REGEX.test(chars[0])
                  ? "katakana"
                  : KANJI_REGEX.test(chars[0])
                    ? "kanji"
                    : LATIN_REGEX.test(chars[0])
                      ? "latin"
                      : "other";
        } else {
            previousType = HANGUL_REGEX.test(chars[0]) ? "hangul" : LATIN_REGEX.test(chars[0]) ? "latin" : "other";
        }

        for (let index = 1; index < chars.length; index++) {
            const char = chars[index];
            let currentType;

            // Determine the type of the current character
            if (isJapanese) {
                if (HIRAGANA_REGEX.test(char)) {
                    currentType = "hiragana";
                } else if (KATAKANA_REGEX.test(char)) {
                    currentType = "katakana";
                } else if (KANJI_REGEX.test(char)) {
                    currentType = "kanji";
                } else if (LATIN_REGEX.test(char)) {
                    currentType = "latin";
                } else {
                    currentType = "other";
                }
            } else if (HANGUL_REGEX.test(char)) {
                currentType = "hangul";
            } else if (LATIN_REGEX.test(char)) {
                currentType = "latin";
            } else {
                currentType = "other";
            }

            // Check for transitions
            let shouldSplit = false;

            if (isJapanese) {
                shouldSplit =
                    (previousType === "hiragana" && currentType === "katakana") ||
                    (previousType === "katakana" && currentType === "hiragana") ||
                    (previousType === "hiragana" && currentType === "latin") ||
                    (previousType === "katakana" && currentType === "latin") ||
                    (previousType === "kanji" && currentType === "latin") ||
                    (previousType === "latin" && (currentType === "hiragana" || currentType === "katakana" || currentType === "kanji"));
            } else {
                shouldSplit = (previousType === "hangul" && currentType === "latin") || (previousType === "latin" && currentType === "hangul");
            }

            if (shouldSplit) {
                // For Japanese, handle particles
                if (isJapanese && currentSegment.length === 1 && particles.has(currentSegment) && result.length > 0) {
                    result[result.length - 1] += currentSegment;
                } else {
                    result.push(currentSegment);
                }
                currentSegment = char;
            } else {
                currentSegment += char;
            }

            previousType = currentType;
        }

        // Add the last segment if it exists
        if (currentSegment) {
            // Add the last segment to results
            result.push(currentSegment);
        }

        return result.length > 0 ? result : [s];
    }

    // Special handling for Slovenian scripts
    if (locale.startsWith("sl")) {
        const chars = [...s];
        const length__ = chars.length;
        const result: string[] = [];

        let currentSegment = chars[0];
        let previousIsUpper = chars[0] === chars[0].toLocaleUpperCase(locale);

        // Process remaining characters
        for (let index = 1; index < length__; index++) {
            const char = chars[index];
            const isUpper = char === char.toLocaleUpperCase(locale);

            // Special handling for Slovenian characters
            const isSpecialChar = /[ČŠŽĐ]/i.test(char);
            const nextIsUpper = index < length__ - 1 && chars[index + 1] === chars[index + 1].toLocaleUpperCase(locale);

            // Split on case transitions and special characters
            if ((!previousIsUpper && isUpper) || (isSpecialChar && nextIsUpper)) {
                result.push(currentSegment);
                currentSegment = char;

                if (isSpecialChar && nextIsUpper) {
                    result.push(currentSegment);
                    currentSegment = "";
                }
            } else {
                currentSegment += char;
            }

            previousIsUpper = isUpper;
        }

        if (currentSegment) {
            result.push(currentSegment);
        }

        return result;
    }

    // Special handling for Korean scripts
    if (locale.startsWith("ko")) {
        const chars = [...s]; // Convert to array once for better performance with Unicode
        const length__ = chars.length;

        // Early return if no Hangul or Latin characters
        if (!HANGUL_REGEX.test(s) && !LATIN_REGEX.test(s)) {
            return [s];
        }

        const result: string[] = [];

        let currentSegment = chars[0];
        let previousType = HANGUL_REGEX.test(chars[0]) ? 1 : LATIN_REGEX.test(chars[0]) ? 2 : 0;

        // Process remaining characters
        for (let index = 1; index < length__; index++) {
            const char = chars[index];
            const currentType = HANGUL_REGEX.test(char) ? 1 : LATIN_REGEX.test(char) ? 2 : 0;

            // Split only on script transitions between Hangul and Latin
            if (previousType !== currentType && (previousType === 2 || currentType === 2)) {
                result.push(currentSegment);
                currentSegment = char;
            } else {
                currentSegment += char;
            }

            previousType = currentType;
        }

        if (currentSegment) {
            result.push(currentSegment);
        }

        return result;
    }

    // Special handling for Uzbek scripts
    if (locale.startsWith("uz")) {
        // Early return if no Cyrillic or Latin characters
        if (!CYRILLIC_REGEX.test(s) && !LATIN_REGEX.test(s)) {
            return [s];
        }

        const chars = [...s]; // Convert to array once for better Unicode handling
        const length__ = chars.length;
        const result: string[] = [];
        let currentSegment = chars[0];

        // Determine initial type (1=cyrillic, 2=latin, 0=other)
        let previousType = CYRILLIC_REGEX.test(chars[0]) ? 1 : LATIN_REGEX.test(chars[0]) ? 2 : 0;
        let previousIsUpper = chars[0] === chars[0].toLocaleUpperCase(locale);

        for (let index = 1; index < length__; index++) {
            const char = chars[index];
            const currentType = CYRILLIC_REGEX.test(char) ? 1 : LATIN_REGEX.test(char) ? 2 : 0;
            const isUpper = char === char.toLocaleUpperCase(locale);

            // Special handling for Uzbek Latin modifiers
            if (UZBEK_LATIN_MODIFIER_REGEX.test(char) || UZBEK_LATIN_MODIFIER_REGEX.test(chars[index - 1])) {
                currentSegment += char;
                continue;
            }

            // Split on script transitions or case changes within the same script
            if (
                (previousType !== currentType && (previousType === 1 || previousType === 2) && (currentType === 1 || currentType === 2)) ||
                (currentType === previousType && !previousIsUpper && isUpper)
            ) {
                result.push(currentSegment);
                currentSegment = char;
            } else {
                currentSegment += char;
            }

            previousType = currentType;
            previousIsUpper = isUpper;
        }

        if (currentSegment) {
            result.push(currentSegment);
        }

        return result;
    }

    const tokens: string[] = [];
    const length_ = s.length;

    let start = 0;
    let lastCharType = getCharType(s.charCodeAt(0));
    let inScript = shouldKeepScriptTogether(lastCharType);
    let currentScriptStart = inScript ? 0 : -1;

    for (let index = 1; index < length_; index++) {
        const previousCode = s.charCodeAt(index - 1);
        const currentCode = s.charCodeAt(index);
        const currentCharType = getCharType(currentCode);

        // Check for known acronyms
        for (const acronym of knownAcronyms) {
            if (s.startsWith(acronym, start)) {
                if (currentScriptStart !== -1) {
                    tokens.push(s.slice(currentScriptStart, start));
                    currentScriptStart = -1;
                }

                tokens.push(acronym);
                start += acronym.length;
                index = start - 1; // Move past the acronym

                if (index < length_) {
                    lastCharType = getCharType(s.charCodeAt(index));
                    inScript = shouldKeepScriptTogether(lastCharType);
                    currentScriptStart = inScript ? start : -1;
                }

                break;
            }
        }

        // Ensure we haven't already moved start forward
        if (index < start) {
            // eslint-disable-next-line no-continue
            continue;
        }

        // Handle script transitions and special characters
        if (shouldSplitAtIndex(lastCharType, currentCharType)) {
            if (currentScriptStart !== -1) {
                tokens.push(s.slice(currentScriptStart, index));
                currentScriptStart = -1;
            } else if (start < index) {
                tokens.push(s.slice(start, index));
            }

            start = index;

            inScript = shouldKeepScriptTogether(currentCharType);
            currentScriptStart = inScript ? index : -1;
            lastCharType = currentCharType;
            continue;
        }

        // If we're in a script section, continue collecting characters
        if (inScript) {
            continue;
        }

        // Lower-to-Upper transition
        const previous = s[index - 1] as string;
        const current = s[index] as string;

        if (previous === previous.toLocaleLowerCase(locale) && current === current.toLocaleUpperCase(locale)) {
            tokens.push(s.slice(start, index));
            start = index;
            continue;
        }

        // Uppercase acronym boundary detection
        if (index + 1 < length_) {
            const nextCode = s.charCodeAt(index + 1);

            if (
                previousCode >= 65 &&
                previousCode <= 90 && // A-Z
                currentCode >= 65 &&
                currentCode <= 90 && // A-Z
                nextCode >= 97 &&
                nextCode <= 122 // a-z
            ) {
                const candidate = s.slice(start, index + 1);

                if (!knownAcronyms.has(candidate)) {
                    tokens.push(s.slice(start, index));
                    start = index;
                    continue;
                }
            }
        }

        lastCharType = currentCharType;
    }

    // Capture last segment
    if (currentScriptStart !== -1) {
        tokens.push(s.slice(currentScriptStart));
    } else if (start < length_) {
        tokens.push(s.slice(start));
    }

    return tokens;
};

// ─────────────────────────────
// ANSI and Emoji Handling (only active when enabled)
// ─────────────────────────────

// eslint-disable-next-line no-control-regex,regexp/no-control-character
const FAST_ANSI_REGEX = /(\u001B\[[0-9;]*[a-z])/i;

/**
 * Processes a segment that may contain ANSI escape sequences and/or emoji.
 * Splits on ANSI if active; then, if emoji are active, splits on emoji boundaries;
 * otherwise applies camel-case splitting.
 */
const processTextWithAnsiEmoji = (text: string, locale: NodeLocale | undefined, knownAcronyms: Set<string>): string[] => {
    const result: string[] = [];

    const segments: string[] = FAST_ANSI_REGEX.test(text) ? text.split(FAST_ANSI_REGEX).filter(Boolean) : [text];

    for (const seg of segments) {
        if (FAST_ANSI_REGEX.test(seg)) {
            // If the segment is an ANSI escape, pass it through.
            result.push(seg);
        } else {
            // If emoji handling is enabled and the segment contains emoji,
            // split on emoji boundaries.
            const subs: string[] = EMOJI_REGEX.test(seg) ? splitByEmoji(seg).filter(Boolean) : [seg];

            for (const sub of subs) {
                if (EMOJI_REGEX.test(sub)) {
                    result.push(sub);
                } else {
                    // Process each plain text subsegment.
                    // eslint-disable-next-line no-lonely-if
                    if (locale) {
                        // Normalize locale codes
                        const normalizedLocale = locale.toLowerCase().split("-")[0] as NodeLocale;
                        result.push(...splitCamelCaseLocale(sub, normalizedLocale, knownAcronyms));
                    } else {
                        result.push(...splitCamelCaseFast(sub, knownAcronyms));
                    }
                }
            }
        }
    }

    return result;
};

// ─────────────────────────────
// Main Exported Function: splitByCase
// ─────────────────────────────

export interface SplitOptions extends LocaleOptions {
    /** Whether to handle ANSI escape sequences. (default: false) */
    handleAnsi?: boolean;
    /** Whether to handle emoji sequences. (default: false) */
    handleEmoji?: boolean;
    /** A list of known acronyms to preserve casing for. */
    knownAcronyms?: ReadonlyArray<string>;
    /** Whether to normalize case (convert all‑upper tokens not in knownAcronyms to title case). */
    normalize?: boolean;
    /** List of additional separators to split on. */
    separators?: ReadonlyArray<string> | RegExp;
    /** Whether to strip ANSI escape sequences. (default: false) */
    stripAnsi?: boolean;
    /** Whether to strip emoji sequences. (default: false) */
    stripEmoji?: boolean;
}

/**
 * Splits a string into an array based on case transitions, script transitions, and separators.
 *
 * Supports:
 * 1. Case Transitions:
 *    - camelCase → ["camel", "Case"]
 *    - PascalCase → ["Pascal", "Case"]
 *    - Consecutive uppercase with common acronyms → "XMLHttpRequest" → ["XML", "Http", "Request"]
 *    - Numbers → "Query123String" → ["Query", "123", "String"]
 *
 * 2. Script/Writing System Transitions:
 *    - Latin/Japanese:
 *      - Hiragana/Katakana: "ひらがなカタカナ" → ["ひらがな", "カタカナ"]
 *      - Hiragana/Latin: "ひらがなText" → ["ひらがな", "Text"]
 *      - Katakana/Latin: "カタカナText" → ["カタカナ", "Text"]
 *    - Latin/Korean: "한국어Text" → ["한국어", "Text"]
 *    - Latin/Cyrillic: "русскийText" → ["русский", "Text"]
 *    - Latin/Greek: "ελληνικάText" → ["ελληνικά", "Text"]
 *
 * 3. Separators:
 *    - Handles multiple consecutive separators: "__FOO__BAR__" → ["FOO", "BAR"]
 *    - Dots: "foo.bar" → ["foo", "bar"]
 *    - Slashes: "foo/bar" → ["foo", "bar"]
 *    - Hyphens: "foo-bar" → ["foo", "bar"]
 *    - Underscores: "foo_bar" → ["foo", "bar"]
 *
 * @param input - The string to split
 * @param options - Optional configuration object
 * @param options.locale - The locale to use for script-aware splitting (e.g., "ja", "ko", "zh")
 * @param options.acronyms - Additional set of known acronyms to preserve beyond common ones
 * @param options.handleAnsi - Whether to handle ANSI escape sequences. (default: false)
 * @param options.handleEmoji - Whether to handle emoji sequences. (default: false)
 * @param options.normalize - Whether to normalize case (convert all-upper tokens not in knownAcronyms to title case). (default: false)
 * @param options.separators - Overwrite default separators to split on
 * @param options.stripAnsi - Whether to strip ANSI escape sequences. (default: false)
 * @param options.stripEmoji - Whether to strip emoji sequences. (default: false)
 * @returns An array of string segments
 *
 * @example
 *   splitByCase("XMLHttpRequest") // → ["XML", "Http", "Request"]
 *   splitByCase("ひらがなカタカナABC", { locale: "ja" }) // → ["ひらがな", "カタカナ", "ABC"]
 *   splitByCase("__FOO__BAR__") // → ["FOO", "BAR"]
 */
// eslint-disable-next-line sonarjs/cognitive-complexity
export const splitByCase = <T extends string = string>(input: T, options: SplitOptions = {}): SplitByCase<T> => {
    if (!input || typeof input !== "string") {
        return [] as unknown as SplitByCase<T>;
    }

    const {
        handleAnsi = false,
        handleEmoji = false,
        knownAcronyms = [],
        locale,
        normalize = false,
        separators,
        stripAnsi: stripAnsiOption = false,
        stripEmoji: stripEmojiOption = false,
    } = options;

    // Sort acronyms by length (longest first) to prevent partial matches
    // Convert known acronyms to a Set.
    const acronymSet = new Set<string>(knownAcronyms.sort((a, b) => b.length - a.length));

    let cleanedInput = input;

    if (stripAnsiOption) {
        cleanedInput = stripAnsi(cleanedInput) as T;
    }

    if (stripEmojiOption) {
        cleanedInput = stripEmoji(cleanedInput) as T;
    }

    // Precompute the separator regex.
    const separatorRegex = Array.isArray(separators)
        ? getSeparatorsRegex(separators as string[])
        : separators instanceof RegExp
          ? separators
          : SEPARATORS_REGEX;

    // First, split the input on explicit separators.
    const parts = cleanedInput.split(separatorRegex).filter(Boolean);
    let tokens: string[] = [];

    // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax
    for (const part of parts) {
        if (handleAnsi || handleEmoji) {
            tokens.push(...processTextWithAnsiEmoji(part, locale, acronymSet));
        } else if (locale) {
            tokens.push(...splitCamelCaseLocale(part, locale, acronymSet));
        } else {
            tokens.push(...splitCamelCaseFast(part, acronymSet));
        }
    }

    // Optional normalization: for locale-aware tokens,
    // convert all-upper tokens (unless known as an acronym) to title case.
    if (normalize) {
        tokens = tokens.map((token) => {
            if (acronymSet.has(token)) {
                return token;
            }

            if (locale && token === token.toLocaleUpperCase(locale)) {
                return (token[0] as string) + token.slice(1).toLocaleLowerCase(locale);
            }

            if (token.toUpperCase() === token && !acronymSet.has(token)) {
                // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
                return token.slice(0, 1) + (token as string).slice(1).toLowerCase();
            }

            return token;
        });
    }

    return tokens as unknown as SplitByCase<T>;
};
