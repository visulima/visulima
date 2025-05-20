import { CSI, ESC, SEP } from "./constants";
import { isTerminalApp } from "./helpers";

/**
 * Saves the cursor position, character attributes (like color, intensity), and character set (G0-G3).
 * This is the DECSC (Save Cursor) sequence: `ESC 7`.
 * Used in conjunction with {@link RESTORE_CURSOR_DEC} (`ESC 8`) to restore the saved state.
 *
 * @remarks This is a DEC private sequence, widely supported.
 * For SCO-compatible terminals (like Linux console before full ANSI/VT support, or some older Unix systems),
 * `ESC s` ({@link cursorSave}) might be used for a similar purpose, though DECSC/DECRC are more comprehensive.
 *
 * @see {@link RESTORE_CURSOR_DEC}
 * @see {@link cursorSave} (provides a version that adapts to Terminal.app)
 */
export const SAVE_CURSOR_DEC = ESC + "7";

/**
 * Restores the previously saved cursor position, character attributes, and character set.
 * This is the DECRC (Restore Cursor) sequence: `ESC 8`.
 * Used after {@link SAVE_CURSOR_DEC} (`ESC 7`) has saved the state.
 *
 * @remarks This is a DEC private sequence, widely supported.
 * For SCO-compatible terminals, `ESC u` ({@link cursorRestore}) might be used.
 *
 * @see {@link SAVE_CURSOR_DEC}
 * @see {@link cursorRestore} (provides a version that adapts to Terminal.app)
 */
export const RESTORE_CURSOR_DEC = ESC + "8";

/**
 * Moves the cursor up one line in the same column. If the cursor is at the top line, behavior is undefined (may ignore or scroll).
 * This is the CUU (Cursor Up) sequence: `CSI A` (equivalent to `CSI 1A`).
 *
 * @see {@link cursorUp} for moving multiple lines or with a count.
 * @see {@link CURSOR_DOWN_1}
 * @see {@link CURSOR_FORWARD_1}
 * @see {@link CURSOR_BACKWARD_1}
 */
export const CURSOR_UP_1 = CSI + "A";

/**
 * Moves the cursor down one line in the same column. If the cursor is at the bottom line, behavior is undefined (may ignore or scroll).
 * This is the CUD (Cursor Down) sequence: `CSI B` (equivalent to `CSI 1B`).
 *
 * @see {@link cursorDown} for moving multiple lines or with a count.
 * @see {@link CURSOR_UP_1}
 * @see {@link CURSOR_FORWARD_1}
 * @see {@link CURSOR_BACKWARD_1}
 */
export const CURSOR_DOWN_1 = CSI + "B";

/**
 * Moves the cursor forward (right) one column in the same line. If the cursor is at the rightmost column, behavior is terminal-dependent (may wrap if DECAWM is set, or ignore).
 * This is the CUF (Cursor Forward) sequence: `CSI C` (equivalent to `CSI 1C`).
 *
 * @see {@link cursorForward} for moving multiple columns or with a count.
 * @see {@link CURSOR_UP_1}
 * @see {@link CURSOR_DOWN_1}
 * @see {@link CURSOR_BACKWARD_1}
 */
export const CURSOR_FORWARD_1 = CSI + "C";

/**
 * Moves the cursor backward (left) one column in the same line. If the cursor is at the leftmost column, behavior is undefined (may ignore).
 * This is the CUB (Cursor Backward) sequence: `CSI D` (equivalent to `CSI 1D`).
 *
 * @see {@link cursorBackward} for moving multiple columns or with a count.
 * @see {@link CURSOR_UP_1}
 * @see {@link CURSOR_DOWN_1}
 * @see {@link CURSOR_FORWARD_1}
 */
export const CURSOR_BACKWARD_1 = CSI + "D";

/**
 * Asks the terminal to report its current cursor position using the DSR (Device Status Report) sequence.
 * The sequence sent is `CSI 6n`.
 * The terminal is expected to respond with a CPR (Cursor Position Report) sequence in the format `CSI <row>;<col>R`,
 * where `<row>` and `<col>` are 1-indexed coordinates.
 *
 * @remarks
 * This is an active report, meaning the application sends a request and waits for a response from the terminal
 * via standard input.
 * Parsing the response requires reading from `stdin` and interpreting the escape sequence.
 *
 * @see {@link REQUEST_EXTENDED_CURSOR_POSITION} for a version that might include page number.
 * @see {@link https://vt100.net/docs/vt510-rm/DSR-CPR.html} DSR/CPR documentation.
 * @returns The ANSI escape sequence `CSI 6n`.
 */
