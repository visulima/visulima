import { stripVTControlCharacters } from "node:util";

import {
    RE_ARABIC,
    RE_BENGALI,
    RE_CYRILLIC,
    RE_DEVANAGARI,
    RE_EMOJI,
    RE_ETHIOPIC,
    RE_FAST_ANSI,
    RE_GREEK,
    RE_GREEK_LATIN_SPLIT,
    RE_GUJARATI,
    RE_GURMUKHI,
    RE_HANGUL,
    RE_HEBREW,
    RE_HIRAGANA,
    RE_KANJI,
    RE_KANNADA,
    RE_KATAKANA,
    RE_KHMER,
    RE_LAO,
    RE_LATIN,
    RE_MALAYALAM,
    RE_MYANMAR,
    RE_ORIYA,
    RE_SEPARATORS,
    RE_SINHALA,
    RE_TAMIL,
    RE_TELUGU,
    RE_THAI,
    RE_TIBETAN,
    RE_UZBEK_LATIN_MODIFIER,
    stripEmoji,
} from "../constants";
import type { NodeLocale } from "../types";
import getSeparatorsRegex from "../utils/get-separators-regex";
import splitByEmoji from "../utils/split-by-emoji";
import type { LocaleOptions, SplitByCase } from "./types";

// Fast lookup tables for performance optimization
const isUpperCode = new Uint8Array(128);
const isLowerCode = new Uint8Array(128);
const isDigitCode = new Uint8Array(128);

// eslint-disable-next-line no-plusplus
for (let index = 0; index < 128; index++) {
    // eslint-disable-next-line security/detect-object-injection
    isUpperCode[index] = index >= 65 && index <= 90 ? 1 : 0; // A-Z
    // eslint-disable-next-line security/detect-object-injection
    isLowerCode[index] = index >= 97 && index <= 122 ? 1 : 0; // a-z
    // eslint-disable-next-line security/detect-object-injection
    isDigitCode[index] = index >= 48 && index <= 57 ? 1 : 0; // 0-9
}

/**
 * Internal helper: Detects if a character code corresponds to an uppercase ASCII letter.
 * Uses a precomputed lookup table for performance.
 *
 * @param code - The character code (0-127).
 * @returns 1 if uppercase ASCII, 0 otherwise.
 */
// @ts-expect-error - Internal helper, type safety handled by usage
// eslint-disable-next-line security/detect-object-injection
const isUpper = (code: number): number => isUpperCode[code];

/**
 * Internal helper: Detects if a character code corresponds to a lowercase ASCII letter.
 * Uses a precomputed lookup table for performance.
 *
 * @param code - The character code (0-127).
 * @returns 1 if lowercase ASCII, 0 otherwise.
 */
// @ts-expect-error - Internal helper, type safety handled by usage
// eslint-disable-next-line security/detect-object-injection
const isLower = (code: number): number => isLowerCode[code];

/**
 * Internal helper: Detects if a character code corresponds to an ASCII digit.
 * Uses a precomputed lookup table for performance.
 *
 * @param code - The character code (0-127).
 * @returns 1 if ASCII digit, 0 otherwise.
 */
// @ts-expect-error - Internal helper, type safety handled by usage
// eslint-disable-next-line security/detect-object-injection
const isDigit = (code: number): number => isDigitCode[code];

/**
 * A shared function to handle script transitions for various locale-specific splitting
 *
 * @param s Input string to process
 * @param scriptDetectors Object mapping script types to detector functions
 * @param caseSensitive Whether to also split on uppercase transitions
 * @param locale Locale for case detection
 * @param customSplitLogic Optional custom logic for determining split points
 * @returns Array of string segments
 */
