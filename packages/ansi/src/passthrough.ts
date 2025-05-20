import { DCS, ESC, ST } from "./constants";

/**
 * Default value for the `limit` parameter in {@link screenPassthrough}, indicating no chunking.
 * When this value is used (or any value <= 0), the passthrough sequence is not split into smaller chunks.
 */
export const SCREEN_MAX_LEN_DEFAULT = 0; // Default 0 means no limit for chunking logic itself

/**
 * A typical limit for string sequences in GNU Screen (e.g., 768 bytes).
 * This constant can be used as a practical value for the `limit` parameter in {@link screenPassthrough}
 * to avoid issues with Screen's internal buffers, though the function itself defaults to no limit.
 * It's provided for informational purposes and as a suggested practical chunking limit.
 */
export const SCREEN_TYPICAL_LIMIT = 768; // Actual Screen limit mentioned in comments

/**
 * Wraps a given ANSI escape sequence in a DCS (Device Control String) passthrough sequence
 * specifically for GNU Screen. This allows raw escape sequences to be sent to the
 * terminal emulator that is hosting Screen, bypassing Screen's own interpretation.
 *
 * The basic format is: `DCS <data> ST` (where `DCS` is `ESC P` and `ST` is `ESC \`).
 *
 * GNU Screen has limitations on the length of string sequences it can handle (often around 768 bytes).
 * This function can optionally chunk the input `sequence` into smaller parts, each wrapped
 * in its own `DCS...ST` sequence, to work around this limitation.
 *
 * @param sequence - The ANSI escape sequence string to be wrapped.
 * @param limit - The maximum length for each chunk of the `sequence` before it's wrapped.
 *                If `0` or a negative number, the sequence is not chunked. Defaults to {@link SCREEN_MAX_LEN_DEFAULT} (0).
 *                Consider using {@link SCREEN_TYPICAL_LIMIT} (768) for practical chunking with Screen.
 * @returns The wrapped string, possibly chunked into multiple `DCS...ST` sequences if `limit` is positive and the `sequence` exceeds it.
 * @see {@link https://www.gnu.org/software/screen/manual/screen.html#String-Escapes} GNU Screen Manual - String Escapes.
 * @example
 * \`\`\`typescript
 * import { screenPassthrough, SCREEN_TYPICAL_LIMIT } from \'@visulima/ansi/passthrough\';
 * import { cursorShow, cursorHide } from \'@visulima/ansi/cursor\';
 *
 * const longSequence = cursorHide + "Some very long output..." + cursorShow;
 *
 * // No chunking (default behavior if sequence is short enough or limit is 0)
 * const passthrough1 = screenPassthrough(cursorHide);
 * console.log(JSON.stringify(passthrough1)); // "\u001bP?25l\u001b\\"
 *
 * // With chunking, assuming SCREEN_TYPICAL_LIMIT is small for demonstration
 * const limitedPassthrough = screenPassthrough(longSequence, 10); // Hypothetical small limit
 * // Example output if longSequence was "0123456789abcde" and limit 10:
 * // "\u001bP0123456789\u001b\\\u001bPabcde\u001b\\"
 * console.log(JSON.stringify(limitedPassthrough));
 * \`\`\`
 */
export function screenPassthrough(sequence: string, limit: number = SCREEN_MAX_LEN_DEFAULT): string {
    let result = DCS;

    if (limit > 0 && sequence.length > limit) {
        for (let index = 0; index < sequence.length; index += limit) {
            const end = Math.min(index + limit, sequence.length);
            result += sequence.substring(index, end);
            if (end < sequence.length) {
                // Close current DCS and start a new one for the next chunk
                result += ST + DCS;
            }
        }
    } else {
        result += sequence;
    }

    result += ST;
    return result;
}

/**
 * Wraps a given ANSI escape sequence in a special DCS (Device Control String) passthrough sequence
 * designed for tmux (Terminal Multiplexer). This allows raw escape sequences to be sent to the
 * terminal emulator hosting tmux, bypassing tmux's own interpretation.
 *
 * The format is: `DCS tmux ; <escaped-data> ST`
 * (where `DCS` is `ESC P`, and `ST` is `ESC \`).
 *
 * The `<escaped-data>` is the original `sequence` with all occurrences of the ESC character (`\u001B`)
 * doubled (i.e., `ESC` becomes `ESC ESC`).
 *
 * **Note:** For this to work, the tmux option `allow-passthrough` must be enabled (`on`) in the tmux configuration.
 * By default, it might be off.
 *
 * @param sequence - The ANSI escape sequence string to be wrapped and properly escaped for tmux.
 * @returns The wrapped and escaped string suitable for tmux passthrough.
 * @see {@link https://github.com/tmux/tmux/wiki/FAQ#what-is-the-passthrough-escape-sequence-and-how-do-i-use-it} Tmux FAQ on Passthrough.
 * @example
 * \`\`\`typescript
 * import { tmuxPassthrough } from \'@visulima/ansi/passthrough\';
 * import { cursorShow } from \'@visulima/ansi/cursor\';
 *
 * const originalSequence = cursorShow; // e.g., "\u001b[?25h"
 * const passthrough = tmuxPassthrough(originalSequence);
 *
 * // Expected: "\u001bPtmux;\u001b\u001b[?25h\u001b\\"
 * // (ESC P tmux ; ESC ESC [ ? 2 5 h ESC \)
 * console.log(JSON.stringify(passthrough));
 * \`\`\`
 */
export function tmuxPassthrough(sequence: string): string {
    let escapedSequence = "";
    for (const element of sequence) {
        escapedSequence += element === ESC ? ESC + ESC : element;
    }
    return DCS + "tmux;" + escapedSequence + ST;
}
