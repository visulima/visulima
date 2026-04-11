/* eslint-disable @stylistic/no-extra-parens, @typescript-eslint/restrict-plus-operands, sonarjs/no-identical-functions */
import type { Writable } from "node:stream";

import { cursorHide, cursorNextLine, cursorShow, cursorTo, cursorUp, eraseLineEnd, eraseLines } from "@visulima/ansi";

import type { CursorPosition } from "./cursor-helpers";
import { buildCursorOnlySequence, buildCursorSuffix, buildReturnToBottomPrefix, cursorPositionChanged } from "./cursor-helpers";

export type { CursorPosition } from "./cursor-helpers";

export type LogUpdate = {
    clear: () => void;
    done: () => void;
    isCursorDirty: () => boolean;
    reset: () => void;
    setCursorPosition: (position: CursorPosition | undefined) => void;
    sync: (string_: string) => void;
    willRender: (string_: string) => boolean;
    (string_: string): boolean;
};

// Count visible lines in a string, ignoring the trailing empty element
// that `split('\n')` produces when the string ends with '\n'.
const visibleLineCount = (lines: string[], string_: string): number => (string_.endsWith("\n") ? lines.length - 1 : lines.length);

// Get the viewport height from a stream. TTY streams expose `.rows`;
// non-TTY streams don't, so we fall back to Infinity (no clamping).
const getViewportRows = (stream: Writable): number => (stream as NodeJS.WriteStream).rows || Infinity;

// Clamp a line count so that eraseLines / cursorUp never move the cursor
// above the visible viewport. Lines beyond the viewport have already
// scrolled into terminal scrollback and cannot be erased.
const clampToViewport = (lineCount: number, stream: Writable): number => Math.min(lineCount, getViewportRows(stream));

const createStandard = (stream: Writable, { showCursor = false } = {}): LogUpdate => {
    let previousLineCount = 0;
    let previousOutput = "";
    let hasHiddenCursor = false;
    let cursorPosition: CursorPosition | undefined;
    let cursorDirty = false;
    let previousCursorPosition: CursorPosition | undefined;
    let cursorWasShown = false;

    const getActiveCursor = () => (cursorDirty ? cursorPosition : undefined);
    const hasChanges = (string_: string, activeCursor: CursorPosition | undefined): boolean => {
        const cursorChanged = cursorPositionChanged(activeCursor, previousCursorPosition);

        return string_ !== previousOutput || cursorChanged;
    };

    const render = (string_: string) => {
        if (!showCursor && !hasHiddenCursor) {
            stream.write(cursorHide);
            hasHiddenCursor = true;
        }

        // Only use cursor if setCursorPosition was called since last render.
        // This ensures stale positions don't persist after component unmount.
        const activeCursor = getActiveCursor();

        cursorDirty = false;
        const cursorChanged = cursorPositionChanged(activeCursor, previousCursorPosition);

        if (!hasChanges(string_, activeCursor)) {
            return false;
        }

        const lines = string_.split("\n");
        const visibleCount = visibleLineCount(lines, string_);
        const cursorSuffix = buildCursorSuffix(visibleCount, activeCursor);

        if (string_ === previousOutput && cursorChanged) {
            stream.write(
                buildCursorOnlySequence({
                    cursorPosition: activeCursor,
                    cursorWasShown,
                    previousCursorPosition,
                    previousLineCount,
                    visibleLineCount: visibleCount,
                }),
            );
        } else {
            previousOutput = string_;
            const returnPrefix = buildReturnToBottomPrefix(cursorWasShown, previousLineCount, previousCursorPosition);

            stream.write(returnPrefix + eraseLines(clampToViewport(previousLineCount, stream)) + string_ + cursorSuffix);
            previousLineCount = lines.length;
        }

        previousCursorPosition = activeCursor ? { ...activeCursor } : undefined;
        cursorWasShown = activeCursor !== undefined;

        return true;
    };

    render.clear = () => {
        const prefix = buildReturnToBottomPrefix(cursorWasShown, previousLineCount, previousCursorPosition);

        stream.write(prefix + eraseLines(clampToViewport(previousLineCount, stream)));
        previousOutput = "";
        previousLineCount = 0;
        previousCursorPosition = undefined;
        cursorWasShown = false;
    };

    render.done = () => {
        previousOutput = "";
        previousLineCount = 0;
        previousCursorPosition = undefined;
        cursorWasShown = false;

        if (!showCursor) {
            stream.write(cursorShow);
            hasHiddenCursor = false;
        }
    };

    render.reset = () => {
        previousOutput = "";
        previousLineCount = 0;
        previousCursorPosition = undefined;
        cursorWasShown = false;
    };

    render.sync = (string_: string) => {
        const activeCursor = cursorDirty ? cursorPosition : undefined;

        cursorDirty = false;

        const lines = string_.split("\n");

        previousOutput = string_;
        previousLineCount = lines.length;

        if (!activeCursor && cursorWasShown) {
            stream.write(cursorHide);
        }

        if (activeCursor) {
            stream.write(buildCursorSuffix(visibleLineCount(lines, string_), activeCursor));
        }

        previousCursorPosition = activeCursor ? { ...activeCursor } : undefined;
        cursorWasShown = activeCursor !== undefined;
    };

    render.setCursorPosition = (position: CursorPosition | undefined) => {
        cursorPosition = position;
        cursorDirty = true;
    };

    render.isCursorDirty = () => cursorDirty;
    render.willRender = (string_: string) => hasChanges(string_, getActiveCursor());

    return render;
};

