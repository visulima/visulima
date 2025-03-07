import { describe, expect, it } from "vitest";

import { wordWrap } from "../src/word-wrap";

// Test fixtures
const redText = "\u001B[31m";
const greenText = "\u001B[32m";
const resetText = "\u001B[39m";

const fixture = `The quick brown ${redText}fox jumped over ${resetText}the lazy ${greenText}dog and then ran away with the unicorn.${resetText}`;
const fixture2 = "12345678\n901234567890";
const fixture3 = "12345678\n901234567890 12345";
const fixture4 = "12345678\n";
const fixture5 = "12345678\n ";

describe("wordWrap", () => {
    // Basic functionality tests
    it("should wrap string at 20 characters", () => {
        const result = wordWrap(fixture, { width: 20 });

        expect(result).toBe(
            `The quick brown ${redText}fox${resetText}\n${redText}jumped over ${resetText}the lazy\n${greenText}dog and then ran${resetText}\n${greenText}away with the${resetText}\n${greenText}unicorn.${resetText}`,
        );
        expect(result.split("\n").every((line) => stripAnsi(line).length <= 20)).toBe(true);
    });

    it("should wrap string at 30 characters", () => {
        const result = wordWrap(fixture, { width: 30 });

        expect(result).toBe(
            `The quick brown ${redText}fox jumped${resetText}\n${redText}over ${resetText}the lazy ${greenText}dog and then ran${resetText}\n${greenText}away with the unicorn.${resetText}`,
        );
        expect(result.split("\n").every((line) => stripAnsi(line).length <= 30)).toBe(true);
    });

    // Word wrapping behavior tests
    it("should not break strings longer than width when hard is false", () => {
        const result = wordWrap(fixture, { width: 5, hard: false });

        expect(result).toBe(
            `The\nquick\nbrown\n${redText}fox${resetText}\n${redText}jumped${resetText}\n${redText}over${resetText}\n${redText}${resetText}the\nlazy\n${greenText}dog${resetText}\n${greenText}and${resetText}\n${greenText}then${resetText}\n${greenText}ran${resetText}\n${greenText}away${resetText}\n${greenText}with${resetText}\n${greenText}the${resetText}\n${greenText}unicorn.${resetText}`,
        );
        expect(result.split("\n").some((line) => stripAnsi(line).length > 5)).toBe(true);
    });

    it("should break strings longer than width when hard is true", () => {
        const result = wordWrap(fixture, { width: 5, hard: true });

        expect(result).toBe(
            `The\nquick\nbrown\n${redText}fox j${resetText}\n${redText}umped${resetText}\n${redText}over${resetText}\n${redText}${resetText}the\nlazy\n${greenText}dog${resetText}\n${greenText}and${resetText}\n${greenText}then${resetText}\n${greenText}ran${resetText}\n${greenText}away${resetText}\n${greenText}with${resetText}\n${greenText}the${resetText}\n${greenText}unico${resetText}\n${greenText}rn.${resetText}`,
        );
        expect(result.split("\n").every((line) => stripAnsi(line).length <= 5)).toBe(true);
    });

    // ANSI handling tests
    it("should handle colored string that wraps onto multiple lines", () => {
        const result = wordWrap(`${greenText}hello world${resetText} hey!`, { width: 5, hard: false });
        const lines = result.split("\n");

        expect(hasAnsi(lines[0])).toBe(true);
        expect(hasAnsi(lines[1])).toBe(true);
        expect(hasAnsi(lines[2])).toBe(false);
    });

    it("should not prepend newline if first string is greater than width", () => {
        const result = wordWrap(`${greenText}hello${resetText}-world`, { width: 5, hard: false });
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
    });

    it("should support unicode surrogate pairs", () => {
        expect(wordWrap("a\uD83C\uDE00bc", { width: 2, hard: true })).toBe("a\n\uD83C\uDE00\nbc");
        expect(wordWrap("a\uD83C\uDE00bc\uD83C\uDE00d\uD83C\uDE00", { width: 2, hard: true })).toBe("a\n\uD83C\uDE00\nbc\n\uD83C\uDE00\nd\n\uD83C\uDE00");
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

// Helper functions for testing
function stripAnsi(str: string): string {
    // eslint-disable-next-line no-control-regex,regexp/no-control-character
    return str.replace(
        /[\u001B\u009B][[]()#;?]*(?:(?:(?:[a-zA-Z\d]*(?:;[-a-zA-Z\d/#&.:=?%@~_]*)*)?\u0007)|(?:(?:\d{1,4}(?:;\d{0,4})*)?[\dA-PR-TZcf-ntqry=><~]))/g,
        "",
    );
}

function hasAnsi(str: string): boolean {
    // eslint-disable-next-line no-control-regex,regexp/no-control-character
    return /[\u001B\u009B][[]()#;?]*(?:(?:(?:[a-zA-Z\d]*(?:;[-a-zA-Z\d/#&.:=?%@~_]*)*)?\u0007)|(?:(?:\d{1,4}(?:;\d{0,4})*)?[\dA-PR-TZcf-ntqry=><~]))/.test(str);
}
