import { describe, expect, it } from "vitest";

import { LineCounter, parse } from "../src";

describe(LineCounter, () => {
    it("records the start of every line", () => {
        expect.assertions(1);

        const counter = new LineCounter();

        parse("a: 1\nb: 2\nc: long line here\n", { lineCounter: counter });

        expect(counter.lineStarts).toStrictEqual([0, 5, 10, 28]);
    });

    it("resolves an offset to a 1-indexed line and column", () => {
        expect.assertions(4);

        const source = "a: 1\nb: 2\nc: long line here\n";
        const counter = new LineCounter();

        parse(source, { lineCounter: counter });

        expect(counter.linePos(0)).toStrictEqual({ col: 1, line: 1 });
        expect(counter.linePos(5)).toStrictEqual({ col: 1, line: 2 });
        expect(counter.linePos(10)).toStrictEqual({ col: 1, line: 3 });
        expect(counter.linePos(25)).toStrictEqual({ col: 16, line: 3 });
    });

    it("does not double-count lines the parser re-scans", () => {
        expect.assertions(1);

        // Anchors and merge keys drive the speculative rewind, so the same line
        // break is consumed more than once.
        const counter = new LineCounter();

        parse("d: &a\n  x: 1\ne:\n  <<: *a\n", { lineCounter: counter });

        expect(counter.lineStarts).toStrictEqual([0, 6, 13, 16, 25]);
    });

    it("is only populated when a counter is supplied", () => {
        expect.assertions(1);

        const counter = new LineCounter();

        parse("a: 1\nb: 2\n");

        expect(counter.lineStarts).toStrictEqual([0]);
    });
});
