import { CSI } from "./constants";
import { cursorLeft, cursorUp } from "./cursor";

/**
 * Erase the screen from the current line down to the bottom of the screen.
 */
export const eraseDown = (count = 1): string => `${CSI}J`.repeat(count);
export const eraseLine = `${CSI}2K`;

/**
 * Erase from the current cursor position to the end of the current line.
 */
export const eraseLineEnd = `${CSI}K`;

/**
 * Erase from the current cursor position to the start of the current line.
 */
export const eraseLineStart = `${CSI}1K`;

/**
 * Erase from the current cursor position up the specified amount of rows.
 *
 * @param count - Count of rows to erase.
 */
export const eraseLines = (count: number): string => {
    let clear = "";

    // eslint-disable-next-line no-plusplus,no-loops/no-loops
    for (let index = 0; index < count; index++) {
        clear += eraseLine + (index < count - 1 ? cursorUp() : "");
    }

    if (count) {
        clear += cursorLeft;
    }

    return clear;
};

/**
 * Erase the screen and move the cursor the top left position.
 */
export const eraseScreen = `${CSI}2J`;

/**
 * Erase the screen from the current line-up to the top of the screen.
 */
export const eraseUp = (count = 1): string => `${CSI}1J`.repeat(count);
