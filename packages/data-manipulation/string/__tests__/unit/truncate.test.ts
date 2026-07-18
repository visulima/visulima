import { describe, expect, it } from "vitest";

import { toEqualAnsi } from "../../src/test/vitest";
import { truncate } from "../../src/truncate";

describe(truncate, () => {
    expect.extend({ toEqualAnsi });

    describe("basic functionality", () => {
        it("should handle basic strings with default position (end)", () => {
            expect.assertions(11);

            expect(truncate("unicorn", 4)).toBe("uni…");
            expect(truncate("unicorn", 4, { position: "end" })).toBe("uni…");
            expect(truncate("unicorn", 1)).toBe("…");
            expect(truncate("unicorn", 0)).toBe("");
            expect(truncate("unicorn", -4)).toBe("");
            expect(truncate("unicorn", 20)).toBe("unicorn");
            expect(truncate("unicorn", 7)).toBe("unicorn");
            expect(truncate("unicorn", 6)).toBe("unico…");

            expect(truncate("y", 1)).toBe("y");
            expect(truncate("ye", 1)).toBe("…");
            expect(truncate("yes", 1)).toBe("…");
        });

        it("should handle ANSI escape codes", () => {
            expect.assertions(3);

            expect(truncate("\u001B[31municorn\u001B[39m", 7)).toEqualAnsi("\u001B[31municorn\u001B[39m");
            expect(truncate("\u001B[31municorn\u001B[39m", 1)).toEqualAnsi("…");
            expect(truncate("\u001B[31municorn\u001B[39m", 4)).toEqualAnsi("\u001B[31muni\u001B[39m…");
        });

        it("should handle Unicode characters", () => {
            expect.assertions(2);

            expect(truncate("a\uD83C\uDE00b\uD83C\uDE00c", 5, { width: { emojiWidth: 1 } })).toEqualAnsi("a\uD83C\uDE00b…");
            expect(truncate("안녕하세요", 3, { width: { fullWidth: 2 } })).toBe("안…");
        });
    });

    describe("position options", () => {
        it("should handle start position", () => {
            expect.assertions(2);

            expect(truncate("unicorn", 5, { position: "start" })).toBe("…corn");
            expect(truncate("unicorn", 6, { position: "start" })).toBe("…icorn");
        });

        it("should handle middle position", () => {
            expect.assertions(3);

            expect(truncate("unicorn", 5, { position: "middle" })).toBe("un…rn");
            expect(truncate("unicorns", 6, { position: "middle" })).toBe("uni…ns");
            expect(truncate("unicorns rainbow dragons", 20, { position: "middle" })).toBe("unicorns r…w dragons");
        });
    });

    describe("preferTruncationOnSpace option", () => {
        it("should handle end position with preferTruncationOnSpace", () => {
            expect.assertions(2);

            expect(truncate("dragons are awesome", 15, { position: "end", preferTruncationOnSpace: true })).toBe("dragons are…");
            expect(truncate("unicorns rainbow dragons", 6, { position: "end", preferTruncationOnSpace: true })).toBe("unico…");
        });

        it("should handle start position with preferTruncationOnSpace", () => {
            expect.assertions(2);

            expect(truncate("unicorns are awesome", 15, { position: "start", preferTruncationOnSpace: true })).toBe("…are awesome");
            expect(truncate("unicorns rainbow dragons", 6, { position: "start", preferTruncationOnSpace: true })).toBe("…agons");
        });

        it("should handle middle position with preferTruncationOnSpace", () => {
            expect.assertions(2);

            expect(truncate("unicorns rainbow dragons", 6, { position: "middle", preferTruncationOnSpace: true })).toBe("uni…ns");
            expect(truncate("unicorns partying with dragons", 20, { position: "middle", preferTruncationOnSpace: true })).toBe("unicorns…dragons");
        });

        it("should correctly handle preferTruncationOnSpace with CJK characters (width-based positions)", () => {
            expect.assertions(3);

            // CJK characters have width 2, so "你好 世界" has width 9 (2+2+1+2+2)
            // When truncating to width 5 with preferTruncationOnSpace, targetWidth = 4
            // widthToIndex(4) returns index 2 (after "你好"), findNearestSpace finds space at index 2
            // indexToWidth converts index 2 back to width 4, slice gives "你好" (width 4), plus ellipsis = width 5
            expect(truncate("你好 世界", 5, { position: "end", preferTruncationOnSpace: true, width: { fullWidth: 2 } })).toBe("你好…");

            // Test start position: "你好 世界" has width 9, truncate to 5
            // targetWidth = 9 - 5 + 1 = 5, widthToIndex(5) finds position after space
            expect(truncate("你好 世界", 5, { position: "start", preferTruncationOnSpace: true, width: { fullWidth: 2 } })).toBe("…世界");

            // Test middle position: "你好 世界 测试" has width 11 (2+2+1+2+2+1+2+2), truncate to 7
            // Verifies that width-to-index conversion works correctly for middle truncation
            expect(truncate("你好 世界 测试", 7, { position: "middle", preferTruncationOnSpace: true, width: { fullWidth: 2 } })).toBe("你…测试");
        });

        it("should correctly handle preferTruncationOnSpace with emoji (width-based positions)", () => {
            expect.assertions(3);

            // "Hello  World" has width 11 (5+1+1+4) with emojiWidth: 2
            // When truncating to width 8 with preferTruncationOnSpace, targetWidth = 7
            // Finds nearest space and truncates accordingly
            expect(truncate("Hello  World", 8, { position: "end", preferTruncationOnSpace: true, width: { emojiWidth: 2 } })).toBe("Hello …");

            // Test start position: finds nearest space from the calculated start position
            expect(truncate("Hello  World", 8, { position: "start", preferTruncationOnSpace: true, width: { emojiWidth: 2 } })).toBe("…World");

            // Test with limit 9: targetWidth = 8, finds space after "Hello "
            expect(truncate("Hello  World", 9, { position: "end", preferTruncationOnSpace: true, width: { emojiWidth: 2 } })).toBe("Hello …");
        });
    });

    describe("custom ellipsis", () => {
        it("should handle custom ellipsis with end position", () => {
            expect.assertions(2);

            expect(truncate("unicorns", 5, { ellipsis: ".", position: "end" })).toBe("unic.");
            expect(truncate("unicorns", 5, { ellipsis: " .", position: "end" })).toBe("uni .");
        });

        it("should handle custom ellipsis with start position", () => {
            expect.assertions(2);

            expect(truncate("unicorns", 5, { ellipsis: ".", position: "start" })).toBe(".orns");
            expect(truncate("\u001B[31municorn\u001B[39m", 6, { ellipsis: ".", position: "start" })).toEqualAnsi(".\u001B[31micorn\u001B[39m");
        });

        it("should handle custom ellipsis with middle position", () => {
            expect.assertions(2);

            expect(truncate("unicorns", 5, { ellipsis: ".", position: "middle" })).toBe("un.ns");
            expect(truncate("\u001B[31municornsareawesome\u001B[39m", 10, { ellipsis: ".", position: "middle" })).toEqualAnsi(
                "\u001B[31munico\u001B[39m.\u001B[31msome\u001B[39m",
            );
        });

        it("should handle custom ellipsis with preferTruncationOnSpace", () => {
            expect.assertions(1);

            expect(truncate("unicorns partying with dragons", 20, { ellipsis: ".", position: "middle", preferTruncationOnSpace: true })).toBe(
                "unicorns.dragons",
            );
        });
    });

    describe("edge cases", () => {
        it("should handle empty strings and invalid limits", () => {
            expect.assertions(3);

            expect(truncate("", 5, { ellipsis: "..." })).toBe("");
            expect(truncate("a", 0, { ellipsis: "..." })).toBe("");
            expect(truncate("hello", -1, { ellipsis: "..." })).toBe("");
        });

        it("should handle strings with mixed content", () => {
            expect.assertions(3);

            expect(
                truncate("Hello 你好 안녕", 10, {
                    ellipsis: "...",
                    width: { fullWidth: 2 },
                }),
            ).toBe("Hello ...");

            expect(truncate("日本語テスト", 9)).toBe("日本語テ…");

            expect(
                truncate("\u001B[31m你好\u001B[39m world", 8, {
                    ellipsis: "...",
                    width: { fullWidth: 2 },
                }),
            ).toEqualAnsi("\u001B[31m你好\u001B[39m ...");
        });

        it("should handle special width characters", () => {
            expect.assertions(2);

            expect(
                truncate("Tab\tTest", 8, {
                    ellipsis: "...",
                    width: { tabWidth: 4 },
                }),
            ).toBe("Tab\tT...");

            expect(
                truncate("ｗｉｄｅ", 6, {
                    ellipsis: "...",
                }),
            ).toBe("ｗ...");
        });
    });

    describe("input validation", () => {
        it("should throw a TypeError when input is not a string", () => {
            expect.assertions(1);

            expect(() => truncate(123 as never, 5)).toThrow(TypeError);
        });

        it("should throw a TypeError when limit is not a number", () => {
            expect.assertions(1);

            expect(() => truncate("hello", "5" as never)).toThrow(TypeError);
        });

        it("should throw an Error for an invalid truncation position", () => {
            expect.assertions(1);

            expect(() => truncate("hello world", 5, { position: "top" as never })).toThrow("Invalid position");
        });
    });
});