export const REQUEST_CURSOR_POSITION = CSI + "6n";

/**
 * Asks the terminal to report its extended cursor position, potentially including the page number.
 * The sequence sent is `CSI ?6n` (a DEC private DSR variant).
 * The response format from the terminal is typically `CSI ? <row>;<col>;<page>R` (1-indexed).
 * If the terminal does not support this extended version, it might fall back to the standard DSR response
 * or not respond in a recognizable way.
 *
 * @remarks
 * Support for this DEC private DSR is less universal than the standard `CSI 6n`.
 * It's generally used in contexts where page numbers (e.g., in a multi-page document or buffer)
 * are relevant.
 *
 * @see {@link REQUEST_CURSOR_POSITION} for the standard cursor position report.
 * @returns The ANSI escape sequence `CSI ?6n`.
 */
export const REQUEST_EXTENDED_CURSOR_POSITION = CSI + "?6n";

/**
 * Moves the cursor backward (left) a specific number of columns from its current position.
 * This uses the CUB (Cursor Backward) sequence: `CSI <count>D`.
 *
 * @param count - The number of columns to move backward. Must be a positive integer. Defaults to `1`.
 *                If `count` is 0 or negative, it might be treated as 1 by some terminals or ignored.
 * @returns The ANSI escape sequence for moving the cursor backward.
 * @example
 * \`\`\`typescript
 * cursorBackward(5); // Moves cursor 5 columns to the left.
 * cursorBackward();  // Moves cursor 1 column to the left.
 * \`\`\`
 * @see {@link CURSOR_BACKWARD_1}
 * @see {@link cursorForward}
 * @see {@link cursorLeft} (alias for this function)
 */
export const cursorBackward = (count = 1): string => CSI + count + "D";

/**
 * Moves the cursor down a specific number of rows from its current position, staying in the same column.
 * This uses the CUD (Cursor Down) sequence: `CSI <count>B`.
 *
 * @param count - The number of rows to move down. Must be a positive integer. Defaults to `1`.
 *                If `count` is 0 or negative, it might be treated as 1 by some terminals or ignored.
 * @returns The ANSI escape sequence for moving the cursor down.
 * @example
 * \`\`\`typescript
 * cursorDown(3); // Moves cursor 3 rows down.
 * cursorDown();  // Moves cursor 1 row down.
 * \`\`\`
 * @see {@link CURSOR_DOWN_1}
 * @see {@link cursorUp}
 */
export const cursorDown = (count = 1): string => CSI + count + "B";

/**
 * Moves the cursor forward (right) a specific number of columns from its current position.
 * This uses the CUF (Cursor Forward) sequence: `CSI <count>C`.
 *
 * @param count - The number of columns to move forward. Must be a positive integer. Defaults to `1`.
 *                If `count` is 0 or negative, it might be treated as 1 by some terminals or ignored.
 * @returns The ANSI escape sequence for moving the cursor forward.
 * @example
 * \`\`\`typescript
 * cursorForward(4); // Moves cursor 4 columns to the right.
 * cursorForward();  // Moves cursor 1 column to the right.
 * \`\`\`
 * @see {@link CURSOR_FORWARD_1}
 * @see {@link cursorBackward}
 */
export const cursorForward = (count = 1): string => CSI + count + "C";

/**
 * Hides the cursor. This uses the DECTCEM (Text Cursor Enable Mode) sequence `CSI ?25l` to set the mode to "invisible".
 *
 * @remarks
 * This is a DEC private mode. Visibility can be restored using {@link cursorShow} (`CSI ?25h`).
 * The appearance of the cursor (when visible) can often be controlled by {@link setCursorStyle}.
 *
 * @see {@link cursorShow}
 * @see {@link TextCursorEnableMode} in `mode.ts` (represents DEC Mode 25).
 * @returns The ANSI escape sequence `CSI ?25l`.
 */
export const cursorHide = CSI + "?25l";

/**
 * Moves the cursor to column 1 (the beginning) of the current line.
 * This uses the CHA (Cursor Horizontal Absolute) sequence `CSI G` (equivalent to `CSI 1G`).
 *
 * @remarks
 * This is different from a carriage return (`\r` or `CR`), which also moves to the beginning
 * of the line but can have other side effects (like overprinting) in some contexts.
 * `CSI G` specifically sets the horizontal position.
 *
 * @see {@link cursorHorizontalAbsolute} for moving to any absolute column.
 * @returns The ANSI escape sequence `CSI G`.
 */
