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
    /**
     * Optional moderation category for the matched entry (e.g. `"slur"`, `"profanity"`).
     * @remarks
     * Only present when the matched entry carried a {@link BannedWordEntry.category}.
     * The built-in dictionaries ship bare strings, so this is `undefined` for them; it is
     * populated when a custom dictionary supplies tagged entries via {@link createChecker}.
     */
    category?: string;
    /** Zero-based end index in the original text (exclusive) */
    endIndex: number;

    /**
     * ISO 639-1 language code the word was matched from (e.g., 'en', 'de', 'ja').
     * @remarks
     * When an identical spelling appears in more than one language dictionary, this
     * is the first dictionary (by dictionary iteration order) the word appears in,
     * not necessarily the only language that bans it.
     */
    language: string;

    /**
     * Optional severity score for the matched entry (higher means more severe).
     * @remarks
     * Only present when the matched entry carried a {@link BannedWordEntry.severity}.
     * Useful for graduated moderation policies (warn vs. block).
     */
    severity?: number;
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
 * A tagged dictionary entry carrying optional moderation metadata.
 * @remarks
 * Accepted by {@link createChecker} in place of a bare string so callers can attach a
 * {@link BannedWordEntry.category} and/or {@link BannedWordEntry.severity} that is surfaced
 * on every {@link BannedWordMatch}.
 * @public
 */
// eslint-disable-next-line import/exports-last
export interface BannedWordEntry {
    /** Optional moderation category (e.g. `"slur"`, `"profanity"`, `"violence"`). */
    category?: string;
    /** Optional severity score (higher means more severe). */
    severity?: number;
    /** The banned word or phrase. */
    word: string;
}

/**
 * A custom dictionary accepted by {@link createChecker}: a map of language code to a list of
 * bare strings and/or {@link BannedWordEntry} objects.
 * @public
 */
// eslint-disable-next-line import/exports-last
export type BannedWordDictionary = Record<string, ReadonlyArray<BannedWordEntry | string>>;

/**
 * Options accepted by {@link checkBannedWords} and {@link Checker.check}.
 * @public
 */
// eslint-disable-next-line import/exports-last
export interface CheckOptions {
    /**
     * Words (or phrases) that should never be reported even if they appear in a dictionary.
     * @remarks
     * Solves the "Scunthorpe problem": a domain-specific term that collides with a banned
     * entry can be allowlisted so it is silently ignored. Matched case-insensitively.
     *
     * Supplying this (or {@link CheckOptions.customWords}) builds a one-off checker for the
     * call, so prefer {@link createChecker} when the same allowlist is reused across many calls.
     */
    allowlist?: ReadonlyArray<string>;

    /**
     * Extra words (or phrases) to flag in addition to the built-in dictionaries.
     * @remarks
     * Added under a synthetic `"custom"` language and always scanned regardless of the
     * {@link CheckOptions.languages} restriction (you opted into them explicitly). Matched
     * case-insensitively. Supplying this builds a one-off checker for the call, so prefer
     * {@link createChecker} when the same custom words are reused across many calls.
     */
    customWords?: ReadonlyArray<string>;

    /**
     * Restrict matching to the given language codes (e.g. `["en", "de"]`).
     * @remarks
     * When omitted (or empty) every configured language is checked. Restricting languages
     * avoids cross-language false positives — an English-only app does not want Latin
     * transliterations from the Russian or Arabic lists matching its content.
     *
     * Has no effect on {@link CheckOptions.customWords}, which are always scanned.
     */
    languages?: ReadonlyArray<string>;
}

/**
 * Options for {@link censorText} and {@link Checker.censor}.
 * @public
 */
// eslint-disable-next-line import/exports-last
export interface CensorOptions extends CheckOptions {
    /**
     * The character used to mask each character of a matched word. Defaults to `"*"`.
     * @remarks
     * Only the first character of the provided string is used.
     */
    replacement?: string;
}

/**
 * Options for {@link createChecker}.
 * @public
 */
// eslint-disable-next-line import/exports-last
export interface CreateCheckerOptions {
    /**
     * Words (or phrases) that should never be reported even if they appear in a dictionary.
     * @remarks
     * Solves the "Scunthorpe problem": a domain-specific term that collides with a banned
     * entry can be allowlisted so it is silently ignored. Matched case-insensitively.
     */
    allowlist?: ReadonlyArray<string>;

