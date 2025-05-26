import { CSI, SEP } from "./constants";

/**
 * Inserts a specified number of blank lines at the current cursor position.
 * (IL - Insert Line)
 *
 * Existing lines from the cursor position to the bottom margin are moved downwards.
 * Lines moved past the bottom margin are lost. The cursor position is unchanged.
 * If the parameter `count` is 0 or 1, it defaults to inserting one line.
 *
 * Sequence: `CSI Pn L`
 * - `Pn`: Number of lines to insert (default: 1).
 * @param count The number of blank lines to insert. Defaults to 1.
 * @returns The ANSI escape sequence for inserting lines.
 * @see {@link https://vt100.net/docs/vt510-rm/IL.html VT510 IL Documentation}
 * @example
 * \`\`\`typescript
 * import { insertLine } from \'@visulima/ansi/screen\';
 *
 * // Insert 1 line (default)
 * process.stdout.write(insertLine()); // CSI L
 *
 * // Insert 5 lines
 * process.stdout.write(insertLine(5)); // CSI 5L
 * \`\`\`
 */
export const insertLine = (count = 1): string => `${CSI + (count <= 1 ? "" : count)}L`;

/**
 * Deletes a specified number of lines starting from the line with the cursor.
 * (DL - Delete Line)
 *
 * Lines below the deleted ones are moved upwards. Blank lines are added at the bottom
 * of the scrolling region to fill the gap. The cursor position is unchanged.
 * If the parameter `count` is 0 or 1, it defaults to deleting one line.
 *
 * Sequence: `CSI Pn M`
 * - `Pn`: Number of lines to delete (default: 1).
 * @param count The number of lines to delete. Defaults to 1.
 * @returns The ANSI escape sequence for deleting lines.
 * @see {@link https://vt100.net/docs/vt510-rm/DL.html VT510 DL Documentation}
 * @example
 * \`\`\`typescript
 * import { deleteLine } from \'@visulima/ansi/screen\';
 *
 * // Delete 1 line (default)
 * process.stdout.write(deleteLine()); // CSI M
 *
 * // Delete 3 lines
 * process.stdout.write(deleteLine(3)); // CSI 3M
 * \`\`\`
 */
export const deleteLine = (count = 1): string => `${CSI + (count <= 1 ? "" : count)}M`;

/**
 * Sets the top and bottom margins, defining the scrolling region.
 * (DECSTBM - Set Top and Bottom Margins)
 *
 * Cursor movement is typically confined to this region, especially when Origin Mode (DECOM) is active.
 * If parameters are omitted or invalid (e.g., `0`, `null`, `undefined`), they usually default to the
 * screen's current extents (e.g., line 1 for top, last line for bottom).
 *
 * Sequence: `CSI Pt ; Pb r`
 * - `Pt`: Line number for the top margin (1-indexed). Default: 1.
 * - `Pb`: Line number for the bottom margin (1-indexed). Default: screen height.
 * @param top The line number for the top margin (1-indexed). If `null`, `undefined`, or `< 1`, it's omitted, implying default.
 * @param bottom The line number for the bottom margin (1-indexed). If `null`, `undefined`, or `< 1`, it's omitted, implying default.
 * @returns The ANSI escape sequence for DECSTBM.
 * @see {@link https://vt100.net/docs/vt510-rm/DECSTBM.html VT510 DECSTBM Documentation}
 * @example
 * \`\`\`typescript
 * import { setTopBottomMargins } from \'@visulima/ansi/screen\';
 *
 * // Set scrolling region from line 5 to 20
 * process.stdout.write(setTopBottomMargins(5, 20)); // CSI 5;20r
 *
 * // Reset to default margins (full screen)
 * process.stdout.write(setTopBottomMargins()); // CSI ;r
 * \`\`\`
 */
export const setTopBottomMargins = (top?: number | null, bottom?: number | null): string => {
    const topString = top && top > 0 ? top.toString() : "";
    const bottomString = bottom && bottom > 0 ? bottom.toString() : "";

    if (topString === "" && bottomString === "") {
        return `${CSI + SEP}r`; // CSI ;r (reset to default)
    }

    return `${CSI + topString + SEP + bottomString}r`;
};

