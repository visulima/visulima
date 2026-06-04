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

const RE_SLOVENIAN_SPECIAL = /[ČŠŽĐ]/i;

// Fast lookup tables for performance optimization
const isUpperCode = new Uint8Array(128);
const isLowerCode = new Uint8Array(128);
const isDigitCode = new Uint8Array(128);

// eslint-disable-next-line no-plusplus
for (let index = 0; index < 128; index++) {
    isUpperCode[index] = index >= 65 && index <= 90 ? 1 : 0; // A-Z

    isLowerCode[index] = index >= 97 && index <= 122 ? 1 : 0; // a-z

    isDigitCode[index] = index >= 48 && index <= 57 ? 1 : 0; // 0-9
}

/**
 * Internal helper: Detects if a character code corresponds to an uppercase ASCII letter.
 * Uses a precomputed lookup table for performance.
 * @param code The character code (0-127).
 * @returns 1 if uppercase ASCII, 0 otherwise.
 */
// @ts-expect-error - Internal helper, type safety handled by usage

const isUpper = (code: number): number => isUpperCode[code];

/**
 * Internal helper: Detects if a character code corresponds to a lowercase ASCII letter.
 * Uses a precomputed lookup table for performance.
 * @param code The character code (0-127).
 * @returns 1 if lowercase ASCII, 0 otherwise.
 */
// @ts-expect-error - Internal helper, type safety handled by usage

const isLower = (code: number): number => isLowerCode[code];

/**
 * Internal helper: Detects if a character code corresponds to an ASCII digit.
 * Uses a precomputed lookup table for performance.
 * @param code The character code (0-127).
 * @returns 1 if ASCII digit, 0 otherwise.
 */
// @ts-expect-error - Internal helper, type safety handled by usage

const isDigit = (code: number): number => isDigitCode[code];

/**
 * Handles script transitions for various locale-specific splitting.
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

    const detectorValues = Object.values(scriptDetectors);

    for (const detectorValue of detectorValues) {
        if (detectorValue(s[0] as string)) {
            hasDetectedScript = true;
            break;
        }
    }

    // Early return if no relevant scripts detected
    if (!hasDetectedScript && !caseSensitive) {
        return [s];
    }

    // eslint-disable-next-line @typescript-eslint/no-misused-spread -- intentional: Unicode code point splitting needed for script detection
    const chars = [...s];
    const result: string[] = [];
    let currentSegment = chars[0] as string;

    // Determine initial script type
    let previousType = "other";

    const scriptEntries = Object.entries(scriptDetectors);

    for (const scriptEntry of scriptEntries) {
        const [type, detector] = scriptEntry as [string, (char: string) => boolean];

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
        const char = chars[index] as string;

        // Determine current script type
        let currentType = "other";

        for (const scriptEntry of scriptEntries) {
            const [type, detector] = scriptEntry as [string, (char: string) => boolean];

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
 * Internal helper: Detects and processes a known acronym at the current start position.
 * @param s The string being processed.
 * @param start The current start position.
 * @param knownAcronyms A set of known acronyms to check.
 * @param tokens The tokens array to append the acronym to.
 * @returns The new start position after the acronym, or the original start if no acronym found.
 */
const detectAndProcessAcronym = (s: string, start: number, knownAcronyms: Set<string>, tokens: string[]): number => {
    if (knownAcronyms.size === 0) {
        return start;
    }

    for (const acronym of knownAcronyms) {
        if (s.startsWith(acronym, start)) {
            tokens.push(acronym);

            return start + acronym.length;
        }
    }

    return start;
};