    /**
     * The dictionary to match against. Defaults to the built-in {@link BANNED_WORDS} lists.
     * @remarks
     * Entries may be bare strings or {@link BannedWordEntry} objects with `category`/`severity`.
     */
    words?: BannedWordDictionary;
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
 * Locale-independent case fold that also normalizes the Turkish dotted İ (U+0130).
 * `"İ".toLowerCase()` yields `"i" + U+0307` (combining dot above), which would never
 * equal the lowercase-stored key `"i"`. Stripping the combining dot above after folding
 * makes uppercase Turkish İ and ASCII I fold identically.
 * @internal
 */
const COMBINING_DOT_ABOVE_RE = /̇/g;

const foldCase = (value: string): string => value.normalize("NFC").toLowerCase().normalize("NFD").replaceAll(COMBINING_DOT_ABOVE_RE, "").normalize("NFC");

interface Token {
    end: number;
    folded: string;
    start: number;
    text: string;
}

interface EntryMeta {
    category?: string;
    language: string;
    severity?: number;
}

/**
 * Lookup tables for efficient banned word matching.
 * @remarks
 * Uses Map/Set for O(1) lookup instead of giant regex alternations, avoiding V8's steep
 * JIT compilation cost for massive patterns. CJK entries are bucketed by first character so
 * a check only scans the handful of entries that could possibly start at a given position,
 * instead of running an `indexOf` for every CJK entry on every call.
 * @internal
 */
interface LookupTables {
    /** First CJK character -> entries (folded word + metadata) that start with it. */
    cjkByFirstChar: Map<string, { meta: EntryMeta; word: string }[]>;
    maxPhraseTokens: number;
    nonCjkPhrases: Map<string, EntryMeta>;
    nonCjkSingleWords: Map<string, EntryMeta>;
}

const normalizeEntry = (entry: BannedWordEntry | string, lang: string): EntryMeta & { word: string } => {
    if (typeof entry === "string") {
        return { language: lang, word: entry };
    }

    return { category: entry.category, language: lang, severity: entry.severity, word: entry.word };
};

const addNonCjkEntry = (normalized: string, meta: EntryMeta, tables: Pick<LookupTables, "nonCjkPhrases" | "nonCjkSingleWords">): number => {
    const tokens = [...normalized.matchAll(WORD_TOKEN_RE)].map((match) => match[0]);

    if (tokens.length === 0) {
        return 1;
    }

    const key = tokens.join(" ");

    if (tokens.length === 1) {
        if (!tables.nonCjkSingleWords.has(key)) {
            tables.nonCjkSingleWords.set(key, meta);
        }

        return 1;
    }

    if (!tables.nonCjkPhrases.has(key)) {
        tables.nonCjkPhrases.set(key, meta);
    }

    return tokens.length;
};

const buildLookupTables = (dictionary: BannedWordDictionary, allowlist: ReadonlySet<string>): LookupTables => {
    const nonCjkSingleWords = new Map<string, EntryMeta>();
    const nonCjkPhrases = new Map<string, EntryMeta>();
    const cjkByFirstChar = new Map<string, { meta: EntryMeta; word: string }[]>();
    let maxPhraseTokens = 1;

    for (const [lang, words] of Object.entries(dictionary)) {
        const isCjk = CJK_LANGUAGES.has(lang);

        for (const entry of words) {
            const { category, severity, word } = normalizeEntry(entry, lang);
            const normalized = foldCase(word);

            if (allowlist.has(normalized)) {
                continue;
            }

            const meta: EntryMeta = { category, language: lang, severity };

            if (isCjk && HAS_CJK_CHAR_RE.test(normalized) && normalized.length > 0) {
                const firstChar = normalized[0] as string;
                let bucket = cjkByFirstChar.get(firstChar);

                if (bucket === undefined) {
                    bucket = [];
                    cjkByFirstChar.set(firstChar, bucket);
                }

                bucket.push({ meta, word: normalized });
            } else {
                const tokens = addNonCjkEntry(normalized, meta, { nonCjkPhrases, nonCjkSingleWords });

                maxPhraseTokens = Math.max(maxPhraseTokens, tokens);
            }
        }
    }

    return { cjkByFirstChar, maxPhraseTokens, nonCjkPhrases, nonCjkSingleWords };
};

// Tokenizes the NFC-normalized original text (not the folded string) so token boundaries
// index the original: `foldCase` can change string length (e.g. stripping a stray combining
// dot above), which would otherwise shift every subsequent match position. The fold is applied
// per token for the lookup key, keeping `start`/`end` aligned with the returned `word`.
const tokenize = (normalized: string): Token[] => {
    WORD_TOKEN_RE.lastIndex = 0;

    const tokens: Token[] = [];
    let tokenMatch: RegExpExecArray | null;

    // eslint-disable-next-line no-cond-assign
    while ((tokenMatch = WORD_TOKEN_RE.exec(normalized)) !== null) {
        const text = tokenMatch[0];

        tokens.push({ end: tokenMatch.index + text.length, folded: foldCase(text), start: tokenMatch.index, text });
    }

    return tokens;
};

/**
 * Synthetic language code under which {@link CheckOptions.customWords} are registered.
 * Always passes the {@link CheckOptions.languages} filter so explicitly-supplied custom
 * words are never narrowed away.
 * @internal
 */
const CUSTOM_LANGUAGE = "custom";

/**
 * Empty allowlist passed when building the one-off table for per-call {@link CheckOptions.customWords}
 * (a per-call allowlist is applied by filtering the resulting matches, not at table-build time).
 * @internal
 */
const EMPTY_ALLOWLIST: ReadonlySet<string> = new Set<string>();

const allowedLanguages = (options?: CheckOptions): ReadonlySet<string> | undefined => {
    if (!options?.languages || options.languages.length === 0) {
        return undefined;
    }

    return new Set([...options.languages, CUSTOM_LANGUAGE]);
};

const toMatch = (meta: EntryMeta, startIndex: number, endIndex: number, word: string): BannedWordMatch => {
    const match: BannedWordMatch = { endIndex, language: meta.language, startIndex, word };

    if (meta.category !== undefined) {
        match.category = meta.category;
    }

    if (meta.severity !== undefined) {
        match.severity = meta.severity;
    }

    return match;
};

const findSingleWordMatches = (tables: LookupTables, tokens: Token[], normalized: string, languages?: ReadonlySet<string>): BannedWordMatch[] => {
    const matches: BannedWordMatch[] = [];

    for (const token of tokens) {
        const meta = tables.nonCjkSingleWords.get(token.folded);

        if (meta && (languages === undefined || languages.has(meta.language))) {
            matches.push(toMatch(meta, token.start, token.end, normalized.slice(token.start, token.end)));
        }
    }

    return matches;
};

const findPhraseMatches = (tables: LookupTables, tokens: Token[], normalized: string, languages?: ReadonlySet<string>): BannedWordMatch[] => {
    const matches: BannedWordMatch[] = [];

    for (let index = 0; index < tokens.length; index += 1) {
        const startToken = tokens[index];

        if (startToken === undefined) {
            continue;
        }

        const maxLength = Math.min(tables.maxPhraseTokens, tokens.length - index);

        // Build the phrase key incrementally to avoid the slice().map().join() allocation
        // churn (two arrays + a string) on every (token, phraseLength) probe.
        let phrase = startToken.folded;

        for (let phraseLength = 2; phraseLength <= maxLength; phraseLength += 1) {
            const endToken = tokens[index + phraseLength - 1];

            if (endToken === undefined) {
                break;
            }

            phrase += ` ${endToken.folded}`;

            const meta = tables.nonCjkPhrases.get(phrase);

            if (meta && (languages === undefined || languages.has(meta.language))) {
                matches.push(toMatch(meta, startToken.start, endToken.end, normalized.slice(startToken.start, endToken.end)));
            }
        }
    }

    return matches;
};

const findCjkMatches = (tables: LookupTables, normalized: string, languages?: ReadonlySet<string>): BannedWordMatch[] => {
    const matches: BannedWordMatch[] = [];

    if (tables.cjkByFirstChar.size === 0) {
        return matches;
    }

    // Walk the NFC-normalized original once (by UTF-16 code unit) so positions index the
    // original text directly. CJK characters are case-fold invariant, so the folded bucket
    // keys and folded entry words compare equal against the original CJK characters — no
    // separate folded string is needed, which also keeps positions length-safe.
    for (let index = 0; index < normalized.length; index += 1) {
        const bucket = tables.cjkByFirstChar.get(normalized[index] as string);

        if (bucket === undefined) {
            continue;
        }

        for (const { meta, word } of bucket) {
            if (languages !== undefined && !languages.has(meta.language)) {
                continue;
            }

            if (normalized.startsWith(word, index)) {
                matches.push(toMatch(meta, index, index + word.length, normalized.slice(index, index + word.length)));
            }
        }
    }

    return matches;
};

/**
 * A reusable banned-word checker bound to a specific dictionary and allowlist.
 * @remarks
 * Created via {@link createChecker}. The lookup tables are built lazily on first use and
 * cached for the lifetime of the checker.
 * @public
 */
// eslint-disable-next-line import/exports-last
export interface Checker {
    /**
     * Censors banned words in the given text by masking each matched character.
     * @param text The text to censor.
     * @param options Replacement character and/or language restriction.
     * @returns The censored text (unchanged if nothing matched).
     */
    censor: (text: string, options?: CensorOptions) => string;