export const cursorToColumn1 = CSI + "G";

/**
 * Moves the cursor left by `count` columns. This is an alias for {@link cursorBackward}.
 * Sequence: `CSI <count>D`.
 *
 * @param count - The number of columns to move left. Defaults to `1`.
 * @returns The ANSI escape sequence.
 * @see {@link cursorBackward}
 */
export const cursorLeft = (count = 1): string => cursorBackward(count);

/**
 * Moves the cursor to the specified absolute horizontal column `column` (1-indexed) on the current line.
 * This uses the CHA (Cursor Horizontal Absolute) sequence: `CSI <column>G`.
 *
 * @param column - The 1-indexed column number to move to. E.g., `1` for the first column.
 *                 If `column` is less than 1, behavior is terminal-dependent (often treated as 1).
 *                 Defaults to `1` if not provided.
 * @returns The ANSI escape sequence.
 * @example
 * \`\`\`typescript
 * cursorHorizontalAbsolute(10); // Moves to column 10 of the current line.
 * cursorHorizontalAbsolute();   // Moves to column 1 of the current line.
 * \`\`\`
 * @see {@link cursorToColumn1} (moves to column 1 specifically).
 * @see {@link cursorTo} for moving to an (x,y) coordinate, which can also use CHA for x-only movement.
 */
export const cursorHorizontalAbsolute = (column = 1): string => CSI + column + "G";

/**
 * Moves the cursor relative to its current position by `x` columns and `y` rows.
 *
 * This function combines CUU (Up), CUD (Down), CUF (Forward), and CUB (Backward) sequences
 * as needed based on the signs and magnitudes of `x` and `y`.
 *
 * - Positive `x` moves right (CUF: `CSI <x>C`).
 * - Negative `x` moves left (CUB: `CSI <-x>D`).
 * - Positive `y` moves down (CUD: `CSI <y>B`).
 * - Negative `y` moves up (CUU: `CSI <-y>A`).
 *
 * If both `x` and `y` are 0, an empty string is returned as no movement is needed.
 *
 * @param x - The number of columns to move. Positive values move right, negative values move left.
 * @param y - The number of rows to move. Positive values move down, negative values move up.
 * @returns A string containing the necessary ANSI escape sequence(s) to perform the relative move,
 *          or an empty string if no movement (`x=0`, `y=0`).
 * @example
 * \`\`\`typescript
 * console.log(cursorMove(5, -2));  // Moves 5 columns right and 2 rows up.
 *                                // Output: CSI 5C CSI 2A (or similar)
 * console.log(cursorMove(-3, 0)); // Moves 3 columns left.
 *                                // Output: CSI 3D
 * console.log(cursorMove(0, 4));  // Moves 4 rows down.
 *                                // Output: CSI 4B
 * \`\`\`
 */
export const cursorMove = (x: number, y: number): string => {
    let returnValue = "";

    if (x < 0) {
        returnValue += CSI + -x + "D"; // Cursor Backward
    } else if (x > 0) {
        returnValue += CSI + x + "C"; // Cursor Forward
    }

    if (y < 0) {
        returnValue += CSI + -y + "A"; // Cursor Up
    } else if (y > 0) {
        returnValue += CSI + y + "B"; // Cursor Down
    }

    return returnValue;
};

/**
 * Moves the cursor to the beginning (column 1) of the next line, `count` times.
 * This uses the CNL (Cursor Next Line) sequence: `CSI <count>E`.
 *
 * @param count - The number of lines to move down. Defaults to `1`.
 *                If `count` is 0 or negative, it might be treated as 1 by some terminals or ignored.
 * @returns The ANSI escape sequence.
 * @example
 * \`\`\`typescript
 * cursorNextLine(2); // Moves to the beginning of the line 2 lines down.
 * cursorNextLine();  // Moves to the beginning of the next line.
 * \`\`\`
 */
export const cursorNextLine = (count = 1): string => CSI + count + "E";

