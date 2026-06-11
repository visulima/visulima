// Dedicated subpath entry for HTML sanitization. Importing this pulls in the heavy
// `sanitize-html` (htmlparser2/parse5/postcss) dependency chain, so keep it out of
// browser-/escape-only code paths and import it explicitly when sanitization is needed.

export { default, default as sanitizeHtml } from "sanitize-html";
