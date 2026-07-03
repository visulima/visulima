/* eslint-disable @stylistic/no-extra-parens, @typescript-eslint/restrict-plus-operands, default-case, jsdoc/lines-before-block, unicorn/no-immediate-mutation, unicorn/no-null */
/**
 * React hook for managing a multi-line text buffer with cursor, selection, and undo/redo.
 */
import { useCallback, useMemo, useRef, useState } from "react";

export type CursorPosition = {
    readonly col: number;
    readonly line: number;
};

export type TextBufferState = {
    readonly anchor: CursorPosition | null;
    readonly cursor: CursorPosition;
    readonly lines: ReadonlyArray<string>;
};

export type UseTextBufferResult = {
    readonly anchor: CursorPosition | null;
    readonly clearSelection: () => void;
    readonly cursor: CursorPosition;
    readonly deleteBack: () => void;
    readonly deleteForward: () => void;
    readonly deleteLine: () => void;
    readonly deleteSelection: () => void;
    readonly deleteToLineEnd: () => void;
    readonly deleteToLineStart: () => void;
    readonly deleteWord: () => void;
    readonly getSelectedText: () => string;
    readonly hasSelection: () => boolean;
    readonly insert: (text: string) => void;
    readonly lines: ReadonlyArray<string>;
    readonly moveCursor: (direction: "down" | "left" | "right" | "up", selecting?: boolean) => void;
    readonly moveToEnd: (selecting?: boolean) => void;
    readonly moveToLineEnd: (selecting?: boolean) => void;
    readonly moveToLineStart: (selecting?: boolean) => void;
    readonly moveToStart: (selecting?: boolean) => void;
    readonly newline: () => void;
    readonly redo: () => void;
    readonly replaceSelection: (text: string) => void;
    readonly selectAll: () => void;
    readonly setValue: (value: string) => void;
    readonly undo: () => void;
    readonly value: string;
};

type Snapshot = {
    readonly anchor: CursorPosition | null;
    readonly cursor: CursorPosition;
    readonly lines: ReadonlyArray<string>;
};

const UNDO_COALESCE_MS = 300;
const MAX_UNDO_STACK = 100;

// eslint-disable-next-line sonarjs/slow-regex -- false positive: linear backtracking on short input lines
const KILL_WORD_PATTERN = /\S+\s*$/;

const splitLines = (text: string): string[] => {
    const result = text.split("\n");

    return result.length === 0 ? [""] : result;
};

const joinLines = (lines: ReadonlyArray<string>): string => lines.join("\n");

/**
 * Create a snapshot from a state object (safe to call inside setState updater).
 */
const snapOf = (s: TextBufferState): Snapshot => {
    return {
        anchor: s.anchor,
        cursor: { ...s.cursor },
        lines: [...s.lines],
    };
};

/**
 * Apply cursor movement with optional selection extension.
 */
const withSelection = (s: TextBufferState, newCursor: CursorPosition, selecting: boolean): TextBufferState => {
    if (selecting) {
        return { ...s, anchor: s.anchor ?? s.cursor, cursor: newCursor };
    }

    return { ...s, anchor: null, cursor: newCursor };
};

/**
 * Get the ordered selection range (start &lt;= end).
 */
const getSelectionRange = (cursor: CursorPosition, anchor: CursorPosition): { end: CursorPosition; start: CursorPosition } => {
    if (anchor.line < cursor.line || (anchor.line === cursor.line && anchor.col < cursor.col)) {
        return { end: cursor, start: anchor };
    }

    return { end: anchor, start: cursor };
};

/**
 * Delete the selected text from a state, returning the new state or null if no selection.
 */
const deleteSelectionFromState = (s: TextBufferState): TextBufferState | null => {
    if (!s.anchor) {
        return null;
    }

    const { end, start } = getSelectionRange(s.cursor, s.anchor);
    const lines = [...s.lines];
    const before = lines[start.line]!.slice(0, start.col);
    const after = lines[end.line]!.slice(end.col);

    lines.splice(start.line, end.line - start.line + 1, before + after);

    return { anchor: null, cursor: start, lines };
};