/**
 * Moves the cursor to the beginning (column 1) of the previous line, `count` times.
 * This uses the CPL (Cursor Previous Line) sequence: `CSI <count>F`.
 *
 * @param count - The number of lines to move up. Defaults to `1`.
 *                If `count` is 0 or negative, it might be treated as 1 by some terminals or ignored.
 * @returns The ANSI escape sequence.
 * @example
 * \`\`\`typescript
 * cursorPreviousLine(3); // Moves to the beginning of the line 3 lines up.
 * cursorPreviousLine();  // Moves to the beginning of the previous line.
 * \`\`\`
 */
export const cursorPreviousLine = (count = 1): string => CSI + count + "F";

/**
 * Restores the last saved cursor position, character attributes (like color and style),
 * and character set state (G0-G3 mapping).
 *
 * This function adapts to the environment:
 * - For Apple's Terminal.app (and environments where `isTerminalApp` is true),
 *   it uses DECRC (`ESC 8`, see {@link RESTORE_CURSOR_DEC}).
 * - For other terminals (typically SCO-compatible or more standard ANSI environments),
 *   it uses SCOSRC (`ESC u`).
 *
 * @remarks
 * `DECSC`/`DECRC` (`ESC 7`/`ESC 8`) are generally more comprehensive and widely supported for full state saving/restoring
 * in VT100+ compatible terminals.
 * `SCOSC`/`SCOSRC` (`ESC s`/`ESC u`) are from the SCO console world and might save/restore fewer attributes.
 *
 * @returns The ANSI escape sequence for restoring the cursor state, adapted to the terminal environment.
 * @see {@link cursorSave} for the corresponding save operation.
 * @see {@link SAVE_CURSOR_DEC}
 * @see {@link RESTORE_CURSOR_DEC}
 * @see {@link isTerminalApp}
 */
export const cursorRestore = isTerminalApp ? RESTORE_CURSOR_DEC : ESC + "u";

/**
 * Saves the current cursor position, character attributes, and character set state.
 *
 * This function adapts to the environment:
 * - For Apple's Terminal.app (and environments where `isTerminalApp` is true),
 *   it uses DECSC (`ESC 7`, see {@link SAVE_CURSOR_DEC}).
 * - For other terminals, it uses SCOSC (`ESC s`).
 *
 * @returns The ANSI escape sequence for saving the cursor state, adapted to the terminal environment.
 * @see {@link cursorRestore} for the corresponding restore operation.
 * @see {@link SAVE_CURSOR_DEC}
 * @see {@link RESTORE_CURSOR_DEC}
 * @see {@link isTerminalApp}
 */
export const cursorSave = isTerminalApp ? SAVE_CURSOR_DEC : ESC + "s";

/**
 * Shows the cursor. This uses the DECTCEM (Text Cursor Enable Mode) sequence `CSI ?25h` to set the mode to "visible".
 *
 * @remarks
 * This is a DEC private mode. Visibility can be hidden using {@link cursorHide} (`CSI ?25l`).
 * The appearance of the cursor (when visible) can often be controlled by {@link setCursorStyle}.
 *
 * @see {@link cursorHide}
 * @see {@link TextCursorEnableMode} in `mode.ts` (represents DEC Mode 25).
 * @returns The ANSI escape sequence `CSI ?25h`.
 */
export const cursorShow = CSI + "?25h";

/**
 * Moves the cursor to a specific coordinate (0-indexed) on the screen.
 * The top-left corner of the screen is `(x: 0, y: 0)`.
 *
 * - If both `x` (column) and `y` (row) are provided, it uses the CUP (Cursor Position)
 *   sequence: `CSI <y+1>;<x+1>H`. Note that CUP is 1-indexed.
 * - If only `x` (column) is provided (or `y` is `undefined`), it moves the cursor horizontally
 *   to the absolute column `x` on the current line. This uses the CHA (Cursor Horizontal Absolute)
 *   sequence: `CSI <x+1>G`. Note that CHA is 1-indexed.
 *
 * @param x - The 0-indexed column number. `0` is the leftmost column.
 * @param y - (Optional) The 0-indexed row number. `0` is the topmost row.
 *            If undefined, only horizontal movement to column `x` occurs.
 * @returns The ANSI escape sequence for moving the cursor.
 * @example
 * \`\`\`typescript
 * cursorTo(0, 0);       // Moves to top-left (row 0, col 0) -> CSI 1;1H
 * cursorTo(10, 5);      // Moves to row 5, col 10 -> CSI 6;11H
 * cursorTo(7);          // Moves to column 7 of the current line -> CSI 8G
 * \`\`\`
 * @see {@link cursorPosition} for a 1-indexed version of CUP.
 * @see {@link cursorHorizontalAbsolute} for 1-indexed horizontal positioning.
 */