const createIncremental = (stream: Writable, { showCursor = false } = {}): LogUpdate => {
    let previousLines: string[] = [];
    let previousOutput = "";
    let hasHiddenCursor = false;
    let cursorPosition: CursorPosition | undefined;
    let cursorDirty = false;
    let previousCursorPosition: CursorPosition | undefined;
    let cursorWasShown = false;

    const getActiveCursor = () => (cursorDirty ? cursorPosition : undefined);
    const hasChanges = (string_: string, activeCursor: CursorPosition | undefined): boolean => {
        const cursorChanged = cursorPositionChanged(activeCursor, previousCursorPosition);

        return string_ !== previousOutput || cursorChanged;
    };

    const render = (string_: string) => {
        if (!showCursor && !hasHiddenCursor) {
            stream.write(cursorHide);
            hasHiddenCursor = true;
        }

        // Only use cursor if setCursorPosition was called since last render.
        // This ensures stale positions don't persist after component unmount.
        const activeCursor = getActiveCursor();

        cursorDirty = false;
        const cursorChanged = cursorPositionChanged(activeCursor, previousCursorPosition);

        if (!hasChanges(string_, activeCursor)) {
            return false;
        }

        const nextLines = string_.split("\n");
        const visibleCount = visibleLineCount(nextLines, string_);
        const previousVisible = visibleLineCount(previousLines, previousOutput);

        if (string_ === previousOutput && cursorChanged) {
            stream.write(
                buildCursorOnlySequence({
                    cursorPosition: activeCursor,
                    cursorWasShown,
                    previousCursorPosition,
                    previousLineCount: previousLines.length,
                    visibleLineCount: visibleCount,
                }),
            );
            previousCursorPosition = activeCursor ? { ...activeCursor } : undefined;
            cursorWasShown = activeCursor !== undefined;

            return true;
        }

        const returnPrefix = buildReturnToBottomPrefix(cursorWasShown, previousLines.length, previousCursorPosition);

        if (string_ === "\n" || previousOutput.length === 0) {
            const cursorSuffix = buildCursorSuffix(visibleCount, activeCursor);

            stream.write(returnPrefix + eraseLines(clampToViewport(previousLines.length, stream)) + string_ + cursorSuffix);
            cursorWasShown = activeCursor !== undefined;
            previousCursorPosition = activeCursor ? { ...activeCursor } : undefined;
            previousOutput = string_;
            previousLines = nextLines;

            return true;
        }

        const hasTrailingNewline = string_.endsWith("\n");

        // We aggregate all chunks for incremental rendering into a buffer, and then write them to stdout at the end.
        const buffer: string[] = [returnPrefix];

        // Clear extra lines if the current content's line count is lower than the previous.
        const viewportRows = getViewportRows(stream);

        if (visibleCount < previousVisible) {
            const previousHadTrailingNewline = previousOutput.endsWith("\n");
            const extraSlot = previousHadTrailingNewline ? 1 : 0;

            buffer.push(eraseLines(Math.min(previousVisible - visibleCount + extraSlot, viewportRows)), cursorUp(Math.min(visibleCount, viewportRows - 1)));
        } else {
            buffer.push(cursorUp(Math.min(previousVisible - 1, viewportRows - 1)));
        }

        for (let i = 0; i < visibleCount; i++) {
            const isLastLine = i === visibleCount - 1;

            // We do not write lines if the contents are the same. This prevents flickering during renders.
            if (nextLines[i] === previousLines[i]) {
                // Don't move past the last line when there's no trailing newline,
                // otherwise the cursor overshoots the rendered block.
                if (!isLastLine || hasTrailingNewline) {
                    buffer.push(cursorNextLine());
                }

                continue;
            }

            buffer.push(
                cursorTo(0)
                + nextLines[i]
                + eraseLineEnd
                // Don't append newline after the last line when the input
                // has no trailing newline (fullscreen mode).
                + (isLastLine && !hasTrailingNewline ? "" : "\n"),
            );
        }

        const cursorSuffix = buildCursorSuffix(visibleCount, activeCursor);

        buffer.push(cursorSuffix);

        stream.write(buffer.join(""));

        cursorWasShown = activeCursor !== undefined;
        previousCursorPosition = activeCursor ? { ...activeCursor } : undefined;
        previousOutput = string_;
        previousLines = nextLines;

        return true;
    };

    render.clear = () => {
        const prefix = buildReturnToBottomPrefix(cursorWasShown, previousLines.length, previousCursorPosition);

        stream.write(prefix + eraseLines(clampToViewport(previousLines.length, stream)));
        previousOutput = "";
        previousLines = [];
        previousCursorPosition = undefined;
        cursorWasShown = false;
    };

    render.done = () => {
        previousOutput = "";
        previousLines = [];
        previousCursorPosition = undefined;
        cursorWasShown = false;

        if (!showCursor) {
            stream.write(cursorShow);
            hasHiddenCursor = false;
        }
    };

    render.reset = () => {
        previousOutput = "";
        previousLines = [];
        previousCursorPosition = undefined;
        cursorWasShown = false;
    };

    render.sync = (string_: string) => {
        const activeCursor = cursorDirty ? cursorPosition : undefined;

        cursorDirty = false;

        const lines = string_.split("\n");

        previousOutput = string_;
        previousLines = lines;

        if (!activeCursor && cursorWasShown) {
            stream.write(cursorHide);
        }

        if (activeCursor) {
            stream.write(buildCursorSuffix(visibleLineCount(lines, string_), activeCursor));
        }

        previousCursorPosition = activeCursor ? { ...activeCursor } : undefined;
        cursorWasShown = activeCursor !== undefined;
    };

    render.setCursorPosition = (position: CursorPosition | undefined) => {
        cursorPosition = position;
        cursorDirty = true;
    };

    render.isCursorDirty = () => cursorDirty;
    render.willRender = (string_: string) => hasChanges(string_, getActiveCursor());

    return render;
};

const create = (stream: Writable, { incremental = false, showCursor = false }: { incremental?: boolean; showCursor?: boolean } = {}): LogUpdate => {
    if (incremental) {
        return createIncremental(stream, { showCursor });
    }

    return createStandard(stream, { showCursor });
};

const logUpdate: { create: typeof create } = { create };

export default logUpdate;
