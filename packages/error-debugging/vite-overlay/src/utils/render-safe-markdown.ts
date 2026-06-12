// eslint-disable-next-line import/no-extraneous-dependencies
import { Marked, Renderer } from "marked";

const HTML_ESCAPE_RE = /[&<>"']/g;
const HTML_ESCAPE_MAP: Record<string, string> = {
    "\"": "&quot;",
    "&": "&amp;",
    "'": "&#39;",
    "<": "&lt;",
    ">": "&gt;",
};

/**
 * Escapes HTML-significant characters so untrusted text cannot break out of its
 * surrounding markup context.
 * @param value The text to escape
 * @returns The HTML-escaped text
 */
const escapeHtml = (value: string): string => value.replaceAll(HTML_ESCAPE_RE, (char) => HTML_ESCAPE_MAP[char] ?? char);

// Only these URL schemes are allowed on rendered links. Anything else
// (notably `javascript:`, `data:`, `vbscript:`) is dropped to a harmless anchor.
// Absolute (`/foo`), relative (`./foo`, `../foo`) and bare-root paths are covered by `\.{0,2}\/`.
const SAFE_URL_RE = /^(?:https?:|mailto:|tel:|#|\.{0,2}\/)/i;

// Whitespace / control characters that could be inserted to disguise a dangerous
// scheme (e.g. `java\tscript:`). Stripped before the scheme allow-list check.
// eslint-disable-next-line no-control-regex
const URL_NOISE_RE = /[\u0000-\u0020\u007F-\u00A0]/g;

const isSafeUrl = (href: string): boolean => SAFE_URL_RE.test(href.replaceAll(URL_NOISE_RE, ""));

/**
 * Builds a marked instance that renders markdown but neutralizes every raw-HTML
 * vector. Solution headers/bodies can contain error-derived (attacker-influenceable)
 * content and the rendered output is injected into the dev overlay via `innerHTML`,
 * so `marked`'s default pass-through of raw HTML (script / img-onerror tags, …) and
 * `javascript:` URLs would be a DOM-XSS sink. Markdown formatting — code blocks,
 * inline code, links to safe schemes, lists, emphasis — is preserved.
 * @returns A configured marked instance
 */
const createSafeMarked = (): Marked => {
    const renderer = new Renderer();

    // Raw HTML tokens (both block-level and inline) are escaped instead of emitted verbatim.
    renderer.html = ({ text }) => escapeHtml(text);

    // Build links ourselves (rather than delegating to the base renderer, which needs an
    // attached parser) so the href is restricted to a safe scheme allow-list and both the
    // href and the visible text are escaped.
    renderer.link = ({ href, text, title }) => {
        const safeText = escapeHtml(text);

        if (!isSafeUrl(href)) {
            // Drop the unsafe href but keep the visible (escaped) link text.
            return safeText;
        }

        const titleAttribute = title ? ` title="${escapeHtml(title)}"` : "";

        return `<a href="${escapeHtml(href)}"${titleAttribute}>${safeText}</a>`;
    };

    // `images` are not expected in solutions; render their alt text only so a
    // crafted `src`/`onerror` cannot reach the DOM.
    renderer.image = ({ text }) => escapeHtml(text);

    return new Marked({ renderer });
};

const safeMarked = createSafeMarked();

/**
 * Renders untrusted markdown to HTML with all raw-HTML / unsafe-URL vectors removed.
 * Use this for any markdown that will be assigned via `innerHTML`.
 * @param markdown The (potentially untrusted) markdown source
 * @returns Sanitized HTML safe to inject via `innerHTML`
 */
const renderSafeMarkdown = async (markdown: string): Promise<string> => safeMarked.parse(markdown);

export default renderSafeMarkdown;

export { escapeHtml };
