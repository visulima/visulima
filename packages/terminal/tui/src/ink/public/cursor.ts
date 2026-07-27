/**
 * Public cursor surface (`@visulima/tui/cursor`).
 *
 * Escape-sequence builders and shape types used by components that place or
 * reshape the terminal cursor.
 */
export type { CursorOnlyInput, CursorPosition, CursorShape } from "../cursor-helpers";
export {
    buildCursorOnlySequence,
    buildCursorShapeSequence,
    buildCursorSuffix,
    buildReturnToBottom,
    buildReturnToBottomPrefix,
    cursorPositionChanged,
} from "../cursor-helpers";
