import { describe, expect, it } from "vitest";

import type { CssObject } from "../src/inspect-colors";
import { cssToAnsi, parseCss } from "../src/inspect-colors";

/**
 * Build a CssObject literal with sensible defaults; properties supplied by
 * the caller override the defaults. The internal shape uses `__proto__: null`
 * to match the runtime type — vitest doesn't care, but parseCss/cssToAnsi do.
 */
const makeCss = (overrides: Partial<CssObject> = {}): CssObject => {
    return {
        __proto__: null,
        backgroundColor: null,
        color: null,
        fontStyle: null,
        fontWeight: null,
        textDecorationColor: null,
        textDecorationLine: [],
        ...overrides,
    };
};

describe(parseCss, () => {
    describe("color names and core props", () => {
        it("should parse the color property", () => {
            expect.assertions(1);

            expect(parseCss("color: red").color).toBe("red");
        });

        it("should parse the background-color property", () => {
            expect.assertions(1);

            expect(parseCss("background-color: blue").backgroundColor).toBe("blue");
        });

        it("should parse font-style: italic", () => {
            expect.assertions(1);

            expect(parseCss("font-style: italic").fontStyle).toBe("italic");
        });

        it("should parse font-style: oblique", () => {
            expect.assertions(1);

            expect(parseCss("font-style: oblique").fontStyle).toBe("italic");
        });

        it("should parse font-style: oblique 14deg", () => {
            expect.assertions(1);

            expect(parseCss("font-style: oblique 14deg").fontStyle).toBe("italic");
        });

        it("should ignore other font-style values", () => {
            expect.assertions(1);

            expect(parseCss("font-style: normal").fontStyle).toBeNull();
        });

        it("should parse font-weight: bold", () => {
            expect.assertions(1);

            expect(parseCss("font-weight: bold").fontWeight).toBe("bold");
        });

        it("should ignore font-weight: normal", () => {
            expect.assertions(1);

            expect(parseCss("font-weight: normal").fontWeight).toBeNull();
        });

        it("should parse multiple properties separated by semicolons", () => {
            expect.assertions(2);

            const parsed = parseCss("color: red; background-color: blue");

            expect(parsed.color).toBe("red");
            expect(parsed.backgroundColor).toBe("blue");
        });

        it("should ignore unknown properties", () => {
            expect.assertions(1);

            expect(parseCss("garbage-prop: foo; color: red").color).toBe("red");
        });
    });

    describe("text-decoration parsing", () => {
        it("should parse text-decoration with line type and color", () => {
            expect.assertions(2);

            const parsed = parseCss("text-decoration: underline red");

            expect(parsed.textDecorationLine).toContain("underline");
            expect(parsed.textDecorationColor).toEqual([255, 0, 0]);
        });

        it("should parse multiple decoration lines", () => {
            expect.assertions(2);

            const parsed = parseCss("text-decoration: underline overline line-through");

            expect(parsed.textDecorationLine).toContain("underline");
            expect(parsed.textDecorationLine).toContain("overline");
        });

        it("should parse text-decoration-color property by itself", () => {
            expect.assertions(1);

            const parsed = parseCss("text-decoration-color: rgb(10, 20, 30)");

            expect(parsed.textDecorationColor).toEqual([10, 20, 30]);
        });

        it("should ignore invalid text-decoration-color values", () => {
            expect.assertions(1);

            const parsed = parseCss("text-decoration-color: nonsense");

            expect(parsed.textDecorationColor).toBeNull();
        });

        it("should parse text-decoration-line property by itself", () => {
            expect.assertions(2);

            const parsed = parseCss("text-decoration-line: underline overline");

            expect(parsed.textDecorationLine).toContain("underline");
            expect(parsed.textDecorationLine).toContain("overline");
        });

        it("should not include unsupported line types", () => {
            expect.assertions(1);

            const parsed = parseCss("text-decoration-line: underline blink");

            expect(parsed.textDecorationLine).not.toContain("blink");
        });

        it("should ignore text-decoration args that are neither colors nor line types", () => {
            expect.assertions(2);

            const parsed = parseCss("text-decoration: bogus underline");

            expect(parsed.textDecorationLine).toContain("underline");
            expect(parsed.textDecorationLine).not.toContain("bogus");
        });
    });

    describe("empty values", () => {
        it("should skip a semicolon-terminated value that is empty", () => {
            expect.assertions(1);

            // "color: ;" trims to an empty value and is dropped; the later color still applies.
            const parsed = parseCss("color: ; color: red");

            expect(parsed.color).toBe("red");
        });

        it("should skip a trailing value that is empty at end of string", () => {
            expect.assertions(1);

            const parsed = parseCss("color:");

            expect(parsed.color).toBeNull();
        });
    });

    describe("color string parsing (via background-color → cssToAnsi)", () => {
        it("should accept css keyword colors that map to a named ANSI", () => {
            expect.assertions(1);

            // `red` keyword resolves through the named switch in cssToAnsi
            const ansi = cssToAnsi(makeCss({ color: "red" }));

            expect(ansi).toContain("[31m");
        });

        it("should accept #rrggbb hex colors", () => {
            expect.assertions(1);

            const ansi = cssToAnsi(makeCss({ color: "#ff8800" }));

            expect(ansi).toBe("[38;2;255;136;0m");
        });

        it("should accept short #rgb hex colors", () => {
            expect.assertions(1);

            const ansi = cssToAnsi(makeCss({ color: "#f80" }));

            expect(ansi).toBe("[38;2;255;136;0m");
        });

        it("should accept rgb() colors", () => {
            expect.assertions(1);

            const ansi = cssToAnsi(makeCss({ color: "rgb(10, 20, 30)" }));

            expect(ansi).toBe("[38;2;10;20;30m");
        });

        it("should accept rgba() colors (alpha ignored)", () => {
            expect.assertions(1);

            const ansi = cssToAnsi(makeCss({ color: "rgba(10, 20, 30, 0.5)" }));

            expect(ansi).toBe("[38;2;10;20;30m");
        });

        it("should clamp rgb values above 255", () => {
            expect.assertions(1);

            const ansi = cssToAnsi(makeCss({ color: "rgb(300, 400, 500)" }));

            expect(ansi).toBe("[38;2;255;255;255m");
        });

        it("should clamp negative rgb values to 0", () => {
            expect.assertions(1);

            const ansi = cssToAnsi(makeCss({ color: "rgb(-10, -20, -30)" }));

            expect(ansi).toBe("[38;2;0;0;0m");
        });

        it("should accept color keywords that resolve to a hex code", () => {
            expect.assertions(1);

            const ansi = cssToAnsi(makeCss({ color: "rebeccapurple" }));

            expect(ansi).toBe("[38;2;102;51;153m");
        });

        it("should accept hsl() colors", () => {
            expect.assertions(1);

            // pure red in hsl
            const ansi = cssToAnsi(makeCss({ color: "hsl(0, 100%, 50%)" }));

            expect(ansi).toBe("[38;2;255;0;0m");
        });

        it("should accept hsl() with negative hue", () => {
            expect.assertions(1);

            // -60 wraps to 300
            const ansi = cssToAnsi(makeCss({ color: "hsl(-60, 100%, 50%)" }));

            expect(ansi).toBe("[38;2;255;0;255m");
        });

        it("should accept hsl() at h<120 boundary", () => {
            expect.assertions(1);

            const ansi = cssToAnsi(makeCss({ color: "hsl(90, 100%, 50%)" }));

            expect(ansi).toContain("[38;2;");
        });

        it("should accept hsl() at h<180 boundary", () => {
            expect.assertions(1);

            const ansi = cssToAnsi(makeCss({ color: "hsl(150, 100%, 50%)" }));

            expect(ansi).toContain("[38;2;");
        });

        it("should accept hsl() at h<240 boundary", () => {
            expect.assertions(1);

            const ansi = cssToAnsi(makeCss({ color: "hsl(210, 100%, 50%)" }));

            expect(ansi).toContain("[38;2;");
        });

        it("should accept hsl() at h<300 boundary", () => {
            expect.assertions(1);

            const ansi = cssToAnsi(makeCss({ color: "hsl(270, 100%, 50%)" }));

            expect(ansi).toContain("[38;2;");
        });

        it("should accept hsla() with alpha component", () => {
            expect.assertions(1);

            const ansi = cssToAnsi(makeCss({ color: "hsla(0, 100%, 50%, 0.5)" }));

            expect(ansi).toBe("[38;2;255;0;0m");
        });

        it("should fall back to default reset for unparseable colors", () => {
            expect.assertions(1);

            const ansi = cssToAnsi(makeCss({ color: "totally-not-a-color" }));

            expect(ansi).toBe("[39m");
        });
    });

    describe("colors as rgb tuples", () => {
        it("should accept array tuple for color", () => {
            expect.assertions(1);

            const ansi = cssToAnsi(makeCss({ color: [12, 34, 56] as unknown as string }));

            expect(ansi).toBe("[38;2;12;34;56m");
        });

        it("should accept array tuple for backgroundColor", () => {
            expect.assertions(1);

            const ansi = cssToAnsi(makeCss({ backgroundColor: [12, 34, 56] as unknown as string }));

            expect(ansi).toBe("[48;2;12;34;56m");
        });
    });
});

