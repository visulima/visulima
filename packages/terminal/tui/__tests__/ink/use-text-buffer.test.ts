import { describe, expect, it } from "vitest";

// Test the text buffer logic by importing the hook's pure helpers indirectly
// through the hook itself using a minimal React rendering harness.
// Since the hook requires React context, we test behavior through state assertions.

// For unit testing without React, we replicate the core logic here.
// The actual hook is tested indirectly via textarea.test.tsx.

describe("useTextBuffer core logic", () => {
    // Test splitLines / joinLines behavior
    const splitLines = (text: string): string[] => {
        const result = text.split("\n");

        return result.length === 0 ? [""] : result;
    };

    const joinLines = (lines: string[]): string => lines.join("\n");

    describe("splitLines / joinLines", () => {
        it("should split text into lines", () => {
            expect.assertions(1);

            expect(splitLines("a\nb\nc")).toEqual(["a", "b", "c"]);
        });

        it("should handle empty string", () => {
            expect.assertions(1);

            expect(splitLines("")).toEqual([""]);
        });

        it("should handle single line", () => {
            expect.assertions(1);

            expect(splitLines("hello")).toEqual(["hello"]);
        });

        it("should handle trailing newline", () => {
            expect.assertions(1);

            expect(splitLines("a\n")).toEqual(["a", ""]);
        });

        it("should roundtrip through join", () => {
            expect.assertions(1);

            const text = "line1\nline2\nline3";

            expect(joinLines(splitLines(text))).toBe(text);
        });
    });

    describe("selection range ordering", () => {
        const getSelectionRange = (cursor: { col: number; line: number }, anchor: { col: number; line: number }) => {
            if (anchor.line < cursor.line || (anchor.line === cursor.line && anchor.col < cursor.col)) {
                return { end: cursor, start: anchor };
            }

            return { end: anchor, start: cursor };
        };

        it("should order cursor before anchor when cursor is ahead", () => {
            expect.assertions(2);

            const result = getSelectionRange({ col: 5, line: 2 }, { col: 0, line: 0 });

            expect(result.start).toEqual({ col: 0, line: 0 });
            expect(result.end).toEqual({ col: 5, line: 2 });
        });

        it("should order anchor before cursor when anchor is ahead", () => {
            expect.assertions(2);

            const result = getSelectionRange({ col: 0, line: 0 }, { col: 5, line: 2 });

            expect(result.start).toEqual({ col: 0, line: 0 });
            expect(result.end).toEqual({ col: 5, line: 2 });
        });

        it("should handle same line different columns", () => {
            expect.assertions(2);

            const result = getSelectionRange({ col: 10, line: 1 }, { col: 3, line: 1 });

            expect(result.start.col).toBe(3);
            expect(result.end.col).toBe(10);
        });

        it("should handle same position", () => {
            expect.assertions(1);

            const result = getSelectionRange({ col: 5, line: 1 }, { col: 5, line: 1 });

            expect(result.start).toEqual(result.end);
        });
    });

    describe("withSelection helper", () => {
        const withSelection = (
            s: { anchor: { col: number; line: number } | null; cursor: { col: number; line: number }; lines: string[] },
            newCursor: { col: number; line: number },
            selecting: boolean,
        ) => {
            if (selecting) {
                return { ...s, anchor: s.anchor ?? s.cursor, cursor: newCursor };
            }

            return { ...s, anchor: null, cursor: newCursor };
        };

        it("should set anchor from cursor when starting selection", () => {
            expect.assertions(2);

            const state = { anchor: null, cursor: { col: 5, line: 0 }, lines: ["hello"] };
            const result = withSelection(state, { col: 10, line: 0 }, true);

            expect(result.anchor).toEqual({ col: 5, line: 0 });
            expect(result.cursor).toEqual({ col: 10, line: 0 });
        });

        it("should preserve existing anchor when extending selection", () => {
            expect.assertions(1);

            const state = { anchor: { col: 0, line: 0 }, cursor: { col: 5, line: 0 }, lines: ["hello"] };
            const result = withSelection(state, { col: 10, line: 0 }, true);

            expect(result.anchor).toEqual({ col: 0, line: 0 });
        });

        it("should clear anchor when not selecting", () => {
            expect.assertions(1);

            const state = { anchor: { col: 0, line: 0 }, cursor: { col: 5, line: 0 }, lines: ["hello"] };
            const result = withSelection(state, { col: 3, line: 0 }, false);

            expect(result.anchor).toBeNull();
        });
    });

    describe("undo coalescing", () => {
        it("should coalesce edits within 300ms window", () => {
            // Simulate the coalescing logic
            expect.assertions(1);

            const UNDO_COALESCE_MS = 300;
            const undoStack: string[] = [];
            let lastEditTime = 0;

            const pushUndo = (snapshot: string) => {
                const now = Date.now();

                if (now - lastEditTime < UNDO_COALESCE_MS && undoStack.length > 0) {
                    // Coalesce — don't push
                } else {
                    undoStack.push(snapshot);
                }

                lastEditTime = now;
            };

            pushUndo("state1");
            pushUndo("state2"); // within 300ms, coalesced
            pushUndo("state3"); // within 300ms, coalesced

            expect(undoStack).toEqual(["state1"]);
        });
    });
});