/**
 * Internal helper: Splits a string by camelCase/PascalCase conventions using fast ASCII checks.
 * Optimized for strings primarily using ASCII characters. Handles known acronyms.
 * @param s The string to split.
 * @param knownAcronyms A set of known acronyms to preserve.
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
        // Check for acronyms at the current start position
        const newStart = detectAndProcessAcronym(s, start, knownAcronyms, tokens);

        if (newStart !== start) {
            // An acronym was found and processed, skip to the position after it
            start = newStart;
            /* eslint-disable-next-line sonarjs/updated-loop-counter */
            index = start - 1; // Set to start-1 so next iteration (after index++) resumes at start
            continue;
        }

        const previousCode = s.codePointAt(index - 1);
        const currentCode = s.codePointAt(index);

        const previousIsUpper = previousCode && previousCode < 128 && isUpper(previousCode);

        const currentIsUpper = currentCode && currentCode < 128 && isUpper(currentCode);

        const previousIsLower = previousCode && previousCode < 128 && isLower(previousCode);

        const previousIsDigit = previousCode && previousCode < 128 && isDigit(previousCode);

        const currentIsDigit = currentCode && currentCode < 128 && isDigit(currentCode);

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

            if (index + 1 < width) {
                const nextCode = s.codePointAt(index + 1);

                isNextUpper = (nextCode && nextCode < 128 && isUpper(nextCode)) as boolean;

                isNextDigit = (nextCode && nextCode < 128 && isDigit(nextCode)) as boolean;
            }

            // Pattern: letter + single digit + uppercase letter (like R2D or C3P)
            if (!isNextDigit && isNextUpper) {
                tokens.push(s.slice(start, index), s.slice(index, index + 1)); // The digit
                start = index + 1;

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
 * @param s The string to split.
 * @param locale The locale to use for case conversion.
 * @param knownAcronyms A set of known acronyms to preserve.
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

        // eslint-disable-next-line @typescript-eslint/no-misused-spread -- intentional: Unicode code point splitting for locale-aware character processing
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
            const char = chars[index] as string;
            const isUpperCaseChar = char === char.toLocaleUpperCase(locale);

            if (isUpperCaseChar === previousIsUpper) {
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

                    currentSegment = lastUpperChar + char;
                } else {
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
        locale.startsWith("uk")
        || locale.startsWith("ru")
        || locale.startsWith("bg")
        || locale.startsWith("sr")
        || locale.startsWith("mk")
        || locale.startsWith("be")
    ) {
        if (!RE_CYRILLIC.test(s) && !RE_LATIN.test(s)) {
            return [s];
        }

        // eslint-disable-next-line @typescript-eslint/no-misused-spread -- intentional: Unicode code point splitting for Cyrillic/Latin script detection
        const chars: string[] = [...s];
        // eslint-disable-next-line @typescript-eslint/naming-convention,no-underscore-dangle
        const width_ = chars.length;
        const result: string[] = [];
        let currentSegment = chars[0] as string;

        // Determine initial type (1=cyrillic, 2=latin, 0=other)
        const firstChar = chars[0] as string;
        let previousType: number;

        if (RE_CYRILLIC.test(firstChar)) {
            previousType = 1;
        } else if (RE_LATIN.test(firstChar)) {
            previousType = 2;
        } else {
            previousType = 0;
        }

        let previousIsUpper = firstChar === firstChar.toLocaleUpperCase(locale);

        // eslint-disable-next-line no-plusplus
        for (let index = 1; index < width_; index++) {
            const char = chars[index] as string;
            let currentType: number;

            if (RE_CYRILLIC.test(char)) {
                currentType = 1;
            } else if (RE_LATIN.test(char)) {
                currentType = 2;
            } else {
                currentType = 0;
            }

            const isUpperCaseChar = char === char.toLocaleUpperCase(locale);

            // Split on script transitions or case changes within the same script
            if (
                (previousType !== currentType && (previousType === 1 || previousType === 2) && (currentType === 1 || currentType === 2))
                || (currentType === previousType && !previousIsUpper && isUpperCaseChar)
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
                index < result.length - 1
                && (result[index] as string).length === 1
                && RE_LATIN.test(result[index] as string)
                && RE_CYRILLIC.test((result[index + 1] as string)[0] as string)
            ) {
                finalResult.push((result[index] as string) + (result[index + 1] as string));
                // Skip the next segment since we merged it by incrementing in the loop

                index += 1;
            } else {
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

        const parts: string[] = [];

        RE_GREEK_LATIN_SPLIT.lastIndex = 0;

        let greekExecMatch: RegExpExecArray | null;

        // eslint-disable-next-line no-cond-assign
        while ((greekExecMatch = RE_GREEK_LATIN_SPLIT.exec(s)) !== null) {
            parts.push(greekExecMatch[0]);
        }

        if (parts.length === 0) {
            parts.push(s);
        }

        const result: string[] = [];
        const width = parts.length;

        // Fast path for single-part strings
        if (width === 1) {
            const part = parts[0];

            if (!part || !RE_GREEK.test(part[0] as string) || part.length === 1) {
                return [part ?? s];
            }
        }

        for (const greekPart of parts) {
            // Skip empty parts
            if (!greekPart) {
                continue;
            }

            // Fast path for non-Greek or single-char parts
            if (!RE_GREEK.test(greekPart[0] as string) || greekPart.length === 1) {
                result.push(greekPart);

                continue;
            }

            // For Greek text longer than 1 character, split on case transitions
            const partLength = greekPart.length;

            let word = greekPart[0] as string;

            let previousIsUpper = greekPart[0] === (greekPart[0] as string).toLocaleUpperCase(locale);

            // eslint-disable-next-line no-plusplus
            for (let index = 1; index < partLength; index++) {
                const char = greekPart[index] as string;
                const isUpperCaseChar = char === char.toLocaleUpperCase(locale);

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
        const particles = new Set(["が", "で", "と", "に", "の", "は", "へ", "も", "や", "を"]);

        if (isJapanese) {
            const baseSegments = handleScriptTransitions(
                s,
                scriptDetectors,
                false,
                locale,
                (previousType, currentType) =>
                    (previousType === "hiragana" && currentType === "katakana") // hiragana -> katakana
                    || (previousType === "katakana" && currentType === "hiragana") // katakana -> hiragana
                    || (previousType === "hiragana" && currentType === "latin") // hiragana -> latin
                    || (previousType === "katakana" && currentType === "latin") // katakana -> latin
                    || (previousType === "kanji" && currentType === "latin") // kanji -> latin
                    || (previousType === "latin" && (currentType === "hiragana" || currentType === "katakana" || currentType === "kanji")), // latin -> japanese
            );

            // Post-process for Japanese particles
            const result: string[] = [];

            for (const baseSegment of baseSegments) {
                const segment = baseSegment;

                if (segment.length === 1 && particles.has(segment) && result.length > 0) {
                    result[result.length - 1] = (result.at(-1) as string) + segment;
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
                (previousType === "hangul" && currentType === "latin") // hangul -> latin
                || (previousType === "latin" && currentType === "hangul"), // latin -> hangul
        );
    }

    // Special handling for Slovenian scripts
    if (locale.startsWith("sl")) {
        // eslint-disable-next-line @typescript-eslint/no-misused-spread -- intentional: Unicode code point splitting for Slovenian character processing
        const chars = [...s];
        // eslint-disable-next-line @typescript-eslint/naming-convention,no-underscore-dangle
        const width_ = chars.length;
        const result: string[] = [];

        let currentSegment = chars[0] as string;
        let previousIsUpper = chars[0] === (chars[0] as string).toLocaleUpperCase(locale);

        // Process remaining characters
        // eslint-disable-next-line no-plusplus
        for (let index = 1; index < width_; index++) {
            const char = chars[index] as string;
            const isUpperCaseChar = char === char.toLocaleUpperCase(locale);

            // Special handling for Slovenian characters
            const isSpecialChar = RE_SLOVENIAN_SPECIAL.test(char);
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
            RE_DEVANAGARI.test(ch)
            || RE_BENGALI.test(ch)
            || RE_GUJARATI.test(ch)
            || RE_GURMUKHI.test(ch)
            || RE_KANNADA.test(ch)
            || RE_TAMIL.test(ch)
            || RE_TELUGU.test(ch)
            || RE_MALAYALAM.test(ch)
            || RE_SINHALA.test(ch)
            || RE_THAI.test(ch)
            || RE_LAO.test(ch)
            || RE_TIBETAN.test(ch)
            || RE_MYANMAR.test(ch)
            || RE_ETHIOPIC.test(ch)
            || RE_KHMER.test(ch)
            || RE_ORIYA.test(ch);

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

        // eslint-disable-next-line @typescript-eslint/no-misused-spread -- intentional: Unicode code point splitting for Uzbek character processing
        const chars = [...s];
        // eslint-disable-next-line @typescript-eslint/naming-convention,no-underscore-dangle
        const width_ = chars.length;
        const result: string[] = [];

        let currentSegment = chars[0] as string;
        let previousIsUpper = chars[0] === (chars[0] as string).toLocaleUpperCase(locale);

        // eslint-disable-next-line no-plusplus
        for (let index = 1; index < width_; index++) {
            const char = chars[index] as string;
            const isUpperCaseChar = char === char.toLocaleUpperCase(locale);

            // Special handling for Uzbek Latin modifiers
            if (RE_UZBEK_LATIN_MODIFIER.test(char) || RE_UZBEK_LATIN_MODIFIER.test(chars[index - 1] as string)) {
                currentSegment += char;

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

    // eslint-disable-next-line @typescript-eslint/no-misused-spread -- intentional: Unicode code point splitting for locale-aware character processing
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
        const char = chars[index] as string;
        const isUpperCaseChar = char === char.toLocaleUpperCase(locale);

        // Check for acronyms at current position
        let acronymLength = 0;

        for (const acronym of knownAcronyms) {
            if (s.startsWith(acronym, index)) {
                result.push(currentSegment, acronym);
                acronymLength = acronym.length;
                currentSegment = "";

                // Keep case-tracking consistent by basing previousIsUpper on the acronym tail.
                const lastAcronymChar = acronym.at(-1);

                if (lastAcronymChar) {
                    previousIsUpper = lastAcronymChar === lastAcronymChar.toLocaleUpperCase(locale);
                }

                break;
            }
        }

        if (acronymLength > 0) {
            // Adjust index to skip past the acronym (loop will increment by 1)

            index += acronymLength - 1;
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
 * @param text The input string, potentially containing ANSI and emoji.
 * @param locale Optional locale for case splitting.
 * @param knownAcronyms Set of known acronyms.
 * @returns An array of split segments, including preserved ANSI/emoji sequences.
 */
// eslint-disable-next-line sonarjs/cognitive-complexity
const processTextWithAnsiEmoji = (text: string, locale: NodeLocale | undefined, knownAcronyms: Set<string>): string[] => {
    const result: string[] = [];
    const segments: string[] = RE_FAST_ANSI.test(text) ? text.split(RE_FAST_ANSI).filter(Boolean) : [text];

    for (const segment of segments) {
        const seg = segment;

        if (RE_FAST_ANSI.test(seg)) {
            // If the segment is an ANSI escape, pass it through.
            result.push(seg);
        } else {
            // If emoji handling is enabled and the segment contains emoji,
            // split on emoji boundaries.
            RE_EMOJI.lastIndex = 0;
            const subs: string[] = RE_EMOJI.test(seg) ? splitByEmoji(seg).filter(Boolean) : [seg];

            for (const emojiSub of subs) {
                RE_EMOJI.lastIndex = 0;

                if (RE_EMOJI.test(emojiSub)) {
                    result.push(emojiSub);
                } else {
                    // Process each plain text subsegment.
                    // eslint-disable-next-line no-lonely-if
                    if (locale) {
                        // Normalize locale codes
                        const normalizedLocale = locale.toLowerCase().split("-")[0] as NodeLocale;

                        result.push(...splitCamelCaseLocale(emojiSub, normalizedLocale, knownAcronyms));
                    } else {
                        result.push(...splitCamelCaseFast(emojiSub, knownAcronyms));
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
 * @template T - The specific literal type of the input string, if known.
 * @param input The string to split.
 * @param options Configuration options for splitting behavior.
 * @returns An array of string segments.
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
    const acronymSet = new Set<string>([...knownAcronyms].toSorted((a, b) => b.length - a.length));

    let cleanedInput = input;

    if (stripAnsiOption) {
        cleanedInput = stripVTControlCharacters(cleanedInput) as T;
    }

    if (stripEmojiOption) {
        cleanedInput = stripEmoji(cleanedInput) as T;
    }

    // Precompute the separator regex.
    let separatorRegex: RegExp;

    if (Array.isArray(separators)) {
        separatorRegex = getSeparatorsRegex(separators as string[]);
    } else if (separators instanceof RegExp) {
        separatorRegex = separators;
    } else {
        separatorRegex = RE_SEPARATORS;
    }

    const parts: string[] = [];
    let workingInput: string = cleanedInput;
    // Use regex directly if it already has global flag to avoid ReDoS from reconstructing user-provided regex patterns
    // When adding 'g' flag, reconstruct only when necessary (note: user-provided RegExp sources are not validated for ReDoS)
    const regex = separatorRegex.flags.includes("g") ? separatorRegex : new RegExp(separatorRegex.source, `${separatorRegex.flags}g`);

    while (workingInput.length > 0) {
        const match = regex.exec(workingInput);

        if (!match) {
            if (workingInput === "..") {
                parts.push("..");
            } else if (workingInput === ".") {
                parts.push(".");
            } else if (workingInput.length > 0) {
                parts.push(workingInput);
            }

            break;
        }

        const matchIndex = match.index;
        const matchText = match[0];
        const matchLength = matchText.length;
        const beforeMatch = workingInput.slice(0, matchIndex);
        const afterMatch = workingInput.slice(matchIndex + matchLength);

        if (matchText.startsWith("../")) {
            parts.push("..");
            workingInput = workingInput.slice(matchIndex + 3);
        } else if (matchText.startsWith("./")) {
            parts.push(".");
            workingInput = workingInput.slice(matchIndex + 2);
        } else if (matchIndex === 0 && matchText === "..") {
            parts.push("..");
            workingInput = workingInput.slice(2);
        } else if (matchIndex === 0 && matchText === ".") {
            parts.push(".");
            workingInput = workingInput.slice(1);
        } else {
            if (beforeMatch.length > 0) {
                parts.push(beforeMatch);
            }

            let pos = 0;

            // eslint-disable-next-line no-cond-assign
            while ((pos = matchText.indexOf("../", pos)) !== -1) {
                parts.push("..");
                pos += 3;
            }

            pos = 0;
            // eslint-disable-next-line no-cond-assign
            while ((pos = matchText.indexOf("./", pos)) !== -1) {
                if (pos === 0 || matchText[pos - 1] !== ".") {
                    parts.push(".");
                }

                pos += 2;
            }

            let remainingAfterMatch = afterMatch;

            while (remainingAfterMatch.startsWith("../")) {
                parts.push("..");
                remainingAfterMatch = remainingAfterMatch.slice(3);
            }

            while (remainingAfterMatch.startsWith("./")) {
                parts.push(".");
                remainingAfterMatch = remainingAfterMatch.slice(2);
            }

            if (remainingAfterMatch === "..") {
                parts.push("..");
                break;
            } else if (remainingAfterMatch === ".") {
                parts.push(".");
                break;
            } else {
                workingInput = remainingAfterMatch;
            }
        }

        regex.lastIndex = 0;
    }

    if (parts.length === 0) {
        const standardParts = cleanedInput.split(separatorRegex).filter(Boolean);

        parts.push(...standardParts);
    }

    let tokens: string[] = [];

    for (const splitPart of parts) {
        if (handleAnsi || handleEmoji) {
            tokens.push(...processTextWithAnsiEmoji(splitPart, locale, acronymSet));
        } else if (locale) {
            tokens.push(...splitCamelCaseLocale(splitPart, locale, acronymSet));
        } else {
            tokens.push(...splitCamelCaseFast(splitPart, acronymSet));
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
                return token.slice(0, 1) + token.slice(1).toLowerCase();
            }

            return token;
        });
    }

    return tokens as unknown as SplitByCase<T>;
};
