import cursor from "./cursor";
import { CSI } from "./helpers";

const erase = {
    down: (count = 1): string => `${CSI}J`.repeat(count),
    line: `${CSI}2K`,
    lineEnd: `${CSI}K`,
    lineStart: `${CSI}1K`,
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
    screen: `${CSI}2J`,
    up: (count = 1): string => `${CSI}1J`.repeat(count),
};

export default erase;
