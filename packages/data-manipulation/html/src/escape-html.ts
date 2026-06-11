/* eslint-disable no-secrets/no-secrets */

/**
 * Copyright (c) 2016-2024 Svelte contributors
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 *
 * Source: https://github.com/sveltejs/svelte/blob/4e6104a9393e1b24831909bb3f6811568c3db413/packages/svelte/src/escaping.js
 */

const ATTR_REGEX = /[&"'<]/g;
const CONTENT_REGEX = /[&<]/g;

/**
 * Escapes HTML special characters in a string.
 * Optimized for performance with minimal allocations.
 * @param value The value to escape. Will be converted to string.
 * @param isAttribute If true, also escapes double quotes (for HTML attributes).
 * @returns The escaped string.
 * @example
 * escapeHtml('<script>alert("xss")</script>');
 * // => '&lt;script>alert("xss")&lt;/script>'
 * @example
 * escapeHtml('<div>', true);
 * // => '&lt;div>'
 * @example
 * escapeHtml('value="test"', true);
 * // => 'value=&quot;test&quot;'
 */
const escapeHtml = (value: unknown, isAttribute: boolean = false): string => {
    // eslint-disable-next-line @typescript-eslint/no-base-to-string
    const htmlString = String(value ?? "");

    const pattern = isAttribute ? ATTR_REGEX : CONTENT_REGEX;

    pattern.lastIndex = 0;

    let escaped = "";
    let last = 0;

    while (pattern.test(htmlString)) {
        const i = pattern.lastIndex - 1;
        const ch = htmlString[i];

        // eslint-disable-next-line sonarjs/no-nested-conditional
        escaped += htmlString.slice(last, i) + (ch === "&" ? "&amp;" : ch === '"' ? "&quot;" : ch === "'" ? "&#39;" : "&lt;");
        last = i + 1;
    }

    return escaped + htmlString.slice(last);
};

export default escapeHtml;
