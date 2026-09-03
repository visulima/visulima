/**
 * A censor function receives the original value being redacted plus the dot-path
 * identifier of where it was found, and returns the value to store in its place.
 *
 * Use it for partial masking — e.g. keep the last four digits of a card number, or
 * mask the local part of an email — instead of a static replacement string.
 * @example
 * ```ts
 * const keepLast4: Censor = (value) =>
 *     typeof value === "string" ? "****" + value.slice(-4) : value;
 * ```
 * @param value The original value matched by the rule.
 * @param path The dot-path of the matched key (e.g. `user.card`), or `undefined`
 * for matches that have no key path (string-anonymizer / array-index matches).
 */
export type Censor = (value: unknown, path: string | undefined) => unknown;

export type StringAnonymize = { key: string; pattern: RegExp | string; replacement?: Censor | string };

export type Anonymize = {
    /**
     * When `true`, the rule is also applied to nested string values (NLP / regex based),
     * not just to matching object keys.
     */
    deep?: boolean;

    /** The key (or wildcard pattern, or NLP type) to match. Case-insensitive. */
    key: string;

    /** Optional regular expression matched against nested string values. */
    pattern?: RegExp | string;

    /**
     * When `true`, the matching key is deleted from the output object instead of being
     * replaced with `replacement`. Ignored for array elements and string-anonymizer matches.
     */
    remove?: boolean;

    /**
     * The value (or {@link Censor} function) to put in place of a match. Defaults to
     * the `&lt;KEY&gt;` placeholder when omitted.
     */
    replacement?: unknown;
};

export type InternalAnonymize = Anonymize & {
    compiledPattern?: RegExp;
    /** Whether `replacement` came from the user (vs. the auto-filled `&lt;KEY&gt;` default). */
    userReplacement?: boolean;
    wildcard?: boolean;
};

export type Rules = (Anonymize | StringAnonymize | number | string)[];

/** A single entity located in a string by an {@link NlpScanner}. */
export type NlpMatch = {
    /** Index of the match within the scanned input. */
    start: number;

    /** The rule key/type this match belongs to (e.g. `FirstName`); cased freely, matched case-insensitively. */
    tag: string;

    /** The exact matched text, which is what gets replaced. */
    text: string;
};

/**
 * Locates named entities (people, organizations, money, ...) that no regular expression can
 * describe. Redact ships no scanner by default — natural-language detection costs a
 * multi-hundred-kilobyte lexicon and a parse per string, so it is opt-in.
 *
 * Pass {@link https://www.npmjs.com/package/compromise | compromise}-backed detection via
 * `@visulima/redact/nlp`, or implement this signature against any other engine.
 * @example
 * ```ts
 * import { createRedactor, standardRules } from "@visulima/redact";
 * import { compromiseScanner } from "@visulima/redact/nlp";
 *
 * const scrub = createRedactor(standardRules, { nlp: compromiseScanner });
 * ```
 * A scanner is called for EVERY string the walk reaches, not only the ones carrying an entity
 * it handles — the core cannot know which types a given engine serves. Check `types` first and
 * return an empty array cheaply when none of them apply to you; that early exit is what keeps a
 * pure key/pattern rule set from paying for the scan.
 * @param input The string being redacted.
 * @param types The rule keys in play, lowercased. Return only matches whose `tag` is one of
 * them — the core masks whatever it is handed, so an out-of-contract tag would redact under a
 * label the caller never asked for.
 * @param logger Optional debug logger forwarded from {@link RedactOptions}.
 * @returns Every entity found, in any order. `start` must be the index of `text` within
 * `input`: the mask is applied at that offset, so a match reported at the wrong position would
 * redact the wrong occurrence. Overlapping matches are resolved in favour of the first by
 * `start` (longest wins on a tie), and the rest are dropped.
 */
export type NlpScanner = (input: string, types: string[], logger?: { debug: (message?: unknown, ...optionalParameters: unknown[]) => void }) => NlpMatch[];

export type RedactOptions = {
    exclude?: (number | string)[];
    logger?: { debug: (message?: unknown, ...optionalParameters: unknown[]) => void };

    /**
     * Opt in to natural-language entity detection (names, organizations, money).
     * Without it, key-name and `pattern` rules still apply — only the four rule keys that have
     * no regex shape (`firstname`, `lastname`, `organization`, `money`) go unmatched inside
     * prose. They still match object keys of the same name either way.
     */
    nlp?: NlpScanner;
};
