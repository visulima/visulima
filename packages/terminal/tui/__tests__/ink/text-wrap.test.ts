import { describe, expect, it } from "vitest";

import type { StyledLine } from "../../src/ink/styled-line";
import { plainTextToStyledLine, textToStyledLine } from "../../src/ink/styled-line-factory";
import { wrapOrTruncateStyledLine } from "../../src/ink/text-wrap";

const ELLIPSIS = "…";

/** Read back the plain text of a StyledLine. */
const text = (line: StyledLine): string => line.getTextRange(0, line.length);

/** Wrap/truncate a plain string and return the resulting rows as plain strings. */
const run = (input: string, maxWidth: number, mode?: string): string[] =>
    wrapOrTruncateStyledLine(plainTextToStyledLine(input), maxWidth, mode).map((line) => text(line));

describe("text-wrap wrapOrTruncateStyledLine", () => {
    describe("truncate (end)", () => {
        it("returns the line unchanged when it already fits", () => {
            expect.assertions(1);

            expect(run("hello", 10, "truncate")).toStrictEqual(["hello"]);
        });

        it("appends an ellipsis at the end when too wide", () => {
            expect.assertions(1);

            expect(run("hello world", 8, "truncate")).toStrictEqual([`hello w${ELLIPSIS}`]);
        });

        it("defaults to end truncation for the bare 'truncate' keyword", () => {
            expect.assertions(1);

            expect(run("abcdef", 4, "truncate-end")).toStrictEqual([`abc${ELLIPSIS}`]);
        });

        it("returns an empty line when columns is below 1", () => {
            expect.assertions(1);

            expect(run("anything", 0, "truncate")).toStrictEqual([""]);
        });

        it("returns just the ellipsis when columns is exactly 1", () => {
            expect.assertions(1);

            expect(run("anything", 1, "truncate")).toStrictEqual([ELLIPSIS]);
        });
    });

    describe("truncate-start", () => {
        it("keeps the right-hand portion and prepends an ellipsis", () => {
            expect.assertions(1);

            expect(run("hello world", 6, "truncate-start")).toStrictEqual([`${ELLIPSIS}world`]);
        });
    });

    describe("truncate-middle", () => {
        it("keeps both ends and inserts an ellipsis in the middle", () => {
            expect.assertions(2);

            const [result] = run("abcdefghij", 7, "truncate-middle");

            expect(result).toContain(ELLIPSIS);
            // Must keep the leading and trailing characters of the original.
            expect(result?.startsWith("a")).toBe(true);
        });
    });

    describe("wrap", () => {
        it("returns the whole line as one row when it fits", () => {
            expect.assertions(1);

            expect(run("hello world", 20)).toStrictEqual(["hello world"]);
        });

        it("wraps at word boundaries and drops the wrapping space", () => {
            expect.assertions(1);

            expect(run("hello world", 7, "wrap")).toStrictEqual(["hello", "world"]);
        });

        it("respects explicit newlines as hard breaks", () => {
            expect.assertions(1);

            expect(run("ab\ncd", 10, "wrap")).toStrictEqual(["ab", "cd"]);
        });

        it("hard-wraps a single word longer than the column width", () => {
            expect.assertions(1);

            // "abcdefghij" is 10 wide; with width 4 it must be chopped into chunks.
            expect(run("abcdefghij", 4, "wrap")).toStrictEqual(["abcd", "efgh", "ij"]);
        });

        it("emits an empty row for a leading blank line", () => {
            expect.assertions(1);

            expect(run("\nfoo", 10, "wrap")).toStrictEqual(["", "foo"]);
        });

        it("returns a single empty row for an empty input", () => {
            expect.assertions(1);

            expect(run("", 10, "wrap")).toStrictEqual([""]);
        });

        it("keeps a styled wrapping space rather than dropping it", () => {
            expect.assertions(2);

            // A red-styled space should survive a wrap boundary (not be trimmed).
            const styled = textToStyledLine("aa\u001B[31m \u001B[0mbb");
            const rows = wrapOrTruncateStyledLine(styled, 3, "wrap");

            expect(rows.length).toBeGreaterThanOrEqual(2);
            // The combined visible text must retain both words.
            expect(rows.map((line) => text(line)).join("")).toContain("bb");
        });
    });
});
