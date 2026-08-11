// Browser-safe subpath entry: HTML/CSS/JS escaping helpers only, with no
// `sanitize-html` (and therefore no htmlparser2/parse5/postcss) in the import graph.
export { default as escapeHtml } from "./escape-html";
export type { EscapeJsOptions } from "./std-html";
export { escapeCss, escapeJs } from "./std-html";
