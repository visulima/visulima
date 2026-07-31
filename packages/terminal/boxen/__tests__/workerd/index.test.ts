import { getStringWidth } from "@visulima/string";
import { describe, expect, it } from "vitest";

import { boxen, boxes, clearTerminalSizeCache } from "../../src";

/** Width of every rendered line, so a box can be checked for a ragged right edge. */
const lineWidths = (box: string): number[] => box.split("\n").map((line) => getStringWidth(line));

describe("boxen in workerd", () => {
    it("should run inside the workers runtime", () => {
        expect.assertions(2);

        // eslint-disable-next-line n/no-unsupported-features/node-builtins -- `navigator` is a workerd global, not a Node builtin
        expect((globalThis as { navigator?: { userAgent?: string } }).navigator?.userAgent).toBe("Cloudflare-Workers");
        // There is no TTY behind `process.stdout` in a Worker, which is the exact condition the
        // terminal-width probe has to survive.
        expect(process.stdout.columns).toBeUndefined();
    });

    describe("terminal width detection without a TTY", () => {
        it("should fall back to a finite default width instead of NaN", () => {
            expect.assertions(4);

            clearTerminalSizeCache();

            const box = boxen("foo");
            const widths = lineWidths(box);

            expect(widths).toStrictEqual([5, 5, 5]);
            expect(widths.every((width) => Number.isFinite(width))).toBe(true);
            expect(box).not.toContain("NaN");
            expect(box).toBe("┌───┐\n│foo│\n└───┘");
        });

        it("should cap an over-long line at the fallback terminal width", () => {
            expect.assertions(3);

            clearTerminalSizeCache();

            const box = boxen("x".repeat(200));
            const widths = lineWidths(box);

            // 80 columns is the documented fallback when no TTY can be probed.
            expect(Math.max(...widths)).toBe(80);
            expect(new Set(widths).size).toBe(1);
            expect(box.split("\n")).toHaveLength(5);
        });

        it("should not throw when the size cache is cleared repeatedly", () => {
            expect.assertions(1);

            clearTerminalSizeCache();
            clearTerminalSizeCache();

            expect(() => boxen("foo")).not.toThrow();
        });

        it("should honour explicit terminal dimensions over the probe", () => {
            expect.assertions(1);

            const box = boxen("x".repeat(40), { terminalColumns: 20 });

            expect(new Set(lineWidths(box))).toStrictEqual(new Set([20]));
        });
    });

    describe("borders", () => {
        // `none` is special-cased into "no border rows at all" and is covered separately below.
        it.each((Object.keys(boxes) as (keyof typeof boxes)[]).filter((style) => style !== "none"))("should render the %s border style", (style) => {
            expect.assertions(3);

            const chars = boxes[style];
            const lines = boxen("foo", { borderStyle: style, terminalColumns: 80 }).split("\n");

            expect(lines).toHaveLength(3);
            expect(lines[0]).toStrictEqual(chars.topLeft + chars.top.repeat(3) + chars.topRight);
            expect(lines[1]).toBe(`${chars.left}foo${chars.right}`);
        });

        it("should render a box with no border", () => {
            expect.assertions(1);

            expect(boxen("foo", { borderStyle: "none", terminalColumns: 80 })).toBe("foo");
        });

        it("should render a custom border style", () => {
            expect.assertions(1);

            expect(
                boxen("foo", {
                    borderStyle: { ...boxes.round, top: "=" },
                    terminalColumns: 80,
                }),
            ).toBe("╭===╮\n│foo│\n╰───╯");
        });

        it("should reject an unknown border style", () => {
            expect.assertions(1);

            // @ts-expect-error - invalid border style
            expect(() => boxen("foo", { borderStyle: "nope", terminalColumns: 80 })).toThrow("Invalid border style: nope");
        });

        it("should let a borderColor callback wrap the border characters", () => {
            expect.assertions(1);

            const box = boxen("foo", {
                borderColor: (border) => `\u001B[31m${border}\u001B[39m`,
                terminalColumns: 80,
            });

            expect(box).toContain("\u001B[31m┌\u001B[39m");
        });
    });

    describe("padding and margin", () => {
        it("should expand the box by a numeric padding", () => {
            expect.assertions(1);

            expect(boxen("foo", { padding: 1, terminalColumns: 80 })).toStrictEqual(
                ["┌─────────┐", "│         │", "│   foo   │", "│         │", "└─────────┘"].join("\n"),
            );
        });

        it("should accept per-side padding", () => {
            expect.assertions(1);

            expect(boxen("foo", { padding: { bottom: 0, left: 2, right: 1, top: 0 }, terminalColumns: 80 })).toBe("┌──────┐\n│  foo │\n└──────┘");
        });

        it("should indent by the left margin and pad with blank lines", () => {
            expect.assertions(2);

            const box = boxen("foo", { margin: 1, terminalColumns: 80 });
            const lines = box.split("\n");

            expect(lines[0]).toBe("");
            expect(lines[1]).toBe("   ┌───┐");
        });
    });

    describe("float", () => {
        it.each([
            ["left", 0],
            ["center", 37],
            ["right", 75],
        ] as const)("should position a %s-floated box", (float, expectedIndent) => {
            expect.assertions(1);

            const box = boxen("foo", { float, terminalColumns: 80 });
            const firstLine = box.split("\n")[0] as string;

            expect(firstLine.length - firstLine.trimStart().length).toStrictEqual(expectedIndent);
        });
    });

    describe("header and footer", () => {
        it.each(["left", "center", "right"] as const)("should place a %s-aligned header", (headerAlignment) => {
            expect.assertions(2);

            const box = boxen("content here", { headerAlignment, headerText: "title", terminalColumns: 80 });
            const widths = lineWidths(box);

            expect(box).toContain("title");
            expect(new Set(widths).size).toBe(1);
        });

        it.each(["left", "center", "right"] as const)("should place a %s-aligned footer", (footerAlignment) => {
            expect.assertions(2);

            const box = boxen("content here", { footerAlignment, footerText: "end", terminalColumns: 80 });
            const widths = lineWidths(box);

            expect(box).toContain("end");
            expect(new Set(widths).size).toBe(1);
        });

        it("should truncate a header that is wider than a fixed width", () => {
            expect.assertions(2);

            const box = boxen("foo", { headerText: "a very long title indeed", terminalColumns: 80, width: 10 });

            expect(new Set(lineWidths(box))).toStrictEqual(new Set([10]));
            expect(box).toBe("┌ a very ┐\n│foo     │\n└────────┘");
        });
    });

    describe("width and height", () => {
        it("should render a fixed width box", () => {
            expect.assertions(1);

            expect(boxen("foo", { terminalColumns: 80, width: 20 })).toStrictEqual(
                ["┌──────────────────┐", "│foo               │", "└──────────────────┘"].join("\n"),
            );
        });

        it("should wrap content that exceeds a fixed width", () => {
            expect.assertions(2);

            const box = boxen("foo bar foo bar", { terminalColumns: 80, width: 10 });

            expect(new Set(lineWidths(box))).toStrictEqual(new Set([10]));
            expect(box.split("\n").length).toBeGreaterThan(3);
        });

        it.each(["top", "center", "bottom"] as const)("should %s-align content in a fixed height box", (verticalAlignment) => {
            expect.assertions(2);

            const box = boxen("foo", { height: 7, terminalColumns: 80, verticalAlignment });
            const lines = box.split("\n");

            expect(lines).toHaveLength(7);
            expect(new Set(lineWidths(box))).toStrictEqual(new Set([5]));
        });
    });

    describe("fullscreen", () => {
        it("should size to the probed fallback dimensions", () => {
            expect.assertions(2);

            clearTerminalSizeCache();

            const box = boxen("foo", { fullscreen: true });
            const widths = lineWidths(box);

            expect(box.split("\n")).toHaveLength(24);
            expect(new Set(widths)).toStrictEqual(new Set([80]));
        });

        it("should accept a callback returning explicit dimensions", () => {
            expect.assertions(2);

            const box = boxen("foo", { fullscreen: () => [30, 4], terminalColumns: 80, terminalRows: 24 });

            expect(box.split("\n")).toHaveLength(4);
            expect(new Set(lineWidths(box))).toStrictEqual(new Set([30]));
        });

        it("should reject a callback returning a non-numeric size", () => {
            expect.assertions(1);

            expect(() => boxen("foo", { fullscreen: () => ["wide", 4] as unknown as [number, number], terminalColumns: 80, terminalRows: 24 })).toThrow(
                "both width and height must be numbers",
            );
        });
    });

    describe("wide, emoji and ANSI content", () => {
        it("should measure full-width CJK characters as two columns", () => {
            expect.assertions(1);

            expect(boxen("你好", { terminalColumns: 80 })).toBe("┌────┐\n│你好│\n└────┘");
        });

        it("should measure emoji as two columns", () => {
            expect.assertions(1);

            expect(boxen("🦄", { terminalColumns: 80 })).toBe("┌──┐\n│🦄│\n└──┘");
        });

        it("should ignore ANSI escapes when measuring content", () => {
            expect.assertions(2);

            const box = boxen("\u001B[31mfoo\u001B[39m", { terminalColumns: 80 });

            expect(box).toContain("\u001B[31mfoo\u001B[39m");
            expect(new Set(lineWidths(box))).toStrictEqual(new Set([5]));
        });

        it("should keep a mixed wide/ANSI line flush with the border", () => {
            expect.assertions(1);

            const box = boxen(`\u001B[32m你好\u001B[39m world\n短`, { terminalColumns: 80 });

            expect(new Set(lineWidths(box)).size).toBe(1);
        });
    });

    describe("text alignment", () => {
        it.each(["left", "center", "right"] as const)("should %s-align text", (textAlignment) => {
            expect.assertions(1);

            const box = boxen("foo\nlonger line", { terminalColumns: 80, textAlignment });

            expect(new Set(lineWidths(box))).toStrictEqual(new Set([13]));
        });
    });

    describe("option validation", () => {
        it("should reject non-function color options", () => {
            expect.assertions(2);

            // @ts-expect-error - invalid borderColor
            expect(() => boxen("foo", { borderColor: "red", terminalColumns: 80 })).toThrow("\"borderColor\" must be a function, got string");
            // @ts-expect-error - invalid fullscreen
            expect(() => boxen("foo", { fullscreen: 1, terminalColumns: 80 })).toThrow("\"fullscreen\" must be a boolean or a function, got number");
        });

        it("should expand tabs to spaces", () => {
            expect.assertions(1);

            expect(boxen("a\tb", { terminalColumns: 80 })).toBe("┌──────┐\n│a    b│\n└──────┘");
        });
    });
});
