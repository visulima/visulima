/**
 * Public syntax-highlighting surface (`@visulima/tui/highlighter`).
 *
 * Kept as its own entry rather than folded into the root: `shiki` and
 * `@shikijs/langs`/`themes` are optional peers that this module lazy-imports.
 * Anything importing the root entry must not pay for them, so the highlighter
 * stays behind a subpath that only Code/Markdown-style components reach for.
 */
export { disposeHighlighter, getCachedTokens, default as getHighlighter, isLanguageSupported, resolveLanguage } from "../highlighter";
export type { TokenRenderOptions } from "../token-to-elements";
export { renderToken, renderTokenLine, tokenLinesToElements } from "../token-to-elements";
