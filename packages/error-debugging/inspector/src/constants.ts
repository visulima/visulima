export const TRUNCATOR = "…";

/**
 * Non-textual separator used between entries when output will later be re-indented
 * by `indentedJoin`. It occupies the same width (two characters) as the textual
 * `", "` separator, keeping `inspectList`'s truncation math identical, yet can never
 * appear inside a serialized value, so splitting on it is always safe.
 */
// eslint-disable-next-line unicorn/prefer-code-point
export const INDENT_SEPARATOR = String.fromCharCode(0, 0);