describe(cssToAnsi, () => {
    describe("named foreground colors", () => {
        it.each([
            ["black", "[30m"],
            ["blue", "[34m"],
            ["cyan", "[36m"],
            ["green", "[32m"],
            ["magenta", "[35m"],
            ["red", "[31m"],
            ["white", "[37m"],
            ["yellow", "[33m"],
        ])("should map color: %s to its named ANSI escape", (color, expected) => {
            expect.assertions(1);

            expect(cssToAnsi(makeCss({ color }))).toBe(expected);
        });
    });

    describe("named background colors", () => {
        it.each([
            ["black", "[40m"],
            ["blue", "[44m"],
            ["cyan", "[46m"],
            ["green", "[42m"],
            ["magenta", "[45m"],
            ["red", "[41m"],
            ["white", "[47m"],
            ["yellow", "[43m"],
        ])("should map background-color: %s to its named ANSI escape", (bg, expected) => {
            expect.assertions(1);

            expect(cssToAnsi(makeCss({ backgroundColor: bg }))).toBe(expected);
        });
    });

    describe("background color fallback", () => {
        it("should fall back to default-bg reset for unparseable background colors", () => {
            expect.assertions(1);

            expect(cssToAnsi(makeCss({ backgroundColor: "totally-not-a-color" }))).toBe("[49m");
        });

        it("should write rgb truecolor for unrecognized background hex", () => {
            expect.assertions(1);

            expect(cssToAnsi(makeCss({ backgroundColor: "#abcdef" }))).toBe("[48;2;171;205;239m");
        });
    });

    describe("font weight transitions", () => {
        it("should emit bold when fontWeight changes to bold", () => {
            expect.assertions(1);

            expect(cssToAnsi(makeCss({ fontWeight: "bold" }))).toContain("[1m");
        });

        it("should emit reset-bold when fontWeight changes away from bold", () => {
            expect.assertions(1);

            const previous = makeCss({ fontWeight: "bold" });
            const next = makeCss({ fontWeight: null });

            expect(cssToAnsi(next, previous)).toContain("[22m");
        });

        it("should emit nothing when fontWeight is unchanged", () => {
            expect.assertions(1);

            const previous = makeCss({ fontWeight: "bold" });
            const next = makeCss({ fontWeight: "bold" });

            expect(cssToAnsi(next, previous)).not.toContain("[1m");
        });
    });

    describe("font style transitions", () => {
        it("should emit italic on", () => {
            expect.assertions(1);

            expect(cssToAnsi(makeCss({ fontStyle: "italic" }))).toContain("[3m");
        });

        it("should emit italic off when fontStyle changes back to null", () => {
            expect.assertions(1);

            const previous = makeCss({ fontStyle: "italic" });
            const next = makeCss({ fontStyle: null });

            expect(cssToAnsi(next, previous)).toContain("[23m");
        });
    });

    describe("text-decoration transitions", () => {
        it("should emit underline on", () => {
            expect.assertions(1);

            expect(cssToAnsi(makeCss({ textDecorationLine: ["underline"] }))).toContain("[4m");
        });

        it("should emit underline off when removed", () => {
            expect.assertions(1);

            const previous = makeCss({ textDecorationLine: ["underline"] });
            const next = makeCss({ textDecorationLine: [] });

            expect(cssToAnsi(next, previous)).toContain("[24m");
        });

        it("should emit overline on", () => {
            expect.assertions(1);

            expect(cssToAnsi(makeCss({ textDecorationLine: ["overline"] }))).toContain("[53m");
        });

        it("should emit overline off when removed", () => {
            expect.assertions(1);

            const previous = makeCss({ textDecorationLine: ["overline"] });
            const next = makeCss({ textDecorationLine: [] });

            expect(cssToAnsi(next, previous)).toContain("[55m");
        });

        it("should emit line-through on", () => {
            expect.assertions(1);

            expect(cssToAnsi(makeCss({ textDecorationLine: ["line-through"] }))).toContain("[9m");
        });

        it("should emit line-through off when removed", () => {
            expect.assertions(1);

            const previous = makeCss({ textDecorationLine: ["line-through"] });
            const next = makeCss({ textDecorationLine: [] });

            expect(cssToAnsi(next, previous)).toContain("[29m");
        });

        it("should emit text-decoration-color truecolor and reset", () => {
            expect.assertions(2);

            const ansi = cssToAnsi(makeCss({ textDecorationColor: [10, 20, 30] }));

            expect(ansi).toContain("[58;2;10;20;30m");

            const previous = makeCss({ textDecorationColor: [10, 20, 30] });
            const next = makeCss({ textDecorationColor: null });

            expect(cssToAnsi(next, previous)).toContain("[59m");
        });
    });

    describe("color reset transitions", () => {
        it("should emit foreground reset when color clears", () => {
            expect.assertions(1);

            const previous = makeCss({ color: "red" });
            const next = makeCss({ color: null });

            expect(cssToAnsi(next, previous)).toContain("[39m");
        });

        it("should emit background reset when background clears", () => {
            expect.assertions(1);

            const previous = makeCss({ backgroundColor: "blue" });
            const next = makeCss({ backgroundColor: null });

            expect(cssToAnsi(next, previous)).toContain("[49m");
        });

        it("should not emit anything when nothing changes between calls", () => {
            expect.assertions(1);

            const previous = makeCss({ color: "red" });
            const next = makeCss({ color: "red" });

            expect(cssToAnsi(next, previous)).toBe("");
        });
    });
});
