/* eslint-disable @stylistic/no-extra-parens, @typescript-eslint/restrict-plus-operands */
import type { Writable } from "node:stream";

import { cursorHide, cursorNextLine, cursorShow, cursorTo, cursorUp, eraseLineEnd, eraseLines } from "@visulima/ansi";

import type { CursorPosition, CursorShape } from "./cursor-helpers";
import { buildCursorOnlySequence, buildCursorShapeSequence, buildCursorSuffix, buildReturnToBottomPrefix, cursorPositionChanged } from "./cursor-helpers";

export type { CursorPosition, CursorShape } from "./cursor-helpers";

export type LogUpdate = {
    clear: () => void;
    done: () => void;
    isCursorDirty: () => boolean;
    reset: () => void;
    setCursorPosition: (position: CursorPosition | undefined) => void;
    setCursorShape: (shape: CursorShape | undefined) => void;
    sync: (string_: string) => void;
    willRender: (string_: string) => boolean;
    (string_: string): boolean;
};

// Treat `undefined` (no <Cursor shape>) and "default" as the same emitted state.
// This lets the diff against `currentShape` collapse "intent absent" and "intent
// = default" into one no-op once we've emitted the restore sequence.
const normalizeShape = (shape: CursorShape | undefined): CursorShape => shape ?? "default";

type CursorShapeTracker = {
    consumeDelta: () => string;
    /** Returns the restore-default sequence if a non-default shape was emitted this session; resets state. */
    consumeRestoreOnDone: () => string;
    isDirty: () => boolean;
    setPending: (shape: CursorShape | undefined) => void;
};

