import type { NodeLocale } from "../types";
import type { LocaleOptions, SplitByCase } from "./types";
import { stripEmoji, stripAnsi, EMOJI_REGEX, getSeparatorsRegex, SEPARATORS_REGEX, splitByEmoji } from "./utils/regex";

// ─────────────────────────────
// Fast Path: No locale (assume ASCII)
// ─────────────────────────────

const isDigitCode = (code: number): boolean => code >= 48 && code <= 57;

const splitCamelCaseFast = (s: string, knownAcronyms: Set<string> = new Set()): string[] => {
    if (s.length === 0) {
        return [];
    }

    if (s.toUpperCase() === s) {
        return [s];
    }

    const tokens: string[] = [];
    let start = 0;
    const length_ = s.length;

    for (let index = 1; index < length_; index++) {
        const previousCode = s.charCodeAt(index - 1);
        const currentCode = s.charCodeAt(index);

        // **Check for known acronyms**
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

        // Lower-to-Upper transition: [a-z] -> [A-Z]
        if (previousCode >= 97 && previousCode <= 122 && currentCode >= 65 && currentCode <= 90) {
            tokens.push(s.slice(start, index));
            start = index;
            continue;
        }

        // Digit-Letter transition
        const previousIsDigit = isDigitCode(previousCode);
        const currentIsDigit = isDigitCode(currentCode);
        if ((previousIsDigit && !currentIsDigit) || (!previousIsDigit && currentIsDigit)) {
            tokens.push(s.slice(start, index));
            start = index;
            continue;
        }

        // Handle single digits in sequences like R2D2, C3PO
        if (currentIsDigit && index > 0 && !previousIsDigit) {
            // Check if this is a single digit between letters
            if (index + 1 < length_ && !isDigitCode(s.charCodeAt(index + 1))) {
                tokens.push(s.slice(start, index));
                tokens.push(s.slice(index, index + 1));
                start = index + 1;
                continue;
            }
        }

        // **Uppercase acronym boundary detection**
        if (index + 1 < length_) {
            const nextCode = s.charCodeAt(index + 1);
            if (previousCode >= 65 && previousCode <= 90 && currentCode >= 65 && currentCode <= 90 && nextCode >= 97) {
                const candidate = s.slice(start, index + 1);
                if (!knownAcronyms.has(candidate)) {
                    tokens.push(s.slice(start, index));
                    start = index;
                    continue;
                }
            }
        }
    }

    // **Capture the last segment**
    if (start < length_) {
        tokens.push(s.slice(start));
    }

    return tokens;
};

// ─────────────────────────────
// Locale-Aware Splitting
// ─────────────────────────────

enum CharType {
    Latin,
    CJK,
    RTL,
    Indic,
    Cyrillic,
    Greek,
    Emoji,
    Digit,
    Special,
    Hiragana,
    Katakana,
    Hangul,
    Other,
}