const handleScriptTransitions = (
    s: string,
    scriptDetectors: Record<string, (char: string) => boolean>,
    caseSensitive: boolean,
    locale?: NodeLocale,
    customSplitLogic?: (
        previousType: string,
        currentType: string,
        previousIsUpper: boolean,
        isUpper: boolean,
        char: string,
        index: number,
        chars: string[],
    ) => boolean,
    // eslint-disable-next-line sonarjs/cognitive-complexity
): string[] => {
    if (s.length === 0) {
        return [];
    }

    // Quick validation - see if any of our detectors match the string
    let hasDetectedScript = false;

    for (const detector of Object.values(scriptDetectors)) {
        if (detector(s[0] as string)) {
            hasDetectedScript = true;
            break;
        }
    }

    // Early return if no relevant scripts detected
    if (!hasDetectedScript && !caseSensitive) {
        return [s];
    }

    const chars = [...s];
    const result: string[] = [];
    let currentSegment = chars[0] as string;

    // Determine initial script type
    let previousType = "other";

    for (const [type, detector] of Object.entries(scriptDetectors)) {
        if (detector(chars[0] as string)) {
            previousType = type;
            break;
        }
    }

    // Track case if needed
    let previousIsUpper = caseSensitive && locale ? (chars[0] as string) === (chars[0] as string).toLocaleUpperCase(locale) : false;

    // Process all characters
    // eslint-disable-next-line no-plusplus
    for (let index = 1; index < chars.length; index++) {
        // eslint-disable-next-line security/detect-object-injection
        const char = chars[index] as string;

        // Determine current script type
        let currentType = "other";

        for (const [type, detector] of Object.entries(scriptDetectors)) {
            if (detector(char)) {
                currentType = type;
                break;
            }
        }

        // Check for case if needed
        const isUpperCaseChar = caseSensitive && locale ? char === char.toLocaleUpperCase(locale) : false;

        // Determine if we should split
        let shouldSplit = false;

        if (customSplitLogic) {
            // Use custom split logic if provided
            shouldSplit = customSplitLogic(previousType, currentType, previousIsUpper, isUpperCaseChar, char, index, chars);
        } else {
            // Default split logic
            // Split on script transitions between known scripts
            if (previousType !== currentType && previousType !== "other" && currentType !== "other") {
                shouldSplit = true;
            }

            // Split on case transitions if enabled
            if (caseSensitive && currentType !== "other" && !previousIsUpper && isUpperCaseChar) {
                shouldSplit = true;
            }
        }

        if (shouldSplit) {
            result.push(currentSegment);
            currentSegment = char;
        } else {
            currentSegment += char;
        }

        previousType = currentType;
        if (caseSensitive) {
            previousIsUpper = isUpperCaseChar;
        }
    }

    // Add the last segment if it exists
    if (currentSegment && currentSegment.length > 0) {
        result.push(currentSegment);
    }

    return result.length > 0 ? result : [s];
};

/**
 * Internal helper: Splits a string by camelCase/PascalCase conventions using fast ASCII checks.
 * Optimized for strings primarily using ASCII characters. Handles known acronyms.
 *
 * @param s - The string to split.
 * @param knownAcronyms - A set of known acronyms to preserve.
 * @returns An array of split segments.
 */
// eslint-disable-next-line sonarjs/cognitive-complexity
const splitCamelCaseFast = (s: string, knownAcronyms: Set<string> = new Set()): string[] => {
    if (s.length === 0) {
        return [];
    }

    if (s.toUpperCase() === s) {
        return [s];
    }

    let start = 0;

    const tokens: string[] = [];

    const width = s.length;

    // eslint-disable-next-line no-plusplus
    for (let index = 1; index < width; index++) {
        const previousCode = s.codePointAt(index - 1);
        const currentCode = s.codePointAt(index);

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
                // eslint-disable-next-line no-continue
                continue;
            }
        }


        const previousIsUpper = previousCode && previousCode < 128 && isUpper(previousCode);

        const currentIsUpper = currentCode && currentCode < 128 && isUpper(currentCode);

        const previousIsLower = previousCode && previousCode < 128 && isLower(previousCode);

        const previousIsDigit = previousCode && previousCode < 128 && isDigit(previousCode);

        const currentIsDigit = currentCode && currentCode < 128 && isDigit(currentCode);

        // Lower-to-Upper transition: [a-z] -> [A-Z]
        if (previousIsLower && currentIsUpper) {
            tokens.push(s.slice(start, index));
            start = index;
            // eslint-disable-next-line no-continue
            continue;
        }

        // Digit-Letter transition
        if ((previousIsDigit && !currentIsDigit) || (!previousIsDigit && currentIsDigit)) {
            tokens.push(s.slice(start, index));
            start = index;
            // eslint-disable-next-line no-continue
            continue;
        }

        // Handle pattern sequences like R2D2, C3PO with special attention to single digit followed by uppercase letter
        if (currentIsDigit && !previousIsDigit) {
            // Get the next character if available
            let isNextUpper = false;
            let isNextDigit = false;

            if (index + 1 < width) {
                const nextCode = s.codePointAt(index + 1);

                isNextUpper = (nextCode && nextCode < 128 && isUpper(nextCode)) as boolean;

                isNextDigit = (nextCode && nextCode < 128 && isDigit(nextCode)) as boolean;
            }

            // Pattern: letter + single digit + uppercase letter (like R2D or C3P)
            if (!isNextDigit && isNextUpper) {
                tokens.push(s.slice(start, index), s.slice(index, index + 1)); // The digit
                start = index + 1;
                // eslint-disable-next-line no-continue
                continue;
            }
        }

        // Uppercase acronym boundary detection
        if (index + 1 < width) {
            const nextCode = s.codePointAt(index + 1);

            const nextIsLower = nextCode && nextCode < 128 && isLower(nextCode);

            if (previousIsUpper && currentIsUpper && nextIsLower) {
                const candidate = s.slice(start, index + 1);

                if (!knownAcronyms.has(candidate)) {
                    tokens.push(s.slice(start, index));
                    start = index;
                }
            }
        }
    }

    // Capture the last segment
    if (start < width) {
        tokens.push(s.slice(start));
    }

    // Filter out empty tokens which can occur in edge cases
    return tokens.filter((token) => token !== "");
};

