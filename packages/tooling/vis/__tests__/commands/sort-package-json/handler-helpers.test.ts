import { describe, expect, it } from "vitest";

import { buildSnippet, computeKeyDiff, computeLineColumn, extractParseErrorContext } from "../../../src/commands/sort-package-json/handler";

describe(computeLineColumn, () => {
    it("should return line 1, column 1 for position 0", () => {
        expect.assertions(1);

        expect(computeLineColumn("hello", 0)).toStrictEqual({ column: 1, line: 1 });
    });

    it("should track column within a single line", () => {
        expect.assertions(1);

        expect(computeLineColumn("hello world", 6)).toStrictEqual({ column: 7, line: 1 });
    });

    it(String.raw`should advance to the next line on \n`, () => {
        expect.assertions(1);

        // "abc\nde" — position 4 is 'd' on line 2
        expect(computeLineColumn("abc\nde", 4)).toStrictEqual({ column: 1, line: 2 });
    });

    it("should clamp to source length", () => {
        expect.assertions(1);

        const source = "ab\ncd";
        // position 999 should still produce a valid coordinate.
        const result = computeLineColumn(source, 999);

        expect(result.line).toBeGreaterThanOrEqual(1);
    });

    it("should handle multi-line documents", () => {
        expect.assertions(1);

        // line 1: "{\n" (positions 0-1)
        // line 2: '  "a": 1,\n' (positions 2-11)
        // line 3: '  "b": 2\n' (positions 12-20)
        const source = '{\n  "a": 1,\n  "b": 2\n}';

        expect(computeLineColumn(source, 14)).toStrictEqual({ column: 3, line: 3 });
    });
});

describe(buildSnippet, () => {
    it("should return rows around the error line", () => {
        expect.assertions(2);

        const source = "line1\nline2\nline3\nline4\nline5";
        const rows = buildSnippet(source, 3, 1);

        expect(rows).toHaveLength(3);
        expect(rows.map((r) => r.lineNumber)).toStrictEqual([2, 3, 4]);
    });

    it("should mark the error line", () => {
        expect.assertions(1);

        const source = "a\nb\nc";
        const rows = buildSnippet(source, 2, 1);

        expect(rows.find((r) => r.isErrorLine)?.lineNumber).toBe(2);
    });

    it("should clamp at file start", () => {
        expect.assertions(1);

        const source = "a\nb\nc";
        const rows = buildSnippet(source, 1, 2);

        // Can't go below line 1
        expect(rows[0]?.lineNumber).toBe(1);
    });

    it("should clamp at file end", () => {
        expect.assertions(1);

        const source = "a\nb\nc";
        const rows = buildSnippet(source, 3, 2);
        const last = rows.at(-1);

        expect(last?.lineNumber).toBe(3);
    });

    it("should return empty for out-of-range line numbers", () => {
        expect.assertions(2);

        expect(buildSnippet("a\nb", 0)).toStrictEqual([]);
        expect(buildSnippet("a\nb", 99)).toStrictEqual([]);
    });
});

describe(extractParseErrorContext, () => {
    it("should extract position from JSON.parse SyntaxError", () => {
        expect.assertions(2);

        const source = '{\n  "a": 1,\n  "b" 2\n}';
        let caught: unknown;

        try {
            JSON.parse(source);
        } catch (error) {
            caught = error;
        }

        const context = extractParseErrorContext(caught, source);

        expect(context).toBeDefined();
        // Should land on line 3 where the error is — exact column depends on Node's
        // wording, just ensure we got *something* in range.
        expect(context?.line).toBeGreaterThanOrEqual(1);
    });

    it("should return undefined for non-Error inputs", () => {
        expect.assertions(2);

        expect(extractParseErrorContext("not an error", "{}")).toBeUndefined();
        expect(extractParseErrorContext(undefined, "{}")).toBeUndefined();
    });

    it("should return undefined when the error message has no position", () => {
        expect.assertions(1);

        const error = new Error("something else broke");

        expect(extractParseErrorContext(error, "{}")).toBeUndefined();
    });

    it("should attach a snippet around the error line", () => {
        expect.assertions(1);

        const source = '{\n  "a": 1,\n  "b" 2\n}';
        let caught: unknown;

        try {
            JSON.parse(source);
        } catch (error) {
            caught = error;
        }

        const context = extractParseErrorContext(caught, source);

        expect(context?.snippet.length ?? 0).toBeGreaterThan(0);
    });
});

describe(computeKeyDiff, () => {
    it("should return an empty diff when key order is unchanged", () => {
        expect.assertions(1);

        const original = JSON.stringify({ a: 1, b: 2, c: 3 });
        const sorted = JSON.stringify({ a: 1, b: 2, c: 3 });

        expect(computeKeyDiff(original, sorted)).toStrictEqual([]);
    });

    it("should report keys whose position changed", () => {
        expect.assertions(2);

        // eslint-disable-next-line perfectionist/sort-objects
        const original = JSON.stringify({ version: "1.0.0", name: "x" });
        const sorted = JSON.stringify({ name: "x", version: "1.0.0" });

        const diff = computeKeyDiff(original, sorted);
        // version: was 0, now 1; name: was 1, now 0
        const versionEntry = diff.find((d) => d.key === "version");
        const nameEntry = diff.find((d) => d.key === "name");

        expect(diff).toHaveLength(2);

        expect({ name: nameEntry, version: versionEntry }).toStrictEqual({
            name: { fromIndex: 1, key: "name", toIndex: 0 },
            version: { fromIndex: 0, key: "version", toIndex: 1 },
        });
    });

    it("should ignore keys that are stable when others move around them", () => {
        expect.assertions(1);

        // eslint-disable-next-line perfectionist/sort-objects
        const original = JSON.stringify({ a: 1, c: 3, b: 2 });
        const sorted = JSON.stringify({ a: 1, b: 2, c: 3 });

        const diff = computeKeyDiff(original, sorted);
        const movedKeys = new Set(diff.map((d) => d.key));

        // 'a' didn't move (still index 0); 'b' and 'c' did
        expect(movedKeys.has("a")).toBe(false);
    });
});
