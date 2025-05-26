import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { CSI } from "../../src/constants";
import * as cursorModule from "../../src/cursor"; // Import as module for spy
import { cursorToColumn1 } from "../../src/cursor"; // Import the constant for use
import {
    eraseDisplay,
    EraseDisplayMode,
    eraseDown,
    eraseInLine,
    eraseLine,
    eraseLineEnd,
    EraseLineMode,
    eraseLines,
    eraseLineStart,
    eraseScreen,
    eraseUp,
} from "../../src/erase";

describe("erase utilities", () => {
    describe("eraseDisplayMode Enum", () => {
        it("should have correct values", () => {
            expect.assertions(4);
            expect(EraseDisplayMode.ToEnd).toBe(0);
            expect(EraseDisplayMode.ToBeginning).toBe(1);
            expect(EraseDisplayMode.EntireScreen).toBe(2);
            expect(EraseDisplayMode.EntireScreenAndScrollback).toBe(3);
        });
    });

    describe("eraseDisplay", () => {
        it("should erase to end by default (mode 0)", () => {
            expect.assertions(1);
            expect(eraseDisplay(EraseDisplayMode.ToEnd)).toBe(CSI + "J");
        });
        it("should erase to end for explicit mode 0", () => {
            expect.assertions(1);
            expect(eraseDisplay(0)).toBe(CSI + "J");
        });
        it("should erase to beginning for mode 1", () => {
            expect.assertions(1);
            expect(eraseDisplay(EraseDisplayMode.ToBeginning)).toBe(CSI + "1J");
        });
        it("should erase entire screen for mode 2", () => {
            expect.assertions(1);
            expect(eraseDisplay(EraseDisplayMode.EntireScreen)).toBe(CSI + "2J");
        });
        it("should erase screen and scrollback for mode 3", () => {
            expect.assertions(1);
            expect(eraseDisplay(EraseDisplayMode.EntireScreenAndScrollback)).toBe(CSI + "3J");
        });
        it("should default to mode 0 for invalid mode number", () => {
            expect.assertions(1);
            expect(eraseDisplay(99 as any)).toBe(CSI + "J");
        });
    });

    describe("eraseLineMode Enum", () => {
        it("should have correct values", () => {
            expect.assertions(3);
            expect(EraseLineMode.ToEnd).toBe(0);
            expect(EraseLineMode.ToBeginning).toBe(1);
            expect(EraseLineMode.EntireLine).toBe(2);
        });
    });

    describe("eraseInLine", () => {
        it("should erase to end of line by default (mode 0)", () => {
            expect.assertions(1);
            expect(eraseInLine(EraseLineMode.ToEnd)).toBe(CSI + "K");
        });
        it("should erase to end for explicit mode 0", () => {
            expect.assertions(1);
            expect(eraseInLine(0)).toBe(CSI + "K");
        });
        it("should erase to beginning of line for mode 1", () => {
            expect.assertions(1);
            expect(eraseInLine(EraseLineMode.ToBeginning)).toBe(CSI + "1K");
        });
        it("should erase entire line for mode 2", () => {
            expect.assertions(1);
            expect(eraseInLine(EraseLineMode.EntireLine)).toBe(CSI + "2K");
        });
        it("should default to mode 0 for invalid mode number", () => {
            expect.assertions(1);
            expect(eraseInLine(99 as any)).toBe(CSI + "K");
        });
    });

    describe("derived erase constants/functions", () => {
        it("eraseDown should be eraseDisplay(ToEnd)", () => {
            expect.assertions(1);
            expect(eraseDown).toBe(CSI + "J");
        });
        it("eraseLine should be eraseInLine(EntireLine)", () => {
            expect.assertions(1);
            expect(eraseLine).toBe(CSI + "2K");
        });
        it("eraseLineEnd should be eraseInLine(ToEnd)", () => {
            expect.assertions(1);
            expect(eraseLineEnd).toBe(CSI + "K");
        });
        it("eraseLineStart should be eraseInLine(ToBeginning)", () => {
            expect.assertions(1);
            expect(eraseLineStart).toBe(CSI + "1K");
        });
        it("eraseScreen should be eraseDisplay(EntireScreen)", () => {
            expect.assertions(1);
            expect(eraseScreen).toBe(CSI + "2J");
        });
        it("eraseUp should be eraseDisplay(ToBeginning)", () => {
            expect.assertions(1);
            expect(eraseUp).toBe(CSI + "1J");
        });
    });

    describe("eraseLines", () => {
        const mockCursorUp = vi.spyOn(cursorModule, "cursorUp");

        beforeEach(() => {
            mockCursorUp.mockClear().mockReturnValue(CSI + "A");
        });

        afterAll(() => {
            mockCursorUp.mockRestore();
        });

        it("should not call helpers for 0 lines", () => {
            expect.assertions(2);
            expect(eraseLines(0)).toBe("");
            expect(mockCursorUp).not.toHaveBeenCalled();
        });

        it("should erase 1 line", () => {
            expect.assertions(2);
            const expected = CSI + "2K" + cursorToColumn1;
            expect(eraseLines(1)).toBe(expected);
            expect(mockCursorUp).not.toHaveBeenCalled();
        });

        it("should erase 3 lines", () => {
            expect.assertions(2);
            const lineClear = CSI + "2K";
            const up = CSI + "A";
            const expected = lineClear + up + lineClear + up + lineClear + cursorToColumn1;
            expect(eraseLines(3)).toBe(expected);
            expect(mockCursorUp).toHaveBeenCalledTimes(2);
        });
    });
});
