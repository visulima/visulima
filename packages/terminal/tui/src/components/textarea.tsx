/* eslint-disable no-useless-assignment, react-x/no-array-index-key, react-x/set-state-in-effect, react/function-component-definition, unicorn/prefer-single-call */

/**
 * Multi-line text input component for Ink.
 *
 * Provides a full-featured textarea with cursor navigation, selection,
 * clipboard support, undo/redo, and viewport scrolling.
 */
import type { ReactElement } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import useClipboard from "../ink/hooks/use-clipboard";
import useInput from "../ink/hooks/use-input";
import usePaste from "../ink/hooks/use-paste";
import useTextBuffer from "../ink/hooks/use-text-buffer";
import { isInsertableInput } from "../ink/input-utils";
import Box from "./box";
import Text from "./text";

export type Props = {
    // eslint-disable-next-line jsdoc/informative-docs -- @default tag triggers false positive
    /** @default "" */
    readonly defaultValue?: string;

    /**
     * When true, all input is ignored and text is dimmed.
     * @default false
     */
    readonly isDisabled?: boolean;

    /**
     * When true, the component responds to keyboard input.
     * @default true
     */
    readonly isFocused?: boolean;

    /**
     * Maximum visible rows before viewport scrolling kicks in.
     * When set, the textarea will grow from `rows` to `maxRows` before scrolling.
     */
    readonly maxRows?: number;

    /**
     * Fires on every edit with the updated text.
     */
    readonly onChange?: (value: string) => void;

    /**
     * Fires when the user presses Meta+Enter or Ctrl+Enter.
     */
    readonly onSubmit?: (value: string) => void;

    /**
     * Greyed-out text shown when the textarea is empty.
     */
    readonly placeholder?: string;

    /**
     * Number of visible rows (viewport height).
     * @default 5
     */
    readonly rows?: number;

    /**
     * Show line numbers in the left gutter.
     * @default false
     */
    readonly showLineNumbers?: boolean;

    /**
     * Number of spaces inserted for a Tab key press.
     * @default 2
     */
    readonly tabSize?: number;
};

type SelectionRange = {
    endCol: number;
    endLine: number;
    startCol: number;
    startLine: number;
};

const getOrderedSelection = (cursor: { col: number; line: number }, anchor: { col: number; line: number }): SelectionRange => {
    if (anchor.line < cursor.line || (anchor.line === cursor.line && anchor.col < cursor.col)) {
        return { endCol: cursor.col, endLine: cursor.line, startCol: anchor.col, startLine: anchor.line };
    }

    return { endCol: anchor.col, endLine: anchor.line, startCol: cursor.col, startLine: cursor.line };
};

/**
 * A multi-line text input with cursor navigation, selection, clipboard, undo/redo,
 * paste support, and viewport scrolling.
 *
 * ```tsx
 * &lt;Textarea defaultValue="Hello\nWorld" rows={10} onChange={setValue} onSubmit={handleSubmit} />
 * ```
 */
