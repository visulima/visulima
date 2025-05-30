import { describe, expect, it } from "vitest";

import {
    cursorBackward,
    cursorBackwardTab,
    cursorDown,
    cursorForward,
    cursorHide,
    cursorHorizontalAbsolute,
    cursorHorizontalForwardTab,
    cursorLeft,
    cursorMove,
    cursorNextLine,
    cursorPosition,
    cursorPreviousLine,
    cursorRestore,
    cursorSave,
    cursorShow,
    CursorStyle,
    cursorTo,
    cursorToColumn1,
    cursorUp,
    cursorVerticalAbsolute,
    eraseCharacter,
    REQUEST_CURSOR_POSITION,
    REQUEST_EXTENDED_CURSOR_POSITION,
    setCursorStyle,
} from "../../src/cursor";
import { isTerminalApp } from "../../src/helpers";

describe(`cursor`, () => {
    it.each([
        ["cursorTo (x)", cursorTo, 0, "\u001B[1G"],
        ["cursorTo (x, y)", cursorTo, [2, 2], "\u001B[3;3H"],
        ["cursorMove", cursorMove, [1, 4], "\u001B[1C\u001B[4B"],
        ["cursorUp (default)", cursorUp, undefined, "\u001B[1A"],
        ["cursorUp (1)", cursorUp, 1, "\u001B[1A"],
        ["cursorUp (2)", cursorUp, 2, "\u001B[2A"],
        ["cursorUp (0)", cursorUp, 0, "\u001B[0A"],
        ["cursorDown (default)", cursorDown, undefined, "\u001B[1B"],
        ["cursorDown (1)", cursorDown, 1, "\u001B[1B"],
        ["cursorDown (2)", cursorDown, 2, "\u001B[2B"],
        ["cursorDown (0)", cursorDown, 0, "\u001B[0B"],
        ["cursorForward (default)", cursorForward, undefined, "\u001B[1C"],
        ["cursorForward (2)", cursorForward, 2, "\u001B[2C"],
        ["cursorForward (0)", cursorForward, 0, "\u001B[0C"],
        ["cursorBackward (default)", cursorBackward, undefined, "\u001B[1D"],
        ["cursorBackward (2)", cursorBackward, 2, "\u001B[2D"],
        ["cursorBackward (0)", cursorBackward, 0, "\u001B[0D"],
        ["cursorNextLine (default)", cursorNextLine, undefined, "\u001B[1E"],
        ["cursorNextLine (2)", cursorNextLine, 2, "\u001B[2E"],
        ["cursorPrevLine (default)", cursorPreviousLine, undefined, "\u001B[1F"],
        ["cursorPrevLine (2)", cursorPreviousLine, 2, "\u001B[2F"],
        ["cursorLeft (default)", cursorLeft, undefined, "\u001B[1D"],
        ["cursorLeft (count 3)", cursorLeft, 3, "\u001B[3D"],
        ["cursorToColumn1", cursorToColumn1, undefined, "\u001B[G"],
        ["cursorHide", cursorHide, undefined, "\u001B[?25l"],
        ["cursorShow", cursorShow, undefined, "\u001B[?25h"],
        ["REQUEST_CURSOR_POSITION", REQUEST_CURSOR_POSITION, undefined, "\u001B[6n"],
        ["REQUEST_EXTENDED_CURSOR_POSITION", REQUEST_EXTENDED_CURSOR_POSITION, undefined, "\u001B[?6n"],
        ["cursorHorizontalAbsolute (default)", cursorHorizontalAbsolute, undefined, "\u001B[1G"],
        ["cursorHorizontalAbsolute (col 5)", cursorHorizontalAbsolute, 5, "\u001B[5G"],
        ["cursorPosition (row 5)", cursorPosition, 5, "\u001B[5H"],
        ["cursorHorizontalForwardTab (default)", cursorHorizontalForwardTab, undefined, "\u001B[1I"],
        ["cursorHorizontalForwardTab (count 3)", cursorHorizontalForwardTab, 3, "\u001B[3I"],
        ["cursorBackwardTab (default)", cursorBackwardTab, undefined, "\u001B[1Z"],
        ["cursorBackwardTab (count 3)", cursorBackwardTab, 3, "\u001B[3Z"],
        ["eraseCharacter (default)", eraseCharacter, undefined, "\u001B[1X"],
        ["eraseCharacter (count 3)", eraseCharacter, 3, "\u001B[3X"],
        ["cursorVerticalAbsolute (default)", cursorVerticalAbsolute, undefined, "\u001B[1d"],
        ["cursorVerticalAbsolute (row 5)", cursorVerticalAbsolute, 5, "\u001B[5d"],
    ])("should return the correct ansi string for %s", (_, function_, value, expected) => {
        expect.assertions(1);

        // eslint-disable-next-line vitest/no-conditional-in-test
        if (Array.isArray(value) && typeof function_ === "function") {
            // eslint-disable-next-line vitest/no-conditional-expect
            expect(function_(value[0] as number, value[1] as number)).toBe(expected);
        } else if (typeof function_ === "function") {
            // eslint-disable-next-line vitest/no-conditional-expect
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

    it("should return correct ansi string for setCursorStyle", () => {
        expect.assertions(5);

        const actualBlinkingBlock = setCursorStyle(CursorStyle.BlinkingBlock);
        const expectedBlinkingBlock = "\u001B[1 q";

        expect(actualBlinkingBlock).toBe(expectedBlinkingBlock);

        const actualSteadyUnderline = setCursorStyle(CursorStyle.SteadyUnderline);
        const expectedSteadyUnderline = "\u001B[4 q";

        expect(actualSteadyUnderline).toBe(expectedSteadyUnderline);

        const actualBlinkingBar = setCursorStyle(CursorStyle.BlinkingBar);
        const expectedBlinkingBar = "\u001B[5 q";

        expect(actualBlinkingBar).toBe(expectedBlinkingBar);

        const actualZero = setCursorStyle(0);
        const expectedZero = "\u001B[0 q";

        expect(actualZero).toBe(expectedZero);

        const actualTwo = setCursorStyle(2);
        const expectedTwo = "\u001B[2 q";

        expect(actualTwo).toBe(expectedTwo);
    });
});
