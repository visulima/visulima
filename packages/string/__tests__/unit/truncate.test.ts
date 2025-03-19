import { describe, expect, it } from "vitest";

import { truncate } from "../../src/truncate";
import { toEqualAnsi } from "../../src/test/vitest";

describe("truncate", () => {
    expect.extend({ toEqualAnsi });

    it("should handle basic strings", () => {
        expect.assertions(3);

        expect(truncate("hello world", { limit: 8, ellipsis: "..." })).toBe("hello...");
        expect(truncate("short", { limit: 10, ellipsis: "..." })).toBe("short");
        expect(truncate("hello world", { limit: 5, ellipsis: "..." })).toBe("he...");
    });

    it("should handle ANSI escape codes", () => {
        expect.assertions(2);

        expect(truncate("\u001B[31mhello world\u001B[39m", { limit: 8, ellipsis: "..." })).toEqualAnsi("\u001B[31mhello...\u001B[39m");
        expect(truncate("\u001B[1m\u001B[31mhello\u001B[39m\u001B[22m", { limit: 10 })).toEqualAnsi("\u001B[1m\u001B[31mhello\u001B[39m\u001B[22m");
    });

    it("should handle Unicode characters", () => {
        expect.assertions(3);

        expect(truncate("あいうえお", { limit: 8, fullWidth: 2, ellipsis: "..." })).toBe("あい...");
        expect(truncate("你好世界", { limit: 6, fullWidth: 2, ellipsis: "..." })).toBe("你...");
        expect(truncate("안녕하세요", { limit: 7, fullWidth: 2, ellipsis: "..." })).toBe("안녕...");
    });

    it("should handle emoji and combining characters", () => {
        expect.assertions(2);

        expect(truncate("👨‍👩‍👧‍👦 family", { limit: 8, emojiWidth: 2, ellipsis: "..." })).toEqualAnsi("👨‍👩‍👧‍👦 ...");
        expect(truncate("e\u0301e\u0301e\u0301", { limit: 4, ellipsis: "..." })).toEqualAnsi("e\u0301e\u0301e\u0301");
    });

    it("should handle empty strings and edge cases", () => {
        expect.assertions(3);

        expect(truncate("", { limit: 5, ellipsis: "..." })).toBe("");
        expect(truncate("a", { limit: 0, ellipsis: "..." })).toBe("");
        expect(truncate("hello", { limit: 3, ellipsis: "" })).toBe("hel");
    });

    it("should handle strings with mixed content", () => {
        expect.assertions(2);

        expect(
            truncate("Hello 你好 안녕", {
                limit: 10,
                fullWidth: 2,
                ellipsis: "...",
            }),
        ).toBe("Hello ...");

        expect(
            truncate("\u001B[31m你好\u001B[39m world", {
                limit: 8,
                fullWidth: 2,
                ellipsis: "...",
            }),
        ).toEqualAnsi("\u001B[31m你好\u001B[39m...");
    });

    it("should respect custom width options", () => {
        expect.assertions(2);

        expect(
            truncate("Tab\tTest", {
                limit: 8,
                tabWidth: 4,
                ellipsis: "...",
            }),
        ).toBe("Ta...");

        expect(
            truncate("ｗｉｄｅ", {
                limit: 6,
                ambiguousWidth: 2,
                ellipsis: "...",
            }),
        ).toBe("ｗ...");
    });
});
