/**
 * Shared input filtering utilities for text input components.
 */

const IS_ASCII_LETTER = /^[a-z]$/i;

/**
 * Check if a character is a C0 control character or DEL.
 */
export const isControlCharacter = (input: string): boolean => {
    const codepoint = input.codePointAt(0);

    return codepoint !== undefined && (codepoint < 32 || codepoint === 127);
};

/**
 * Determine whether the input should be inserted as text.
 * Filters out modifier chords (Ctrl+S, Meta+S, etc.) while allowing
 * AltGr-produced symbols (Ctrl+Meta+@, Ctrl+Meta+€) on international keyboards.
 */
export const isInsertableInput = (input: string, key: { ctrl: boolean; meta: boolean }): boolean => {
    if (input.length === 0 || isControlCharacter(input)) {
        return false;
    }

    // Ctrl+Meta together is AltGr on many layouts — allow non-letter symbols
    if (key.ctrl && key.meta) {
        return !IS_ASCII_LETTER.test(input);
    }

    // Single modifier chord — not insertable
    if (key.ctrl || key.meta) {
        return false;
    }

    return true;
};
