import { CSI } from "./constants";
import cursor from "./cursor";

const erase = {
    /**
     * Erase the screen from the current line down to the bottom of the screen.
     */
    down: (count = 1): string => `${CSI}J`.repeat(count),
    line: `${CSI}2K`,
    /**
     * Erase from the current cursor position to the end of the current line.
     */
    lineEnd: `${CSI}K`,
    /**
     * Erase from the current cursor position to the start of the current line.
     */
    lineStart: `${CSI}1K`,
    /**
     * Erase from the current cursor position up the specified amount of rows.
     *
     * @param count - Count of rows to erase.
     */
    lines(count: number): string {
        let clear = "";

        // eslint-disable-next-line no-plusplus,no-loops/no-loops
        for (let index = 0; index < count; index++) {
            clear += this.line + (index < count - 1 ? cursor.up() : "");
        }

        if (count) {
            clear += cursor.left;
        }

        return clear;
    },
    /**
     * Erase the screen and move the cursor the top left position.
     */
    screen: `${CSI}2J`,
    /**
     * Erase the screen from the current line-up to the top of the screen.
     */
    up: (count = 1): string => `${CSI}1J`.repeat(count),
};

export default erase;