// DECSCUSR (cursor shape) state. `currentShape` is what the terminal currently
// displays; `pendingShape` is the latest intent from a <Cursor> component (or
// undefined when no <Cursor> is mounted). The diff is emitted alongside the
// next render write; on done() we restore the default so the parent shell
// never inherits a leaked shape.
const createCursorShapeTracker = (): CursorShapeTracker => {
    let currentShape: CursorShape | undefined;
    let pendingShape: CursorShape | undefined;

    return {
        consumeDelta: () => {
            if (normalizeShape(pendingShape) === normalizeShape(currentShape)) {
                return "";
            }

            const next = normalizeShape(pendingShape);

            currentShape = pendingShape;

            return buildCursorShapeSequence(next);
        },
        consumeRestoreOnDone: () => {
            const isNeedsRestore = normalizeShape(currentShape) !== "default";

            currentShape = undefined;
            pendingShape = undefined;

            return isNeedsRestore ? buildCursorShapeSequence("default") : "";
        },
        isDirty: () => normalizeShape(pendingShape) !== normalizeShape(currentShape),
        setPending: (shape) => {
            pendingShape = shape;
        },
    };
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

/**
 * Everything a frame writer needs to emit one changed frame.
 *
 * The renderer resolves all of this before choosing a writer, and owns the state updates that
 * follow — a writer only produces bytes.
 */
type Frame = {
    /** Cursor position to restore after the frame, or undefined when no &lt;Cursor> is mounted. */
    activeCursor: CursorPosition | undefined;

    content: string;

    /** `content` and `previous` split on newlines — the renderer has already split both. */
    contentLines: string[];

    previous: string;

    previousLines: string[];

    /** Cursor motion back to the bottom of the previous frame. Goes first. */
    returnPrefix: string;

    /** Pending DECSCUSR change. Goes before any cursor motion or erase. */
    shapeDelta: string;
};

/** Emits one changed frame to the stream. */
type WriteFrame = (frame: Frame, stream: Writable) => void;

/**
 * Erases the previous frame and writes the new one whole.
 *
 * Also the fallback inside the incremental writer, for the cases a line diff cannot express: the
 * first frame, and a bare newline.
 * @param frame The frame to write.
 * @param stream The stream to write it to.
 */
const writeFullFrame: WriteFrame = (frame, stream) => {
    const { activeCursor, content, contentLines, previousLines, returnPrefix, shapeDelta } = frame;
    const cursorSuffix = buildCursorSuffix(visibleLineCount(contentLines, content), activeCursor);

    stream.write(shapeDelta + returnPrefix + eraseLines(clampToViewport(previousLines.length, stream)) + content + cursorSuffix);
};

/**
 * Rewrites only the lines that changed since the previous frame.
 *
 * Skipping untouched lines is what stops the display flickering on every render.
 * @param frame The frame to write.
 * @param stream The stream to write it to.
 */

const writeIncrementalFrame: WriteFrame = (frame, stream) => {
    const { activeCursor, content, contentLines, previous, previousLines, returnPrefix, shapeDelta } = frame;
    const visibleCount = visibleLineCount(contentLines, content);

    // Nothing to diff against, or a bare newline: fall back to a full redraw.
    if (content === "\n" || previous.length === 0) {
        writeFullFrame(frame, stream);

        return;
    }

    const previousVisible = visibleLineCount(previousLines, previous);
    const hasTrailingNewline = content.endsWith("\n");

    // We aggregate all chunks for incremental rendering into a buffer, and then write them to stdout at the end.
    // Shape delta is prepended so DECSCUSR lands before any cursor motion/erase from this frame.
    const buffer: string[] = [shapeDelta, returnPrefix];

    // Clear extra lines if the current content's line count is lower than the previous.
    const viewportRows = getViewportRows(stream);

    if (visibleCount < previousVisible) {
        const isPreviousHadTrailingNewline = previous.endsWith("\n");
        const extraSlot = isPreviousHadTrailingNewline ? 1 : 0;

        buffer.push(eraseLines(Math.min(previousVisible - visibleCount + extraSlot, viewportRows)), cursorUp(Math.min(visibleCount, viewportRows - 1)));
    } else {
        buffer.push(cursorUp(Math.min(previousVisible - 1, viewportRows - 1)));
    }

    for (let index = 0; index < visibleCount; index += 1) {
        const isLastLine = index === visibleCount - 1;

        // We do not write lines if the contents are the same. This prevents flickering during renders.
        if (contentLines[index] === previousLines[index]) {
            // Don't move past the last line when there's no trailing newline,
            // otherwise the cursor overshoots the rendered block.
            if (!isLastLine || hasTrailingNewline) {
                buffer.push(cursorNextLine());
            }

            continue;
        }

        buffer.push(
            cursorTo(0)
            + contentLines[index]
            + eraseLineEnd
            // Don't append newline after the last line when the input
            // has no trailing newline (fullscreen mode).
            + (isLastLine && !hasTrailingNewline ? "" : "\n"),
        );
    }

    buffer.push(buildCursorSuffix(visibleCount, activeCursor));

    stream.write(buffer.join(""));
};

/**
 * Builds a log updater around a frame-writing strategy.
 *
 * Frame bookkeeping — hidden cursor, previous output and lines, cursor position and shape — is
 * identical whichever way frames reach the terminal, so it lives here once. The strategy is only
 * consulted for the one case the two modes disagree on: emitting a frame whose content changed.
 * @param stream The stream to render to.
 * @param options Renderer options.
 * @param options.showCursor Leave the terminal cursor visible while rendering.
 * @param writeFrame How to emit a changed frame.
 * @returns The log updater.
 */
const createLogUpdate = (stream: Writable, { showCursor = false }: { showCursor?: boolean }, writeFrame: WriteFrame): LogUpdate => {
    let previousLines: string[] = [];
    let previousOutput = "";
    let hasHiddenCursor = false;
    let cursorPosition: CursorPosition | undefined;
    let isCursorDirty = false;
    let previousCursorPosition: CursorPosition | undefined;
    let isCursorWasShown = false;
    const shapeTracker = createCursorShapeTracker();

    const getActiveCursor = () => (isCursorDirty ? cursorPosition : undefined);
    const hasChanges = (string_: string, activeCursor: CursorPosition | undefined): boolean => {
        const isCursorChanged = cursorPositionChanged(activeCursor, previousCursorPosition);

        return string_ !== previousOutput || isCursorChanged || shapeTracker.isDirty();
    };

    const commitCursor = (activeCursor: CursorPosition | undefined) => {
        previousCursorPosition = activeCursor ? { ...activeCursor } : undefined;
        isCursorWasShown = activeCursor !== undefined;
    };

    const forgetFrame = () => {
        previousOutput = "";
        previousLines = [];
        previousCursorPosition = undefined;
        isCursorWasShown = false;
    };

    const render = (string_: string) => {
        if (!showCursor && !hasHiddenCursor) {
            stream.write(cursorHide);
            hasHiddenCursor = true;
        }

        // Only use cursor if setCursorPosition was called since last render.
        // This ensures stale positions don't persist after component unmount.
        const activeCursor = getActiveCursor();

        isCursorDirty = false;
        const isCursorChanged = cursorPositionChanged(activeCursor, previousCursorPosition);

        if (!hasChanges(string_, activeCursor)) {
            return false;
        }

        const shapeDelta = shapeTracker.consumeDelta();

        const nextLines = string_.split("\n");
        const visibleCount = visibleLineCount(nextLines, string_);

        if (string_ === previousOutput && isCursorChanged) {
            stream.write(
                shapeDelta
                + buildCursorOnlySequence({
                    cursorPosition: activeCursor,
                    cursorWasShown: isCursorWasShown,
                    previousCursorPosition,
                    previousLineCount: previousLines.length,
                    visibleLineCount: visibleCount,
                }),
            );
            commitCursor(activeCursor);

            return true;
        }

        if (string_ === previousOutput && shapeDelta !== "") {
            // Output and cursor position unchanged, but shape did — emit the
            // bare DECSCUSR delta without redrawing the frame.
            stream.write(shapeDelta);
            commitCursor(activeCursor);

            return true;
        }

        writeFrame(
            {
                activeCursor,
                content: string_,
                contentLines: nextLines,
                previous: previousOutput,
                previousLines,
                returnPrefix: buildReturnToBottomPrefix(isCursorWasShown, previousLines.length, previousCursorPosition),
                shapeDelta,
            },
            stream,
        );

        previousOutput = string_;
        previousLines = nextLines;
        commitCursor(activeCursor);

        return true;
    };

    render.clear = () => {
        const prefix = buildReturnToBottomPrefix(isCursorWasShown, previousLines.length, previousCursorPosition);

        stream.write(prefix + eraseLines(clampToViewport(previousLines.length, stream)));
        forgetFrame();
    };

    render.done = () => {
        forgetFrame();

        // Restore the terminal's user-configured shape before handing the
        // cursor back. We only emit the sequence when we actually changed the
        // shape during this session so apps that never use <Cursor shape>
        // don't pay the byte tax.
        const restore = shapeTracker.consumeRestoreOnDone();

        if (restore !== "") {
            stream.write(restore);
        }

        if (!showCursor) {
            stream.write(cursorShow);
            hasHiddenCursor = false;
        }
    };

    render.reset = forgetFrame;

    render.sync = (string_: string) => {
        const activeCursor = getActiveCursor();

        isCursorDirty = false;

        const lines = string_.split("\n");

        previousOutput = string_;
        previousLines = lines;

        const shapeDelta = shapeTracker.consumeDelta();

        if (shapeDelta !== "") {
            stream.write(shapeDelta);
        }

        if (!activeCursor && isCursorWasShown) {
            stream.write(cursorHide);
        }

        if (activeCursor) {
            stream.write(buildCursorSuffix(visibleLineCount(lines, string_), activeCursor));
        }

        commitCursor(activeCursor);
    };

    render.setCursorPosition = (position: CursorPosition | undefined) => {
        cursorPosition = position;
        isCursorDirty = true;
    };

    render.setCursorShape = shapeTracker.setPending;

    // isCursorDirty signals "re-flush needed even if output bytes are
    // identical" — covers cursor position changes *and* shape changes.
    render.isCursorDirty = () => isCursorDirty || shapeTracker.isDirty();
    render.willRender = (string_: string) => hasChanges(string_, getActiveCursor());

    return render;
};

const create = (stream: Writable, { incremental = false, showCursor = false }: { incremental?: boolean; showCursor?: boolean } = {}): LogUpdate =>
    createLogUpdate(stream, { showCursor }, incremental ? writeIncrementalFrame : writeFullFrame);

const logUpdate: { create: typeof create } = { create };

export default logUpdate;
