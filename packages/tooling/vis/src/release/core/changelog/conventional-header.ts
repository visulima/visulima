/**
 * The conventional-commit header grammar — one parser for every changelog
 * formatter under this directory.
 *
 * A changelog entry is a single authored line (`fix(client,react): encode SSR
 * payloads`), optionally carrying a list marker and/or a gitmoji prefix. This
 * module owns every regex needed to take that line apart; formatters decide
 * what to *do* with the result (see `sections.ts`) but never re-derive it.
 *
 * The two breaking-change signals are reported separately rather than folded
 * into one flag, because the shipped formatters weigh them differently: the
 * `!` marker is part of the header and can therefore re-type an entry, while
 * an inline `BREAKING CHANGE` note is prose that only earns a mention in the
 * breaking section. {@link isBreakingChange} is the "either signal" predicate.
 */

/** Leading list marker (`- `, `* `, `+ `) authored in a change-file body. */
const BULLET_PREFIX_RE = /^[*+-]\s+/;

/**
 * Optional gitmoji / `:shortcode:` prefix preceding the conventional type
 * (`🚀 feat: …`, `:rocket: feat: …`) — release-please #2385 parity. Stripped
 * before parsing so the header regex doesn't bail on the leading non-ASCII
 * glyph.
 *
 * A pictographic base is not enough: half the gitmoji set is written with a
 * trailing U+FE0F VARIATION SELECTOR-16 (`🏗️` is U+1F3D7 U+FE0F), and an
 * emoji picker will hand the author a skin-tone modifier (`👍🏽`) or a
 * ZWJ sequence (`👨‍💻`). Matching only the base code point left the selector
 * sitting where the separator was expected, so the whole line failed to parse
 * as a conventional header and silently landed in the uncategorized bucket.
 *
 * Every optional part is a single code point drawn from a class that is
 * disjoint from what may follow it (a variation selector is not a modifier,
 * not a ZWJ and not whitespace), and each `*` iteration must start with a
 * ZWJ — so a failed match backtracks straight out instead of exploring
 * combinations. Together with the `^` anchor that keeps matching linear.
 * Keycap sequences (`1️⃣`) are deliberately not covered: they start with an
 * ASCII digit, and stripping those would swallow legitimate prose.
 */
const GITMOJI_PREFIX_RE
    = /^(?:[\p{Emoji_Presentation}\p{Extended_Pictographic}][\uFE0E\uFE0F]?\p{Emoji_Modifier}?(?:\u200D[\p{Emoji_Presentation}\p{Extended_Pictographic}][\uFE0E\uFE0F]?\p{Emoji_Modifier}?)*|:\w+:)\s+/u;

/**
 * Conventional-commit header. Fully anchored (`^`…`$`) and free of nested
 * quantifiers: the scope body is `[^()]*` so it can never overlap with the
 * closing paren, and the type charset excludes `(`, `!` and `:`. Matching is
 * therefore linear in the length of the line — this repo has been bitten by
 * CodeQL polynomial-ReDoS findings on unanchored commit scanners.
 */
// `[ \t]` is deliberately a SINGLE character rather than `[ \t]+`, and the
// subject is `(.*)` rather than `(.+)`. With `[ \t]+(.+)$` the two groups can
// both match whitespace, so a subject of many tabs makes the engine try every
// split between them — O(n²) (CodeQL polynomial-redos, alert 582). Consuming
// exactly one separator makes the split deterministic; any further leading
// whitespace lands in the subject and is removed by the `.trim()` below, so
// the parsed result is unchanged.
const CONVENTIONAL_HEADER_RE = /^([a-z][\w-]*)(?:\(([^()]*)\))?(!)?:[ \t](.*)$/i;

/** `BREAKING CHANGE:` / `BREAKING-CHANGE:` footer written inline in a change-file body. */
const BREAKING_NOTE = "BREAKING CHANGE";

const BREAKING_NOTE_ALT = "BREAKING-CHANGE";

/** Result of parsing a conventional-commit header line. */
export interface ParsedConventionalHeader {
    /** `true` for the `!` marker — `feat!:`, `fix(scope)!:`. */
    breakingMarker: boolean;
    /** `true` when the line carries an inline `BREAKING CHANGE` / `BREAKING-CHANGE` note. */
    breakingNote: boolean;
    /** Scope between the parentheses, `undefined` when the header has none. */
    scope: string | undefined;
    /** Everything after `: `. */
    subject: string;
    /** Lower-cased conventional type. */
    type: string;
}

/**
 * `true` when the line already opens with a Markdown list marker.
 *
 * Renderers use this to decide whether to prefix a bullet of their own; it is
 * the same test {@link stripBulletMarker} strips with, so the two can never
 * disagree about what a marker is (a `+ ` bullet used to be stripped here but
 * re-bulleted there, emitting `* + fix: …`).
 */
export const hasBulletMarker = (line: string): boolean => BULLET_PREFIX_RE.test(line);

/** Strip the leading list marker (if any) from an authored body line. */
export const stripBulletMarker = (line: string): string => line.replace(BULLET_PREFIX_RE, "").trim();

/**
 * Parse a single body line as a conventional-commit header.
 *
 * Returns `undefined` when the line does not follow the convention — the
 * caller is responsible for routing those to the uncategorized bucket rather
 * than dropping them.
 */
export const parseConventionalHeader = (line: string): ParsedConventionalHeader | undefined => {
    const text = stripBulletMarker(line).replace(GITMOJI_PREFIX_RE, "");
    const match = CONVENTIONAL_HEADER_RE.exec(text);

    if (!match) {
        return undefined;
    }

    const [, type, scope, bang, subject] = match;

    return {
        breakingMarker: bang === "!",
        breakingNote: text.includes(BREAKING_NOTE) || text.includes(BREAKING_NOTE_ALT),
        scope: scope === undefined || scope.trim() === "" ? undefined : scope.trim(),
        subject: subject!.trim(),
        type: type!.toLowerCase(),
    };
};

/** `true` when the header announces a breaking change by either signal. */
export const isBreakingChange = (parsed: ParsedConventionalHeader): boolean => parsed.breakingMarker || parsed.breakingNote;
