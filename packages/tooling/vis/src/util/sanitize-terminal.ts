/**
 * Neutralize untrusted text before it is written to a terminal.
 *
 * Remote, attacker-influenceable strings (changelog bodies, published manifest
 * fields) must not be able to emit terminal control sequences — cursor moves
 * that overwrite a confirmation prompt, OSC title/clipboard writes, bell
 * spam, etc. This strips ANSI/VT escape sequences and bare C0/DEL control
 * characters, keeping only printable text (tabs are normalised to spaces).
 */

import { stripVTControlCharacters } from "node:util";

// eslint-disable-next-line no-control-regex -- intentionally matching C0 controls + DEL to strip them.
const CONTROL_CHARS = /[\u0000-\u0008\u000B-\u001F\u007F]/g;

/**
 * Strip ANSI/VT escape sequences and bare control characters from untrusted text.
 * @param text Remote, attacker-influenceable text destined for the terminal.
 * @returns The text with escapes and C0/DEL controls removed and tabs spaced.
 */
export const sanitizeTerminalText = (text: string): string => stripVTControlCharacters(text).replaceAll("\t", " ").replaceAll(CONTROL_CHARS, "");
