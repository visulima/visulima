import { cursorDown, cursorTo, cursorUp } from "@visulima/ansi";
import { describe, expect, it } from "vitest";

import {
    buildCursorOnlySequence,
    buildCursorShapeSequence,
    buildCursorSuffix,
    buildReturnToBottom,
    buildReturnToBottomPrefix,
    cursorPositionChanged,
} from "../../src/ink/cursor-helpers";

const showCursorEscape = "\u001B[?25h";
const hideCursorEscape = "\u001B[?25l";

describe("cursor-helpers", () => {
    // CursorPositionChanged

    it("cursorPositionChanged - both undefined returns false", () => {
        expect.assertions(1);

        expect(cursorPositionChanged(undefined, undefined)).toBe(false);
    });

    it("cursorPositionChanged - same position returns false", () => {
        expect.assertions(1);

        expect(cursorPositionChanged({ x: 1, y: 2 }, { x: 1, y: 2 })).toBe(false);
    });

    it("cursorPositionChanged - different x returns true", () => {
        expect.assertions(1);

        expect(cursorPositionChanged({ x: 1, y: 2 }, { x: 3, y: 2 })).toBe(true);
    });

    it("cursorPositionChanged - different y returns true", () => {
        expect.assertions(1);

        expect(cursorPositionChanged({ x: 1, y: 2 }, { x: 1, y: 3 })).toBe(true);
    });

    it("cursorPositionChanged - undefined vs defined returns true", () => {
        expect.assertions(2);

        expect(cursorPositionChanged(undefined, { x: 0, y: 0 })).toBe(true);
        expect(cursorPositionChanged({ x: 0, y: 0 }, undefined)).toBe(true);
    });

    // BuildCursorSuffix

    it("buildCursorSuffix - returns empty string when cursorPosition is undefined", () => {
        expect.assertions(1);

        expect(buildCursorSuffix(3, undefined)).toBe("");
    });

    it("buildCursorSuffix - moves up and positions cursor", () => {
        expect.assertions(1);

        const result = buildCursorSuffix(3, { x: 5, y: 1 });

        expect(result).toBe(cursorUp(2) + cursorTo(5) + showCursorEscape);
    });

    it("buildCursorSuffix - no cursorUp when cursor is at last visible line", () => {
        expect.assertions(1);

        const result = buildCursorSuffix(3, { x: 0, y: 3 });

        expect(result).toBe(cursorTo(0) + showCursorEscape);
    });

    it("buildCursorSuffix - cursor at first line of single-line output", () => {
        expect.assertions(1);

        const result = buildCursorSuffix(1, { x: 4, y: 0 });

        expect(result).toBe(cursorUp(1) + cursorTo(4) + showCursorEscape);
    });

    // BuildReturnToBottom

    it("buildReturnToBottom - returns empty string when previousCursorPosition is undefined", () => {
        expect.assertions(1);

        expect(buildReturnToBottom(4, undefined)).toBe("");
    });

    it("buildReturnToBottom - moves down to bottom", () => {
        expect.assertions(1);

        const result = buildReturnToBottom(4, { x: 5, y: 0 });

        expect(result).toBe(cursorDown(3) + cursorTo(0));
    });

    it("buildReturnToBottom - no cursorDown when cursor already at bottom", () => {
        expect.assertions(1);

        const result = buildReturnToBottom(4, { x: 0, y: 3 });

        expect(result).toBe(cursorTo(0));
    });

    // BuildCursorOnlySequence

    it("buildCursorOnlySequence - builds full sequence with hide prefix when cursor was shown", () => {
        expect.assertions(1);

        const result = buildCursorOnlySequence({
            cursorPosition: { x: 3, y: 0 },
            cursorWasShown: true,
            previousCursorPosition: { x: 0, y: 0 },
            previousLineCount: 2,
            visibleLineCount: 1,
        });
        const expected = hideCursorEscape + buildReturnToBottom(2, { x: 0, y: 0 }) + buildCursorSuffix(1, { x: 3, y: 0 });

        expect(result).toBe(expected);
    });

    it("buildCursorOnlySequence - no hide prefix when cursor was not shown", () => {
        expect.assertions(2);

        const result = buildCursorOnlySequence({
            cursorPosition: { x: 3, y: 0 },
            cursorWasShown: false,
            previousCursorPosition: undefined,
            previousLineCount: 0,
            visibleLineCount: 1,
        });

        expect(result.startsWith(hideCursorEscape)).toBe(false);
        expect(result).toContain(showCursorEscape);
    });

    // BuildReturnToBottomPrefix

    it("buildReturnToBottomPrefix - returns empty string when cursor was not shown", () => {
        expect.assertions(1);

        expect(buildReturnToBottomPrefix(false, 4, { x: 0, y: 0 })).toBe("");
    });

    it("buildReturnToBottomPrefix - returns hide + returnToBottom when cursor was shown", () => {
        expect.assertions(1);

        const result = buildReturnToBottomPrefix(true, 4, { x: 0, y: 0 });

        expect(result).toBe(hideCursorEscape + buildReturnToBottom(4, { x: 0, y: 0 }));
    });

    it("buildReturnToBottomPrefix - with undefined previousCursorPosition still hides cursor", () => {
        expect.assertions(1);

        const result = buildReturnToBottomPrefix(true, 4, undefined);

        expect(result).toBe(hideCursorEscape + buildReturnToBottom(4, undefined));
    });

    // BuildCursorShapeSequence — DECSCUSR `CSI Ps SP q`

    it.each([
        ["default", 0],
        ["blinking-block", 1],
        ["block", 2],
        ["blinking-underline", 3],
        ["underline", 4],
        ["blinking-bar", 5],
        ["bar", 6],
    ] as const)("buildCursorShapeSequence - %s maps to Ps=%i", (shape, ps) => {
        expect.assertions(1);

        expect(buildCursorShapeSequence(shape)).toBe(`[${ps} q`);
    });
});
