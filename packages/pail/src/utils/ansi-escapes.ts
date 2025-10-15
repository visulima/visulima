const ESC = "\u001B[";

const eraseScreen = `${ESC}2J`;
const eraseLine = `${ESC}2K`;

const cursorLeft = `${ESC}G`;
const cursorUp = (count = 1) => `${ESC + count}A`;

export const clearTerminal: string
    = process.platform === "win32"
        ? `${eraseScreen}${ESC}0f`
        : // 1. Erases the screen (Only done in case `2` is not supported)
    // 2. Erases the whole screen including scrollback buffer
    // 3. Moves cursor to the top-left position
    // More info: https://www.real-world-systems.com/docs/ANSIcode.html
        `${eraseScreen}${ESC}3J${ESC}H`;

export const cursorHide: string = `${ESC}?25l`;
export const cursorShow: string = `${ESC}?25h`;

export const eraseLines = (count: number): string => {
    let clear = "";

    // eslint-disable-next-line no-plusplus
    for (let index = 0; index < count; index++) {
        clear += eraseLine + (index < count - 1 ? cursorUp() : "");
    }

    if (count) {
        clear += cursorLeft;
    }

    return clear;
};
