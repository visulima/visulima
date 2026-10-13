/* eslint-disable no-param-reassign, no-control-regex, sonarjs/no-control-regex, regexp/no-unused-capturing-group, regexp/no-obscure-range -- the VT model mutates its screen and parses control bytes by design */
import { describe, expect, it } from "vitest";

import logUpdate from "../../src/ink/log-update";
import createStdout from "../helpers/ink-create-stdout";

/**
 * A minimal VT screen model. It replays the bytes the renderer wrote, so the
 * tests assert what the user would actually see instead of the exact escape
 * sequences. Only the sequences the inline renderer emits are modelled.
 */
type Screen = {
    cols: number;
    cursorX: number;
    cursorY: number;
    height: number;
    rows: string[][];
    scrollback: string[];
    scrollbackCleared: boolean;
};

const createScreen = (cols: number, height: number): Screen => {
    return {
        cols,
        cursorX: 0,
        cursorY: 0,
        height,
        rows: Array.from({ length: height }, () => Array.from({ length: cols }).fill(" ")),
        scrollback: [],
        scrollbackCleared: false,
    };
};

const scrollUp = (screen: Screen): void => {
    screen.scrollback.push(screen.rows[0]!.join("").trimEnd());
    screen.rows.shift();
    screen.rows.push(Array.from({ length: screen.cols }).fill(" "));
};

const lineFeed = (screen: Screen): void => {
    if (screen.cursorY === screen.height - 1) {
        scrollUp(screen);
    } else {
        screen.cursorY += 1;
    }
};

const eraseRow = (screen: Screen, row: number, from: number, to: number): void => {
    for (let column = from; column < to && column < screen.cols; column += 1) {
        screen.rows[row]![column] = " ";
    }
};

const feed = (screen: Screen, data: string): void => {
    const pattern = /\u001B\[([\d;?]*)([ -/]*)([@-~])|\u001B[@-_]|([\s\S])/gu;

    for (const match of data.matchAll(pattern)) {
        const [, rawParams = "", , final, char] = match;

        if (char !== undefined) {
            if (char === "\n") {
                screen.cursorX = 0;
                lineFeed(screen);
            } else if (char === "\r") {
                screen.cursorX = 0;
            } else {
                if (screen.cursorX >= screen.cols) {
                    screen.cursorX = 0;
                    lineFeed(screen);
                }

                screen.rows[screen.cursorY]![screen.cursorX] = char;
                screen.cursorX += 1;
            }

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
                screen.cursorX = 0;
                screen.cursorY = 0;
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
            default:
                // SGR, cursor visibility, cursor shape and synchronized output do not move text.
        }
    }
};

const visibleRows = (screen: Screen): string[] => screen.rows.map((row) => row.join("").trimEnd());

const replay = (writes: string[], rows = 12, cols = 40): Screen => {
    const screen = createScreen(cols, rows);

    feed(screen, writes.join(""));

    return screen;
};

const trimTrailingBlankRows = (lines: string[]): string[] => {
    const result = [...lines];

    while (result.length > 0 && result.at(-1) === "") {
        result.pop();
    }

    return result;
};

const SENTINEL = "$ prompt\n";

/** Replays what the renderer wrote after some shell output that is already on screen. */
const replayAfterPrompt = (writes: string[], rows: number, cols = 40): Screen => replay([SENTINEL, ...writes], rows, cols);

const renderIncremental = (frames: string[], rows = 12) => {
    const stdout = createStdout(40, true, rows);
    const render = logUpdate.create(stdout, { incremental: true, showCursor: true });

    for (const frame of frames) {
        render(frame);
    }

    return replayAfterPrompt(stdout.getWrites(), rows);
};

describe("inline renderer (incremental log-update) renders the screen it claims", () => {
    it("updates a single changed line in place", () => {
        expect.assertions(1);

        const screen = renderIncremental(["A\nB\nC\n", "A\nX\nC\n"]);

        expect(visibleRows(screen).slice(0, 4)).toEqual(["$ prompt", "A", "X", "C"]);
    });

    it("updates the first line when only it changed", () => {
        expect.assertions(1);

        const screen = renderIncremental(["A\nB\nC\n", "X\nB\nC\n"]);

        expect(visibleRows(screen).slice(0, 5)).toEqual(["$ prompt", "X", "B", "C", ""]);
    });

    it("updates the last line when only it changed", () => {
        expect.assertions(1);

        const screen = renderIncremental(["A\nB\nC\n", "A\nB\nZ\n"]);

        expect(visibleRows(screen).slice(0, 5)).toEqual(["$ prompt", "A", "B", "Z", ""]);
    });

    it("renders every changed row when all rows change", () => {
        expect.assertions(1);

        const screen = renderIncremental(["A\nB\nC\n", "X\nY\nZ\n"]);

        expect(visibleRows(screen).slice(0, 5)).toEqual(["$ prompt", "X", "Y", "Z", ""]);
    });

    it("renders a new blank row inserted between existing rows", () => {
        expect.assertions(1);

        const screen = renderIncremental(["A\nB\n", "A\n\nB\n"]);

        expect(visibleRows(screen).slice(0, 5)).toEqual(["$ prompt", "A", "", "B", ""]);
    });

    it("renders new blank rows appended at the end", () => {
        expect.assertions(2);

        const screen = renderIncremental(["A\n", "A\n\n\n"]);

        expect(visibleRows(screen).slice(0, 5)).toEqual(["$ prompt", "A", "", "", ""]);
        expect(screen.cursorY).toBe(4);
    });

    it("clears rows left behind when the output shrinks", () => {
        expect.assertions(2);

        const screen = renderIncremental(["A\nB\nC\n", "A\n"]);

        expect(visibleRows(screen).slice(0, 5)).toEqual(["$ prompt", "A", "", "", ""]);
        expect(screen.cursorY).toBe(2);
    });

    it("updates a frame that ends on the last row of the viewport", () => {
        expect.assertions(1);

        const screen = renderIncremental(["A\nB\nC\n", "A\nX\nC\n"], 5);

        expect(visibleRows(screen)).toEqual(["$ prompt", "A", "X", "C", ""]);
    });

    it("updates a frame without a trailing newline", () => {
        expect.assertions(1);

        const screen = renderIncremental(["A\nB\nC", "A\nX\nC"]);

        expect(visibleRows(screen).slice(0, 4)).toEqual(["$ prompt", "A", "X", "C"]);
    });

    it("updates a single-line frame without a trailing newline", () => {
        expect.assertions(1);

        const screen = renderIncremental(["A", "B"]);

        expect(visibleRows(screen).slice(0, 2)).toEqual(["$ prompt", "B"]);
    });
});

describe("inline renderer blank rows at the bottom of the viewport", () => {
    it("scrolls when a blank row is appended on the last viewport row", () => {
        expect.assertions(2);

        const screen = renderIncremental(["A\nB\n", "A\nB\n\n"], 4);

        expect(visibleRows(screen)).toEqual(["A", "B", "", ""]);
        expect(screen.cursorY).toBe(3);
    });
});