    /**
     * Checks text for banned words.
     * @param text The text to check.
     * @param options Optional language restriction.
     * @returns Result object containing match information.
     */
    check: (text: string, options?: CheckOptions) => BannedWordsResult;
}

const runCheck = (tables: LookupTables, text: string, options?: CheckOptions): BannedWordsResult => {
    if (!text || text.trim().length === 0) {
        return { hasBannedWords: false, matches: [] };
    }

    const languages = allowedLanguages(options);
    const normalized = text.normalize("NFC");
    const tokens = tokenize(normalized);

    const matches: BannedWordMatch[] = [
        ...findSingleWordMatches(tables, tokens, normalized, languages),
        ...findPhraseMatches(tables, tokens, normalized, languages),
        ...findCjkMatches(tables, normalized, languages),
    ];

    // Layer per-call custom words over the checker's own dictionary. They are scanned under the
    // synthetic "custom" language (always allowed by `allowedLanguages`) so an explicit list is
    // never narrowed away by an `options.languages` restriction.
    if (options?.customWords && options.customWords.length > 0) {
        const customTables = buildLookupTables({ [CUSTOM_LANGUAGE]: options.customWords }, EMPTY_ALLOWLIST);

        matches.push(
            ...findSingleWordMatches(customTables, tokens, normalized, languages),
            ...findPhraseMatches(customTables, tokens, normalized, languages),
            ...findCjkMatches(customTables, normalized, languages),
        );
    }

    // Suppress per-call allowlisted terms (the Scunthorpe problem), matched case-insensitively.
    let resolved = matches;

    if (options?.allowlist && options.allowlist.length > 0) {
        const allowed = new Set(options.allowlist.map((word) => foldCase(word)));

        resolved = matches.filter((match) => !allowed.has(foldCase(match.word)));
    }

    // Order by start position, then longest-first, so the documented
    // reverse-censor pattern produces correct, position-ordered output.
    resolved.sort((a, b) => a.startIndex - b.startIndex || b.endIndex - b.startIndex - (a.endIndex - a.startIndex));

    return {
        hasBannedWords: resolved.length > 0,
        matches: resolved,
    };
};

const applyCensor = (text: string, matches: ReadonlyArray<BannedWordMatch>, replacement: string): string => {
    if (matches.length === 0) {
        return text;
    }

    const firstCodePoint = replacement.codePointAt(0);
    const maskChar = firstCodePoint === undefined ? "*" : String.fromCodePoint(firstCodePoint);

    let censored = text;

    // Process right-to-left so indices stay valid as we mutate the string. `cursorEnd` tracks the
    // leftmost already-masked position; each match masks the union of its span with what remains,
    // i.e. [startIndex, min(endIndex, cursorEnd)). This masks overlapping matches fully instead of
    // dropping an earlier match that overlaps a later one (which would leak its unmasked prefix).
    let cursorEnd = Number.POSITIVE_INFINITY;

    for (const match of matches.toSorted((a, b) => b.startIndex - a.startIndex)) {
        const maskEnd = Math.min(match.endIndex, cursorEnd);

        if (maskEnd <= match.startIndex) {
            continue;
        }

        const mask = maskChar.repeat(maskEnd - match.startIndex);

        censored = censored.slice(0, match.startIndex) + mask + censored.slice(maskEnd);
        cursorEnd = match.startIndex;
    }

    return censored;
};

/**
 * Creates a reusable {@link Checker} bound to a custom dictionary and/or allowlist.
 * @param options Dictionary, allowlist, and other configuration. See {@link CreateCheckerOptions}.
 * @returns A {@link Checker} with `check` and `censor` methods.
 * @remarks
 * Use this to:
 * - supply a domain-specific dictionary (bare strings or tagged {@link BannedWordEntry} objects),
 * - allowlist terms that collide with banned entries (the Scunthorpe problem),
 * - attach `category`/`severity` metadata that is surfaced on every match.
 *
 * Lookup tables are built lazily on the first `check`/`censor` call and cached afterwards.
 * @example
 * ```typescript
 * import { createChecker } from "@visulima/content-safety";
 *
 * const checker = createChecker({
 *   words: { en: [{ word: "frobnicate", category: "spam", severity: 1 }] },
 *   allowlist: ["scunthorpe"],
 * });
 *
 * checker.check("please do not frobnicate").matches[0]?.category; // "spam"
 * checker.censor("frobnicate now"); // "********** now"
 * ```
 * @public
 */
// eslint-disable-next-line import/exports-last
export const createChecker = (options: CreateCheckerOptions = {}): Checker => {
    const dictionary = options.words ?? BANNED_WORDS;
    const allowlist = new Set((options.allowlist ?? []).map((word) => foldCase(word)));

    let tables: LookupTables | undefined;

    const getTables = (): LookupTables => {
        tables ??= buildLookupTables(dictionary, allowlist);

        return tables;
    };

    return {
        censor: (text: string, censorOptions?: CensorOptions): string => {
            const { matches } = runCheck(getTables(), text, censorOptions);

            return applyCensor(text, matches, censorOptions?.replacement ?? "*");
        },
        check: (text: string, checkOptions?: CheckOptions): BannedWordsResult => runCheck(getTables(), text, checkOptions),
    };
};

// Default checker over the built-in dictionary. Lookup tables are built lazily on first use,
// so merely importing the package no longer folds/tokenizes all ~8.4k entries — keeping
// cold-start cheap for edge runtimes that may never call the checker.
let defaultChecker: Checker | undefined;

const getDefaultChecker = (): Checker => {
    defaultChecker ??= createChecker();

    return defaultChecker;
};


/**
 * Checks text for banned words across the configured languages.
 * @param text The text to check for banned words.
 * @param options Optional {@link CheckOptions} (e.g. restrict the languages checked).
 * @returns Result object containing match information.
 * @remarks
 * This function:
 * - Checks against 19 language dictionaries simultaneously (or a subset via `options.languages`)
 * - Is case-insensitive
 * - Normalizes text to NFC Unicode form for consistent matching
 * - Handles multi-word phrases
 * - Respects word boundaries (except for CJK scripts)
 * - Uses Map/Set lookups for O(1) per-word matching
 * - Returns empty results for empty or whitespace-only input
 *
 * For performance, CJK scripts (Chinese, Japanese, Korean) use substring matching
 * without word boundaries, while all other scripts use tokenized word-boundary matching.
 *
 * Pass `options.allowlist` to suppress specific false positives (the Scunthorpe problem) and
 * `options.customWords` to flag extra terms in addition to the built-in lists. Both build a
 * one-off checker per call — for repeated use of the same custom dictionary, `category`/`severity`
 * metadata, or a stable allowlist, prefer {@link createChecker}.
 * To mask matches in one call, use {@link censorText}.
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
 * Restricting to specific languages (avoids cross-language false positives):
 * ```typescript
 * const result = checkBannedWords("some text", { languages: ["en"] });
 * ```
 * @public
 */
export const checkBannedWords = (text: string, options?: CheckOptions): BannedWordsResult => getDefaultChecker().check(text, options);

/**
 * Censors banned words in the given text by masking each matched character.
 * @param text The text to censor.
 * @param options Replacement character and/or language restriction. See {@link CensorOptions}.
 * @returns The censored text. The input is returned unchanged when nothing matches.
 * @remarks
 * Overlapping matches are masked once (the longest match at each position wins), so the output
 * length always equals the input length. For custom dictionaries use {@link createChecker}'s `censor`.
 * @example
 * ```typescript
 * import { censorText } from "@visulima/content-safety";
 *
 * censorText("this is badword text"); // "this is ******* text"
 * censorText("this is badword text", { replacement: "#" }); // "this is ####### text"
 * ```
 * @public
 */
export const censorText = (text: string, options?: CensorOptions): string => getDefaultChecker().censor(text, options);
