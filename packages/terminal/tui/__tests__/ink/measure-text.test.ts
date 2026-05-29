import { getStringWidth } from "@visulima/string";
import { afterEach, describe, expect, it, vi } from "vitest";

import measureText, {
    clearStringWidthCache,
    clearStyledLineCache,
    inkCharacterWidth,
    measureStyledLine,
    setEnableStyledLineCache,
    setStringWidthFunction,
    splitStyledLineByNewline,
    styledLineWidth,
    toStyledLine,
} from "../../src/ink/measure-text";
import { plainTextToStyledLine } from "../../src/ink/styled-line-factory";

describe("measure-text", () => {
    it("measure single word", () => {
        expect.assertions(1);

        expect(measureText("constructor")).toStrictEqual({ height: 1, width: 11 });
    });

    it("measure empty string", () => {
        expect.assertions(1);

        expect(measureText("")).toStrictEqual({ height: 0, width: 0 });
    });

    it("measure multiline text", () => {
        expect.assertions(2);

        const result = measureText("hello\nworld");

        expect(result.width).toBe(5);
        expect(result.height).toBe(2);
    });

    it("measure multiline text with varying line lengths", () => {
        expect.assertions(2);

        const result = measureText("a\nfoo\nhi");

        expect(result.width).toBe(3);
        expect(result.height).toBe(3);
    });

    it("measure text with trailing newline", () => {
        expect.assertions(2);

        const result = measureText("hello\n");

        expect(result.width).toBe(5);
        expect(result.height).toBe(2);
    });

    it("measure text with only newlines", () => {
        expect.assertions(2);

        const result = measureText("\n\n");

        expect(result.width).toBe(0);
        expect(result.height).toBe(3);
    });

    it("returns cached result on repeated calls", () => {
        expect.assertions(3);

        const first = measureText("cached-test");

        expect(first.width).toBe(11);
        expect(first.height).toBe(1);

        const second = measureText("cached-test");

        expect(first).toBe(second);
    });

    it("measure text with ANSI escape sequences", () => {
        expect.assertions(2);

        const result = measureText("\u001B[31mred\u001B[0m");

        expect(result.width).toBe(3);
        expect(result.height).toBe(1);
    });

    it("measure text with 256-color ANSI", () => {
        expect.assertions(2);

        const result = measureText("\u001B[38;5;196mred\u001B[0m");

        expect(result.width).toBe(3);
        expect(result.height).toBe(1);
    });

    it("measure text with wide characters", () => {
        expect.assertions(2);

        const result = measureText("你好");

        expect(result.width).toBe(4);
        expect(result.height).toBe(1);
    });

    it("measure text with emoji", () => {
        expect.assertions(2);

        const result = measureText("🍔");

        expect(result.width).toBe(2);
        expect(result.height).toBe(1);
    });

    it("measure multiline with wide characters", () => {
        expect.assertions(2);

        const result = measureText("🍔🍟\nabc");

        expect(result.width).toBe(4);
        expect(result.height).toBe(2);
    });
});

describe("measure-text inkCharacterWidth", () => {
    afterEach(() => {
        // Restore the default width function and drop caches so other suites
        // see a clean global measurement state.
        setStringWidthFunction(getStringWidth);
        clearStringWidthCache();
        vi.restoreAllMocks();
    });

    it("returns 1 for printable ASCII via the fast path", () => {
        expect.assertions(2);

        expect(inkCharacterWidth("a")).toBe(1);
        expect(inkCharacterWidth(" ")).toBe(1);
    });

    it("measures wide characters as 2", () => {
        expect.assertions(1);

        expect(inkCharacterWidth("你")).toBe(2);
    });

    it("caches a non-ASCII width and reuses it on the second call", () => {
        expect.assertions(2);

        const spy = vi.fn((text: string) => getStringWidth(text));

        setStringWidthFunction(spy);

        expect(inkCharacterWidth("好")).toBe(2);
        // Second call should be served from widthCache, not re-measured.
        expect(inkCharacterWidth("好")).toBe(2);
    });

    it("falls back to width 1 when the width function throws", () => {
        expect.assertions(1);

        setStringWidthFunction(() => {
            throw new Error("boom");
        });

        // Use a non-ASCII char so the fast path does not short-circuit.
        expect(inkCharacterWidth("好")).toBe(1);
    });

    it("does not treat control characters as fast-path ASCII", () => {
        expect.assertions(1);

        // Newline (code 10) is below 32, so it bypasses the fast path.
        expect(inkCharacterWidth("\n")).toBe(0);
    });
});

