import { green, red } from "@visulima/colorize";
import { getStringWidth } from "@visulima/string";
import { describe, expect, it, vi } from "vitest";

import { boxen } from "../../src";

vi.mock(import("terminal-size"), () => {
    return {
        default: () => {
            return {
                columns: 80,
                rows: 24,
            };
        },
    };
});

// Assert every rendered line of a box occupies the same number of display columns.
const expectUniformWidth = (box: string): void => {
    const widths = box.split("\n").map((line) => getStringWidth(line));

    expect(new Set(widths).size).toBe(1);
};

describe("wide-character and ANSI content", () => {
    it.each(["left", "center", "right"] as const)("renders CJK content with uniform width (%s)", (textAlignment) => {
        expect.assertions(1);

        const box = boxen("你好世界\nこんにちは", { padding: 1, textAlignment });

        expectUniformWidth(box);
    });

    it.each(["left", "center", "right"] as const)("renders emoji content with uniform width (%s)", (textAlignment) => {
        expect.assertions(1);

        const box = boxen("🌍 hello 🚀", { textAlignment, width: 20 });

        expectUniformWidth(box);
    });

    it("renders fullwidth headerText with uniform width", () => {
        expect.assertions(1);

        const box = boxen("foo", { headerAlignment: "center", headerText: "見出し" });

        expectUniformWidth(box);
    });

    it("preserves pre-colored ANSI input and keeps uniform width", () => {
        expect.assertions(2);

        const box = boxen(`${red("error")} ${green("ok")}`, { padding: 1 });

        expectUniformWidth(box);
        // The original styling codes survive untouched.
        expect(box).toContain("[31m");
    });
});

describe("regression: wide grapheme in a narrow box (boxen-1)", () => {
    it.each(["right", "center", "left"] as const)("does not throw for a fullwidth char at width 3 (%s)", (textAlignment) => {
        expect.assertions(1);

        expect(() => boxen("あ", { textAlignment, width: 3 })).not.toThrow();
    });
});

describe("regression: multi-code-unit border char with header/footer (boxen-7)", () => {
    // `𝄞` (U+1D11E) is one display column but two UTF-16 code units, so a
    // code-unit slice would remove the wrong number of columns.
    const astralBorder = {
        bottom: "𝄞",
        bottomLeft: "+",
        bottomRight: "+",
        left: "|",
        right: "|",
        top: "𝄞",
        topLeft: "+",
        topRight: "+",
    };

    it.each(["left", "right"] as const)("keeps the top border aligned with %s headerText", (headerAlignment) => {
        expect.assertions(1);

        const box = boxen("content here", { borderStyle: astralBorder, headerAlignment, headerText: "hi" });

        expectUniformWidth(box);
    });

    it("keeps the bottom border aligned with left footerText", () => {
        expect.assertions(1);

        const box = boxen("content here", { borderStyle: astralBorder, footerAlignment: "left", footerText: "bye" });

        expectUniformWidth(box);
    });
});