export const cursorTo = (x: number, y?: number): string => {
    if (y === undefined) {
        // If only x is provided, or y is explicitly undefined,
        // treat as moving to column x+1 (CHA is 1-indexed).
        return cursorHorizontalAbsolute(x + 1);
    }
    // CUP is 1-indexed for row and column.
    return CSI + (y + 1) + SEP + (x + 1) + "H";
};

/**
 * Moves the cursor to a specific position (1-indexed) on the screen using the CUP (Cursor Position) sequence.
 * The top-left corner of the screen is `(row: 1, column: 1)`.
 *
 * - If `column` is provided: `CSI <row>;<column>H`.
 * - If `column` is undefined: `CSI <row>H` (moves to column 1 of the specified `row`).
 *
 * @param row - The 1-indexed row number. `1` is the topmost row.
 * @param column - (Optional) The 1-indexed column number. `1` is the leftmost column.
 *                 If undefined, the cursor moves to column 1 of the specified `row`.
 * @returns The ANSI escape sequence.
 * @example
 * \`\`\`typescript
 * cursorPosition(1, 1);    // Moves to top-left (row 1, col 1) -> CSI 1;1H
 * cursorPosition(5, 10);   // Moves to row 5, col 10 -> CSI 5;10H
 * cursorPosition(3);       // Moves to row 3, col 1 -> CSI 3H
 * \`\`\`
 * @see {@link cursorTo} for a 0-indexed version.
 */
export const cursorPosition = (row: number, column?: number): string => {
    if (column === undefined) {
        return CSI + row + "H"; // Moves to (row, 1)
    }
    return CSI + row + SEP + column + "H";
};

/**
 * Moves the cursor forward (right) to the next tab stop, `count` times.
 * This uses the CHT (Cursor Horizontal Forward Tabulation) sequence: `CSI <count>I`.
 * Tab stops are typically every 8 columns by default, but can be configured by terminal settings or HTS/TBC sequences.
 *
 * @param count - The number of tab stops to advance. Defaults to `1`.
 *                If `count` is 0 or negative, it might be treated as 1 by some terminals or ignored.
 * @returns The ANSI escape sequence.
 * @example
 * \`\`\`typescript
 * cursorHorizontalForwardTab(2); // Advances two tab stops.
 * cursorHorizontalForwardTab();  // Advances one tab stop.
 * \`\`\`
 * @see {@link cursorBackwardTab}
 */
export const cursorHorizontalForwardTab = (count = 1): string => CSI + count + "I";

/**
 * Moves the cursor backward (left) to the previous tab stop, `count` times.
 * This uses the CBT (Cursor Backward Tabulation) sequence: `CSI <count>Z`.
 * Tab stops are typically every 8 columns by default.
 *
 * @param count - The number of tab stops to move backward. Defaults to `1`.
 *                If `count` is 0 or negative, it might be treated as 1 by some terminals or ignored.
 * @returns The ANSI escape sequence.
 * @example
 * \`\`\`typescript
 * cursorBackwardTab(2); // Moves back two tab stops.
 * cursorBackwardTab();  // Moves back one tab stop.
 * \`\`\`
 * @see {@link cursorHorizontalForwardTab}
 */
export const cursorBackwardTab = (count = 1): string => CSI + count + "Z";

/**
 * Erases `count` characters from the current cursor position forward (inclusive of the character at the cursor position).
 * Characters are replaced with spaces. The cursor position does not change.
 * This uses the ECH (Erase Character) sequence: `CSI <count>X`.
 *
 * @param count - The number of characters to erase. Defaults to `1`.
 *                If `count` is 0 or negative, it might be treated as 1 by some terminals or ignored.
 * @returns The ANSI escape sequence.
 * @example
 * \`\`\`typescript
 * // Assuming text "Hello World" and cursor at 'H':
 * process.stdout.write(eraseCharacter(5)); // Erases "Hello", leaves "     World"
 * \`\`\`
 */
export const eraseCharacter = (count = 1): string => CSI + count + "X";

/**
 * Moves the cursor to the absolute vertical line (row) `row` (1-indexed), maintaining the current column.
 * This uses the VPA (Vertical Line Position Absolute) sequence: `CSI <row>d`.
 *
 * @param row - The 1-indexed row number to move to. Defaults to `1` (the first row).
 *              If `row` is less than 1, behavior is terminal-dependent (often treated as 1).
 * @returns The ANSI escape sequence.
 * @example
 * \`\`\`typescript
 * cursorVerticalAbsolute(10); // Moves to row 10, same column.
 * cursorVerticalAbsolute();   // Moves to row 1, same column.
 * \`\`\`
 */