const getCharType = (code: number): CharType => {
    // ASCII ranges
    if (code >= 48 && code <= 57) return CharType.Digit;
    if ((code >= 65 && code <= 90) || (code >= 97 && code <= 122)) return CharType.Latin;

    // CJK ranges
    if (code >= 0x4e00 && code <= 0x9fff)
        // CJK Unified
        return CharType.CJK;

    // Japanese scripts
    if (code >= 0x3040 && code <= 0x309f)
        // Hiragana
        return CharType.Hiragana;
    if (code >= 0x30a0 && code <= 0x30ff)
        // Katakana
        return CharType.Katakana;

    // Korean ranges
    if (
        (code >= 0x1100 && code <= 0x11ff) || // Hangul Jamo
        (code >= 0xac00 && code <= 0xd7af)
    )
        // Hangul Syllables
        return CharType.CJK;

    // RTL ranges
    if (
        (code >= 0x0590 && code <= 0x05ff) || // Hebrew
        (code >= 0x0600 && code <= 0x06ff) || // Arabic
        (code >= 0x0750 && code <= 0x077f) || // Arabic Supplement
        (code >= 0x08a0 && code <= 0x08ff)
    )
        // Arabic Extended-A
        return CharType.RTL;

    // Indic ranges
    if (
        (code >= 0x0900 && code <= 0x097f) || // Devanagari
        (code >= 0x0980 && code <= 0x09ff) || // Bengali
        (code >= 0x0a00 && code <= 0x0a7f) || // Gurmukhi
        (code >= 0x0a80 && code <= 0x0aff) || // Gujarati
        (code >= 0x0b00 && code <= 0x0b7f) || // Oriya
        (code >= 0x0b80 && code <= 0x0bff) || // Tamil
        (code >= 0x0c00 && code <= 0x0c7f) || // Telugu
        (code >= 0x0c80 && code <= 0x0cff) || // Kannada
        (code >= 0x0d00 && code <= 0x0d7f) || // Malayalam
        (code >= 0x0d80 && code <= 0x0dff) || // Sinhala
        (code >= 0x0e00 && code <= 0x0e7f) || // Thai
        (code >= 0x0e80 && code <= 0x0eff) || // Lao
        (code >= 0x0f00 && code <= 0x0fff) || // Tibetan
        (code >= 0x1000 && code <= 0x109f) || // Myanmar
        (code >= 0x1200 && code <= 0x137f) || // Ethiopic
        (code >= 0x1780 && code <= 0x17ff) // Khmer
    )
        return CharType.Indic;

    // Cyrillic range
    if (code >= 0x0400 && code <= 0x04ff) return CharType.Cyrillic;

    // Greek range
    if (code >= 0x0370 && code <= 0x03ff) return CharType.Greek;

    // Special characters
    if (
        (code >= 0x0021 && code <= 0x002f) || // ASCII punctuation and symbols
        (code >= 0x003a && code <= 0x0040) || // ASCII punctuation and symbols
        (code >= 0x005b && code <= 0x0060) || // ASCII punctuation and symbols
        (code >= 0x007b && code <= 0x007e)
    )
        // ASCII punctuation and symbols
        return CharType.Special;

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
const shouldKeepScriptTogether = (type: CharType): boolean => {
    return (
        type === CharType.CJK ||
        type === CharType.RTL ||
        type === CharType.Indic ||
        type === CharType.Cyrillic ||
        type === CharType.Greek ||
        type === CharType.Hiragana ||
        type === CharType.Katakana
    );
};

const isCyrillicUpperCase = (code: number): boolean => {
    return code >= 0x0410 && code <= 0x042f;
};

const isCyrillicLowerCase = (code: number): boolean => {
    return code >= 0x0430 && code <= 0x044f;
};

const isGreekUpperCase = (code: number): boolean => {
    return code >= 0x0391 && code <= 0x03a9;
};

const isGreekLowerCase = (code: number): boolean => {
    return code >= 0x03b1 && code <= 0x03c9;
};

const isLatinScript = (type: CharType): boolean => {
    return type === CharType.Latin || type === CharType.Digit;
};

const isEmbeddedLatinWord = (s: string, start: number, end: number): boolean => {
    if (end - start < 2) return false;
    const word = s.slice(start, end);
    return /^[A-Za-z]{2,}$/.test(word);
};

const shouldSplitAtIndex = (s: string, index: number, lastCharType: CharType, currentCharType: CharType): boolean => {
    const prevCode = s.charCodeAt(index - 1);
    const currentCode = s.charCodeAt(index);

    // Handle Cyrillic case transitions
    if (lastCharType === CharType.Cyrillic && currentCharType === CharType.Cyrillic) {
        if (
            (isCyrillicLowerCase(prevCode) && isCyrillicUpperCase(currentCode)) ||
            (index + 1 < s.length && isCyrillicUpperCase(currentCode) && isCyrillicLowerCase(s.charCodeAt(index + 1)))
        ) {
            return true;
        }

        return false;
    }

    // Handle Greek case transitions
    if (lastCharType === CharType.Greek && currentCharType === CharType.Greek) {
        if (
            (isGreekLowerCase(prevCode) && isGreekUpperCase(currentCode)) ||
            (index + 1 < s.length && isGreekUpperCase(currentCode) && isGreekLowerCase(s.charCodeAt(index + 1)))
        ) {
            return true;
        }

        return false;
    }

    // Handle script transitions between Greek and Latin
    if ((lastCharType === CharType.Greek && currentCharType === CharType.Latin) || (lastCharType === CharType.Latin && currentCharType === CharType.Greek)) {
        return true;
    }

    // Don't split if both characters are the same script (except Latin)
    if (shouldKeepScriptTogether(lastCharType) && lastCharType === currentCharType) {
        return false;
    }

    // Always split on script transitions
    if (shouldKeepScriptTogether(lastCharType) !== shouldKeepScriptTogether(currentCharType)) {
        return true;
    }

    // Always split on special characters
    if (currentCharType === CharType.Special) {
        return true;
    }

    return false;
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
    if (locale.startsWith("de") && !isUpperCase && s.replace(/ß/g, "SS") === s.toLocaleUpperCase(locale)) {
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
        // Pre-compile regex patterns
        const cyrillicPattern = /[\p{Script=Cyrillic}]/u;
        const latinPattern = /[\p{Script=Latin}]/u;

        // Early return if no Cyrillic or Latin characters
        if (!cyrillicPattern.test(s) && !latinPattern.test(s)) {
            return [s];
        }

        const chars = Array.from(s); // Convert to array once for better Unicode handling
        const len = chars.length;
        const result: string[] = [];
        let currentSegment = chars[0];

        // Determine initial type (1=cyrillic, 2=latin, 0=other)
        let prevType = cyrillicPattern.test(chars[0]) ? 1 : latinPattern.test(chars[0]) ? 2 : 0;
        let prevIsUpper = chars[0] === chars[0].toLocaleUpperCase(locale);

        for (let i = 1; i < len; i++) {
            const char = chars[i];
            const currentType = cyrillicPattern.test(char) ? 1 : latinPattern.test(char) ? 2 : 0;
            const isUpper = char === char.toLocaleUpperCase(locale);

            // Split on script transitions or case changes within the same script
            if (
                (prevType !== currentType && (prevType === 1 || prevType === 2) && (currentType === 1 || currentType === 2)) ||
                (currentType === prevType && !prevIsUpper && isUpper)
            ) {
                result.push(currentSegment);
                currentSegment = char;
            } else {
                currentSegment += char;
            }

            prevType = currentType;
            prevIsUpper = isUpper;
        }

        if (currentSegment) {
            result.push(currentSegment);
        }

        // Post-process: merge single Latin characters with following Cyrillic if they form a word
        const finalResult: string[] = [];
        for (let i = 0; i < result.length; i++) {
            if (i < result.length - 1 && result[i].length === 1 && latinPattern.test(result[i]) && cyrillicPattern.test(result[i + 1][0])) {
                finalResult.push(result[i] + result[i + 1]);
                i++; // Skip the next segment since we merged it
            } else {
                finalResult.push(result[i]);
            }
        }

        return finalResult;
    }

    // Special handling for Greek scripts
    if (locale.startsWith("el")) {
        // Pre-compile regex patterns
        const greekPattern = /[\p{Script=Greek}]/u;
        const latinPattern = /[\p{Script=Latin}]/u;

        // Early return if no Greek or Latin characters
        if (!greekPattern.test(s) && !latinPattern.test(s)) {
            return [s];
        }

        const chars = Array.from(s); // Convert to array once for better Unicode handling
        const len = chars.length;
        const result: string[] = [];
        let currentSegment = chars[0];

        // Determine initial type (1=greek, 2=latin, 0=other)
        let prevType = greekPattern.test(chars[0]) ? 1 : latinPattern.test(chars[0]) ? 2 : 0;
        let prevIsUpper = chars[0] === chars[0].toLocaleUpperCase(locale);

        for (let i = 1; i < len; i++) {
            const char = chars[i];
            const currentType = greekPattern.test(char) ? 1 : latinPattern.test(char) ? 2 : 0;
            const isUpper = char === char.toLocaleUpperCase(locale);

            // Split on script transitions or case changes within the same script
            if (
                (prevType !== currentType && (prevType === 1 || prevType === 2) && (currentType === 1 || currentType === 2)) ||
                ((currentType === 1 || currentType === 2) && !prevIsUpper && isUpper)
            ) {
                result.push(currentSegment);
                currentSegment = char;
            } else {
                currentSegment += char;
            }

            prevType = currentType;
            prevIsUpper = isUpper;
        }

        if (currentSegment) {
            result.push(currentSegment);
        }

        return result;
    }

    // Special handling for Japanese and Korean scripts
    if (locale.startsWith("ja") || locale.startsWith("ko")) {
        const isJapanese = locale.startsWith("ja");
        // Pre-compile regex patterns
        const hiraganaPattern = /[\p{Script=Hiragana}]/u;
        const katakanaPattern = /[\p{Script=Katakana}]/u;
        const kanjiPattern = /[\p{Script=Han}]/u;
        const hangulPattern = /[\p{Script=Hangul}]/u;
        const latinPattern = /[\p{Script=Latin}]/u;

        // Early return if no relevant characters
        if (isJapanese && !hiraganaPattern.test(s) && !katakanaPattern.test(s) && !kanjiPattern.test(s) && !latinPattern.test(s)) {
            return [s];
        }
        if (!isJapanese && !hangulPattern.test(s) && !latinPattern.test(s)) {
            return [s];
        }

        const chars = Array.from(s); // Convert to array once for better Unicode handling
        const result: string[] = [];
        let currentSegment = chars[0];

        // List of common Japanese particles (pre-compiled Set for faster lookups)
        const particles = new Set(["と", "に", "へ", "を", "は", "が", "の", "で", "や", "も"]);

        // Determine initial type
        let prevType;
        if (isJapanese) {
            prevType = hiraganaPattern.test(chars[0])
                ? "hiragana"
                : katakanaPattern.test(chars[0])
                  ? "katakana"
                  : kanjiPattern.test(chars[0])
                    ? "kanji"
                    : latinPattern.test(chars[0])
                      ? "latin"
                      : "other";
        } else {
            prevType = hangulPattern.test(chars[0]) ? "hangul" : latinPattern.test(chars[0]) ? "latin" : "other";
        }

        for (let i = 1; i < chars.length; i++) {
            const char = chars[i];
            let currentType;

            // Determine the type of the current character
            if (isJapanese) {
                if (hiraganaPattern.test(char)) currentType = "hiragana";
                else if (katakanaPattern.test(char)) currentType = "katakana";
                else if (kanjiPattern.test(char)) currentType = "kanji";
                else if (latinPattern.test(char)) currentType = "latin";
                else currentType = "other";
            } else {
                if (hangulPattern.test(char)) currentType = "hangul";
                else if (latinPattern.test(char)) currentType = "latin";
                else currentType = "other";
            }

            // Check for transitions
            let shouldSplit = false;

            if (isJapanese) {
                shouldSplit =
                    (prevType === "hiragana" && currentType === "katakana") ||
                    (prevType === "katakana" && currentType === "hiragana") ||
                    (prevType === "hiragana" && currentType === "latin") ||
                    (prevType === "katakana" && currentType === "latin") ||
                    (prevType === "kanji" && currentType === "latin") ||
                    (prevType === "latin" && (currentType === "hiragana" || currentType === "katakana" || currentType === "kanji"));
            } else {
                shouldSplit = (prevType === "hangul" && currentType === "latin") || (prevType === "latin" && currentType === "hangul");
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

            prevType = currentType;
        }

        // Add the last segment if it exists
        if (currentSegment) {
            // Check if the last segment is a particle
            if (currentSegment.length === 1 && particles.includes(currentSegment) && result.length > 0) {
                // Append particle to the previous segment
                result[result.length - 1] += currentSegment;
            } else {
                // Add the last segment to results
                result.push(currentSegment);
            }
        }

        return result.length > 0 ? result : [s];
    }

    // Special handling for Slovenian scripts
    if (locale.startsWith("sl")) {
        const chars = Array.from(s);
        const len = chars.length;
        const result: string[] = [];
        let currentSegment = chars[0];
        let prevIsUpper = chars[0] === chars[0].toLocaleUpperCase(locale);

        // Process remaining characters
        for (let i = 1; i < len; i++) {
            const char = chars[i];
            const isUpper = char === char.toLocaleUpperCase(locale);

            // Special handling for Slovenian characters
            const isSpecialChar = /[ČŠŽĐ]/i.test(char);
            const nextIsUpper = i < len - 1 && chars[i + 1] === chars[i + 1].toLocaleUpperCase(locale);

            // Split on case transitions and special characters
            if ((!prevIsUpper && isUpper) || (isSpecialChar && nextIsUpper)) {
                result.push(currentSegment);
                currentSegment = char;
                if (isSpecialChar && nextIsUpper) {
                    result.push(currentSegment);
                    currentSegment = "";
                }
            } else {
                currentSegment += char;
            }

            prevIsUpper = isUpper;
        }

        if (currentSegment) {
            result.push(currentSegment);
        }

        return result;
    }

    // Special handling for Korean scripts
    if (locale.startsWith("ko")) {
        // Pre-compile regex patterns
        const hangulPattern = /[\p{Script=Hangul}]/u;
        const latinPattern = /[\p{Script=Latin}]/u;
        const chars = Array.from(s); // Convert to array once for better performance with Unicode
        const len = chars.length;

        // Early return if no Hangul or Latin characters
        if (!hangulPattern.test(s) && !latinPattern.test(s)) {
            return [s];
        }

        const result: string[] = [];
        let currentSegment = chars[0];
        let prevType = hangulPattern.test(chars[0]) ? 1 : latinPattern.test(chars[0]) ? 2 : 0;

        // Process remaining characters
        for (let i = 1; i < len; i++) {
            const char = chars[i];
            const currentType = hangulPattern.test(char) ? 1 : latinPattern.test(char) ? 2 : 0;

            // Split only on script transitions between Hangul and Latin
            if (prevType !== currentType && (prevType === 2 || currentType === 2)) {
                result.push(currentSegment);
                currentSegment = char;
            } else {
                currentSegment += char;
            }

            prevType = currentType;
        }

        if (currentSegment) {
            result.push(currentSegment);
        }

        return result;
    }

    // Special handling for Uzbek scripts
    if (locale.startsWith("uz")) {
        // Pre-compile regex patterns
        const cyrillicPattern = /[\p{Script=Cyrillic}]/u;
        const latinPattern = /[\p{Script=Latin}]/u;
        const modifierPattern = /[\u02BB\u02BC\u0027]/u; // Special modifiers for Uzbek Latin script

        // Early return if no Cyrillic or Latin characters
        if (!cyrillicPattern.test(s) && !latinPattern.test(s)) {
            return [s];
        }

        const chars = Array.from(s); // Convert to array once for better Unicode handling
        const len = chars.length;
        const result: string[] = [];
        let currentSegment = chars[0];

        // Determine initial type (1=cyrillic, 2=latin, 0=other)
        let prevType = cyrillicPattern.test(chars[0]) ? 1 : latinPattern.test(chars[0]) ? 2 : 0;
        let prevIsUpper = chars[0] === chars[0].toLocaleUpperCase(locale);

        for (let i = 1; i < len; i++) {
            const char = chars[i];
            const currentType = cyrillicPattern.test(char) ? 1 : latinPattern.test(char) ? 2 : 0;
            const isUpper = char === char.toLocaleUpperCase(locale);

            // Special handling for Uzbek Latin modifiers
            if (modifierPattern.test(char) || modifierPattern.test(chars[i - 1])) {
                currentSegment += char;
                continue;
            }

            // Split on script transitions or case changes within the same script
            if (
                (prevType !== currentType && (prevType === 1 || prevType === 2) && (currentType === 1 || currentType === 2)) ||
                (currentType === prevType && !prevIsUpper && isUpper)
            ) {
                result.push(currentSegment);
                currentSegment = char;
            } else {
                currentSegment += char;
            }

            prevType = currentType;
            prevIsUpper = isUpper;
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

        // **Check for known acronyms**
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
            continue;
        }

        // **Handle script transitions and special characters**
        if (shouldSplitAtIndex(s, index, lastCharType, currentCharType)) {
            // Check for embedded Latin words
            if (isLatinScript(currentCharType) && isEmbeddedLatinWord(s, index, Math.min(index + 10, length_))) {
                if (currentScriptStart !== -1) {
                    tokens.push(s.slice(currentScriptStart, index));
                    currentScriptStart = -1;
                } else if (start < index) {
                    tokens.push(s.slice(start, index));
                }
                // Find the end of the Latin word
                let latinEnd = index;

                while (latinEnd < length_ && isLatinScript(getCharType(s.charCodeAt(latinEnd)))) {
                    latinEnd++;
                }

                tokens.push(s.slice(index, latinEnd));

                index = latinEnd - 1;
                start = latinEnd;
                inScript = false;
                continue;
            }

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

        // Digit transitions
        if ((currentCharType === CharType.Digit) !== (lastCharType === CharType.Digit)) {
            tokens.push(s.slice(start, index));
            start = index;
            lastCharType = currentCharType;
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
export const splitByCase = <T extends string = string>(input: T, options?: SplitOptions): SplitByCase<T> => {
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
    } = options || {};

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

    for (const part of parts) {
        if (handleAnsi || handleEmoji) {
            tokens.push(...processTextWithAnsiEmoji(part, locale, acronymSet));
        } else if (locale) {
            // Normalize locale codes
            const normalizedLocale = locale.toLowerCase().split("-")[0] as NodeLocale;
            tokens.push(...splitCamelCaseLocale(part, normalizedLocale, acronymSet));
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
                return token[0] + token.slice(1).toLocaleLowerCase(locale);
            }

            if (token.toUpperCase() === token && !acronymSet.has(token)) {
                return token.slice(0, 1) + token.slice(1).toLowerCase();
            }

            return token;
        });
    }

    return tokens as unknown as SplitByCase<T>;
};
