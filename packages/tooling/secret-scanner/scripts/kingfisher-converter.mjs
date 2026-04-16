// Pure, side-effect-free converters for Kingfisher YAML → our JSON rule shape.
// Kept separate from `build-rules.mjs` (which does IO + git) so it can be unit-tested
// without a filesystem or network.

// Kingfisher confidence is a quality signal; we mirror it onto `priority` so the
// existing span-based dedup in `native/src/lib.rs` naturally prefers higher-confidence
// rules when both gitleaks + kingfisher cover the same span. Preserves the string
// value on `confidence` for user-facing filtering.
export const CONFIDENCE_PRIORITY = { high: 2, low: 0, medium: 1 };

const KEYWORD_MIN_LEN = 3;
const KEYWORD_MAX_LEN = 16;

const INLINE_FLAGS_PATTERN = /^\s*\(\?[a-z]+\)\s*/i;
const FREE_SPACING_PATTERN = /\(\?[A-WYZ]*X[A-Z]*\)/i;
const COMMENT_PATTERN = /#[^\n]*/g;
const WHITESPACE_PATTERN = /\s+/g;
const BOUNDED_QUANTIFIER_PATTERN = /^\{\d+(?:,\d*)?\}$/;
const METACHAR_PATTERN = /[()|^$*+?.]/;
const LITERAL_CHAR_PATTERN = /[\w-]/;
const NON_ALPHA_KEYWORD_PATTERN = /^[0-9_-]+$/;

const stripLeadingFlags = (pattern) => pattern.replace(INLINE_FLAGS_PATTERN, "");

/**
 * Heuristic literal-prefix extractor for Kingfisher patterns. Produces short
 * literal substrings that feed the runtime's aho-corasick prefilter — rules
 * without any extracted keyword fall back to always-run (acceptable for phase 1;
 * `pattern_requirements` + entropy catch the FPs).
 *
 * Handles the common Kingfisher shapes:
 * - `\b<literal>` / `\b(<literal>...)`
 * - `(?:alt1|alt2|alt3)<rest>`  — extracts each alternative's leading literal
 * - `<literal><charclass>`      — literal up to the first `[` or quantifier
 * Ignores inline flags `(?x)`, `(?xi)`, `(?i)` at the very start.
 * @param {string} pattern Raw regex source from the rule YAML.
 * @returns {string[]} Lower-cased candidate keywords. Empty when the pattern has no extractable literal prefix.
 */
// eslint-disable-next-line sonarjs/cognitive-complexity -- the per-char state machine is intentional; splitting would split the read order too.
export const extractKeywords = (pattern) => {
    if (typeof pattern !== "string") {
        return [];
    }

    // Collapse `(?x)` free-spacing whitespace + comments so the literal extractor
    // doesn't get confused. Kingfisher uses `(?x)` heavily.
    let body = stripLeadingFlags(pattern);

    if (FREE_SPACING_PATTERN.test(pattern)) {
        body = body.replaceAll(COMMENT_PATTERN, "").replaceAll(WHITESPACE_PATTERN, "");
    }

    // Walk the body char-by-char, accumulating runs of literal characters while
    // skipping over regex metasyntax (character classes, escapes, quantifiers,
    // group markers). Every run ≥ KEYWORD_MIN_LEN becomes a candidate keyword.
    // The accumulator resets on any regex metachar or boundary — so we never
    // splice "token" + "secret" together if they appear as alternatives.
    const keywords = new Set();
    let run = "";

    const flush = () => {
        if (run.length >= KEYWORD_MIN_LEN) {
            keywords.add(run.slice(0, KEYWORD_MAX_LEN).toLowerCase());
        }

        run = "";
    };

    let index = 0;

    while (index < body.length) {
        const ch = body[index];

        if (ch === "\\") {
            // Escape: skip the escape pair; escapes like `\d`, `\w`, `\s`, `\b` are
            // never literal.
            flush();
            index += 2;

            continue;
        }

        if (ch === "[") {
            flush();

            const end = body.indexOf("]", index + 1);

            index = end === -1 ? body.length : end + 1;

            continue;
        }

        if (ch === "{") {
            // Bounded quantifier `{min,max}` or literal `{` — assume quantifier when
            // followed by digits (the common case in rule patterns).
            const end = body.indexOf("}", index + 1);

            if (end !== -1 && BOUNDED_QUANTIFIER_PATTERN.test(body.slice(index, end + 1))) {
                index = end + 1;

                continue;
            }
        }

        if (METACHAR_PATTERN.test(ch)) {
            flush();
            index += 1;

            continue;
        }

        if (LITERAL_CHAR_PATTERN.test(ch)) {
            run += ch;
            index += 1;

            continue;
        }

        flush();
        index += 1;
    }

    flush();

    return [...keywords].filter((k) => !NON_ALPHA_KEYWORD_PATTERN.test(k));
};

