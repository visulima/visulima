import { describe, expect, it } from "vitest";

import {
    cursorBackward,
    cursorDown,
    cursorForward,
    cursorHide,
    cursorLeft,
    cursorMove,
    cursorNextLine,
    cursorPreviousLine,
    cursorRestore,
    cursorSave,
    cursorShow,
    cursorTo,
    cursorUp,
} from "../../src/cursor";
import { isTerminalApp } from "../../src/helpers";

describe(`cursor`, () => {
    it.each([
        ["cursorTo", cursorTo, 0, "\u001B[1G"],
        ["cursorTo", cursorTo, [2, 2], "\u001B[3;3H"],
        ["cursorMove", cursorMove, [1, 4], "\u001B[1C\u001B[4B"],
        ["cursorUp", cursorUp, undefined, "\u001B[1A"],
        ["cursorUp", cursorUp, 1, "\u001B[1A"],
        ["cursorUp", cursorUp, 2, "\u001B[2A"],
        ["cursorUp", cursorUp, 0, "\u001B[0A"],
        ["cursorDown", cursorDown, undefined, "\u001B[1B"],
        ["cursorDown", cursorDown, 1, "\u001B[1B"],
        ["cursorDown", cursorDown, 2, "\u001B[2B"],
        ["cursorDown", cursorDown, 0, "\u001B[0B"],
        ["cursorForward", cursorForward, undefined, "\u001B[1C"],
        ["cursorForward", cursorForward, 2, "\u001B[2C"],
        ["cursorForward", cursorForward, 0, "\u001B[0C"],
        ["cursorBackward", cursorBackward, undefined, "\u001B[1D"],
        ["cursorBackward", cursorBackward, 2, "\u001B[2D"],
        ["cursorBackward", cursorBackward, 0, "\u001B[0D"],
        ["cursorNextLine", cursorNextLine, undefined, "\u001B[E"],
        ["cursorNextLine", cursorNextLine, 2, "\u001B[E\u001B[E"],
        ["cursorPrevLine", cursorPreviousLine, undefined, "\u001B[F"],
        ["cursorPrevLine", cursorPreviousLine, 2, "\u001B[F\u001B[F"],
        ["cursorLeft", cursorLeft, undefined, "\u001B[G"],
        ["cursorHide", cursorHide, undefined, "\u001B[?25l"],
        ["cursorShow", cursorShow, undefined, "\u001B[?25h"],
    ])("should return the correct ansi string for %s", (_, function_, value, expected) => {
        expect.assertions(1);

        // eslint-disable-next-line vitest/no-conditional-in-test
        if (Array.isArray(value) && typeof function_ === "function") {
            // eslint-disable-next-line vitest/no-conditional-expect
            expect(function_(value[0] as number, value[1] as number)).toBe(expected);
        } else if (typeof function_ === "function") {
            // eslint-disable-next-line vitest/no-conditional-expect, @typescript-eslint/no-explicit-any
            expect((function_ as (value: any) => string)(value)).toBe(expected);
        } else {
            // eslint-disable-next-line vitest/no-conditional-expect
            expect(function_).toBe(expected);
        }
    });

    it("should return the correct ansi string for save", () => {
        expect.assertions(1);

        expect(cursorSave).toBe(isTerminalApp ? "\u001B7" : "\u001Bs");
    });

    it("should return the correct ansi string for restore", () => {
        expect.assertions(1);

        expect(cursorRestore).toBe(isTerminalApp ? "\u001B8" : "\u001Bu");
    });
});
