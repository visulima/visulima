import { BANNED_WORDS } from "./banned-words";

/**
 * Represents a single banned word match found in text.
 *
 * @remarks
 * The match includes position information for highlighting or censoring purposes.
 * The language field indicates which language dictionary the word was matched from.
 *
 * @example
 * ```typescript
 * const match: BannedWordMatch = {
 *   word: "badword",
 *   startIndex: 10,
 *   endIndex: 17,
 *   language: "en"
 * };
 * ```
 *
 * @public
 */
export interface BannedWordMatch {
    /** The matched word or phrase exactly as it appears in the text */
    word: string;
    /** Zero-based start index in the original text */
    startIndex: number;
    /** Zero-based end index in the original text (exclusive) */
    endIndex: number;
    /** ISO 639-1 language code the word was matched from (e.g., 'en', 'de', 'ja') */
    language: string;
}

/**
 * Result of checking text for banned words.
 *
 * @remarks
 * Contains both a convenience boolean flag and detailed match information.
 * The matches array is empty when no banned words are found.
 *
 * @example
 * ```typescript
 * const result: BannedWordsResult = {
 *   hasBannedWords: true,
 *   matches: [
 *     { word: "badword", startIndex: 0, endIndex: 7, language: "en" }
 *   ]
 * };
 * ```
 *
 * @public
 */
export interface BannedWordsResult {
    /** `true` if one or more banned words were found, `false` otherwise */
    hasBannedWords: boolean;
    /** Array of all matched banned words with position and language information */
    matches: BannedWordMatch[];
}

/**
 * Escapes special regex characters in a string.
 *
 * @param str - String to escape
 * @returns Escaped string safe for use in RegExp constructor
 *
 * @internal
 */
const escapeRegExp = (str: string): string => {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

/**
 * Language groups for splitting regex compilation.
 * Grouping by geographic/script similarity for better performance.
 * @internal
 */
const LANGUAGE_GROUPS = {
    western: new Set(["en", "de", "es", "fr", "nl", "pt", "it", "sv", "ga"]),
    eastern: new Set(["pl", "ru"]),
    middleEast: new Set(["ar", "fa", "tr", "az"]),
    southAsian: new Set(["hi"]),
    cjk: new Set(["zh", "ja", "ko"]),
} as const;

/**
 * Builds optimized regex patterns split by language groups for better performance.
 *
 * @remarks
 * This function:
 * - Splits patterns into 5 geographic/script groups to reduce regex size
 * - Normalizes all words to NFC Unicode form
 * - Sorts patterns by length (longest first) to match phrases before individual words
 * - Creates a language lookup map for match attribution
 * - Produces smaller, faster-compiling regexes than a single giant pattern
 *
 * @returns Object containing compiled regexes and word-to-language mapping
 *
 * @internal
 */
const buildRegexGroups = (): {
    regexGroups: Array<{ name: string; regex: RegExp }>;
    wordToLanguage: Map<string, string>;
} => {
    const wordToLanguage = new Map<string, string>();
    const groupPatterns: Record<string, string[]> = {
        western: [],
        eastern: [],
        middleEast: [],
        southAsian: [],
        cjk: [],
    };

    for (const [lang, words] of Object.entries(BANNED_WORDS)) {
        // Determine which group this language belongs to
        let groupName = "";
        for (const [group, langs] of Object.entries(LANGUAGE_GROUPS)) {
            if (langs.has(lang)) {
                groupName = group;
                break;
            }
        }

        if (!groupName) {
            continue;
        }

        const isCjk = LANGUAGE_GROUPS.cjk.has(lang);

        for (const word of words) {
            const normalized = word.normalize("NFC").toLowerCase();

            if (!wordToLanguage.has(normalized)) {
                wordToLanguage.set(normalized, lang);

                const escaped = escapeRegExp(normalized);

                if (isCjk) {
                    groupPatterns[groupName]?.push(escaped);
                } else {
                    groupPatterns[groupName]?.push(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`);
                }
            }
        }
    }

    const regexGroups: Array<{ name: string; regex: RegExp }> = [];

    for (const [groupName, patterns] of Object.entries(groupPatterns)) {
        if (patterns.length > 0) {
            patterns.sort((a, b) => b.length - a.length);
            regexGroups.push({
                name: groupName,
                regex: new RegExp(patterns.join("|"), "giu"),
            });
        }
    }

    return { regexGroups, wordToLanguage };
};

const { regexGroups, wordToLanguage: cachedWordToLanguage } = buildRegexGroups();

/**
 * Checks text for banned words across all configured languages.
 *
 * @param text - The text to check for banned words
 * @returns Result object containing match information
 *
 * @remarks
 * This function:
 * - Checks against 19 language dictionaries simultaneously
 * - Is case-insensitive
 * - Normalizes text to NFC Unicode form for consistent matching
 * - Handles multi-word phrases
 * - Respects word boundaries (except for CJK scripts)
 * - Uses pre-compiled regexes split by script type for optimal performance
 * - Returns empty results for empty or whitespace-only input
 *
 * For performance, the implementation splits patterns into 5 geographic/script groups
 * (Western, Eastern European, Middle Eastern, South Asian, CJK), significantly
 * reducing regex compilation time and JIT overhead.
 *
 * @example
 * Basic usage:
 * ```typescript
 * import { checkBannedWords } from "@visulima/content-safety";
 *
 * const result = checkBannedWords("This is clean text");
 * console.log(result.hasBannedWords); // false
 * console.log(result.matches); // []
 * ```
 *
 * @example
 * Handling matches:
 * ```typescript
 * const result = checkBannedWords("This contains badword");
 *
 * if (result.hasBannedWords) {
 *   result.matches.forEach(match => {
 *     console.log(`Found "${match.word}" at position ${match.startIndex}`);
 *     console.log(`Language: ${match.language}`);
 *   });
 * }
 * ```
 *
 * @example
 * Censoring text:
 * ```typescript
 * const text = "This contains badword";
 * const result = checkBannedWords(text);
 *
 * let censored = text;
 * // Process matches in reverse to maintain indices
 * for (const match of result.matches.reverse()) {
 *   const replacement = "*".repeat(match.word.length);
 *   censored = censored.slice(0, match.startIndex) +
 *              replacement +
 *              censored.slice(match.endIndex);
 * }
 * ```
 *
 * @public
 */
export const checkBannedWords = (text: string): BannedWordsResult => {
    if (!text || text.trim().length === 0) {
        return { hasBannedWords: false, matches: [] };
    }

    const normalized = text.normalize("NFC");
    const matches: BannedWordMatch[] = [];

    for (const { regex } of regexGroups) {
        regex.lastIndex = 0;
        let match: RegExpExecArray | null;

        while ((match = regex.exec(normalized)) !== null) {
            const matchedText = match[0].toLowerCase();
            const language = cachedWordToLanguage.get(matchedText) ?? "unknown";

            matches.push({
                word: match[0],
                startIndex: match.index,
                endIndex: match.index + match[0].length,
                language,
            });
        }
    }

    return {
        hasBannedWords: matches.length > 0,
        matches,
    };
};