/**
 * Sets the left and right margins for the page or screen, defining horizontal boundaries.
 * (DECSLRM - Set Left and Right Margins)
 *
 * This command is common on VT420+ terminals and xterm.
 * If parameters are omitted or invalid, they usually default to the screen's current extents
 * (e.g., column 1 for left, last column for right).
 *
 * Sequence: `CSI Pl ; Pr s`
 * - `Pl`: Column number for the left margin (1-indexed). Default: 1.
 * - `Pr`: Column number for the right margin (1-indexed). Default: screen width.
 *
 * Note: The final character 's' should not be confused with save cursor sequences.
 * @param left The column number for the left margin (1-indexed). If `null`, `undefined`, or `< 1`, it's omitted.
 * @param right The column number for the right margin (1-indexed). If `null`, `undefined`, or `< 1`, it's omitted.
 * @returns The ANSI escape sequence for DECSLRM.
 * @see {@link https://vt100.net/docs/vt510-rm/DECSLRM.html VT510 DECSLRM Documentation}
 * @example
 * \`\`\`typescript
 * import { setLeftRightMargins } from \'@visulima/ansi/screen\';
 *
 * // Set left margin to 10, right margin to 70
 * process.stdout.write(setLeftRightMargins(10, 70)); // CSI 10;70s
 *
 * // Reset to default margins (full width)
 * process.stdout.write(setLeftRightMargins());      // CSI ;s
 * \`\`\`
 */
export const setLeftRightMargins = (left?: number | null, right?: number | null): string => {
    const leftString = left && left > 0 ? left.toString() : "";
    const rightString = right && right > 0 ? right.toString() : "";

    if (leftString === "" && rightString === "") {
        return `${CSI + SEP}s`; // CSI ;s (reset to default)
    }

    return `${CSI + leftString + SEP + rightString}s`;
};

/**
 * Inserts a specified number of blank characters at the current cursor position.
 * (ICH - Insert CHaracter)
 *
 * Existing characters from the cursor position to the right margin are shifted to the right.
 * Characters shifted past the right margin are lost. The cursor position is unchanged.
 * If the parameter `count` is 0 or 1, it defaults to inserting one character.
 *
 * Sequence: `CSI Pn @`
 * - `Pn`: Number of blank characters to insert (default: 1).
 * @param count The number of blank characters to insert. Defaults to 1.
 * @returns The ANSI escape sequence for inserting characters.
 * @see {@link https://vt100.net/docs/vt510-rm/ICH.html VT510 ICH Documentation}
 * @example
 * \`\`\`typescript
 * import { insertCharacter } from \'@visulima/ansi/screen\';
 *
 * // Insert 1 character (default)
 * process.stdout.write(insertCharacter()); // CSI @
 *
 * // Insert 10 characters
 * process.stdout.write(insertCharacter(10)); // CSI 10@
 * \`\`\`
 */
export const insertCharacter = (count = 1): string => `${CSI + (count <= 1 ? "" : count)}@`;

/**
 * Deletes a specified number of characters starting from the current cursor position.
 * (DCH - Delete CHaracter)
 *
 * Remaining characters on the line (to the right of the cursor) are shifted to the left.
 * Character attributes move with the characters. Blank characters with default attributes
 * are inserted at the right margin. The cursor position is unchanged.
 * If the parameter `count` is 0 or 1, it defaults to deleting one character.
 *
 * Sequence: `CSI Pn P`
 * - `Pn`: Number of characters to delete (default: 1).
 * @param count The number of characters to delete. Defaults to 1.
 * @returns The ANSI escape sequence for deleting characters.
 * @see {@link https://vt100.net/docs/vt510-rm/DCH.html VT510 DCH Documentation}
 * @example
 * \`\`\`typescript
 * import { deleteCharacter } from \'@visulima/ansi/screen\';
 *
 * // Delete 1 character (default)
 * process.stdout.write(deleteCharacter()); // CSI P
 *
 * // Delete 5 characters
 * process.stdout.write(deleteCharacter(5)); // CSI 5P
 * \`\`\`
 */
