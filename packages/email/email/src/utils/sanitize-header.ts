/**
 * Sanitizes header values to prevent CRLF injection attacks.
 * Removes carriage return (\r) and line feed (\n) characters.
 * @param value The header value to sanitize.
 * @returns The sanitized header value with CR/LF characters removed.
 */
export const sanitizeHeaderValue = (value: string): string => value.replaceAll(/[\r\n]/g, "");

/**
 * Sanitizes header names to prevent CRLF injection attacks.
 * Removes carriage return (\r) and line feed (\n) characters.
 * @param name The header name to sanitize.
 * @returns The sanitized header name with CR/LF characters removed.
 */
export const sanitizeHeaderName = (name: string): string => name.replaceAll(/[\r\n]/g, "");