export const cursorVerticalAbsolute = (row = 1): string => CSI + row + "d";

/**
 * Moves the cursor up a specific number of rows from its current position, staying in the same column.
 * This uses the CUU (Cursor Up) sequence: `CSI <count>A`.
 *
 * @param count - The number of rows to move up. Must be a positive integer. Defaults to `1`.
 *                If `count` is 0 or negative, it might be treated as 1 by some terminals or ignored.
 * @returns The ANSI escape sequence for moving the cursor up.
 * @example
 * \`\`\`typescript
 * cursorUp(2); // Moves cursor 2 rows up.
 * cursorUp();  // Moves cursor 1 row up.
 * \`\`\`
 * @see {@link CURSOR_UP_1}
 * @see {@link cursorDown}
 */
export const cursorUp = (count = 1): string => CSI + count + "A";

/**
 * Represents the available cursor styles that can be set using the DECSCUSR (Set Cursor Style) sequence.
 * The sequence is typically `CSI <Ps> SP q` (note the space before `q`).
 *
 * @remarks
 * - `0` or `1` (Blinking Block) are often treated as the default by many terminals if DECSCUSR is not supported or reset.
 * - Actual appearance can vary between terminal emulators.
 * - Some terminals might not support all styles or DECSCUSR itself.
 */
export enum CursorStyle {
    /** Blinking Block cursor. (Corresponds to `Ps=0` or `Ps=1` in `CSI Ps SP q`) */
    BlinkingBlock = 1, // Or 0, often interchangeable for default blinking block
    /** Steady (non-blinking) Block cursor. (Corresponds to `Ps=2`) */
    SteadyBlock = 2,
    /** Blinking Underline cursor. (Corresponds to `Ps=3`) */
    BlinkingUnderline = 3,
    /** Steady (non-blinking) Underline cursor. (Corresponds to `Ps=4`) */
    SteadyUnderline = 4,
    /** Blinking Bar (often an I-beam shape) cursor. (Corresponds to `Ps=5`) */
    BlinkingBar = 5,
    /** Steady (non-blinking) Bar (I-beam) cursor. (Corresponds to `Ps=6`) */
    SteadyBar = 6,
    /**
     * Default cursor style (Ps=0). The appearance is terminal-dependent, typically a blinking block.
     * Using `0` explicitly can sometimes reset to the terminal's configured default if it differs from `1`.
     */
    Default = 0,
}

/**
 * Sets the terminal cursor style using the DECSCUSR (Set Cursor Style) sequence.
 * The generated sequence is `CSI <styleValue> SP q` (note the space before `q`).
 *
 * @param style - The desired cursor style. This can be a value from the {@link CursorStyle} enum
 *                or a raw number corresponding to the `Ps` parameter of DECSCUSR.
 * @returns The ANSI escape sequence to set the cursor style.
 * @example
 * \`\`\`typescript
 * import { setCursorStyle, CursorStyle } from '@visulima/ansi/cursor';
 *
 * process.stdout.write(setCursorStyle(CursorStyle.BlinkingUnderline)); // Sets blinking underline: CSI 3 q
 * process.stdout.write(setCursorStyle(CursorStyle.SteadyBar));       // Sets steady bar: CSI 6 q
 * process.stdout.write(setCursorStyle(0));                           // Sets default (usually blinking block): CSI 0 q
 * \`\`\`
 * @remarks
 * - Support for DECSCUSR and specific styles can vary between terminal emulators.
 * - `0` and `1` often both result in a blinking block, with `0` sometimes being a more explicit "reset to default."
 * @see {@link CursorStyle} for predefined style values.
 * @see {@link https://invisible-island.net/xterm/ctlseqs/ctlseqs.html#h3-Set-cursor-style-DECSCUSR} XTerm DECSCUSR documentation.
 * @see {@link https://vt100.net/docs/vt510-rm/DECSCUSR.html} VT510 DECSCUSR documentation.
 */
export const setCursorStyle = (style: CursorStyle | number): string =>
    CSI + style + " q"; // Note the space before 'q'

// eslint-disable-next-line import/no-extraneous-dependencies
export { default as restoreCursor } from "restore-cursor";