/**
 * Map a single Kingfisher rule block to our JSON rule shape. Returns
 * `{ skipped: true, reason }` only for invalid rules (missing id or pattern).
 * Upstream-only metadata (`validation`, `depends_on_rule`,
 * `pattern_requirements.checksum`) is preserved round-trip — the TS post-scan
 * pipeline consumes the checksum filter directly, and the HTTP validator
 * consumes `validation:` on opt-in.
 * @param {unknown} rule       Parsed YAML rule block.
 * @param {string}  sourceFile File path the rule came from, used in skip reasons.
 * @returns {{ skipped: true, reason: string } | { skipped: false, rule: object }} Conversion result — `skipped:true` when the rule is unusable.
 */
// eslint-disable-next-line sonarjs/cognitive-complexity -- straight-line field mapping; branching is the nature of YAML → JSON translation.
export const convertKingfisherRule = (rule, sourceFile = "<inline>") => {
    const skip = (reason) => {
        return { reason: `${sourceFile}:${rule?.id ?? "?"} — ${reason}`, skipped: true };
    };

    if (rule === undefined || rule === null || typeof rule !== "object") {
        return skip("non-object rule");
    }

    if (!rule.id || !rule.pattern) {
        return skip("missing id or pattern");
    }

    const converted = {
        description: String(rule.name ?? rule.id),
        id: String(rule.id),
        regex: String(rule.pattern).trimEnd(),
        secretGroup: 1,
        source: "kingfisher",
    };

    if (typeof rule.min_entropy === "number") {
        converted.entropy = rule.min_entropy;
    }

    if (typeof rule.confidence === "string") {
        const c = rule.confidence.toLowerCase();

        if (c === "low" || c === "medium" || c === "high") {
            converted.confidence = c;
            converted.priority = CONFIDENCE_PRIORITY[c];
        }
    }

    const reqs = rule.pattern_requirements;

    if (reqs && typeof reqs === "object") {
        const patternRequirements = {};

        if (typeof reqs.min_digits === "number") {
            patternRequirements.minDigits = reqs.min_digits;
        }

        if (typeof reqs.min_length === "number") {
            patternRequirements.minLength = reqs.min_length;
        }

        if (Array.isArray(reqs.ignore_if_contains)) {
            const items = reqs.ignore_if_contains.filter((s) => typeof s === "string" && s.length > 0);

            if (items.length > 0) {
                patternRequirements.ignoreIfContains = items;
            }
        }

        // Preserve the checksum block as a sub-object of patternRequirements so
        // the TS post-scan pipeline can apply it. Passed through as-is — the
        // consumer parses the liquid template against the rule's named captures.
        if (reqs.checksum && typeof reqs.checksum === "object") {
            patternRequirements.checksum = reqs.checksum;
        }

        if (Object.keys(patternRequirements).length > 0) {
            converted.patternRequirements = patternRequirements;
        }
    }

    const keywords = extractKeywords(converted.regex);

    if (keywords.length > 0) {
        converted.keywords = keywords;
    }

    if (Array.isArray(rule.tags)) {
        converted.tags = rule.tags.filter((t) => typeof t === "string");
    }

    // Preserve upstream-only metadata (validation, depends_on_rule) round-trip so
    // HTTP validators can consume them without re-parsing the Kingfisher YAMLs.
    // The native detector ignores both fields at scan time.
    if (rule.validation !== undefined && rule.validation !== null) {
        converted.validation = rule.validation;
    }

    if (rule.depends_on_rule !== undefined && rule.depends_on_rule !== null) {
        converted.dependsOnRule = rule.depends_on_rule;
    }

    return { rule: converted, skipped: false };
};
