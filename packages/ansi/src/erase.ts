import { CSI } from "./constants";
import { cursorToColumn1, cursorUp } from "./cursor";

/**
 * Defines the modes for erasing parts of the display using the ED (Erase in Display) sequence.
 * The ED sequence is `CSI Ps J`, where `Ps` is one of these mode values.
 * @see {@link eraseDisplay} for the function that generates ED sequences.
 * @see {@link https://vt100.net/docs/vt510-rm/ED.html} VT510 Erase in Display (ED) documentation.
 * @enum {number}
 */
export enum EraseDisplayMode {
    /**
     * Clears the entire screen. The cursor position usually does not change, but this can be
     * terminal-dependent. Some terminals might move the cursor to the home position (top-left).
     * This corresponds to `Ps=2` in `CSI Ps J`.
     * Sequence: `CSI 2J`.
     */
    EntireScreen = 2,

    /**
     * Clears the entire screen and, on supported terminals (like XTerm and derivatives),
     * also deletes all lines saved in the scrollback buffer.
     * This corresponds to `Ps=3` in `CSI Ps J` (an XTerm extension, widely adopted).
     * Sequence: `CSI 3J`.
     * @remarks This mode is particularly useful for a more complete "reset" of the terminal view.
     */
    EntireScreenAndScrollback = 3,

    /**
     * Clears from the beginning of the screen to the current cursor position (inclusive).
     * This corresponds to `Ps=1` in `CSI Ps J`.
     * Sequence: `CSI 1J`.
     */
    ToBeginning = 1,

    /**
     * Clears from the current cursor position to the end of the screen (inclusive).
     * If the cursor is at the top-left, this clears the entire screen.
     * This corresponds to `Ps=0` (or `Ps` omitted) in `CSI Ps J`.
     * Sequence: `CSI J` or `CSI 0J`.
     */
    ToEnd = 0,
}

/**
 * Generates an ANSI escape sequence to erase parts of the display (ED - Erase in Display).
 * The specific sequence is `CSI &lt;mode>J`, where `&lt;mode>` is a parameter from {@link EraseDisplayMode}.
 *
 * - If `mode` is `EraseDisplayMode.ToEnd` (or `0`), the sequence can be shortened to `CSI J`.
 * - The function validates the input `mode`. If an invalid number is provided, it defaults to `EraseDisplayMode.ToEnd`.
 * @param mode The erase mode, specified as a value from `EraseDisplayMode` or its corresponding number (0, 1, 2, 3).
 * @returns The ANSI escape sequence string for erasing in display.
 * @example
 * ```typescript
 * import { eraseDisplay, EraseDisplayMode } from '@visulima/ansi/erase';
 *
 * // Erase from cursor to end of screen
 * process.stdout.write(eraseDisplay(EraseDisplayMode.ToEnd)); // or eraseDisplay(0)
 *
 * // Erase entire screen
 * process.stdout.write(eraseDisplay(EraseDisplayMode.EntireScreen)); // or eraseDisplay(2)
 *
 * // Erase entire screen and scrollback buffer
 * process.stdout.write(eraseDisplay(EraseDisplayMode.EntireScreenAndScrollback)); // or eraseDisplay(3)
 * ```
 * @see {@link EraseDisplayMode}
 * @see {@link https://vt100.net/docs/vt510-rm/ED.html} VT510 Erase in Display (ED) documentation.
 */
export const eraseDisplay = (mode: EraseDisplayMode | 0 | 1 | 2 | 3): string => {
    // Ensure mode is within the valid range 0-3, otherwise default to ToEnd (0).
    const validMode = mode >= 0 && mode <= 3 ? mode : EraseDisplayMode.ToEnd;

    // For mode 0 (ToEnd), the parameter can be omitted from the sequence.
    return `${CSI + (validMode === EraseDisplayMode.ToEnd ? "" : String(validMode))}J`;
};