/**
 * Internal helper: Splits a string by camelCase/PascalCase conventions using locale-aware checks.
 * Slower than the fast version but correctly handles non-ASCII characters and locale-specific casing.
 * Handles known acronyms.
 *
 * @param s - The string to split.
 * @param locale - The locale to use for case conversion.
 * @param knownAcronyms - A set of known acronyms to preserve.
 * @returns An array of split segments.
 */
// eslint-disable-next-line sonarjs/cognitive-complexity
const splitCamelCaseLocale = (s: string, locale: NodeLocale, knownAcronyms: Set<string>): string[] => {
    if (s.length === 0) {
        return [];
    }

    // Fast path: if no known acronyms and string is all uppercase,
    // return the string as a single token
    const isUpperCase = s === s.toLocaleUpperCase(locale);

    // Special case for German: handle eszett and mixed case
    if (locale.startsWith("de")) {
        // If the string is all uppercase (considering eszett), return as is
        if (!isUpperCase && s.replaceAll("ß", "SS") === s.toLocaleUpperCase(locale)) {
            return [s];
        }

        const chars = [...s];
        // eslint-disable-next-line @typescript-eslint/naming-convention,no-underscore-dangle
        const width_ = chars.length;
        const result: string[] = [];
        let currentSegment = chars[0] as string;

        let previousIsUpper = chars[0] === (chars[0] as string).toLocaleUpperCase(locale);
        let isInUpperSequence = previousIsUpper;
        let upperSequenceStart = previousIsUpper ? 0 : -1;

        // eslint-disable-next-line no-plusplus
        for (let index = 1; index < width_; index++) {
            // eslint-disable-next-line security/detect-object-injection
            const char = chars[index];
            const isUpperCaseChar = char === (char as string).toLocaleUpperCase(locale);

            if (isUpperCaseChar === previousIsUpper) {
                // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
                currentSegment += char;
            } else if (isUpperCaseChar) {
                // Transition to uppercase
                if (currentSegment && currentSegment.length > 0) {
                    result.push(currentSegment);
                    currentSegment = char;
                }
                isInUpperSequence = true;
                upperSequenceStart = index;
            } else {
                // Transition to lowercase
                if (isInUpperSequence && index - upperSequenceStart > 1) {
                    // If we had a sequence of uppercase letters, split before the last one
                    const lastUpperChar = chars[index - 1] as string;
                    const withoutLastUpper = currentSegment.slice(0, -1);
                    if (withoutLastUpper && withoutLastUpper.length > 0) {
                        result.push(withoutLastUpper);
                    }
                    // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
                    currentSegment = lastUpperChar + char;
                } else {
                    // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
                    currentSegment += char;
                }
                isInUpperSequence = false;
                upperSequenceStart = -1;
            }

            previousIsUpper = isUpperCaseChar;
        }

        if (currentSegment && currentSegment.length > 0) {
            result.push(currentSegment);
        }

        return result;
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
        if (!RE_CYRILLIC.test(s) && !RE_LATIN.test(s)) {
            return [s];
        }

        const chars: string[] = [...s];
        // eslint-disable-next-line @typescript-eslint/naming-convention,no-underscore-dangle
        const width_ = chars.length;
        const result: string[] = [];
        let currentSegment = chars[0] as string;

        // Determine initial type (1=cyrillic, 2=latin, 0=other)
        let previousType = RE_CYRILLIC.test(chars[0] as string) ? 1 : RE_LATIN.test(chars[0] as string) ? 2 : 0;
        let previousIsUpper = (chars[0] as string) === (chars[0] as string).toLocaleUpperCase(locale);

        // eslint-disable-next-line no-plusplus
        for (let index = 1; index < width_; index++) {
            // eslint-disable-next-line security/detect-object-injection
            const char = chars[index] as string;
            const currentType = RE_CYRILLIC.test(char) ? 1 : RE_LATIN.test(char) ? 2 : 0;
            const isUpperCaseChar = char === char.toLocaleUpperCase(locale);

            // Split on script transitions or case changes within the same script
            if (
                (previousType !== currentType && (previousType === 1 || previousType === 2) && (currentType === 1 || currentType === 2)) ||
                (currentType === previousType && !previousIsUpper && isUpperCaseChar)
            ) {
                result.push(currentSegment);
                currentSegment = char;
            } else {
                currentSegment += char;
            }

            previousType = currentType;
            previousIsUpper = isUpperCaseChar;
        }

        if (currentSegment && currentSegment.length > 0) {
            result.push(currentSegment);
        }

        // Post-process: merge single Latin characters with following Cyrillic if they form a word
        const finalResult: string[] = [];

        // eslint-disable-next-line no-plusplus
        for (let index = 0; index < result.length; index++) {
            if (
                index < result.length - 1 &&
                // eslint-disable-next-line security/detect-object-injection
                (result[index] as string).length === 1 &&
                // eslint-disable-next-line security/detect-object-injection
                RE_LATIN.test(result[index] as string) &&
                RE_CYRILLIC.test((result[index + 1] as string)[0] as string)
            ) {
                // eslint-disable-next-line security/detect-object-injection
                finalResult.push((result[index] as string) + (result[index + 1] as string));
                // eslint-disable-next-line no-plusplus
                index++; // Skip the next segment since we merged it
            } else {
                // eslint-disable-next-line security/detect-object-injection
                finalResult.push(result[index] as string);
            }
        }

        return finalResult;
    }

    // Special handling for Greek scripts
    if (locale.startsWith("el")) {
        if (!RE_GREEK.test(s) && !RE_LATIN.test(s)) {
            return [s];
        }

        const parts = s.match(RE_GREEK_LATIN_SPLIT) ?? [s];
        const result: string[] = [];
        const width = parts.length;

        // Fast path for single-part strings
        if (width === 1) {
            const part = parts[0];

            if (!part || !RE_GREEK.test(part[0] as string) || part.length === 1) {
                return [part || s];
            }
        }

        for (const part of parts) {
            // Skip empty parts
            if (!part) {
                // eslint-disable-next-line no-continue
                continue;
            }

            // Fast path for non-Greek or single-char parts
            if (!RE_GREEK.test(part[0] as string) || part.length === 1) {
                result.push(part);
                // eslint-disable-next-line no-continue
                continue;
            }

            // For Greek text longer than 1 character, split on case transitions
            const partLength = part.length;

            let word = part[0] as string;
            // eslint-disable-next-line @typescript-eslint/prefer-string-starts-ends-with
            let previousIsUpper = part[0] === (part[0] as string).toLocaleUpperCase(locale);

            // eslint-disable-next-line no-plusplus
            for (let index = 1; index < partLength; index++) {
                // eslint-disable-next-line security/detect-object-injection
                const char = part[index] as string;
                const isUpperCaseChar = char === (char as string).toLocaleUpperCase(locale);

                if (!previousIsUpper && isUpperCaseChar) {
                    result.push(word);
                    word = char;
                } else {
                    word += char;
                }

                previousIsUpper = isUpperCaseChar;
            }

            if (word) {
                result.push(word);
            }
        }

        return result;
    }

    // Special handling for Japanese and Korean scripts
    if (locale.startsWith("ja") || locale.startsWith("ko")) {
        const isJapanese = locale.startsWith("ja");

        const scriptDetectors: Record<string, (char: string) => boolean> = isJapanese
            ? {
                  hiragana: (char) => RE_HIRAGANA.test(char),
                  kanji: (char) => RE_KANJI.test(char),
                  katakana: (char) => RE_KATAKANA.test(char),
                  latin: (char) => RE_LATIN.test(char),
              }
            : {
                  hangul: (char) => RE_HANGUL.test(char),
                  latin: (char) => RE_LATIN.test(char),
              };

        // Pre-compiled Set for Japanese particles - defined once and cached
        const particles = new Set(["と", "に", "へ", "を", "は", "が", "の", "で", "や", "も"]);

        if (isJapanese) {
            const baseSegments = handleScriptTransitions(
                s,
                scriptDetectors,
                false,
                locale,
                (previousType, currentType) =>
                    (previousType === "hiragana" && currentType === "katakana") || // hiragana -> katakana
                    (previousType === "katakana" && currentType === "hiragana") || // katakana -> hiragana
                    (previousType === "hiragana" && currentType === "latin") || // hiragana -> latin
                    (previousType === "katakana" && currentType === "latin") || // katakana -> latin
                    (previousType === "kanji" && currentType === "latin") || // kanji -> latin
                    (previousType === "latin" && (currentType === "hiragana" || currentType === "katakana" || currentType === "kanji")), // latin -> japanese
            );

            // Post-process for Japanese particles
            const result: string[] = [];

            for (const segment of baseSegments) {
                if (segment.length === 1 && particles.has(segment) && result.length > 0) {
                    // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
                    result[result.length - 1] += segment;
                } else {
                    result.push(segment);
                }
            }

            return result.length > 0 ? result : [s];
        }
        // Korean
        return handleScriptTransitions(
            s,
            scriptDetectors,
            false,
            locale,
            (previousType, currentType) =>
                (previousType === "hangul" && currentType === "latin") || // hangul -> latin
                (previousType === "latin" && currentType === "hangul"), // latin -> hangul
        );
    }

    // Special handling for Slovenian scripts
    if (locale.startsWith("sl")) {
        const chars = [...s];
        // eslint-disable-next-line @typescript-eslint/naming-convention,no-underscore-dangle
        const width_ = chars.length;
        const result: string[] = [];

        let currentSegment = chars[0] as string;
        let previousIsUpper = chars[0] === (chars[0] as string).toLocaleUpperCase(locale);

        // Process remaining characters
        // eslint-disable-next-line no-plusplus
        for (let index = 1; index < width_; index++) {
            // eslint-disable-next-line security/detect-object-injection
            const char = chars[index] as string;
            const isUpperCaseChar = char === (char as string).toLocaleUpperCase(locale);

            // Special handling for Slovenian characters
            const isSpecialChar = /[ČŠŽĐ]/i.test(char);
            const nextIsUpper = index < width_ - 1 && chars[index + 1] === (chars[index + 1] as string).toLocaleUpperCase(locale);

            // Split on case transitions and special characters
            if ((!previousIsUpper && isUpperCaseChar) || (isSpecialChar && nextIsUpper)) {
                result.push(currentSegment);
                currentSegment = char;

                if (isSpecialChar && nextIsUpper) {
                    result.push(currentSegment);
                    currentSegment = "";
                }
            } else {
                currentSegment += char;
            }

            previousIsUpper = isUpperCaseChar;
        }

        if (currentSegment && currentSegment.length > 0) {
            result.push(currentSegment);
        }

        return result;
    }

    // Special handling for Chinese scripts
    if (locale.startsWith("zh")) {
        return handleScriptTransitions(
            s,
            {
                han: (char) => RE_KANJI.test(char),
                latin: (char) => RE_LATIN.test(char),
            },
            false,
            locale,
        );
    }

    // Special handling for RTL scripts (Arabic, Persian, Hebrew, Urdu)
    if (["ar", "fa", "he", "ur"].includes(locale.split("-")[0])) {
        // Helper function to check if a character is RTL
        const isRtlChar = (ch: string): boolean => RE_HEBREW.test(ch) || RE_ARABIC.test(ch);

        return handleScriptTransitions(
            s,
            {
                latin: (char) => RE_LATIN.test(char),
                rtl: (char) => isRtlChar(char),
            },
            false,
            locale,
        );
    }

    // Special handling for Indic scripts
    if (
        [
            "am", // Amharic
            "bn", // Bengali
            "gu", // Gujarati
            "hi", // Hindi
            "km", // Khmer
            "kn", // Kannada
            "lo", // Lao
            "ml", // Malayalam
            "mr", // Marathi
            "ne", // Nepali
            "or", // Oriya
            "pa", // Punjabi
            "si", // Sinhala
            "ta", // Tamil
            "te", // Telugu
            "th", // Thai
        ].includes(locale.split("-")[0])
    ) {
        // Helper function to check if a character is Indic
        const isIndicChar = (ch: string): boolean =>
            RE_DEVANAGARI.test(ch) ||
            RE_BENGALI.test(ch) ||
            RE_GUJARATI.test(ch) ||
            RE_GURMUKHI.test(ch) ||
            RE_KANNADA.test(ch) ||
            RE_TAMIL.test(ch) ||
            RE_TELUGU.test(ch) ||
            RE_MALAYALAM.test(ch) ||
            RE_SINHALA.test(ch) ||
            RE_THAI.test(ch) ||
            RE_LAO.test(ch) ||
            RE_TIBETAN.test(ch) ||
            RE_MYANMAR.test(ch) ||
            RE_ETHIOPIC.test(ch) ||
            RE_KHMER.test(ch) ||
            RE_ORIYA.test(ch);

        return handleScriptTransitions(
            s,
            {
                indic: (char) => isIndicChar(char),
                latin: (char) => RE_LATIN.test(char),
            },
            false,
            locale,
        );
    }

    // Special handling for Cyrillic scripts (Russian, Ukrainian, etc.)
    if (["be", "bg", "ru", "sr", "uk"].includes(locale)) {
        return handleScriptTransitions(
            s,
            {
                cyrillic: (char) => RE_CYRILLIC.test(char),
                latin: (char) => RE_LATIN.test(char),
            },
            true, // Enable case-sensitive splitting
            locale,
        );
    }

    // Special handling for Arabic and Hebrew scripts
    if (["ar", "fa", "he"].includes(locale)) {
        return handleScriptTransitions(
            s,
            {
                latin: (char) => RE_LATIN.test(char),
                rtl: (char) => RE_HEBREW.test(char) || RE_ARABIC.test(char),
            },
            false,
            locale,
        );
    }

    // Special handling for Korean scripts
    if (locale.startsWith("ko")) {
        return handleScriptTransitions(
            s,
            {
                hangul: (char) => RE_HANGUL.test(char),
                latin: (char) => RE_LATIN.test(char),
            },
            false,
            locale,
        );
    }

    // Special handling for Uzbek scripts
    if (locale.startsWith("uz")) {
        // Early return if no Cyrillic or Latin characters
        if (!RE_CYRILLIC.test(s) && !RE_LATIN.test(s)) {
            return [s];
        }

        const chars = [...s];
        // eslint-disable-next-line @typescript-eslint/naming-convention,no-underscore-dangle
        const width_ = chars.length;
        const result: string[] = [];

        let currentSegment = chars[0] as string;
        let previousIsUpper = chars[0] === (chars[0] as string).toLocaleUpperCase(locale);

        // eslint-disable-next-line no-plusplus
        for (let index = 1; index < width_; index++) {
            // eslint-disable-next-line security/detect-object-injection
            const char = chars[index] as string;
            const isUpperCaseChar = char === char.toLocaleUpperCase(locale);

            // Special handling for Uzbek Latin modifiers
            if (RE_UZBEK_LATIN_MODIFIER.test(char) || RE_UZBEK_LATIN_MODIFIER.test(chars[index - 1] as string)) {
                currentSegment += char;
                // eslint-disable-next-line no-continue
                continue;
            }

            if (!previousIsUpper && isUpperCaseChar) {
                result.push(currentSegment);
                currentSegment = char;
            } else {
                currentSegment += char;
            }

            previousIsUpper = isUpperCaseChar;
        }

        if (currentSegment && currentSegment.length > 0) {
            result.push(currentSegment);
        }

        return result;
    }

    // Handle default case - Latin script with case transitions
    const chars = [...s];
    // eslint-disable-next-line @typescript-eslint/naming-convention,no-underscore-dangle
    const width_ = chars.length;
    const result: string[] = [];
    let currentSegment = chars[0] as string;
    let previousIsUpper = chars[0] === (chars[0] as string).toLocaleUpperCase(locale);

    // Check for known acronyms first

    for (const acronym of knownAcronyms) {
        if (s.startsWith(acronym)) {
            result.push(acronym);
            currentSegment = chars[acronym.length] as string;
            previousIsUpper = currentSegment === currentSegment.toLocaleUpperCase(locale);
            break;
        }
    }

    // eslint-disable-next-line no-plusplus
    for (let index = 1; index < width_; index++) {
        // eslint-disable-next-line security/detect-object-injection
        const char = chars[index] as string;
        const isUpperCaseChar = char === char.toLocaleUpperCase(locale);

        // Check for acronyms at current position
        let isAcronym = false;

        for (const acronym of knownAcronyms) {
            if (s.startsWith(acronym, index)) {
                result.push(currentSegment, acronym);
                index += acronym.length - 1;
                currentSegment = "";
                isAcronym = true;
                break;
            }
        }

        if (isAcronym) {
            // eslint-disable-next-line no-continue
            continue;
        }

        // Split on case transitions
        if (!previousIsUpper && isUpperCaseChar) {
            result.push(currentSegment);
            currentSegment = char;
        } else {
            currentSegment += char;
        }

        previousIsUpper = isUpperCaseChar;
    }

    if (currentSegment) {
        result.push(currentSegment);
    }

    return result;
};