export const deleteCharacter = (count = 1): string => `${CSI + (count <= 1 ? "" : count)}P`;

/**
 * Clears horizontal tab stops.
 * (TBC - Tabulation Clear)
 *
 * Sequence: `CSI Ps g`
 * - `Ps = 0` (or omitted): Clear horizontal tab stop at the current column (default).
 * - `Ps = 3`: Clear all horizontal tab stops in the current line (or all lines, terminal-dependent).
 * @param mode Specifies which tab stops to clear:
 * - `0`: Clear tab stop at the current cursor column (default).
 * - `3`: Clear all horizontal tab stops.
 * @returns The ANSI escape sequence for clearing tab stops.
 * @see {@link https://vt100.net/docs/vt510-rm/TBC.html VT510 TBC Documentation}
 * @example
 * \`\`\`typescript
 * import { clearTabStop } from \'@visulima/ansi/screen\';
 *
 * // Clear tab stop at current column
 * process.stdout.write(clearTabStop(0)); // CSI 0g
 * process.stdout.write(clearTabStop());  // CSI 0g (default)
 *
 * // Clear all tab stops
 * process.stdout.write(clearTabStop(3)); // CSI 3g
 * \`\`\`
 */
export const clearTabStop = (mode: 0 | 3 = 0): string => `${CSI + mode}g`;

/**
 * Requests a report of the terminal's presentation state.
 * (DECRQPSR - Request Presentation State Report)
 *
 * The terminal responds with a corresponding report sequence (e.g., DECTPSSR, DECSGRSR, DECCPSR).
 * This is useful for querying current SGR settings, color palette, etc.
 *
 * Sequence: `CSI Ps $ u`
 * - `Ps = 0`: Report Text Presentation State (DECTPSSR) - font, decoration, etc.
 * - `Ps = 1`: Report SGR State (DECSGRSR) - current graphic rendition attributes.
 * - `Ps = 2`: Report Color Palette State (DECCPSR) - color table contents.
 * @param mode Specifies the type of presentation state report requested:
 * - `0`: Text Presentation State (DECTPSSR).
 * - `1`: SGR State (DECSGRSR).
 * - `2`: Color Palette State (DECCPSR).
 * @returns The ANSI escape sequence to request the presentation state report.
 * @see {@link https://vt100.net/docs/vt510-rm/DECRQPSR.html VT510 DECRQPSR Documentation}
 * @example
 * \`\`\`typescript
 * import { requestPresentationStateReport } from \'@visulima/ansi/screen\';
 *
 * // Request SGR state
 * process.stdout.write(requestPresentationStateReport(1)); // CSI 1$u
 * \`\`\`
 */
export const requestPresentationStateReport = (mode: 0 | 1 | 2): string => `${CSI + mode}$u`;

/**
 * Repeats the preceding graphic character a specified number of times.
 * (REP - Repeat Previous Character)
 *
 * The character repeated is the last non-control character that was processed by the terminal.
 * If the parameter `count` is 0 or 1, it defaults to repeating one time (i.e., printing it again).
 *
 * Sequence: `CSI Pn b`
 * - `Pn`: Number of times to repeat the character (default: 1).
 * @param count The number of times to repeat the preceding graphic character. Defaults to 1.
 * @returns The ANSI escape sequence for repeating the previous character.
 * @see {@link https://vt100.net/docs/vt510-rm/REP.html VT510 REP Documentation (though REP is less common or behavior varies)}
 * @example
 * \`\`\`typescript
 * import { repeatPreviousCharacter } from \'@visulima/ansi/screen\';
 *
 * process.stdout.write("A");
 * // Repeat 'A' 5 times
 * process.stdout.write(repeatPreviousCharacter(5)); // Output: AAAAA (total 6 'A's)
 *
 * process.stdout.write("B");
 * // Repeat 'B' 1 time (default)
 * process.stdout.write(repeatPreviousCharacter()); // Output: BB (total 2 'B's)
 * \`\`\`
 */
export const repeatPreviousCharacter = (count = 1): string => `${CSI + (count <= 1 ? "" : count)}b`;
