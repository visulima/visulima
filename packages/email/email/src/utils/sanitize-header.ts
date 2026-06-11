/**
 * Sanitizes header values to prevent CRLF injection attacks.
 *
 * A header value is a single logical line, so a raw carriage return (\r) or line
 * feed (\n) is never legitimate here — it is the classic header-injection vector.
 * Everything from the first line break onward is discarded rather than merely
 * deleting the control characters: stripping alone would leave the smuggled
 * `\r\nX-Injected: ...` payload glued onto the tail of the value (e.g.
 * `text/plainX-Injected-Type: yes`), so the injected token would still surface.
 * @param value The header value to sanitize.
 * @returns The header value truncated at the first CR/LF.
 */
const LINE_BREAK_REGEX = /[\r\n]/;

export const sanitizeHeaderValue = (value: string): string => {
    const lineBreak = value.search(LINE_BREAK_REGEX);

    return lineBreak === -1 ? value : value.slice(0, lineBreak);
};

/**
 * Sanitizes header names to prevent CRLF injection attacks.
 * Removes carriage return (\r) and line feed (\n) characters.
 * @param name The header name to sanitize.
 * @returns The sanitized header name with CR/LF characters removed.
 */
export const sanitizeHeaderName = (name: string): string => name.replaceAll(/[\r\n]/g, "");
