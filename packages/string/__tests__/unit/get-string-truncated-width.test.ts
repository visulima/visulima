import { describe, expect, it } from "vitest";

import type { StringTruncatedWidthOptions } from "../../src";
import { getStringTruncatedWidth } from "../../src";

const getWidth = (input: string, options?: StringTruncatedWidthOptions): number => getStringTruncatedWidth(input, options).width;

const getTruncated = (input: string, options: StringTruncatedWidthOptions): string => {
    const ellipsis = options.ellipsis ?? "";
    const result = getStringTruncatedWidth(input, options);

    return `${input.slice(0, result.index)}${result.ellipsed ? ellipsis : ""}`;
};

describe("string Width", () => {
    describe("calculating the raw result", () => {
        it("supports strings that do not need to be truncated", () => {
            expect.assertions(4);
            const result = getStringTruncatedWidth("\u001B[31mhello", { ellipsis: "…", limit: Number.POSITIVE_INFINITY });

            expect(result.truncated).toBeFalsy();
            expect(result.ellipsed).toBeFalsy();
            expect(result.width).toBe(5);
            expect(result.index).toBe(10);
        });

        it("supports strings that do need to be truncated", () => {
            expect.assertions(4);
            const result = getStringTruncatedWidth("\u001B[31mhello", { ellipsis: "…", limit: 3 });

            expect(result.truncated).toBeTruthy();
            expect(result.ellipsed).toBeTruthy();
            expect(result.width).toBe(3);
            expect(result.index).toBe(6);
        });
    });

    describe("calculating the width of a string", () => {
        it("supports basic cases", () => {
            expect.assertions(19);
            expect(getWidth("hello")).toBe(5);
            expect(getWidth("\u001B[31mhello")).toBe(5);

            expect(getWidth("abcde")).toBe(5);
            expect(getWidth("古池や")).toBe(6);
            expect(getWidth("あいうabc")).toBe(9);
            expect(getWidth("あいう★")).toBe(8);
            expect(getWidth("±")).toBe(1);
            expect(getWidth("ノード.js")).toBe(9);
            expect(getWidth("你好")).toBe(4);
            expect(getWidth("안녕하세요")).toBe(10);
            expect(getWidth("A\uD83C\uDE00BC")).toBe(5);
            expect(getWidth("\u001B[31m\u001B[39m")).toBe(0);
            expect(getWidth("\u{231A}")).toBe(2);
            expect(getWidth("\u{2194}\u{FE0F}")).toBe(2);
            expect(getWidth("\u{1F469}")).toBe(2);
            expect(getWidth("\u{1F469}\u{1F3FF}")).toBe(2);
            expect(getWidth("\u{845B}\u{E0100}")).toBe(2);
            expect(getWidth("ปฏัก")).toBe(3);
            expect(getWidth("_\u0E34")).toBe(1);
        });

        it("supports control characters", () => {
            expect.assertions(6);

            expect(getWidth(String.fromCodePoint(0))).toBe(0);
            expect(getWidth(String.fromCodePoint(31))).toBe(0);
            expect(getWidth(String.fromCodePoint(127))).toBe(0);
            expect(getWidth(String.fromCodePoint(134))).toBe(0);
            expect(getWidth(String.fromCodePoint(159))).toBe(0);
            expect(getWidth("\u001B")).toBe(0);
        });

        it("supports tab characters", () => {
            expect.assertions(3);

            expect(getWidth("\t")).toBe(8);
            expect(getWidth("\t\t\t")).toBe(24);
            expect(getWidth("\0\t\0\t\0\t\0")).toBe(24);
        });

        it("supports combining characters", () => {
            expect.assertions(1);
            expect(getWidth("x\u0300")).toBe(1);
        });

        it("supports emoji characters", () => {
            expect.assertions(16);

            expect(getWidth("👶")).toBe(2);
            expect(getWidth("👶🏽")).toBe(2);
            expect(getWidth("👩‍👩‍👦‍👦")).toBe(2);
            expect(getWidth("👨‍❤️‍💋‍👨")).toBe(2);
            expect(getWidth("🏴‍☠️")).toBe(2);
            expect(getWidth("🏴󠁧󠁢󠁷󠁬󠁳󠁿")).toBe(2);
            expect(getWidth("🇸🇪")).toBe(2);
            expect(getWidth("🇺🇳")).toBe(2);

            expect(getWidth("👶".repeat(2))).toBe(4);
            expect(getWidth("👶🏽".repeat(2))).toBe(4);
            expect(getWidth("👩‍👩‍👦‍👦".repeat(2))).toBe(4);
            expect(getWidth("👨‍❤️‍💋‍👨".repeat(2))).toBe(4);
            expect(getWidth("🏴‍☠️".repeat(2))).toBe(4);
            expect(getWidth("🏴󠁧󠁢󠁷󠁬󠁳󠁿".repeat(2))).toBe(4);
            expect(getWidth("🇸🇪".repeat(2))).toBe(4);
            expect(getWidth("🇺🇳".repeat(2))).toBe(4);
        });

        it("supports all basic emojis", async () => {
            expect.assertions(1);
            // eslint-disable-next-line compat/compat
            const response = await fetch("https://raw.githubusercontent.com/muan/unicode-emoji-json/main/data-by-group.json");
            const data = await response.json();
            // eslint-disable-next-line @typescript-eslint/no-shadow
            const emojis = data.flatMap(({ emojis }) => emojis.map(({ emoji }) => emoji));

            const failures = emojis.filter((emoji: string) => {
                if (getWidth(emoji) !== 2) {
                    return true;
                }

                return false;
            });

            expect(failures).toStrictEqual([]);
        });

        it("supports unicode characters", () => {
            expect.assertions(44);
            // Map of Unicode characters to their expected display widths
            const unicodeChars = {
                // Whitespace and special spaces
                "\u00A0": 1, // NO-BREAK SPACE
                "\u2009": 1, // THIN SPACE
                "\u200A": 1, // HAIR SPACE
                "\u200B": 0, // ZERO WIDTH SPACE

                // Dashes and punctuation
                "\u2013": 2, // EN DASH
                "\u2014": 2, // EM DASH
                "\u2022": 2, // BULLET
                "…": 2, // HORIZONTAL ELLIPSIS

                // Arrows - Basic directional
                "\u2190": 2, // LEFTWARDS ARROW
                "\u2191": 2, // UPWARDS ARROW
                "\u2192": 2, // RIGHTWARDS ARROW
                "\u2193": 2, // DOWNWARDS ARROW
                "\u2194": 2, // LEFT RIGHT ARROW
                "\u2197": 2, // NORTH EAST ARROW
                "\u21A9": 1, // LEFTWARDS ARROW WITH HOOK

                // Arrows - Double and special
                "\u21C4": 1, // RIGHTWARDS ARROW OVER LEFTWARDS ARROW
                "\u21C5": 1, // UPWARDS ARROW LEFTWARDS OF DOWNWARDS ARROW
                "\u21C6": 1, // LEFTWARDS ARROW OVER RIGHTWARDS ARROW
                "\u21CB": 1, // LEFTWARDS HARPOON OVER RIGHTWARDS HARPOON
                "\u21CC": 1, // RIGHTWARDS HARPOON OVER LEFTWARDS HARPOON
                "\u21CE": 1, // LEFT RIGHT DOUBLE ARROW WITH STROKE
                "\u21D0": 1, // LEFTWARDS DOUBLE ARROW
                "\u21D2": 2, // RIGHTWARDS DOUBLE ARROW
                "\u21D4": 2, // LEFT RIGHT DOUBLE ARROW
                "\u21E8": 1, // RIGHTWARDS WHITE ARROW
                "\u21F5": 1, // DOWNWARDS ARROW LEFTWARDS OF UPWARDS ARROW

                // Mathematical and technical symbols
                "\u2217": 1, // ASTERISK OPERATOR
                "\u2261": 2, // IDENTICAL TO
                "\u226A": 2, // MUCH LESS-THAN
                "\u226B": 2, // MUCH GREATER-THAN
                "\u22EF": 1, // MIDLINE HORIZONTAL ELLIPSIS

                // Miscellaneous symbols
                "\u2690": 1, // WHITE FLAG
                "\u2691": 1, // BLACK FLAG
                "\u26A0": 1, // WARNING SIGN
                "\u2709": 1, // ENVELOPE
                "\u270E": 1, // LOWER RIGHT PENCIL
                "✔": 1, // HEAVY CHECK MARK
                "\u274F": 1, // LOWER RIGHT DROP-SHADOWED WHITE SQUARE
                "\u2750": 1, // UPPER RIGHT DROP-SHADOWED WHITE SQUARE

                // Brackets and delimiters
                "\u2770": 1, // HEAVY LEFT-POINTING ANGLE BRACKET ORNAMENT
                "\u2771": 1, // HEAVY RIGHT-POINTING ANGLE BRACKET ORNAMENT

                // Additional arrows and symbols
                "\u27A4": 1, // BLACK RIGHTWARDS ARROWHEAD
                "\u27F7": 1, // LONG LEFT RIGHT ARROW
                "\u2937": 1, // RIGHT-SIDE ARC CLOCKWISE ARROW
            };

            // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax
            for (const [char, expectedWidth] of Object.entries(unicodeChars)) {
                expect(getWidth(char), `${char} should have a width of ${expectedWidth}`).toBe(expectedWidth);
            }
        });

        it("supports japanese half-width characters", () => {
            expect.assertions(2);
            expect(getWidth("ﾊﾞ")).toBe(2);
            expect(getWidth("ﾊﾟ")).toBe(2);
        });
    });

    describe("truncating a string", () => {
        it("supports latin characters", () => {
            expect.assertions(14);
            expect(getTruncated("hello", { ellipsis: "…", limit: 10 })).toBe("hello");
            expect(getTruncated("hello", { ellipsis: "…", limit: 5 })).toBe("hello");
            expect(getTruncated("hello", { ellipsis: "…", limit: 4 })).toBe("he…");
            expect(getTruncated("hello", { ellipsis: "…", limit: 3 })).toBe("h…");
            expect(getTruncated("hello", { ellipsis: "…", limit: 2 })).toBe("…");
            expect(getTruncated("hello", { ellipsis: "…", limit: 1 })).toBe("");
            expect(getTruncated("hello", { ellipsis: "…", limit: 0 })).toBe("");

            expect(getTruncated("hello", { ellipsis: "..", limit: 10 })).toBe("hello");
            expect(getTruncated("hello", { ellipsis: "..", limit: 5 })).toBe("hello");
            expect(getTruncated("hello", { ellipsis: "..", limit: 4 })).toBe("he..");
            expect(getTruncated("hello", { ellipsis: "..", limit: 3 })).toBe("h..");
            expect(getTruncated("hello", { ellipsis: "..", limit: 2 })).toBe("..");
            expect(getTruncated("hello", { ellipsis: "..", limit: 1 })).toBe("");
            expect(getTruncated("hello", { ellipsis: "..", limit: 0 })).toBe("");
        });

        it("supports ansi characters and does not count them in width limit", () => {
            expect.assertions(13);

            expect(getTruncated("\u001B[31mhello", { ellipsis: "…", limit: 10 })).toBe("\u001B[31mhello");
            expect(getTruncated("\u001B[31mhello", { ellipsis: "…", limit: 5 })).toBe("\u001B[31mhello");
            expect(getTruncated("\u001B[31mhello", { ellipsis: "…", limit: 4 })).toBe("\u001B[31mhe…");
            expect(getTruncated("\u001B[31mhello", { ellipsis: "…", limit: 3 })).toBe("\u001B[31mh…");
            expect(getTruncated("\u001B[31mhello", { ellipsis: "…", limit: 2 })).toBe("\u001B[31m…");
            expect(getTruncated("\u001B[31mhello", { ellipsis: "…", limit: 1 })).toBe("\u001B[31m");
            expect(getTruncated("\u001B[31mhello", { ellipsis: "…", limit: 0 })).toBe("\u001B[31m");

            // Test with multiple ANSI codes
            expect(getTruncated("\u001B[31m\u001B[1mhello", { ellipsis: "…", limit: 5 })).toBe("\u001B[31m\u001B[1mhello");
            expect(getTruncated("\u001B[31m\u001B[1mhello", { ellipsis: "…", limit: 4 })).toBe("\u001B[31m\u001B[1mhe…");
            expect(getTruncated("\u001B[31m\u001B[1mhello", { ellipsis: "…", limit: 3 })).toBe("\u001B[31m\u001B[1mh…");
            expect(getTruncated("\u001B[31m\u001B[1mhello", { ellipsis: "…", limit: 2 })).toBe("\u001B[31m\u001B[1m…");
            expect(getTruncated("\u001B[31m\u001B[1mhello", { ellipsis: "…", limit: 1 })).toBe("\u001B[31m\u001B[1m");
            expect(getTruncated("\u001B[31m\u001B[1mhello", { ellipsis: "…", limit: 0 })).toBe("\u001B[31m\u001B[1m");
        });

        it("supports control characters", () => {
            expect.assertions(12);

            expect(getTruncated("\u0000\u0001\u0002\u0003", { ellipsis: "…", limit: 10 })).toBe("\u0000\u0001\u0002\u0003");
            expect(getTruncated("\u0000\u0001\u0002\u0003", { ellipsis: "…", limit: 4 })).toBe("\u0000\u0001\u0002\u0003");
            expect(getTruncated("\u0000\u0001\u0002\u0003", { ellipsis: "…", limit: 3 })).toBe("\u0000\u0001\u0002\u0003");
            expect(getTruncated("\u0000\u0001\u0002\u0003", { ellipsis: "…", limit: 2 })).toBe("\u0000\u0001\u0002\u0003");
            expect(getTruncated("\u0000\u0001\u0002\u0003", { ellipsis: "…", limit: 1 })).toBe("\u0000\u0001\u0002\u0003");
            expect(getTruncated("\u0000\u0001\u0002\u0003", { ellipsis: "…", limit: 0 })).toBe("\u0000\u0001\u0002\u0003");

            expect(getTruncated("\u0000\u0001\u0002\u0003", { controlWidth: 1, ellipsis: "…", limit: 10 })).toBe("\u0000\u0001\u0002\u0003");
            expect(getTruncated("\u0000\u0001\u0002\u0003", { controlWidth: 1, ellipsis: "…", limit: 4 })).toBe("\u0000\u0001\u0002\u0003");
            expect(getTruncated("\u0000\u0001\u0002\u0003", { controlWidth: 1, ellipsis: "…", limit: 3 })).toBe("\u0000…");
            expect(getTruncated("\u0000\u0001\u0002\u0003", { controlWidth: 1, ellipsis: "…", limit: 2 })).toBe("…");
            expect(getTruncated("\u0000\u0001\u0002\u0003", { controlWidth: 1, ellipsis: "…", limit: 1 })).toBe("");
            expect(getTruncated("\u0000\u0001\u0002\u0003", { controlWidth: 1, ellipsis: "…", limit: 0 })).toBe("");
        });

        it("supports CJK characters", () => {
            expect.assertions(8);

            expect(getTruncated("古池や", { ellipsis: "…", limit: 10 })).toBe("古池や");
            expect(getTruncated("古池や", { ellipsis: "…", limit: 6 })).toBe("古池や");
            expect(getTruncated("古池や", { ellipsis: "…", limit: 5 })).toBe("古…");
            expect(getTruncated("古池や", { ellipsis: "…", limit: 4 })).toBe("古…");
            expect(getTruncated("古池や", { ellipsis: "…", limit: 3 })).toBe("…");
            expect(getTruncated("古池や", { ellipsis: "…", limit: 2 })).toBe("…");
            expect(getTruncated("古池や", { ellipsis: "…", limit: 1 })).toBe("");
            expect(getTruncated("古池や", { ellipsis: "…", limit: 0 })).toBe("");
        });

        it("supports emoji characters", () => {
            expect.assertions(12);

            expect(getTruncated("👶👶🏽", { ellipsis: "…", limit: 10 })).toBe("👶👶🏽");
            expect(getTruncated("👶👶🏽", { ellipsis: "…", limit: 4 })).toBe("👶👶🏽");
            expect(getTruncated("👶👶🏽", { ellipsis: "…", limit: 3 })).toBe("…");
            expect(getTruncated("👶👶🏽", { ellipsis: "…", limit: 2 })).toBe("…");
            expect(getTruncated("👶👶🏽", { ellipsis: "…", limit: 1 })).toBe("");
            expect(getTruncated("👶👶🏽", { ellipsis: "…", limit: 0 })).toBe("");

            expect(getTruncated("👩‍👩‍👦‍👦👨‍❤️‍💋‍👨", { ellipsis: "…", limit: 10 })).toBe("👩‍👩‍👦‍👦👨‍❤️‍💋‍👨");
            expect(getTruncated("👩‍👩‍👦‍👦👨‍❤️‍💋‍👨", { ellipsis: "…", limit: 4 })).toBe("👩‍👩‍👦‍👦👨‍❤️‍💋‍👨");
            expect(getTruncated("👩‍👩‍👦‍👦👨‍❤️‍💋‍👨", { ellipsis: "…", limit: 3 })).toBe("…");
            expect(getTruncated("👩‍👩‍👦‍👦👨‍❤️‍💋‍👨", { ellipsis: "…", limit: 2 })).toBe("…");
            expect(getTruncated("👩‍👩‍👦‍👦👨‍❤️‍💋‍👨", { ellipsis: "…", limit: 1 })).toBe("");
            expect(getTruncated("👩‍👩‍👦‍👦👨‍❤️‍💋‍👨", { ellipsis: "…", limit: 0 })).toBe("");
        });
    });
});
