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

export type RedactOptions = {
    exclude?: (number | string)[];
    logger?: { debug: (message?: unknown, ...optionalParameters: unknown[]) => void };
};
