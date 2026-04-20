import { BANNED_WORDS } from "./banned-words";

/**
 * Represents a single banned word match found in text.
 * @remarks
 * The match includes position information for highlighting or censoring purposes.
 * The language field indicates which language dictionary the word was matched from.
 * @example
 * ```typescript
 * const match: BannedWordMatch = {
 *   word: "badword",
 *   startIndex: 10,
 *   endIndex: 17,
 *   language: "en"
 * };
 * ```
 * @public
 */
// eslint-disable-next-line import/exports-last
export interface BannedWordMatch {
    /** Zero-based end index in the original text (exclusive) */
    endIndex: number;
    /** ISO 639-1 language code the word was matched from (e.g., 'en', 'de', 'ja') */
    language: string;
    /** Zero-based start index in the original text */
    startIndex: number;
    /** The matched word or phrase exactly as it appears in the text */
    word: string;
}

/**
 * Result of checking text for banned words.
 * @remarks
 * Contains both a convenience boolean flag and detailed match information.
 * The matches array is empty when no banned words are found.
 * @example
 * ```typescript
 * const result: BannedWordsResult = {
 *   hasBannedWords: true,
 *   matches: [
 *     { word: "badword", startIndex: 0, endIndex: 7, language: "en" }
 *   ]
 * };
 * ```
 * @public
 */
// eslint-disable-next-line import/exports-last
export interface BannedWordsResult {
    /** `true` if one or more banned words were found, `false` otherwise */
    hasBannedWords: boolean;
    /** Array of all matched banned words with position and language information */
    matches: BannedWordMatch[];
}

/**
 * Language groups — CJK languages use substring matching (no word boundaries),
 * all others use tokenized word-boundary matching.
 * @internal
 */
const CJK_LANGUAGES = new Set(["ja", "ko", "zh"]);

/**
 * Pre-compiled token regex for splitting text into word tokens.
 * Matches sequences of Unicode letters or digits.
 * @internal
 */
const WORD_TOKEN_RE = /[\p{L}\p{N}]+/gu;

/**
 * Detects whether a string contains any CJK (Chinese, Japanese, Korean) characters.
 * Latin transliterations from CJK word lists are routed to the tokenized matcher
 * so they respect word boundaries (e.g. "ass" from the Korean list must not match
 * inside "class").
 * @internal
 */
const HAS_CJK_CHAR_RE = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;

interface Token {
    end: number;
    start: number;
    text: string;
}

/**
 * Builds lookup tables for efficient banned word matching.
 * @remarks
 * Uses Map/Set for O(1) lookup instead of giant regex alternations,
 * avoiding V8's steep JIT compilation cost for massive patterns.
 * @internal
 */
const buildLookupTables = (): {
    cjkEntries: { language: string; word: string }[];
    maxPhraseTokens: number;
    nonCjkPhrases: Map<string, string>;
    nonCjkSingleWords: Map<string, string>;
} => {
    const nonCjkSingleWords = new Map<string, string>();
    const nonCjkPhrases = new Map<string, string>();
    const cjkEntries: { language: string; word: string }[] = [];
    let maxPhraseTokens = 1;

    for (const [lang, words] of Object.entries(BANNED_WORDS)) {
        const isCjk = CJK_LANGUAGES.has(lang);

        for (const word of words) {
            const normalized = word.normalize("NFC").toLowerCase();

            if (isCjk && HAS_CJK_CHAR_RE.test(normalized)) {
                // Native-script CJK: substring matching (no word boundaries)
                cjkEntries.push({ language: lang, word: normalized });
            } else {
                // Latin-script (including transliterated CJK): word-boundary matching
                const tokens = normalized.split(/\s+/);

                if (tokens.length === 1) {
                    if (!nonCjkSingleWords.has(normalized)) {
                        nonCjkSingleWords.set(normalized, lang);
                    }
                } else {
                    if (!nonCjkPhrases.has(normalized)) {
                        nonCjkPhrases.set(normalized, lang);
                        maxPhraseTokens = Math.max(maxPhraseTokens, tokens.length);
                    }
                }
            }
        }
    }

    return { cjkEntries, maxPhraseTokens, nonCjkPhrases, nonCjkSingleWords };
};

const { cjkEntries, maxPhraseTokens, nonCjkPhrases, nonCjkSingleWords } = buildLookupTables();

/**
 * Checks text for banned words across all configured languages.
 * @param text The text to check for banned words
 * @returns Result object containing match information
 * @remarks
 * This function:
 * - Checks against 19 language dictionaries simultaneously
 * - Is case-insensitive
 * - Normalizes text to NFC Unicode form for consistent matching
 * - Handles multi-word phrases
 * - Respects word boundaries (except for CJK scripts)
 * - Uses Set-based lookup for near-instant initialization and O(1) per-word matching
 * - Returns empty results for empty or whitespace-only input
 *
 * For performance, CJK scripts (Chinese, Japanese, Korean) use substring matching
 * without word boundaries, while all other scripts use tokenized word-boundary matching.
 * @example
 * Basic usage:
 * ```typescript
 * import { checkBannedWords } from "@visulima/content-safety";
 *
 * const result = checkBannedWords("This is clean text");
 * console.log(result.hasBannedWords); // false
 * console.log(result.matches); // []
 * ```
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
 * @public
 */
export const checkBannedWords = (text: string): BannedWordsResult => {
    if (!text || text.trim().length === 0) {
        return { hasBannedWords: false, matches: [] };
    }

    const normalized = text.normalize("NFC");
    const lowerNormalized = normalized.toLowerCase();
    const matches: BannedWordMatch[] = [];

    // --- Non-CJK: tokenized word-boundary matching ---
    WORD_TOKEN_RE.lastIndex = 0;

    const tokens: Token[] = [];
    let tokenMatch: RegExpExecArray | null;

    // eslint-disable-next-line no-cond-assign
    while ((tokenMatch = WORD_TOKEN_RE.exec(lowerNormalized)) !== null) {
        tokens.push({ end: tokenMatch.index + tokenMatch[0].length, start: tokenMatch.index, text: tokenMatch[0] });
    }

    // Single-word matches
    for (const token of tokens) {
        const lang = nonCjkSingleWords.get(token.text);

        if (lang) {
            matches.push({
                endIndex: token.end,
                language: lang,
                startIndex: token.start,
                word: normalized.slice(token.start, token.end),
            });
        }
    }

    // Multi-word phrase matches (sliding window)
    for (let i = 0; i < tokens.length; i++) {
        for (let len = 2; len <= maxPhraseTokens && i + len <= tokens.length; len++) {
            const phrase = tokens
                .slice(i, i + len)
                .map((t) => t.text)
                .join(" ");
            const lang = nonCjkPhrases.get(phrase);

            if (lang) {
                const start = tokens[i]!.start;
                const end = tokens[i + len - 1]!.end;

                matches.push({
                    endIndex: end,
                    language: lang,
                    startIndex: start,
                    word: normalized.slice(start, end),
                });
            }
        }
    }

    // --- CJK: substring matching (no word boundaries) ---
    for (const { language, word } of cjkEntries) {
        let pos = 0;

        // eslint-disable-next-line no-cond-assign
        while ((pos = lowerNormalized.indexOf(word, pos)) !== -1) {
            matches.push({
                endIndex: pos + word.length,
                language,
                startIndex: pos,
                word: normalized.slice(pos, pos + word.length),
            });
            pos += 1;
        }
    }

    return {
        hasBannedWords: matches.length > 0,
        matches,
    };
};