/**
 * Internal helper: Pre-processes text by splitting ANSI codes and emoji sequences,
 * then applies locale-specific camel case splitting to the remaining text segments.
 *
 * @param text - The input string, potentially containing ANSI and emoji.
 * @param locale - Optional locale for case splitting.
 * @param knownAcronyms - Set of known acronyms.
 * @returns An array of split segments, including preserved ANSI/emoji sequences.
 */
// eslint-disable-next-line sonarjs/cognitive-complexity
const processTextWithAnsiEmoji = (text: string, locale: NodeLocale | undefined, knownAcronyms: Set<string>): string[] => {
    const result: string[] = [];
    const segments: string[] = RE_FAST_ANSI.test(text) ? text.split(RE_FAST_ANSI).filter(Boolean) : [text];

    for (const seg of segments) {
        if (RE_FAST_ANSI.test(seg)) {
            // If the segment is an ANSI escape, pass it through.
            result.push(seg);
        } else {
            // If emoji handling is enabled and the segment contains emoji,
            // split on emoji boundaries.
            const subs: string[] = RE_EMOJI.test(seg) ? splitByEmoji(seg).filter(Boolean) : [seg];

            for (const sub of subs) {
                if (RE_EMOJI.test(sub)) {
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

/** Options for the `splitByCase` function. */
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
 * Splits a string into segments based on various criteria including case changes,
 * separators, Unicode scripts, ANSI codes, and emojis.
 *
 * This is the core splitting logic used by various case conversion functions.
 *
 * @template T - The specific literal type of the input string, if known.
 * @param input - The string to split.
 * @param options - Configuration options for splitting behavior.
 * @returns An array of string segments.
 *
 * @example
 * ```typescript
 * splitByCase("fooBarBaz") // => ["foo", "Bar", "Baz"]
 * splitByCase("foo_bar-baz") // => ["foo", "bar", "baz"]
 * splitByCase("HTMLElement") // => ["HTML", "Element"]
 * splitByCase("HTMLElement", { knownAcronyms: ["HTML"] }) // => ["HTML", "Element"]
 * splitByCase("\u001B[31mhello\u001B[0mWorld", { handleAnsi: true }) // => ["\u001B[31m", "hello", "\u001B[0m", "World"]
 * splitByCase("hello🌍world", { handleEmoji: true }) // => ["hello", "🌍", "world"]
 * ```
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
    const acronymSet = new Set<string>([...knownAcronyms].sort((a, b) => b.length - a.length));

    let cleanedInput = input;

    if (stripAnsiOption) {
        cleanedInput = stripVTControlCharacters(cleanedInput) as T;
    }

    if (stripEmojiOption) {
        cleanedInput = stripEmoji(cleanedInput) as T;
    }

    // Precompute the separator regex.
    const separatorRegex = Array.isArray(separators) ? getSeparatorsRegex(separators as string[]) : separators instanceof RegExp ? separators : RE_SEPARATORS;

    // First, split the input on explicit separators.
    const parts = cleanedInput.split(separatorRegex).filter(Boolean);
    let tokens: string[] = [];

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
                return token.slice(0, 1) + (token as string).slice(1).toLowerCase();
            }

            return token;
        });
    }

    return tokens as unknown as SplitByCase<T>;
};
