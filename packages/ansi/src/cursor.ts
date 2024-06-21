import { CSI, ESC, SEP } from "./constants";
import { isTerminalApp } from "./helpers";

const cursor = {
    /**
     * Move cursor backward a specific amount of rows.
     *
     * @param count - Count of rows to move backward. Default is `1`.
     */
    backward: (count = 1): string => CSI + count + "D",
    /**
     * Move cursor down a specific amount of rows.
     *
     * @param count - Count of rows to move down. Default is `1`.
     */
    down: (count = 1): string => CSI + count + "B",
    /**
     * Move cursor forward a specific amount of rows.
     *
     * @param count - Count of rows to move forward. Default is `1`.
     */
    forward: (count = 1): string => CSI + count + "C",
    /**
     * Hide cursor.
     */
    hide: CSI + "?25l",
    /**
     * Move cursor to the left side.
     */
    left: CSI + "G",
    /**
     * Set the position of the cursor relative to its current position.
     */
    move(x: number, y: number): string {
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
    },
    /**
     * Move cursor to the next line.
     */
    nextLine: (count = 1): string => (CSI + "E").repeat(count),
    /**
     * Move cursor to the previous line.
     */
    prevLine: (count = 1): string => (CSI + "F").repeat(count),
    /**
     * Restore saved cursor position.
     */
    restore: isTerminalApp ? ESC + "8" : ESC + "u",
    /**
     * Save cursor position.
     */
    save: isTerminalApp ? ESC + "7" : ESC + "s",
    /**
     * Show cursor.
     */
    show: CSI + "?25h",
    /**
     * Set the absolute position of the cursor. `x0` `y0` is the top left of the screen.
     */
    to(x: number, y: number): string {
        if (!y && y !== 0) {
            return CSI + (x + 1) + "G";
        }

        return CSI + (y + 1) + SEP + (x + 1) + "H";
    },
    /**
     * Move cursor up a specific amount of rows.
     *
     * @param count - Count of rows to move up. Default is `1`.
     */
    up: (count = 1): string => CSI + count + "A",
};

export default cursor;
