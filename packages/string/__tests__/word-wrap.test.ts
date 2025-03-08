import { describe, expect, it } from "vitest";

import { red, green } from "@visulima/colorize";
import { stripAnsi, FAST_ANSI_REGEX } from "../src/case/utils/regex";
import { wordWrap } from "../src/word-wrap";

// Test fixtures using @visulima/colorize
const fixture = `The quick brown ${red("fox jumped over")} the lazy ${green("dog and then ran away with the unicorn.")}`;
const fixture2 = "12345678\n901234567890";
const fixture3 = "12345678\n901234567890 12345";
const fixture4 = "12345678\n";
const fixture5 = "12345678\n ";

describe("wordWrap", () => {
    // Basic functionality tests
    it("should wrap string at 20 characters", () => {
        const result = wordWrap(fixture, { width: 20 });

        expect(result).toBe(
            `The quick brown ${red("fox")}\n${red("jumped over")} the lazy\n${green("dog and then ran")}\n${green("away with the")}\n${green("unicorn.")}`,
        );
        expect(result.split("\n").every((line) => stripAnsi(line).length <= 20)).toBe(true);
    });

    it("should wrap string at 30 characters", () => {
        const result = wordWrap(fixture, { width: 30 });

        expect(result).toBe(
            `The quick brown ${red("fox jumped")}\n${red("over")} the lazy ${green("dog and then ran")}\n${green("away with the unicorn.")}`,
        );
        expect(result.split("\n").every((line) => stripAnsi(line).length <= 30)).toBe(true);
    });

    // Word wrapping behavior tests
    it("should not break strings longer than width when hard is false", () => {
        const result = wordWrap(fixture, { width: 5, hard: false });

        expect(result).toBe(
            `The\nquick\nbrown\n${red("fox")}\n${red("jumped")}\n${red("over")}\nthe\nlazy\n${green("dog")}\n${green("and")}\n${green("then")}\n${green("ran")}\n${green("away")}\n${green("with")}\n${green("the")}\n${green("unicorn.")}`,
        );
        expect(result.split("\n").some((line) => stripAnsi(line).length > 5)).toBe(true);
    });

    it("should break strings longer than width when hard is true", () => {
        const result = wordWrap(fixture, { width: 5, hard: true });

        expect(result).toBe(
            `The\nquick\nbrown\n${red("fox j")}\n${red("umped")}\n${red("over")}\nthe\nlazy\n${green("dog")}\n${green("and")}\n${green("then")}\n${green("ran")}\n${green("away")}\n${green("with")}\n${green("the")}\n${green("unico")}\n${green("rn.")}`,
        );
        expect(result.split("\n").every((line) => stripAnsi(line).length <= 5)).toBe(true);
    });

    // ANSI handling tests
    it("should handle colored string that wraps onto multiple lines", () => {
        const result = wordWrap(`${green("hello world")} hey!`, { width: 5, hard: false });
        const lines = result.split("\n");

        expect(hasAnsi(lines[0])).toBe(true);
        expect(hasAnsi(lines[1])).toBe(true);
        expect(hasAnsi(lines[2])).toBe(false);
    });

    it("should not prepend newline if first string is greater than width", () => {
        const result = wordWrap(`${green("hello")}-world`, { width: 5, hard: false });
        expect(result.split("\n").length).toBe(1);
    });

    // Line breaks and whitespace handling
    it("should take into account line returns inside input", () => {
        expect(wordWrap(fixture2, { width: 10, hard: true })).toBe("12345678\n9012345678\n90");
    });

    it("should handle word wrapping", () => {
        expect(wordWrap(fixture3, { width: 15 })).toBe("12345678\n901234567890\n12345");
    });

    it("should handle no word-wrapping", () => {
        const result = wordWrap(fixture3, { width: 15, preserveWordBoundaries: false });
        expect(result).toBe("12345678\n901234567890 12\n345");

        const result2 = wordWrap(fixture3, { width: 5, preserveWordBoundaries: false });
        expect(result2).toBe("12345\n678\n90123\n45678\n90 12\n345");

        const result3 = wordWrap(fixture5, { width: 5, preserveWordBoundaries: false });
        expect(result3).toBe("12345\n678\n");
    });

    // Unicode and special character handling
    it("should support fullwidth characters", () => {
        expect(wordWrap("안녕하세", { width: 4, hard: true })).toBe("안녕\n하세");
        expect(wordWrap("古池や蛙飛び込む水の音", { width: 8, hard: true })).toBe("古池や蛙\n飛び込む\n水の音");
    });

    it("should support unicode surrogate pairs", () => {
        expect(wordWrap("a\uD83C\uDE00bc", { width: 2, hard: true })).toBe("a\n\uD83C\uDE00\nbc");
        expect(wordWrap("a\uD83C\uDE00bc\uD83C\uDE00d\uD83C\uDE00", { width: 2, hard: true })).toBe("a\n\uD83C\uDE00\nbc\n\uD83C\uDE00\nd\n\uD83C\uDE00");
    });

    it("should handle emoji sequences correctly", () => {
        expect(wordWrap("👨‍👩‍👧‍👦 family", { width: 4 })).toBe("👨‍👩\n👨‍👩\nfami\nly");
        expect(wordWrap("👩🏽 person", { width: 4 })).toBe("👩🏽\npers\non");
        expect(wordWrap("🏴‍☠️ flag", { width: 4 })).toBe("🏴‍☠️\nflag");
    });

    it("should handle combining characters", () => {
        expect(wordWrap("e\u0301 acute", { width: 4 })).toBe("e\u0301\nacut\ne");
        expect(wordWrap("o\u0308 umlaut", { width: 4 })).toBe("o\u0308\numla\nut");
    });

    it("should handle zero-width characters", () => {
        expect(wordWrap("a\u200Bb\u200Bc", { width: 2, hard: true })).toBe("ab\nc");
        expect(wordWrap("\u200B\u200Ba\u200Bb", { width: 2 })).toBe("ab");
    });

    // Whitespace handling
    it("should properly wrap whitespace with no trimming", () => {
        expect(wordWrap("   ", { width: 2, trim: false })).toBe("  \n ");
        expect(wordWrap("   ", { width: 2, trim: false, hard: true })).toBe("  \n ");
    });

    it("should trim leading and trailing whitespace only on wrapped lines", () => {
        expect(wordWrap("   foo   bar   ", { width: 3 })).toBe("foo\nbar");
        expect(wordWrap("   foo   bar   ", { width: 6 })).toBe("foo\nbar");
        expect(wordWrap("   foo   bar   ", { width: 42 })).toBe("foo   bar");
        expect(wordWrap("   foo   bar   ", { width: 42, trim: false })).toBe("   foo   bar   ");
    });

    it("should properly wrap whitespace between words with no trimming", () => {
        expect(wordWrap("foo bar", { width: 3 })).toBe("foo\nbar");
        expect(wordWrap("foo bar", { width: 3, hard: true })).toBe("foo\nbar");
        expect(wordWrap("foo bar", { width: 3, trim: false })).toBe("foo\n \nbar");
        expect(wordWrap("foo bar", { width: 3, trim: false, hard: true })).toBe("foo\n \nbar");
    });

    it("should not multiplicate leading spaces with no trimming", () => {
        expect(wordWrap(" a ", { width: 10, trim: false })).toBe(" a ");
        expect(wordWrap("   a ", { width: 10, trim: false })).toBe("   a ");
    });

    // Hyperlink handling
    it("should wrap hyperlinks preserving clickability", () => {
        const result1 = wordWrap(
            "Check out \u001B]8;;https://www.example.com\u0007my website\u001B]8;;\u0007, it is \u001B]8;;https://www.example.com\u0007supercalifragilisticexpialidocious\u001B]8;;\u0007.",
            { width: 16, hard: true },
        );
        expect(result1).toBe(
            "Check out \u001B]8;;https://www.example.com\u0007my\u001B]8;;\u0007\n" +
                "\u001B]8;;https://www.example.com\u0007website\u001B]8;;\u0007, it is\n" +
                "\u001B]8;;https://www.example.com\u0007supercalifragili\u001B]8;;\u0007\n" +
                "\u001B]8;;https://www.example.com\u0007sticexpialidocio\u001B]8;;\u0007\n" +
                "\u001B]8;;https://www.example.com\u0007us\u001B]8;;\u0007.",
        );
    });

    // Non-SGR ANSI escape handling
    it("should handle non-SGR/non-hyperlink ANSI escapes", () => {
        expect(wordWrap("Hello, \u001B[1D World!", { width: 8 })).toBe("Hello,\u001B[1D\nWorld!");
        expect(wordWrap("Hello, \u001B[1D World!", { width: 8, trim: false })).toBe("Hello, \u001B[1D \nWorld!");
    });

    // Newline normalization
    it("should normalize newlines", () => {
        expect(wordWrap("foobar\r\nfoobar\r\nfoobar\nfoobar", { width: 3, hard: true })).toBe("foo\nbar\nfoo\nbar\nfoo\nbar\nfoo\nbar");
        expect(wordWrap("foo bar\r\nfoo bar\r\nfoo bar\nfoo bar", { width: 3 })).toBe("foo\nbar\nfoo\nbar\nfoo\nbar\nfoo\nbar");
    });
});

// Helper function for testing
function hasAnsi(str: string): boolean {
    return FAST_ANSI_REGEX.test(str);
}
