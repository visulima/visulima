import { CSI, ESC, SEP } from "./constants";
import { isTerminalApp } from "./helpers";

/**
 * Move cursor backward a specific amount of rows.
 *
 * @param count - Count of rows to move backward. Default is `1`.
 */
export const cursorBackward = (count = 1): string => CSI + count + "D";

/**
 * Move cursor down a specific amount of rows.
 *
 * @param count - Count of rows to move down. Default is `1`.
 */
export const cursorDown = (count = 1): string => CSI + count + "B";

/**
 * Move cursor forward a specific amount of rows.
 *
 * @param count - Count of rows to move forward. Default is `1`.
 */
export const cursorForward = (count = 1): string => CSI + count + "C";

/**
 * Hide cursor.
 */
export const cursorHide = CSI + "?25l";

/**
 * Move cursor to the left side.
 */
export const cursorLeft = CSI + "G";

/**
 * Set the position of the cursor relative to its current position.
 */
export const cursorMove = (x: number, y: number): string => {
    let returnValue = "";

    if (x < 0) {
        returnValue += CSI + -x + "D";
    } else if (x > 0) {
        returnValue += CSI + x + "C";
    }

    if (y < 0) {
        returnValue += CSI + -y + "A";
    } else if (y > 0) {
        returnValue += CSI + y + "B";
    }

    return returnValue;
};

/**
 * Move cursor to the next line.
 */
export const cursorNextLine = (count = 1): string => (CSI + "E").repeat(count);

/**
 * Move cursor to the previous line.
 */
export const cursorPrevLine = (count = 1): string => (CSI + "F").repeat(count);

/**
 * Restore saved cursor position.
 */
export const cursorRestore = isTerminalApp ? ESC + "8" : ESC + "u";

/**
 * Save cursor position.
 */
export const cursorSave = isTerminalApp ? ESC + "7" : ESC + "s";

/**
 * Show cursor.
 */
export const cursorShow = CSI + "?25h";

/**
 * Set the absolute position of the cursor. `x0` `y0` is the top left of the screen.
 */
export const cursorTo = (x: number, y: number): string => {
    if (!y && y !== 0) {
        return CSI + (x + 1) + "G";
    }

    return CSI + (y + 1) + SEP + (x + 1) + "H";
};

/**
 * Move cursor up a specific amount of rows.
 *
 * @param count - Count of rows to move up. Default is `1`.
 */
export const cursorUp = (count = 1): string => CSI + count + "A";

export { default as restoreCursor } from "restore-cursor";
