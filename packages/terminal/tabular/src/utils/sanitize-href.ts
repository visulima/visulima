// Matches C0 control chars (U+0000-U+001F, includes ESC/BEL/newlines) and the
// C1 / DEL range (U+007F-U+009F, includes the 8-bit String Terminator U+009C).
// eslint-disable-next-line no-control-regex
const CONTROL_CHARACTERS_REGEX = /[\u0000-\u001F\u007F-\u009F]/gu;

/**
 * Strips terminal control characters from a hyperlink target before it is
 * embedded into an OSC 8 escape sequence.
 *
 * Without this, an attacker-controlled href containing an ESC, BEL or 8-bit
 * String Terminator could break out of the OSC 8 wrapper and inject arbitrary
 * escape sequences (cursor movement, screen clearing, spoofed output) into the
 * consumer's terminal.
 * @param href The raw hyperlink target.
 * @returns The href with all C0/C1 control characters removed.
 */
const sanitizeHref = (href: string): string => href.replaceAll(CONTROL_CHARACTERS_REGEX, "");

export default sanitizeHref;