/**
 * Defines the modes for erasing parts of the current line using the EL (Erase in Line) sequence.
 * The EL sequence is `CSI Ps K`, where `Ps` is one of these mode values.
 * The cursor position is NOT affected by EL sequences.
 * @see {@link eraseInLine} for the function that generates EL sequences.
 * @see {@link https://vt100.net/docs/vt510-rm/EL.html} VT510 Erase in Line (EL) documentation.
 * @enum {number}
 */
export enum EraseLineMode {
    /**
     * Clears the entire current line.
     * This corresponds to `Ps=2` in `CSI Ps K`.
     * Sequence: `CSI 2K`.
     */
    EntireLine = 2,

    /**
     * Clears from the beginning of the line to the current cursor position (inclusive).
     * This corresponds to `Ps=1` in `CSI Ps K`.
     * Sequence: `CSI 1K`.
     */
    ToBeginning = 1,

    /**
     * Clears from the current cursor position to the end of the line (inclusive).
     * This corresponds to `Ps=0` (or `Ps` omitted) in `CSI Ps K`.
     * Sequence: `CSI K` or `CSI 0K`.
     */
    ToEnd = 0,
}

/**
 * Generates an ANSI escape sequence to erase parts of the current line (EL - Erase in Line).
 * The specific sequence is `CSI &lt;mode>K`, where `&lt;mode>` is a parameter from {@link EraseLineMode}.
 * The cursor position is NOT changed by this sequence.
 *
 * - If `mode` is `EraseLineMode.ToEnd` (or `0`), the sequence can be shortened to `CSI K`.
 * - The function validates the input `mode`. If an invalid number is provided, it defaults to `EraseLineMode.ToEnd`.
 * @param mode The erase mode, specified as a value from `EraseLineMode` or its corresponding number (0, 1, 2).
 * @returns The ANSI escape sequence string for erasing in line.
 * @example
 * ```typescript
 * import { eraseInLine, EraseLineMode } from '@visulima/ansi/erase';
 *
 * // Erase from cursor to end of line
 * process.stdout.write(eraseInLine(EraseLineMode.ToEnd)); // or eraseInLine(0)
 *
 * // Erase entire current line
 * process.stdout.write(eraseInLine(EraseLineMode.EntireLine)); // or eraseInLine(2)
 * ```
 * @see {@link EraseLineMode}
 * @see {@link https://vt100.net/docs/vt510-rm/EL.html} VT510 Erase in Line (EL) documentation.
 */
export const eraseInLine = (mode: EraseLineMode | 0 | 1 | 2): string => {
    // Ensure mode is within the valid range 0-2, otherwise default to ToEnd (0).
    const validMode = mode >= 0 && mode <= 2 ? mode : EraseLineMode.ToEnd;

    // For mode 0 (ToEnd), the parameter can be omitted from the sequence.
    return `${CSI + (validMode === EraseLineMode.ToEnd ? "" : String(validMode))}K`;
};

/**
 * Erases the screen from the current cursor position down to the bottom of the screen (inclusive).
 * This is a convenience constant for `eraseDisplay(EraseDisplayMode.ToEnd)`.
 * Sequence: `CSI J` (or `CSI 0J`).
 * @returns The ANSI escape sequence `CSI J`.
 * @see {@link eraseDisplay}
 * @see {@link EraseDisplayMode.ToEnd}
 */
export const eraseDown: string = eraseDisplay(EraseDisplayMode.ToEnd);

/**
 * Erases the entire current line. The cursor position does not change.
 * This is a convenience constant for `eraseInLine(EraseLineMode.EntireLine)`.
 * Sequence: `CSI 2K`.
 * @returns The ANSI escape sequence `CSI 2K`.
 * @see {@link eraseInLine}
 * @see {@link EraseLineMode.EntireLine}
 */
export const eraseLine: string = eraseInLine(EraseLineMode.EntireLine);

