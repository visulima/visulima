import { CSI, ESC } from "./helpers";

const cursor = {
    backward: (count = 1): string => CSI + count + "D",
    down: (count = 1): string => CSI + count + "B",
    forward: (count = 1): string => CSI + count + "C",
    hide: CSI + "?25l",
    left: CSI + "G",
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
    nextLine: (count = 1): string => (CSI + "E").repeat(count),
    prevLine: (count = 1): string => (CSI + "F").repeat(count),
    restore: ESC + "8",
    save: ESC + "7",
    show: CSI + "?25h",
    to(x: number, y: number): string {
        if (!y && y !== 0) {
            return CSI + x + 1 + "G";
        }

        return CSI + y + 1 + ";" + x + 1 + "H";
    },
    up: (count = 1): string => CSI + count + "A",
};

export default cursor;
