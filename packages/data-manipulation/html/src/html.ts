import escapeHtml from "./escape-html";

/**
 * Branded wrapper produced by {@link html.raw}. Values wrapped in this marker are
 * interpolated into the `html` tagged template (or composed via arrays) verbatim,
 * without escaping. Use it only for HTML you already trust.
 */
interface RawHtml {
    /** Internal brand used to detect trusted fragments. */
    readonly __isRawHtml: true;
    /** The trusted HTML payload. */
    readonly value: string;
}

const RAW_BRAND = "__isRawHtml" as const;

/**
 * Type guard that detects a {@link RawHtml} marker (including nested fragments
 * produced by the `html` tag, which are themselves marked as raw).
 * @param value The value to test.
 * @returns `true` when the value is a trusted raw HTML fragment.
 */
const isRawHtml = (value: unknown): value is RawHtml => typeof value === "object" && value !== null && (value as { [RAW_BRAND]?: unknown })[RAW_BRAND] === true;

/**
 * Serializes a single interpolated value for the `html` tag.
 *
 * - {@link RawHtml} markers (created via {@link html.raw}) are inlined verbatim.
 * - Arrays are flattened and joined with an empty string, serializing each element recursively.
 * - Everything else is coerced to a string and HTML-escaped (attribute-safe).
 * @param value The interpolated value.
 * @returns The serialized, escape-applied string.
 */
const serializeValue = (value: unknown): string => {
    if (isRawHtml(value)) {
        return value.value;
    }

    if (Array.isArray(value)) {
        let out = "";

        for (const element of value) {
            out += serializeValue(element);
        }

        return out;
    }

    return escapeHtml(value, true);
};

/**
 * Template tag function for HTML that escapes interpolated values to prevent XSS.
 * Template strings are used as-is, but all interpolated values are HTML-escaped.
 *
 * Interpolated arrays are flattened and joined with an empty string (no commas), and
 * values wrapped with {@link html.raw} are inlined without escaping, enabling fragment
 * composition. Because the tag returns a plain string, nested fragments must be wrapped
 * with `html.raw` to avoid double-escaping.
 * @param strings Template literal strings
 * @param values Template literal values (escaped unless wrapped with {@link html.raw})
 * @returns The HTML string with interpolated values escaped
 * @example
 * html`<div>Hello</div>`
 * // => '<div>Hello</div>'
 * @example
 * html`<div>${'<script>alert("xss")</script>'}</div>`
 * // => '<div>&lt;script>alert("xss")&lt;/script></div>'
 * @example
 * html`<ul>${items.map((i) => html.raw(html`<li>${i}</li>`))}</ul>`
 * // => '<ul><li>a</li><li>b</li></ul>'
 */
function html(strings: TemplateStringsArray, ...values: unknown[]): string;

/**
 * Function overload for HTML with explicit escaping control.
 *
 * Note: unlike the template-tag form, this overload returns the input **unescaped**
 * unless `shouldEscape` is `true`. Prefer the template tag for untrusted data; reach
 * for this form only when you already trust `value`.
 * @param value The HTML string to process
 * @param shouldEscape When `true`, escapes HTML. When `false`/omitted, returns the input as-is (unsafe for untrusted input).
 * @returns The processed HTML string
 * @example
 * html('<div></div>', false)
 * // => '<div></div>'
 * @example
 * html('<script>alert("xss")</script>', true)
 * // => '&lt;script>alert(&quot;xss&quot;)&lt;/script>'
 */
function html(value: string, shouldEscape?: boolean): string;

function html(stringsOrValue: TemplateStringsArray | string, ...valuesOrEscape: unknown[]): string {
    if (Array.isArray(stringsOrValue) && "raw" in stringsOrValue) {
        const strings = stringsOrValue as TemplateStringsArray;
        let result = strings[0] ?? "";

        for (const [i, element] of valuesOrEscape.entries()) {
            result += serializeValue(element);
            result += strings[i + 1] ?? "";
        }

        return result;
    }

    const value = stringsOrValue as string;
    const shouldEscape = valuesOrEscape[0] as boolean | undefined;

    if (shouldEscape === true) {
        return escapeHtml(value, true);
    }

    return value;
}

/**
 * Marks a string as trusted, pre-rendered HTML so the `html` tagged template inlines
 * it verbatim instead of escaping it. Only pass HTML you have already sanitized or
 * fully control — wrapping untrusted input defeats the package's XSS protection.
 * @param value The trusted HTML string.
 * @returns A {@link RawHtml} marker recognized by the `html` tag.
 * @example
 * const note = html.raw("<em>trusted</em>");
 * html`<p>${note}</p>`
 * // => '<p><em>trusted</em></p>'
 */
html.raw = (value: string): RawHtml => {
    return { [RAW_BRAND]: true, value };
};

export type { RawHtml };
export { isRawHtml };
export default html;
