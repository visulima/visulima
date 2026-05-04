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

/**
 * Pre-compiled whitespace regex for splitting normalized words into tokens.
 * @internal
 */
const WHITESPACE_RE = /\s+/;

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
interface LookupTables {
    cjkEntries: { language: string; word: string }[];
    maxPhraseTokens: number;
    nonCjkPhrases: Map<string, string>;
    nonCjkSingleWords: Map<string, string>;
}

const addNonCjkEntry = (
    normalized: string,
    lang: string,
    tables: Pick<LookupTables, "nonCjkPhrases" | "nonCjkSingleWords"> & { maxPhraseTokens: number },
): number => {
    const tokens = normalized.split(WHITESPACE_RE);

    if (tokens.length === 1) {
        if (!tables.nonCjkSingleWords.has(normalized)) {
            tables.nonCjkSingleWords.set(normalized, lang);
        }

        return tables.maxPhraseTokens;
    }

    if (!tables.nonCjkPhrases.has(normalized)) {
        tables.nonCjkPhrases.set(normalized, lang);

        return Math.max(tables.maxPhraseTokens, tokens.length);
    }

    return tables.maxPhraseTokens;
};

const buildLookupTables = (): LookupTables => {
    const nonCjkSingleWords = new Map<string, string>();
    const nonCjkPhrases = new Map<string, string>();
    const cjkEntries: { language: string; word: string }[] = [];
    let maxPhraseTokens = 1;

    for (const [lang, words] of Object.entries(BANNED_WORDS)) {
        const isCjk = CJK_LANGUAGES.has(lang);

        for (const word of words) {
            const normalized = word.normalize("NFC").toLowerCase();

            if (isCjk && HAS_CJK_CHAR_RE.test(normalized)) {
                cjkEntries.push({ language: lang, word: normalized });
            } else {
                maxPhraseTokens = addNonCjkEntry(normalized, lang, { maxPhraseTokens, nonCjkPhrases, nonCjkSingleWords });
            }
        }
    }

    return { cjkEntries, maxPhraseTokens, nonCjkPhrases, nonCjkSingleWords };
};

const { cjkEntries, maxPhraseTokens, nonCjkPhrases, nonCjkSingleWords } = buildLookupTables();

const tokenize = (lowerNormalized: string): Token[] => {
    WORD_TOKEN_RE.lastIndex = 0;

    const tokens: Token[] = [];
    let tokenMatch: RegExpExecArray | null;

    // eslint-disable-next-line no-cond-assign
    while ((tokenMatch = WORD_TOKEN_RE.exec(lowerNormalized)) !== null) {
        tokens.push({ end: tokenMatch.index + tokenMatch[0].length, start: tokenMatch.index, text: tokenMatch[0] });
    }

    return tokens;
};

const findSingleWordMatches = (tokens: Token[], normalized: string): BannedWordMatch[] => {
    const matches: BannedWordMatch[] = [];

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

    return matches;
};

const findPhraseMatches = (tokens: Token[], normalized: string): BannedWordMatch[] => {
    const matches: BannedWordMatch[] = [];

    for (let index = 0; index < tokens.length; index += 1) {
        const startToken = tokens[index];

        if (startToken === undefined) {
            continue;
        }

        const maxLength = Math.min(maxPhraseTokens, tokens.length - index);

        for (let phraseLength = 2; phraseLength <= maxLength; phraseLength += 1) {
            const phrase = tokens
                .slice(index, index + phraseLength)
                .map((t) => t.text)
                .join(" ");
            const lang = nonCjkPhrases.get(phrase);
            const endToken = tokens[index + phraseLength - 1];

            if (lang && endToken !== undefined) {
                matches.push({
                    endIndex: endToken.end,
                    language: lang,
                    startIndex: startToken.start,
                    word: normalized.slice(startToken.start, endToken.end),
                });
            }
        }
    }

    return matches;
};

const findCjkMatches = (lowerNormalized: string, normalized: string): BannedWordMatch[] => {
    const matches: BannedWordMatch[] = [];

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

    return matches;
};

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
    const tokens = tokenize(lowerNormalized);

    const matches: BannedWordMatch[] = [
        ...findSingleWordMatches(tokens, normalized),
        ...findPhraseMatches(tokens, normalized),
        ...findCjkMatches(lowerNormalized, normalized),
    ];

    return {
        hasBannedWords: matches.length > 0,
        matches,
    };
};
