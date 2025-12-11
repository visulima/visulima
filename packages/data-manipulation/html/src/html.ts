import escapeHtml from "./escape-html";

/**
 * Template tag function for HTML that returns the HTML as-is (XSS-safe).
 * Use this when you trust the HTML content from template literals.
 * @param strings Template literal strings
 * @param values Template literal values
 * @returns The HTML string as-is
 * @example
 * html`<div>Hello</div>`
 * // => '<div>Hello</div>'
 */
function html(strings: TemplateStringsArray, ...values: unknown[]): string;

/**
 * Function overload for HTML with escaping control.
 * @param value The HTML string to process
 * @param escape If false, returns HTML as-is (XSS-safe). If true, escapes HTML.
 * @returns The processed HTML string
 * @example
 * html('<div></div>', false)
 * // => '<div></div>'
 * @example
 * html('<script>alert("xss")</script>', true)
 * // => '&lt;script>alert("xss")&lt;/script>'
 */
function html(value: string, escape?: boolean): string;

function html(stringsOrValue: TemplateStringsArray | string, ...valuesOrEscape: unknown[]): string {
    // Template tag call: html`...`
    if (Array.isArray(stringsOrValue) && "raw" in stringsOrValue) {
        const strings = stringsOrValue as TemplateStringsArray;
        let result = strings[0] ?? "";

        for (const [i, element] of valuesOrEscape.entries()) {
            result += String(element ?? "");
            result += strings[i + 1] ?? "";
        }

        return result;
    }

    // Function call: html(value, escape)
    const value = stringsOrValue as string;
    const escape = valuesOrEscape[0] as boolean | undefined;

    if (escape === false) {
        return value;
    }

    if (escape === true) {
        // Escape for attributes (escapes &, <, and ")
        return escapeHtml(value, true);
    }

    // Default: return as-is (XSS-safe)
    return value;
}

export default html;