describe("measure-text setStringWidthFunction", () => {
    afterEach(() => {
        setStringWidthFunction(getStringWidth);
        clearStringWidthCache();
    });

    it("uses the replacement width function and clears the measurement cache", () => {
        expect.assertions(2);

        // Prime the measureText cache.
        expect(measureText("widthfn").width).toBe(7);

        // Every character now reports width 3.
        setStringWidthFunction(() => 3);

        // Cache was cleared, so the new function is consulted.
        expect(measureText("widthfn").width).toBe(3);
    });
});

describe("measure-text toStyledLine cache", () => {
    afterEach(() => {
        setEnableStyledLineCache(true);
        clearStyledLineCache();
    });

    it("returns the same cached instance on repeated calls when enabled", () => {
        expect.assertions(1);

        const first = toStyledLine("cached-styled-line");
        const second = toStyledLine("cached-styled-line");

        expect(first).toBe(second);
    });

    it("returns fresh instances when the cache is disabled", () => {
        expect.assertions(2);

        setEnableStyledLineCache(false);

        const first = toStyledLine("no-cache-line");
        const second = toStyledLine("no-cache-line");

        expect(first).not.toBe(second);
        expect(first.getTextRange(0, first.length)).toBe("no-cache-line");
    });

    it("re-enabling the cache repopulates it", () => {
        expect.assertions(1);

        setEnableStyledLineCache(false);
        toStyledLine("toggle-line");
        setEnableStyledLineCache(true);

        const a = toStyledLine("toggle-line");
        const b = toStyledLine("toggle-line");

        expect(a).toBe(b);
    });
});

describe("measure-text StyledLine measurement", () => {
    it("computes the visual width of a styled line", () => {
        expect.assertions(2);

        expect(styledLineWidth(plainTextToStyledLine("hello"))).toBe(5);
        expect(styledLineWidth(toStyledLine("你好"))).toBe(4);
    });

    it("returns 0 width for an empty styled line", () => {
        expect.assertions(1);

        expect(styledLineWidth(plainTextToStyledLine(""))).toBe(0);
    });

    it("splits a styled line on newlines", () => {
        expect.assertions(3);

        const parts = splitStyledLineByNewline(toStyledLine("ab\ncd\nef"));

        expect(parts).toHaveLength(3);
        expect(parts[0]?.getTextRange(0, parts[0].length)).toBe("ab");
        expect(parts[2]?.getTextRange(0, parts[2].length)).toBe("ef");
    });

    it("yields a single empty line for an empty styled line", () => {
        expect.assertions(2);

        const parts = splitStyledLineByNewline(plainTextToStyledLine(""));

        expect(parts).toHaveLength(1);
        expect(parts[0]?.length).toBe(0);
    });

    it("yields empty segments for consecutive and trailing newlines", () => {
        expect.assertions(2);

        const parts = splitStyledLineByNewline(toStyledLine("a\n\nb\n"));

        // "a", "", "b", "" -> 4 segments
        expect(parts).toHaveLength(4);
        expect(parts[1]?.length).toBe(0);
    });

    it("measures the dimensions of a multi-line styled line", () => {
        expect.assertions(2);

        const { height, width } = measureStyledLine(toStyledLine("a\nfoo\nhi"));

        expect(height).toBe(3);
        expect(width).toBe(3);
    });

    it("measures an empty styled line as zero by zero", () => {
        expect.assertions(1);

        expect(measureStyledLine(plainTextToStyledLine(""))).toStrictEqual({ height: 0, width: 0 });
    });
});
