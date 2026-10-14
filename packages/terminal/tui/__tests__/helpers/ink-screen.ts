/* eslint-disable no-param-reassign, no-control-regex, sonarjs/no-control-regex, regexp/no-unused-capturing-group, regexp/no-obscure-range -- the VT model mutates its screen and parses control bytes by design */
import { getStringWidth } from "@visulima/string";

import logUpdate from "../../src/ink/log-update";
import createStdout from "./ink-create-stdout";

/**
 * Rendering attributes of one cell. The default pen is what a whole-line rewrite starts from.
 */
export type Pen = {
    bg: string;
    bold: boolean;
    fg: string;
    inverse: boolean;
    italic: boolean;
    underline: boolean;
};

const defaultPen: Pen = { bg: "", bold: false, fg: "", inverse: false, italic: false, underline: false };

/**
 * A minimal VT screen model. It replays the bytes the renderer wrote, so the
 * tests assert what the user would actually see instead of the exact escape
 * sequences. Only the sequences the inline renderer emits are modelled.
 *
 * Text is segmented into graphemes and placed by terminal cell width, so a wide
 * character occupies two cells: the second holds `""`. Every cell also carries the
 * pen it was written with, so tests can check styling as well as characters.
 */
export type Screen = {
    cols: number;
    cursorX: number;
    cursorY: number;
    height: number;
    pen: Pen;
    rows: string[][];
    scrollback: string[];
    scrollbackCleared: boolean;
    styles: Pen[][];
};

const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });

export const createScreen = (cols: number, height: number): Screen => {
    return {
        cols,
        cursorX: 0,
        cursorY: 0,
        height,
        pen: defaultPen,
        rows: Array.from({ length: height }, () => Array.from({ length: cols }).fill(" ") as string[]),
        scrollback: [],
        scrollbackCleared: false,
        styles: Array.from({ length: height }, () => Array.from({ length: cols }).fill(defaultPen) as Pen[]),
    };
};

const scrollUp = (screen: Screen): void => {
    screen.scrollback.push(screen.rows[0]!.join("").trimEnd());
    screen.rows.shift();
    screen.rows.push(Array.from({ length: screen.cols }).fill(" ") as string[]);
    screen.styles.shift();
    screen.styles.push(Array.from({ length: screen.cols }).fill(defaultPen) as Pen[]);
};

const lineFeed = (screen: Screen): void => {
    if (screen.cursorY === screen.height - 1) {
        scrollUp(screen);
    } else {
        screen.cursorY += 1;
    }
};

// Erased cells keep only the background colour (back colour erase), as a real terminal does.
const eraseRow = (screen: Screen, row: number, from: number, to: number): void => {
    const erasedPen: Pen = { ...defaultPen, bg: screen.pen.bg };

    for (let column = from; column < to && column < screen.cols; column += 1) {
        screen.rows[row]![column] = " ";
        screen.styles[row]![column] = erasedPen;
    }

    // Erasing either half of a wide character erases the whole character.
    if (from > 0 && screen.rows[row]![from] === "") {
        screen.rows[row]![from - 1] = " ";
    }

    if (to < screen.cols && screen.rows[row]![to] === "") {
        screen.rows[row]![to] = " ";
    }
};

const applySgr = (pen: Pen, params: string): Pen => {
    const codes = params === "" ? [0] : params.split(";").map(Number);
    let next = pen;

    for (let index = 0; index < codes.length; index += 1) {
        const code = codes[index]!;

        switch (code) {
            case 0: {
                next = defaultPen;

                break;
            }
            case 1:
            case 22: {
                next = { ...next, bold: code === 1 };

                break;
            }
            case 3:
            case 23: {
                next = { ...next, italic: code === 3 };

                break;
            }
            case 4:
            case 24: {
                next = { ...next, underline: code === 4 };

                break;
            }
            case 7:
            case 27: {
                next = { ...next, inverse: code === 7 };

                break;
            }
            default: { if ((code >= 30 && code <= 37) || (code >= 90 && code <= 97)) {
                next = { ...next, fg: String(code) };
            } else if (code === 39) {
                next = { ...next, fg: "" };
            } else if ((code >= 40 && code <= 47) || (code >= 100 && code <= 107)) {
                next = { ...next, bg: String(code) };
            } else if (code === 49) {
                next = { ...next, bg: "" };
            } else if (code === 38 || code === 48) {
                const isForeground = code === 38;
                const mode = codes[index + 1];
                const value = mode === 5 ? `5;${codes[index + 2]}` : `2;${codes[index + 2]};${codes[index + 3]};${codes[index + 4]}`;

                next = isForeground ? { ...next, fg: value } : { ...next, bg: value };
                index += mode === 5 ? 2 : 4;
            }
            }
        }
    }

    return next;
};

