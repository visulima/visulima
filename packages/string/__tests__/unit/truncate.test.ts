import { describe, expect, it } from "vitest";

import { toEqualAnsi } from "../../src/test/vitest";
import { truncate } from "../../src/truncate";

describe("truncate", () => {
    expect.extend({ toEqualAnsi });

    describe("basic functionality", () => {
        it("should handle basic strings with default position (end)", () => {
            expect.assertions(8);

            expect(truncate("unicorn", 4)).toBe("uni…");
            expect(truncate("unicorn", 4, { position: "end" })).toBe("uni…");
            expect(truncate("unicorn", 1)).toBe("…");
            expect(truncate("unicorn", 0)).toBe("");
            expect(truncate("unicorn", -4)).toBe("");
            expect(truncate("unicorn", 20)).toBe("unicorn");
            expect(truncate("unicorn", 7)).toBe("unicorn");
            expect(truncate("unicorn", 6)).toBe("unico…");
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
            ).toEqualAnsi("\u001B[31m你好\u001B[39m wo...");
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
});
