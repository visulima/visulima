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
 * Builds an optimized regex pattern and language mapping from the banned words dictionary.
 *
 * @remarks
 * This function:
 * - Normalizes all words to NFC Unicode form
 * - Handles CJK scripts (no word boundaries needed)
 * - Uses Unicode-aware word boundaries for other scripts
 * - Sorts patterns by length (longest first) to match phrases before individual words
 * - Creates a language lookup map for match attribution
 *
 * @returns Object containing the compiled regex and word-to-language mapping
 *
 * @internal
 */
const buildRegexAndMap = (): { regex: RegExp; wordToLanguage: Map<string, string> } => {
    const wordToLanguage = new Map<string, string>();
    const patterns: string[] = [];

    for (const [lang, words] of Object.entries(BANNED_WORDS)) {
        for (const word of words) {
            const normalized = word.normalize("NFC").toLowerCase();

            // Only add each word once (first language wins)
            if (!wordToLanguage.has(normalized)) {
                wordToLanguage.set(normalized, lang);

                const escaped = escapeRegExp(normalized);
                // CJK characters: no boundary needed (they don't use spaces)
                // All other scripts: use Unicode-aware word boundaries via \p{L}/\p{N}
                // (JS \b only treats [a-zA-Z0-9_] as word chars, which breaks
                // accented Latin, Cyrillic, Arabic, Hindi, etc.)
                const hasCJK = /[\u3000-\u9fff\uac00-\ud7af\uff00-\uffef]/.test(normalized);

                if (hasCJK) {
                    patterns.push(escaped);
                } else {
                    patterns.push(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`);
                }
            }
        }
    }

    // Sort by length descending so longer phrases match first (e.g., "white trash" before "white")
    patterns.sort((a, b) => b.length - a.length);

    const regex = new RegExp(patterns.join("|"), "giu");

    return { regex, wordToLanguage };
};

// PERFORMANCE FIX: Build regex cache EAGERLY on module load instead of lazily on first use
// This prevents 3+ second lag on first send button click
// Lazy init caused UI jank because it blocked the click handler
const { regex: cachedRegex, wordToLanguage: cachedWordToLanguage } = buildRegexAndMap();

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
 * - Uses a pre-compiled regex for optimal performance
 * - Returns empty results for empty or whitespace-only input
 *
 * The regex cache is built eagerly on module load to prevent first-call lag.
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

    // Reset lastIndex since we reuse the cached regex
    cachedRegex.lastIndex = 0;

    const matches: BannedWordMatch[] = [];
    let match: RegExpExecArray | null;

    while ((match = cachedRegex.exec(normalized)) !== null) {
        const matchedText = match[0].toLowerCase();
        const language = cachedWordToLanguage.get(matchedText) ?? "unknown";

        matches.push({
            word: match[0],
            startIndex: match.index,
            endIndex: match.index + match[0].length,
            language,
        });
    }

    return {
        hasBannedWords: matches.length > 0,
        matches,
    };
};