/**
 * Insert text at cursor position in a given state, returning new state.
 */
const insertIntoState = (s: TextBufferState, text: string): TextBufferState => {
    const base = deleteSelectionFromState(s) ?? s;
    const lines = [...base.lines];
    const { col, line } = base.cursor;
    const before = lines[line]!.slice(0, col);
    const after = lines[line]!.slice(col);
    const inserted = splitLines(text);

    if (inserted.length === 1) {
        lines[line] = before + inserted[0] + after;

        return { anchor: null, cursor: { col: col + inserted[0]!.length, line }, lines };
    }

    const firstLine = before + inserted[0]!;
    const lastLine = inserted.at(-1)! + after;
    const middle = inserted.slice(1, -1);

    lines.splice(line, 1, firstLine, ...middle, lastLine);

    return {
        anchor: null,
        cursor: { col: inserted.at(-1)!.length, line: line + inserted.length - 1 },
        lines,
    };
};

/**
 * Hook managing a multi-line text buffer with cursor, selection, and undo/redo.
 */
const useTextBuffer = (initialValue = ""): UseTextBufferResult => {
    const [state, setState] = useState<TextBufferState>(() => {
        const lines = splitLines(initialValue);

        return {
            anchor: null,
            cursor: { col: lines.at(-1)!.length, line: lines.length - 1 },
            lines,
        };
    });

    // Undo/redo stacks
    const undoStack = useRef<Snapshot[]>([]);
    const redoStack = useRef<Snapshot[]>([]);
    const lastEditTime = useRef(0);

    // Track "desired column" for vertical movement
    const desiredCol = useRef(state.cursor.col);

    desiredCol.current = state.cursor.col;

    // Keep a ref to the latest state for use in callbacks that read but don't write via setState updater
    const stateRef = useRef(state);

    stateRef.current = state;

    const pushUndo = useCallback((snapshot: Snapshot) => {
        const now = Date.now();

        if (now - lastEditTime.current < UNDO_COALESCE_MS && undoStack.current.length > 0) {
            // Coalesce — don't push new entry
        } else {
            undoStack.current.push(snapshot);

            if (undoStack.current.length > MAX_UNDO_STACK) {
                undoStack.current.shift();
            }
        }

        redoStack.current = [];
        lastEditTime.current = now;
    }, []);

    const hasSelection = useCallback(() => stateRef.current.anchor !== null, []);

    const getSelectedText = useCallback((): string => {
        const s = stateRef.current;

        if (!s.anchor) {
            return "";
        }

        const { end, start } = getSelectionRange(s.cursor, s.anchor);

        if (start.line === end.line) {
            return s.lines[start.line]!.slice(start.col, end.col);
        }

        const result: string[] = [];

        result.push(s.lines[start.line]!.slice(start.col));

        for (let index = start.line + 1; index < end.line; index++) {
            result.push(s.lines[index]!);
        }

        result.push(s.lines[end.line]!.slice(0, end.col));

        return result.join("\n");
    }, []);

    const insert = useCallback(
        (text: string) => {
            setState((s) => {
                pushUndo(snapOf(s));

                return insertIntoState(s, text);
            });
        },
        [pushUndo],
    );

    const newline = useCallback(() => {
        setState((s) => {
            pushUndo(snapOf(s));
            const base = deleteSelectionFromState(s) ?? s;
            const lines = [...base.lines];
            const { col, line } = base.cursor;
            const before = lines[line]!.slice(0, col);
            const after = lines[line]!.slice(col);

            lines.splice(line, 1, before, after);

            return { anchor: null, cursor: { col: 0, line: line + 1 }, lines };
        });
    }, [pushUndo]);

    const deleteBack = useCallback(() => {
        setState((s) => {
            if (s.anchor) {
                pushUndo(snapOf(s));

                return deleteSelectionFromState(s) ?? s;
            }

            const { col, line } = s.cursor;

            if (col === 0 && line === 0) {
                return s;
            }

            pushUndo(snapOf(s));
            const lines = [...s.lines];

            if (col === 0) {
                const previousLine = lines[line - 1]!;
                const newCol = previousLine.length;

                lines[line - 1] = previousLine + lines[line]!;
                lines.splice(line, 1);

                return { anchor: null, cursor: { col: newCol, line: line - 1 }, lines };
            }

            lines[line] = lines[line]!.slice(0, col - 1) + lines[line]!.slice(col);

            return { anchor: null, cursor: { col: col - 1, line }, lines };
        });
    }, [pushUndo]);

    const deleteForward = useCallback(() => {
        setState((s) => {
            if (s.anchor) {
                pushUndo(snapOf(s));

                return deleteSelectionFromState(s) ?? s;
            }

            const { col, line } = s.cursor;
            const currentLine = s.lines[line]!;

            if (col === currentLine.length && line === s.lines.length - 1) {
                return s;
            }

            pushUndo(snapOf(s));
            const lines = [...s.lines];

            if (col === currentLine.length) {
                lines[line] = currentLine + lines[line + 1]!;
                lines.splice(line + 1, 1);

                return { anchor: null, cursor: s.cursor, lines };
            }

            lines[line] = currentLine.slice(0, col) + currentLine.slice(col + 1);

            return { anchor: null, cursor: s.cursor, lines };
        });
    }, [pushUndo]);

    const deleteLine = useCallback(() => {
        setState((s) => {
            pushUndo(snapOf(s));
            const lines = [...s.lines];
            const { line } = s.cursor;

            if (lines.length === 1) {
                return { anchor: null, cursor: { col: 0, line: 0 }, lines: [""] };
            }

            lines.splice(line, 1);
            const newLine = Math.min(line, lines.length - 1);

            return { anchor: null, cursor: { col: Math.min(s.cursor.col, lines[newLine]!.length), line: newLine }, lines };
        });
    }, [pushUndo]);

    const deleteToLineEnd = useCallback(() => {
        setState((s) => {
            pushUndo(snapOf(s));
            const lines = [...s.lines];
            const { col, line } = s.cursor;

            lines[line] = lines[line]!.slice(0, col);

            return { ...s, anchor: null, lines };
        });
    }, [pushUndo]);

    const deleteToLineStart = useCallback(() => {
        setState((s) => {
            pushUndo(snapOf(s));
            const lines = [...s.lines];
            const { col, line } = s.cursor;

            lines[line] = lines[line]!.slice(col);

            return { anchor: null, cursor: { col: 0, line }, lines };
        });
    }, [pushUndo]);

    const deleteWord = useCallback(() => {
        setState((s) => {
            pushUndo(snapOf(s));

            if (s.anchor) {
                return deleteSelectionFromState(s) ?? s;
            }

            const { col, line } = s.cursor;
            const before = s.lines[line]!.slice(0, col);
            const trimmed = before.replace(KILL_WORD_PATTERN, "");
            const lines = [...s.lines];

            lines[line] = trimmed + s.lines[line]!.slice(col);

            return { anchor: null, cursor: { col: trimmed.length, line }, lines };
        });
    }, [pushUndo]);

    const moveCursor = useCallback((direction: "down" | "left" | "right" | "up", selecting = false) => {
        setState((s) => {
            const { col, line } = s.cursor;
            let newLine = line;
            let newCol = col;

            switch (direction) {
                case "down": {
                    if (line < s.lines.length - 1) {
                        newLine = line + 1;
                        newCol = Math.min(desiredCol.current, s.lines[newLine]!.length);
                    }

                    break;
                }

                case "left": {
                    if (col > 0) {
                        newCol = col - 1;
                    } else if (line > 0) {
                        newLine = line - 1;
                        newCol = s.lines[newLine]!.length;
                    }

                    break;
                }

                case "right": {
                    const lineLength = s.lines[line]!.length;

                    if (col < lineLength) {
                        newCol = col + 1;
                    } else if (line < s.lines.length - 1) {
                        newLine = line + 1;
                        newCol = 0;
                    }

                    break;
                }

                case "up": {
                    if (line > 0) {
                        newLine = line - 1;
                        newCol = Math.min(desiredCol.current, s.lines[newLine]!.length);
                    }

                    break;
                }
            }

            return withSelection(s, { col: newCol, line: newLine }, selecting);
        });
    }, []);

    const moveToLineStart = useCallback((selecting = false) => {
        setState((s) => withSelection(s, { col: 0, line: s.cursor.line }, selecting));
    }, []);

    const moveToLineEnd = useCallback((selecting = false) => {
        setState((s) => withSelection(s, { col: s.lines[s.cursor.line]!.length, line: s.cursor.line }, selecting));
    }, []);

    const moveToStart = useCallback((selecting = false) => {
        setState((s) => withSelection(s, { col: 0, line: 0 }, selecting));
    }, []);

    const moveToEnd = useCallback((selecting = false) => {
        setState((s) => {
            const lastLine = s.lines.length - 1;

            return withSelection(s, { col: s.lines[lastLine]!.length, line: lastLine }, selecting);
        });
    }, []);

    const selectAll = useCallback(() => {
        setState((s) => {
            const lastLine = s.lines.length - 1;

            return {
                ...s,
                anchor: { col: 0, line: 0 },
                cursor: { col: s.lines[lastLine]!.length, line: lastLine },
            };
        });
    }, []);

    const clearSelection = useCallback(() => {
        setState((s) => (s.anchor ? { ...s, anchor: null } : s));
    }, []);

    const deleteSelection = useCallback(() => {
        setState((s) => {
            if (!s.anchor) {
                return s;
            }

            pushUndo(snapOf(s));

            return deleteSelectionFromState(s) ?? s;
        });
    }, [pushUndo]);

    const replaceSelection = useCallback(
        (text: string) => {
            setState((s) => {
                if (!s.anchor) {
                    // No selection — just insert
                    pushUndo(snapOf(s));

                    return insertIntoState(s, text);
                }

                pushUndo(snapOf(s));
                const base = deleteSelectionFromState(s) ?? s;

                return insertIntoState(base, text);
            });
        },
        [pushUndo],
    );

    const setValue = useCallback((value: string) => {
        const lines = splitLines(value);

        setState({
            anchor: null,
            cursor: { col: lines.at(-1)!.length, line: lines.length - 1 },
            lines,
        });
        undoStack.current = [];
        redoStack.current = [];
    }, []);

    const undo = useCallback(() => {
        const previous = undoStack.current.pop();

        if (!previous) {
            return;
        }

        // Push current state to redo via stateRef (safe — we read then immediately setState)
        redoStack.current.push(snapOf(stateRef.current));
        setState(previous);
    }, []);

    const redo = useCallback(() => {
        const next = redoStack.current.pop();

        if (!next) {
            return;
        }

        undoStack.current.push(snapOf(stateRef.current));
        setState(next);
    }, []);

    const value = useMemo(() => joinLines(state.lines), [state.lines]);

    return useMemo(() => {
        return {
            anchor: state.anchor,
            clearSelection,
            cursor: state.cursor,
            deleteBack,
            deleteForward,
            deleteLine,
            deleteSelection,
            deleteToLineEnd,
            deleteToLineStart,
            deleteWord,
            getSelectedText,
            hasSelection,
            insert,
            lines: state.lines,
            moveCursor,
            moveToEnd,
            moveToLineEnd,
            moveToLineStart,
            moveToStart,
            newline,
            redo,
            replaceSelection,
            selectAll,
            setValue,
            undo,
            value,
        };
    }, [
        state.anchor,
        state.cursor,
        state.lines,
        value,
        clearSelection,
        deleteBack,
        deleteForward,
        deleteLine,
        deleteSelection,
        deleteToLineEnd,
        deleteToLineStart,
        deleteWord,
        getSelectedText,
        hasSelection,
        insert,
        moveCursor,
        moveToEnd,
        moveToLineEnd,
        moveToLineStart,
        moveToStart,
        newline,
        redo,
        replaceSelection,
        selectAll,
        setValue,
        undo,
    ]);
};

export default useTextBuffer;

export { useTextBuffer };
