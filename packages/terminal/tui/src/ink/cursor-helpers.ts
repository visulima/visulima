import { cursorDown, cursorHide, cursorShow, cursorTo, cursorUp, setCursorStyle } from "@visulima/ansi";

export type CursorPosition = {
    x: number;
    y: number;
};

/**
 * Declarative cursor shape, mapped to DECSCUSR (`CSI Ps SP q`).
 *
 * `"default"` restores the terminal's user-configured shape (`Ps=0`).
 * Steady variants are non-blinking; `blinking-*` variants opt into blink.
 */
export type CursorShape =
    | "bar"
    | "blinking-bar"
    | "blinking-block"
    | "blinking-underline"
    | "block"
    | "default"
    | "underline";

// DECSCUSR `Ps` parameter for each declarative shape. `Ps=0` is treated as
// "restore to user default" by every terminal that implements DECSCUSR; we
// emit it on unmount/exit so an app never leaks a custom shape back to the
// parent shell.
const CURSOR_SHAPE_PS: Record<CursorShape, number> = {
    bar: 6,
    "blinking-bar": 5,
    "blinking-block": 1,
    "blinking-underline": 3,
    block: 2,
    default: 0,
    underline: 4,
};

/**
 * Build the DECSCUSR escape sequence for a cursor shape.
 */
export const buildCursorShapeSequence = (shape: CursorShape): string => setCursorStyle(CURSOR_SHAPE_PS[shape]);

/**
 * Compare two cursor positions. Returns true if they differ.
 */
export const cursorPositionChanged = (a: CursorPosition | undefined, b: CursorPosition | undefined): boolean => a?.x !== b?.x || a?.y !== b?.y;

/**
 * Build escape sequence to move cursor from bottom of output to the target position and show it.
 * Assumes cursor is at (col 0, line visibleLineCount) — i.e. just after the last output line.
 */
export const buildCursorSuffix = (visibleLineCount: number, cursorPosition: CursorPosition | undefined): string => {
    if (!cursorPosition) {
        return "";
    }

    const moveUp = visibleLineCount - cursorPosition.y;

    return (moveUp > 0 ? cursorUp(moveUp) : "") + cursorTo(cursorPosition.x) + cursorShow;
};

/**
 * Build escape sequence to move cursor from previousCursorPosition back to the bottom of output.
 * This must be done before eraseLines or any operation that assumes cursor is at the bottom.
 */
export const buildReturnToBottom = (previousLineCount: number, previousCursorPosition: CursorPosition | undefined): string => {
    if (!previousCursorPosition) {
        return "";
    }

    // PreviousLineCount includes trailing newline, so visible lines = previousLineCount - 1
    // cursor is at previousCursorPosition.y, need to go to line (previousLineCount - 1)
    const down = previousLineCount - 1 - previousCursorPosition.y;

    return (down > 0 ? cursorDown(down) : "") + cursorTo(0);
};

export type CursorOnlyInput = {
    cursorPosition: CursorPosition | undefined;
    cursorWasShown: boolean;
    previousCursorPosition: CursorPosition | undefined;
    previousLineCount: number;
    visibleLineCount: number;
};

/**
 * Build the escape sequence for cursor-only updates (output unchanged, cursor moved).
 * Hides cursor if it was previously shown, returns to bottom, then repositions.
 */
export const buildCursorOnlySequence = (input: CursorOnlyInput): string => {
    const hidePrefix = input.cursorWasShown ? cursorHide : "";
    const returnToBottom = buildReturnToBottom(input.previousLineCount, input.previousCursorPosition);
    const cursorSuffix = buildCursorSuffix(input.visibleLineCount, input.cursorPosition);

    return hidePrefix + returnToBottom + cursorSuffix;
};

/**
 * Build the prefix that hides cursor and returns to bottom before erasing or rewriting.
 * Returns empty string if cursor was not shown.
 */
export const buildReturnToBottomPrefix = (cursorWasShown: boolean, previousLineCount: number, previousCursorPosition: CursorPosition | undefined): string => {
    if (!cursorWasShown) {
        return "";
    }

    return cursorHide + buildReturnToBottom(previousLineCount, previousCursorPosition);
};