const writeText = (screen: Screen, text: string): void => {
    for (const { segment } of segmenter.segment(text)) {
        // Zero-width control characters (tabs) still occupy one cell in this model.
        const width = Math.min(2, getStringWidth(segment) || 1);

        if (screen.cursorX + width > screen.cols) {
            screen.cursorX = 0;
            lineFeed(screen);
        }

        screen.rows[screen.cursorY]![screen.cursorX] = segment;
        screen.styles[screen.cursorY]![screen.cursorX] = screen.pen;

        if (width === 2) {
            screen.rows[screen.cursorY]![screen.cursorX + 1] = "";
            screen.styles[screen.cursorY]![screen.cursorX + 1] = screen.pen;
        }

        screen.cursorX += width;
    }
};

export const feed = (screen: Screen, data: string): void => {
    const pattern = /\u001B\[([\d;?]*)([ -/]*)([@-~])|\u001B[@-_]|([\n\r])|([^\u001B\n\r]+)|\u001B/gu;

    for (const match of data.matchAll(pattern)) {
        const [, rawParams = "", , final, lineBreak, text] = match;

        if (lineBreak === "\n") {
            screen.cursorX = 0;
            lineFeed(screen);

            continue;
        }

        if (lineBreak === "\r") {
            screen.cursorX = 0;

            continue;
        }

        if (text !== undefined) {
            writeText(screen, text);

            continue;
        }

        if (final === undefined) {
            continue;
        }

        const params = rawParams.replace(/^\?/u, "");
        const count = Number.parseInt(params, 10) || 1;

        switch (final) {
            case "A": {
                screen.cursorY = Math.max(0, screen.cursorY - count);
                break;
            }
            case "B": {
                screen.cursorY = Math.min(screen.height - 1, screen.cursorY + count);
                break;
            }
            case "E": {
                screen.cursorY = Math.min(screen.height - 1, screen.cursorY + count);
                screen.cursorX = 0;
                break;
            }
            case "G": {
                screen.cursorX = Math.min(screen.cols - 1, count - 1);
                break;
            }
            case "H": {
                // CUP `row;col` (1-based); a bare `CSI H` homes the cursor.
                const [row = 1, column = 1] = params.split(";").map((value) => Number.parseInt(value, 10) || 1);

                screen.cursorY = Math.min(screen.height - 1, row - 1);
                screen.cursorX = Math.min(screen.cols - 1, column - 1);
                break;
            }
            case "J": {
                switch (params) {
                    case "":
                    case "0": {
                        eraseRow(screen, screen.cursorY, screen.cursorX, screen.cols);

                        for (let row = screen.cursorY + 1; row < screen.height; row += 1) {
                            eraseRow(screen, row, 0, screen.cols);
                        }

                        break;
                    }
                    case "2": {
                        for (let row = 0; row < screen.height; row += 1) {
                            eraseRow(screen, row, 0, screen.cols);
                        }

                        break;
                    }
                    case "3": {
                        screen.scrollbackCleared = true;
                        screen.scrollback = [];

                        break;
                    }
                    // No default
                }

                break;
            }
            case "K": {
                if (params === "2") {
                    eraseRow(screen, screen.cursorY, 0, screen.cols);
                } else if (params === "1") {
                    eraseRow(screen, screen.cursorY, 0, screen.cursorX + 1);
                } else {
                    eraseRow(screen, screen.cursorY, screen.cursorX, screen.cols);
                }

                break;
            }
            case "m": {
                screen.pen = applySgr(screen.pen, params);

                break;
            }
            default:
                // Cursor visibility, cursor shape and synchronized output do not move text.
        }
    }
};

export const visibleRows = (screen: Screen): string[] => screen.rows.map((row) => row.join("").trimEnd());

export const replay = (writes: string[], rows = 12, cols = 40): Screen => {
    const screen = createScreen(cols, rows);

    feed(screen, writes.join(""));

    return screen;
};

export const SENTINEL = "$ prompt\n";

/** Replays what the renderer wrote after some shell output that is already on screen. */
export const replayAfterPrompt = (writes: string[], rows: number, cols = 40): Screen => replay([SENTINEL, ...writes], rows, cols);

/**
 * Renders the frames through the log updater and returns the screen they leave behind, after the
 * sentinel prompt line that is already on screen.
 */
export const renderFrames = (frames: string[], { cols = 40, incremental = true, rows = 12 }: { cols?: number; incremental?: boolean; rows?: number } = {}): Screen => {
    const stdout = createStdout(cols, true, rows);
    const render = logUpdate.create(stdout, { incremental, showCursor: true });

    for (const frame of frames) {
        render(frame);
    }

    return replayAfterPrompt(stdout.getWrites(), rows, cols);
};
