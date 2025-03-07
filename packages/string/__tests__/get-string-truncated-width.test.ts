import { describe, expect, it } from "vitest";

import type { StringWidthOptions } from "../src";
import { getStringTruncatedWidth } from "../src";

const getWidth = (input: string, options?: StringWidthOptions): number => getStringTruncatedWidth(input, options).width;

const getTruncated = (input: string, options: StringWidthOptions): string => {
    const ellipsis = options.ellipsis ?? "";
    const result = getStringTruncatedWidth(input, options);
    return `${input.slice(0, result.index)}${result.ellipsed ? ellipsis : ""}`;
};

describe("string Width", () => {
    describe("calculating the raw result", () => {
        it("supports strings that do not need to be truncated", () => {
            const result = getStringTruncatedWidth("\u001B[31mhello", { ellipsis: "…", limit: Number.POSITIVE_INFINITY });

            expect(result.truncated).toBeFalsy();
            expect(result.ellipsed).toBeFalsy();
            expect(result.width).toBe(5);
            expect(result.index).toBe(10);
        });

        it("supports strings that do need to be truncated", () => {
            const result = getStringTruncatedWidth("\u001B[31mhello", { ellipsis: "…", limit: 3 });

            expect(result.truncated).toBeTruthy();
            expect(result.ellipsed).toBeTruthy();
            expect(result.width).toBe(2);
            expect(result.index).toBe(7);
        });
    });

    describe("calculating the width of a string", () => {
        it("supports basic cases", () => {
            expect(getWidth("hello")).toBe(5);
            expect(getWidth("\u001B[31mhello")).toBe(5);

            expect(getWidth("abcde")).toBe(5);
            expect(getWidth("古池や")).toBe(6);
            expect(getWidth("あいうabc")).toBe(9);
            expect(getWidth("あいう★")).toBe(7);
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
            expect(getWidth(String.fromCodePoint(0))).toBe(0);
            expect(getWidth(String.fromCodePoint(31))).toBe(0);
            expect(getWidth(String.fromCodePoint(127))).toBe(0);
            expect(getWidth(String.fromCodePoint(134))).toBe(0);
            expect(getWidth(String.fromCodePoint(159))).toBe(0);
            expect(getWidth("\u001B")).toBe(0);
        });

        it("supports tab characters", () => {
            expect(getWidth("\t")).toBe(8);
            expect(getWidth("\t\t\t")).toBe(24);
            expect(getWidth("\0\t\0\t\0\t\0")).toBe(24);
        });

        it("supports combining characters", () => {
            expect(getWidth("x\u0300")).toBe(1);
        });

        it("supports emoji characters", () => {
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

        it("supports all basic emojis", async (t) => {
            const response = await fetch("https://raw.githubusercontent.com/muan/unicode-emoji-json/main/data-by-group.json");
            const data = await response.json();
            const emojis = data.flatMap(({ emojis }) => emojis.map(({ emoji }) => emoji));

            const failures = emojis.filter((emoji) => {
                if (getWidth(emoji) !== 2) {
                    return true;
                }
            });

            expect(failures).toEqual([]);
        });

        it("supports unicode characters", () => {
            const unicodeChars = {
                "\u00A0": 1,
                "\u2009": 1,
                "\u200A": 1,
                "\u200B": 1,
                "\u2013": 1,
                "\u2014": 1,
                "\u2022": 1,
                "…": 1,
                "\u2190": 1,
                "\u2191": 1,
                "\u2192": 1,
                "\u2193": 1,
                "\u2194": 2,
                "\u2197": 2,
                "\u21A9": 2,
                "\u21C4": 1,
                "\u21C5": 1,
                "\u21C6": 1,
                "\u21CB": 1,
                "\u21CC": 1,
                "\u21CE": 1,
                "\u21D0": 1,
                "\u21D2": 1,
                "\u21D4": 1,
                "\u21E8": 1,
                "\u21F5": 1,
                "\u2217": 1,
                "\u2261": 1,
                "\u226A": 1,
                "\u226B": 1,
                "\u22EF": 1,
                "\u2690": 1,
                "\u2691": 1,
                "\u26A0": 2,
                "\u2709": 2,
                "\u270E": 1,
                "✔": 2,
                "\u274F": 1,
                "\u2750": 1,
                "\u2770": 1,
                "\u2771": 1,
                "\u27A4": 1,
                "\u27F7": 1,
                "\u2937": 1,
            };

            for (const [char, expectedWidth] of Object.entries(unicodeChars)) {
                expect(getWidth(char), `${char} should have a width of ${expectedWidth}`).toBe(expectedWidth);
            }
        });

        it("supports japanese half-width characters", () => {
            expect(getWidth("ﾊﾞ")).toBe(2);
            expect(getWidth("ﾊﾟ")).toBe(2);
        });
    });

    describe("truncating a string", () => {
        it("supports latin characters", () => {
            expect(getTruncated("hello", { ellipsis: "…", limit: 10 })).toBe("hello");
            expect(getTruncated("hello", { ellipsis: "…", limit: 5 })).toBe("hello");
            expect(getTruncated("hello", { ellipsis: "…", limit: 4 })).toBe("hel…");
            expect(getTruncated("hello", { ellipsis: "…", limit: 3 })).toBe("he…");
            expect(getTruncated("hello", { ellipsis: "…", limit: 2 })).toBe("h…");
            expect(getTruncated("hello", { ellipsis: "…", limit: 1 })).toBe("…");
            expect(getTruncated("hello", { ellipsis: "…", limit: 0 })).toBe("");

            expect(getTruncated("hello", { ellipsis: "..", limit: 10 })).toBe("hello");
            expect(getTruncated("hello", { ellipsis: "..", limit: 5 })).toBe("hello");
            expect(getTruncated("hello", { ellipsis: "..", limit: 4 })).toBe("he..");
            expect(getTruncated("hello", { ellipsis: "..", limit: 3 })).toBe("h..");
            expect(getTruncated("hello", { ellipsis: "..", limit: 2 })).toBe("..");
            expect(getTruncated("hello", { ellipsis: "..", limit: 1 })).toBe("");
            expect(getTruncated("hello", { ellipsis: "..", limit: 0 })).toBe("");
        });

        it("supports ansi characters", () => {
            expect(getTruncated("\u001B[31mhello", { ellipsis: "…", limit: 10 })).toBe("\u001B[31mhello");
            expect(getTruncated("\u001B[31mhello", { ellipsis: "…", limit: 5 })).toBe("\u001B[31mhello");
            expect(getTruncated("\u001B[31mhello", { ellipsis: "…", limit: 4 })).toBe("\u001B[31mhel…");
            expect(getTruncated("\u001B[31mhello", { ellipsis: "…", limit: 3 })).toBe("\u001B[31mhe…");
            expect(getTruncated("\u001B[31mhello", { ellipsis: "…", limit: 2 })).toBe("\u001B[31mh…");
            expect(getTruncated("\u001B[31mhello", { ellipsis: "…", limit: 1 })).toBe("\u001B[31m…");
            expect(getTruncated("\u001B[31mhello", { ellipsis: "…", limit: 0 })).toBe("\u001B[31m");

            expect(getTruncated("\u001B[31mhello", { ellipsis: "..", limit: 10 })).toBe("\u001B[31mhello");
            expect(getTruncated("\u001B[31mhello", { ellipsis: "..", limit: 5 })).toBe("\u001B[31mhello");
            expect(getTruncated("\u001B[31mhello", { ellipsis: "..", limit: 4 })).toBe("\u001B[31mhe..");
            expect(getTruncated("\u001B[31mhello", { ellipsis: "..", limit: 3 })).toBe("\u001B[31mh..");
            expect(getTruncated("\u001B[31mhello", { ellipsis: "..", limit: 2 })).toBe("\u001B[31m..");
            expect(getTruncated("\u001B[31mhello", { ellipsis: "..", limit: 1 })).toBe("\u001B[31m");
            expect(getTruncated("\u001B[31mhello", { ellipsis: "..", limit: 0 })).toBe("\u001B[31m");
        });

        it("supports control characters", () => {
            expect(getTruncated("\u0000\u0001\u0002\u0003", { ellipsis: "…", limit: 10 })).toBe("\u0000\u0001\u0002\u0003");
            expect(getTruncated("\u0000\u0001\u0002\u0003", { ellipsis: "…", limit: 4 })).toBe("\u0000\u0001\u0002\u0003");
            expect(getTruncated("\u0000\u0001\u0002\u0003", { ellipsis: "…", limit: 3 })).toBe("\u0000\u0001\u0002\u0003");
            expect(getTruncated("\u0000\u0001\u0002\u0003", { ellipsis: "…", limit: 2 })).toBe("\u0000\u0001\u0002\u0003");
            expect(getTruncated("\u0000\u0001\u0002\u0003", { ellipsis: "…", limit: 1 })).toBe("\u0000\u0001\u0002\u0003");
            expect(getTruncated("\u0000\u0001\u0002\u0003", { ellipsis: "…", limit: 0 })).toBe("\u0000\u0001\u0002\u0003");

            expect(getTruncated("\u0000\u0001\u0002\u0003", { ellipsis: "…", limit: 10 , controlWidth: 1 })).toBe("\u0000\u0001\u0002\u0003");
            expect(getTruncated("\u0000\u0001\u0002\u0003", { ellipsis: "…", limit: 4 , controlWidth: 1 })).toBe("\u0000\u0001\u0002\u0003");
            expect(getTruncated("\u0000\u0001\u0002\u0003", { ellipsis: "…", limit: 3 , controlWidth: 1 })).toBe("\u0000\u0001…");
            expect(getTruncated("\u0000\u0001\u0002\u0003", { ellipsis: "…", limit: 2 , controlWidth: 1 })).toBe("\u0000…");
            expect(getTruncated("\u0000\u0001\u0002\u0003", { ellipsis: "…", limit: 1 , controlWidth: 1 })).toBe("…");
            expect(getTruncated("\u0000\u0001\u0002\u0003", { ellipsis: "…", limit: 0 , controlWidth: 1 })).toBe("");
        });

        it("supports CJK characters", () => {
            expect(getTruncated("古池や", { ellipsis: "…", limit: 10 })).toBe("古池や");
            expect(getTruncated("古池や", { ellipsis: "…", limit: 6 })).toBe("古池や");
            expect(getTruncated("古池や", { ellipsis: "…", limit: 5 })).toBe("古池…");
            expect(getTruncated("古池や", { ellipsis: "…", limit: 4 })).toBe("古…");
            expect(getTruncated("古池や", { ellipsis: "…", limit: 3 })).toBe("古…");
            expect(getTruncated("古池や", { ellipsis: "…", limit: 2 })).toBe("…");
            expect(getTruncated("古池や", { ellipsis: "…", limit: 1 })).toBe("…");
            expect(getTruncated("古池や", { ellipsis: "…", limit: 0 })).toBe("");
        });

        it("supports emoji characters", () => {
            expect(getTruncated("👶👶🏽", { ellipsis: "…", limit: 10 })).toBe("👶👶🏽");
            expect(getTruncated("👶👶🏽", { ellipsis: "…", limit: 4 })).toBe("👶👶🏽");
            expect(getTruncated("👶👶🏽", { ellipsis: "…", limit: 3 })).toBe("👶…");
            expect(getTruncated("👶👶🏽", { ellipsis: "…", limit: 2 })).toBe("…");
            expect(getTruncated("👶👶🏽", { ellipsis: "…", limit: 1 })).toBe("…");
            expect(getTruncated("👶👶🏽", { ellipsis: "…", limit: 0 })).toBe("");

            expect(getTruncated("👩‍👩‍👦‍👦👨‍❤️‍💋‍👨", { ellipsis: "…", limit: 10 })).toBe("👩‍👩‍👦‍👦👨‍❤️‍💋‍👨");
            expect(getTruncated("👩‍👩‍👦‍👦👨‍❤️‍💋‍👨", { ellipsis: "…", limit: 4 })).toBe("👩‍👩‍👦‍👦👨‍❤️‍💋‍👨");
            expect(getTruncated("👩‍👩‍👦‍👦👨‍❤️‍💋‍👨", { ellipsis: "…", limit: 3 })).toBe("👩‍👩‍👦‍👦…");
            expect(getTruncated("👩‍👩‍👦‍👦👨‍❤️‍💋‍👨", { ellipsis: "…", limit: 2 })).toBe("…");
            expect(getTruncated("👩‍👩‍👦‍👦👨‍❤️‍💋‍👨", { ellipsis: "…", limit: 1 })).toBe("…");
            expect(getTruncated("👩‍👩‍👦‍👦👨‍❤️‍💋‍👨", { ellipsis: "…", limit: 0 })).toBe("");
        });
    });
});
