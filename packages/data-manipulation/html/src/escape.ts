// Browser-safe subpath entry: HTML/CSS/JS escaping helpers only, with no
// `sanitize-html` (and therefore no htmlparser2/parse5/postcss) in the import graph.
export { default as escapeHtml } from "./escape-html";

// eslint-disable-next-line import/no-extraneous-dependencies
export { escapeCss } from "@std/html/unstable-escape-css";
// eslint-disable-next-line import/no-extraneous-dependencies
export { escapeJs } from "@std/html/unstable-escape-js";
