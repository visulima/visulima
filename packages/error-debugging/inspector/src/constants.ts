export const TRUNCATOR = "…";

/**
 * Rendered in place of anything the inspector was not allowed to read — a getter
 * that threw, a `Proxy` trap that threw, a revoked `Proxy`. The inspector must
 * never crash on the value it is asked to render (its primary consumer is a
 * logger), so every unreadable slot degrades to this marker instead.
 */
export const INSPECTION_THREW = "[Inspection threw]";

/**
 * Non-textual separator used between entries when output will later be re-indented
 * by `indentedJoin`. It occupies the same width (two characters) as the textual
 * `", "` separator, keeping `inspectList`'s truncation math identical, yet can never
 * appear inside a serialized value, so splitting on it is always safe.
 */
// eslint-disable-next-line unicorn/prefer-code-point
export const INDENT_SEPARATOR = String.fromCharCode(0, 0);
