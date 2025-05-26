import { CSI, ESC } from "./constants";
import { cursorTo } from "./cursor";
import {
    eraseDisplay,
    EraseDisplayMode,
    eraseInLine,
    EraseLineMode,
} from "./erase";
import { isWindows } from "./helpers";

/**
 * Moves the cursor to the top-left (0,0 in 0-indexed terms) and erases from the cursor to the end of the screen.
 *
 * This sequence is a combination of:
 * 1. {@link cursorTo}(0, 0): Moves the cursor to the first row, first column.
 * (Equivalent to `CSI 1;1H` as `cursorTo` uses 0-indexed arguments which are converted to 1-indexed for the sequence).
 * 2. {@link eraseDisplay}({@link EraseDisplayMode.ToEnd}): Erases from the cursor position to the end of the screen (`CSI 0J` or `CSI J`).
 *
 * Effective combined sequence: `CSI 1;1H CSI J` (or `CSI 1;1H CSI 0J`).
 * @see {@link cursorTo}
 * @see {@link eraseDisplay}
 * @see {@link EraseDisplayMode.ToEnd}
 */
export const clearScreenFromTopLeft = cursorTo(0, 0) + eraseDisplay(EraseDisplayMode.ToEnd);

/**
 * Erases the entire current line and moves the cursor to the beginning of that line (column 1).
 *
 * This sequence is a combination of:
 * 1. {@link eraseInLine}({@link EraseLineMode.EntireLine}): Erases the entire current line (`CSI 2K`).
 * 2. `CSI G`: Moves the cursor to column 1 of the current line (Cursor Horizontal Absolute).
 * Alternatively, a carriage return (`\r`) could achieve a similar cursor move to the start of the line on many systems.
 *
 * Effective combined sequence: `CSI 2K CSI G`.
 * @see {@link eraseInLine}
 * @see {@link EraseLineMode.EntireLine}
 */
export const clearLineAndHomeCursor = `${eraseInLine(EraseLineMode.EntireLine) + CSI}G`; // Or use "\r" for carriage return

/**
 * Homes the cursor to the top-left position (row 1, column 1) and erases the entire screen.
 *
 * This sequence is a combination of:
 * 1. `CSI H`: Moves the cursor to the home position (top-left, equivalent to `CSI 1;1H`).
 * 2. {@link eraseDisplay}({@link EraseDisplayMode.EntireScreen}): Erases the entire screen (`CSI 2J`).
 *
 * Effective combined sequence: `CSI H CSI 2J`.
 * @remarks This is a very common sequence for clearing the visible terminal window.
 * @see {@link cursorPosition} (which `CSI H` relates to)
 * @see {@link eraseDisplay}
 * @see {@link EraseDisplayMode.EntireScreen}
 */
export const clearScreenAndHomeCursor = `${CSI}H${eraseDisplay(EraseDisplayMode.EntireScreen)}`;

/**
 * Clears the entire terminal display, including the scrollback buffer on supported terminals,
 * and attempts to reset the terminal to its initial (or a more pristine) state.
 *
 * This is generally a more comprehensive and forceful clear operation than just erasing the
 * visible screen content (like {@link clearScreenAndHomeCursor}).
 *
 * The exact behavior and sequences used can vary by terminal and operating system:
 *
 * - **On Windows:**
 * It typically uses `CSI 2J` (erase entire screen) followed by `CSI 0f`.
 * `CSI 0f` (or `CSI ;f`, `CSI 0;0f`) is an SGR sequence that also often acts as a cursor home command,
 * though its standardization can be less consistent than `CSI H`.
 * The primary goal is to clear the screen and move the cursor to the top-left.
 *
 * - **On other platforms (e.g., Linux, macOS with XTerm-like terminals):**
 * A more robust combination is used:
 * 1. {@link eraseDisplay}({@link EraseDisplayMode.EntireScreen}) (`CSI 2J`): Erases the entire visible screen.
 * 2. {@link eraseDisplay}({@link EraseDisplayMode.EntireScreenAndScrollback}) (`CSI 3J`): Erases the scrollback buffer (XTerm-specific, but widely supported).
 * 3. `CSI H`: Moves the cursor to the home position (top-left).
 * 4. `ESC c` (RIS - Reset to Initial State): This is the most powerful reset sequence. It typically resets the terminal
 * to its power-on state, clearing character sets, SGR attributes, modes, and more.
 * @returns A string containing the ANSI escape sequence(s) for resetting the terminal.
 * @example
 * \`\`\`typescript
 * import { resetTerminal } from '@visulima/ansi/clear';
 *
 * process.stdout.write(resetTerminal);
 * // The terminal attempts a full reset.
 * \`\`\`
 * @see {@link eraseDisplay}
 * @see {@link EraseDisplayMode.EntireScreen}
 * @see {@link EraseDisplayMode.EntireScreenAndScrollback}
 * @see {@link https://vt100.net/docs/vt510-rm/RIS.html} RIS documentation.
 */
export const resetTerminal = isWindows
    ? `${eraseDisplay(EraseDisplayMode.EntireScreen) + CSI}0f` // `0f` for cursor to (0,0) might be specific or non-standard
    // 1. Erases the screen (as a fallback/part of comprehensive clear)
    // 2. Erases the whole screen including scrollback buffer (XTerm)
    // 3. Moves cursor to the top-left position
    // 4. RIS - Hard Reset (most comprehensive reset)
    : `${eraseDisplay(EraseDisplayMode.EntireScreen) + eraseDisplay(EraseDisplayMode.EntireScreenAndScrollback) + CSI}H${ESC}c`;