export default function Textarea({
    defaultValue = "",
    isDisabled = false,
    isFocused = true,
    maxRows,
    onChange,
    onSubmit,
    placeholder,
    rows = 5,
    showLineNumbers = false,
    tabSize = 2,
}: Props): ReactElement {
    const buffer = useTextBuffer(defaultValue);
    const bufferRef = useRef(buffer);

    bufferRef.current = buffer;

    const { copy } = useClipboard();
    const [scrollOffset, setScrollOffset] = useState(0);

    const onChangeRef = useRef(onChange);

    onChangeRef.current = onChange;
    const onSubmitRef = useRef(onSubmit);

    onSubmitRef.current = onSubmit;

    // Fire onChange on value changes
    const previousValueRef = useRef(defaultValue);

    useEffect(() => {
        if (buffer.value !== previousValueRef.current) {
            previousValueRef.current = buffer.value;
            onChangeRef.current?.(buffer.value);
        }
    }, [buffer.value]);

    // Calculate visible rows
    const visibleRows = useMemo(() => {
        if (maxRows) {
            return Math.min(Math.max(rows, buffer.lines.length), maxRows);
        }

        return rows;
    }, [rows, maxRows, buffer.lines.length]);

    // Keep cursor in viewport
    useEffect(() => {
        setScrollOffset((offset) => {
            if (buffer.cursor.line < offset) {
                return buffer.cursor.line;
            }

            if (buffer.cursor.line >= offset + visibleRows) {
                return buffer.cursor.line - visibleRows + 1;
            }

            return offset;
        });
    }, [buffer.cursor.line, visibleRows]);

    const inputHandler = useCallback(
        (
            input: string,
            key: {
                backspace: boolean;
                ctrl: boolean;
                delete: boolean;
                downArrow: boolean;
                end: boolean;
                escape: boolean;
                home: boolean;
                leftArrow: boolean;
                meta: boolean;
                return: boolean;
                rightArrow: boolean;
                shift: boolean;
                tab: boolean;
                upArrow: boolean;
            },
        ) => {
            const b = bufferRef.current;

            // Submit: Meta+Enter or Ctrl+Enter
            if (key.return && (key.meta || key.ctrl)) {
                onSubmitRef.current?.(b.value);

                return;
            }

            // Enter: insert newline
            if (key.return) {
                b.newline();

                return;
            }

            if (key.escape) {
                b.clearSelection();

                return;
            }

            // Tab: insert spaces
            if (key.tab) {
                b.insert(" ".repeat(tabSize));

                return;
            }

            // Undo: Ctrl+Z
            if (key.ctrl && input === "z") {
                b.undo();

                return;
            }

            // Redo: Ctrl+Y or Ctrl+Shift+Z
            if (key.ctrl && (input === "y" || (key.shift && input === "Z"))) {
                b.redo();

                return;
            }

            // Copy: Ctrl+C (with selection)
            if (key.ctrl && input === "c" && b.hasSelection()) {
                copy(b.getSelectedText());

                return;
            }

            // Select all: Ctrl+Shift+A (Shift produces uppercase "A")
            if (key.ctrl && (input === "A" || (input === "a" && key.shift))) {
                b.selectAll();

                return;
            }

            // Navigation
            if (key.upArrow) {
                b.moveCursor("up", key.shift);

                return;
            }

            if (key.downArrow) {
                b.moveCursor("down", key.shift);

                return;
            }

            if (key.leftArrow) {
                b.moveCursor("left", key.shift);

                return;
            }

            if (key.rightArrow) {
                b.moveCursor("right", key.shift);

                return;
            }

            if (key.home) {
                if (key.ctrl) {
                    b.moveToStart(key.shift);
                } else {
                    b.moveToLineStart(key.shift);
                }

                return;
            }

            if (key.end) {
                if (key.ctrl) {
                    b.moveToEnd(key.shift);
                } else {
                    b.moveToLineEnd(key.shift);
                }

                return;
            }

            // Ctrl+A (no shift): home
            if (key.ctrl && input === "a") {
                b.moveToLineStart(key.shift);

                return;
            }

            // Ctrl+E: end
            if (key.ctrl && input === "e") {
                b.moveToLineEnd(key.shift);

                return;
            }

            // Editing
            if (key.backspace) {
                b.deleteBack();

                return;
            }

            if (key.delete) {
                b.deleteForward();

                return;
            }

            if (key.ctrl && input === "u") {
                b.deleteToLineStart();

                return;
            }

            if (key.ctrl && input === "k") {
                b.deleteToLineEnd();

                return;
            }

            if (key.ctrl && input === "w") {
                b.deleteWord();

                return;
            }

            // Printable character
            if (isInsertableInput(input, key)) {
                if (b.hasSelection()) {
                    b.replaceSelection(input);
                } else {
                    b.insert(input);
                }
            }
        },
        [copy, tabSize],
    );

    useInput(inputHandler, { isActive: isFocused && !isDisabled });

    // Paste handler
    const pasteHandler = useCallback((text: string) => {
        const b = bufferRef.current;

        if (b.hasSelection()) {
            b.replaceSelection(text);
        } else {
            b.insert(text);
        }
    }, []);

    usePaste(pasteHandler, { isActive: isFocused && !isDisabled });

    // Render
    const visibleLines = buffer.lines.slice(scrollOffset, scrollOffset + visibleRows);
    const lineNumberWidth = showLineNumbers ? String(buffer.lines.length).length + 1 : 0;

    // Selection range (ordered)
    const sel = buffer.anchor ? getOrderedSelection(buffer.cursor, buffer.anchor) : null;

    if (isDisabled) {
        return (
            <Box flexDirection="column">
                {visibleLines.map((line, index) => {
                    const lineNumber = scrollOffset + index;

                    return (
                        <Box key={lineNumber}>
                            {showLineNumbers
                                ? (
<Text dimColor>
{String(lineNumber + 1).padStart(lineNumberWidth)}
{" "}
</Text>
                                )
                                : undefined}
                            {}
                            <Text dimColor>{line || (lineNumber === 0 && placeholder ? placeholder : "")}</Text>
                        </Box>
                    );
                })}
            </Box>
        );
    }

    // Empty with placeholder
    if (buffer.value.length === 0 && placeholder) {
        const placeholderLines = placeholder.split("\n").slice(0, visibleRows);

        return (
            <Box flexDirection="column">
                {placeholderLines.map((pLine, index) => (
                    <Box key={index}>
                        {showLineNumbers
                            ? (
<Text dimColor>
{String(index + 1).padStart(lineNumberWidth)}
{" "}
</Text>
                            )
                            : undefined}
                        {index === 0
                            ? (
                            <Text>
                                <Text dimColor inverse>
                                    {pLine[0] ?? " "}
                                </Text>
                                <Text dimColor>{pLine.slice(1)}</Text>
                            </Text>
                            )
                            : (
                            <Text dimColor>{pLine}</Text>
                            )}
                    </Box>
                ))}
            </Box>
        );
    }

    return (
        <Box flexDirection="column">
            {visibleLines.map((line, index) => {
                const lineNumber = scrollOffset + index;
                const isCursorLine = lineNumber === buffer.cursor.line;

                return (
                    <Box key={lineNumber}>
                        {showLineNumbers
                            ? (
<Text dimColor={!isCursorLine}>
{String(lineNumber + 1).padStart(lineNumberWidth)}
{" "}
</Text>
                            )
                            : undefined}
                        <Text>{renderLine(line, lineNumber, buffer.cursor, sel)}</Text>
                    </Box>
                );
            })}
        </Box>
    );
}