/**
 * Erases from the current cursor position to the end of the current line (inclusive).
 * The cursor position does not change.
 * This is a convenience constant for `eraseInLine(EraseLineMode.ToEnd)`.
 * Sequence: `CSI K` (or `CSI 0K`).
 * @returns The ANSI escape sequence `CSI K`.
 * @see {@link eraseInLine}
 * @see {@link EraseLineMode.ToEnd}
 */
export const eraseLineEnd: string = eraseInLine(EraseLineMode.ToEnd);

/**
 * Erases from the current cursor position to the beginning of the current line (inclusive).
 * The cursor position does not change.
 * This is a convenience constant for `eraseInLine(EraseLineMode.ToBeginning)`.
 * Sequence: `CSI 1K`.
 * @returns The ANSI escape sequence `CSI 1K`.
 * @see {@link eraseInLine}
 * @see {@link EraseLineMode.ToBeginning}
 */
export const eraseLineStart: string = eraseInLine(EraseLineMode.ToBeginning);

/**
 * Erases a specified number of lines, starting from the current line and moving upwards,
 * then moves the cursor to the beginning of the topmost erased line (which becomes the new current line).
 *
 * This is a custom helper function, not a single standard ANSI/VT sequence. It combines
 * multiple sequences: {@link eraseLine} to clear each line, {@link cursorUp} to move to the line above,
 * and finally {@link cursorToColumn1} to position the cursor at the start of the resulting current line.
 * @param count The total number of lines to erase. This includes the current line and `count-1` lines above it.
 * If `count` is 0 or negative, an empty string is returned (no operation).
 * @returns A string of concatenated ANSI escape sequences to perform the operation.
 * @example
 * ```typescript
 * import { eraseLines } from '@visulima/ansi/erase';
 *
 * // To erase the current line and the 2 lines above it (total 3 lines):
 * process.stdout.write(eraseLines(3));
 * // Conceptual sequence of operations:
 * // 1. Erase current line
 * // 2. Cursor up
 * // 3. Erase current line (which was the line above the original)
 * // 4. Cursor up
 * // 5. Erase current line (which was two lines above the original)
 * // 6. Cursor to column 1 (on this topmost erased line)
 * ```
 */
export const eraseLines = (count: number): string => {
    if (count <= 0) {
        return "";
    }

    let clear = "";

    // The loop erases the current line and then moves up.
    // It does this `count` times. The last cursorUp is omitted for the final line.
    // Finally, cursor is moved to column 1 of the current (topmost erased) line.
    for (let index = 0; index < count; index += 1) {
        clear += eraseLine; // Erase the current line

        if (index < count - 1) {
            clear += cursorUp(); // Move up for the next line, unless it's the last one
        }
    }

    // After erasing all lines and moving up to the topmost one,
    // move the cursor to the beginning of that line.
    clear += cursorToColumn1;

    return clear;
};

/**
 * Erases the entire screen. The cursor position usually does not change, though this can be terminal-dependent.
 * This is a convenience constant for `eraseDisplay(EraseDisplayMode.EntireScreen)`.
 * Sequence: `CSI 2J`.
 * @returns The ANSI escape sequence `CSI 2J`.
 * @see {@link eraseDisplay}
 * @see {@link EraseDisplayMode.EntireScreen}
 */
export const eraseScreen: string = eraseDisplay(EraseDisplayMode.EntireScreen);

/**
 * Erases the screen from the current cursor position up to the top of the screen (inclusive).
 * This is a convenience constant for `eraseDisplay(EraseDisplayMode.ToBeginning)`.
 * Sequence: `CSI 1J`.
 * @returns The ANSI escape sequence `CSI 1J`.
 * @see {@link eraseDisplay}
 * @see {@link EraseDisplayMode.ToBeginning}
 */
export const eraseUp: string = eraseDisplay(EraseDisplayMode.ToBeginning);
