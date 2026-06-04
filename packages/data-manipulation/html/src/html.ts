import escapeHtml from "./escape-html";

/**
 * Template tag function for HTML that escapes interpolated values to prevent XSS.
 * Template strings are used as-is, but all interpolated values are HTML-escaped.
 * @param strings Template literal strings
 * @param values Template literal values (will be escaped)
 * @returns The HTML string with interpolated values escaped
 * @example
 * html`<div>Hello</div>`
 * // => '<div>Hello</div>'
 * @example
 * html`<div>${'<script>alert("xss")</script>'}</div>`
 * // => '<div>&lt;script>alert("xss")&lt;/script></div>'
 */
function html(strings: TemplateStringsArray, ...values: unknown[]): string;

/**
 * Function overload for HTML with escaping control.
 * @param value The HTML string to process
 * @param shouldEscape If false/undefined, returns HTML as-is (unsafe for untrusted input). If true, escapes HTML.
 * @returns The processed HTML string
 * @example
 * html('<div></div>', false)
 * // => '<div></div>'
 * @example
 * html('<script>alert("xss")</script>', true)
 * // => '&lt;script>alert("xss")&lt;/script>'
 */
function html(value: string, shouldEscape?: boolean): string;

function html(stringsOrValue: TemplateStringsArray | string, ...valuesOrEscape: unknown[]): string {
    if (Array.isArray(stringsOrValue) && "raw" in stringsOrValue) {
        const strings = stringsOrValue as TemplateStringsArray;
        let result = strings[0] ?? "";

        for (const [i, element] of valuesOrEscape.entries()) {
            result += escapeHtml(element, true);
            result += strings[i + 1] ?? "";
        }

        return result;
    }

    const value = stringsOrValue as string;
    const shouldEscape = valuesOrEscape[0] as boolean | undefined;

    if (shouldEscape === false) {
        return value;
    }

    if (shouldEscape === true) {
        return escapeHtml(value, true);
    }

    return value;
}

export default html;