/**
 * Render a single line with cursor and selection highlighting.
 */
function renderLine(line: string, lineNumber: number, cursor: { col: number; line: number }, sel: SelectionRange | null): ReactElement {
    const isCursorLine = lineNumber === cursor.line;
    const cursorCol = isCursorLine ? cursor.col : -1;

    // Determine if this line has any selection
    const lineSelected = sel && lineNumber >= sel.startLine && lineNumber <= sel.endLine;

    if (!lineSelected && !isCursorLine) {
        // No cursor, no selection — plain text
        return <>{line}</>;
    }

    if (!lineSelected) {
        // Cursor on this line, no selection
        const before = line.slice(0, cursorCol);
        const at = line[cursorCol];
        const after = line.slice(cursorCol + 1);

        return (
            <>
                {before}
                <Text inverse>{at ?? " "}</Text>
                {after}
            </>
        );
    }

    // Selection on this line
    const selStart = lineNumber === sel.startLine ? sel.startCol : 0;
    const selEnd = lineNumber === sel.endLine ? sel.endCol : line.length;

    const beforeSel = line.slice(0, selStart);
    const selected = line.slice(selStart, selEnd);
    const afterSel = line.slice(selEnd);

    if (isCursorLine && (cursorCol < selStart || cursorCol >= selEnd)) {
        // Cursor is outside the selection on this line
        const parts: ReactElement[] = [];
        let key = 0;

        if (cursorCol < selStart) {
            parts.push(<Text key={key++}>{line.slice(0, cursorCol)}</Text>);
            parts.push(
                <Text inverse key={key++}>
                    {line[cursorCol] ?? " "}
                </Text>,
            );
            parts.push(<Text key={key++}>{line.slice(cursorCol + 1, selStart)}</Text>);
            parts.push(
                <Text inverse key={key++}>
                    {selected}
                </Text>,
            );
            parts.push(<Text key={key++}>{afterSel}</Text>);
        } else {
            parts.push(<Text key={key++}>{beforeSel}</Text>);
            parts.push(
                <Text inverse key={key++}>
                    {selected}
                </Text>,
            );
            parts.push(<Text key={key++}>{line.slice(selEnd, cursorCol)}</Text>);
            parts.push(
                <Text inverse key={key++}>
                    {line[cursorCol] ?? " "}
                </Text>,
            );
            parts.push(<Text key={key++}>{line.slice(cursorCol + 1)}</Text>);
        }

        return <>{parts}</>;
    }

    // Cursor is within or no cursor — just show selection
    return (
        <>
            {beforeSel}
            <Text inverse>{selected}</Text>
            {afterSel}
        </>
    );
}

export { Textarea };
export type { Props as TextareaProps };
