import { green, red } from "@visulima/colorize";
import { describe, expect, it } from "vitest";

import { FAST_ANSI_REGEX, stripAnsi } from "../src/case/utils/regex";
import { WrapMode, wordWrap } from "../src/word-wrap";

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
        expect(result.split("\n").every((line) => stripAnsi(line).length <= 20)).toBeTruthy();
    });

    it("should wrap string at 30 characters", () => {
        const result = wordWrap(fixture, { width: 30 });

        expect(result).toBe(`The quick brown ${red("fox jumped")}\n${red("over")} the lazy ${green("dog and then ran")}\n${green("away with the unicorn.")}`);
        expect(result.split("\n").every((line) => stripAnsi(line).length <= 30)).toBeTruthy();
    });

    // Word wrapping behavior tests
    it("should not break strings longer than width when using PRESERVE_WORDS mode", () => {
        const result = wordWrap(fixture, { wrapMode: WrapMode.PRESERVE_WORDS, width: 5 });

        expect(result).toBe(
            `The\nquick\nbrown\n${red("fox")}\n${red("jumped")}\n${red("over")}\nthe\nlazy\n${green("dog")}\n${green("and")}\n${green("then")}\n${green("ran")}\n${green("away")}\n${green("with")}\n${green("the")}\n${green("unicorn.")}`,
        );
        expect(result.split("\n").some((line) => stripAnsi(line).length > 5)).toBeTruthy();
    });

    it("should break strings longer than width when using STRICT_WIDTH mode", () => {
        const result = wordWrap(fixture, { wrapMode: WrapMode.STRICT_WIDTH, width: 5 });

        expect(result).toBe(["The q",
            "uick",
            "brown",
            red("fox j"),
            red("umped"),
            red("over"),
            "the",
            "lazy",
            green("dog a"),
            green("nd th"),
            green("en ra"),
            green("n awa"),
            green("y wit"),
            green("h the"),
            green("unic"),
            green("orn.")].join("\n"));
        expect(result.split("\n").every((line) => stripAnsi(line).length <= 5)).toBeTruthy();
    });

    // ANSI handling tests
    it("should handle colored string that wraps onto multiple lines", () => {
        const result = wordWrap(`${green("hello world")} hey!`, { wrapMode: WrapMode.PRESERVE_WORDS, width: 5 });
        const lines = result.split("\n");

        expect(hasAnsi(lines[0])).toBeTruthy();
        expect(hasAnsi(lines[1])).toBeTruthy();
        expect(hasAnsi(lines[2])).toBeFalsy();
    });

    it("should not prepend newline if first string is greater than width", () => {
        const result = wordWrap(`${green("hello")}-world`, { wrapMode: WrapMode.PRESERVE_WORDS, width: 5 });
        expect(result.split("\n")).toHaveLength(1);
    });

    // Line breaks and whitespace handling
    it("should take into account line returns inside input", () => {
        expect(wordWrap(fixture2, { wrapMode: WrapMode.STRICT_WIDTH, width: 10 })).toBe("12345678\n9012345678\n90");
    });

    it("should handle no word-wrapping", () => {
        expect(wordWrap("supercalifragilistic", { wrapMode: WrapMode.BREAK_AT_CHARACTERS, width: 5 })).toBe("super\ncalif\nragil\nistic");

        const result = wordWrap(fixture3, { wrapMode: WrapMode.BREAK_AT_CHARACTERS, width: 15 });
        expect(result).toBe("12345678\n901234567890 12\n345");

        const result2 = wordWrap(fixture3, { wrapMode: WrapMode.BREAK_AT_CHARACTERS, width: 5 });
        expect(result2).toBe("12345\n678\n90123\n45678\n90 12\n345");

        const result3 = wordWrap(fixture5, { wrapMode: WrapMode.BREAK_AT_CHARACTERS, width: 5 });
        expect(result3).toBe("12345\n678\n");
    });

    // Unicode and special character handling
    it("should support fullwidth characters", () => {
        expect(wordWrap("안녕하세", { wrapMode: WrapMode.STRICT_WIDTH, width: 4 })).toBe("안녕\n하세");
        expect(wordWrap("古池や蛙飛び込む水の音", { wrapMode: WrapMode.STRICT_WIDTH, width: 8 })).toBe("古池や蛙\n飛び込む\n水の音");
    });

    it("should support unicode surrogate pairs", () => {
        expect(wordWrap("a\uD83C\uDE00bc", { wrapMode: WrapMode.STRICT_WIDTH, width: 2 })).toBe("a\n\uD83C\uDE00\nbc");
        expect(wordWrap("a\uD83C\uDE00bc\uD83C\uDE00d\uD83C\uDE00", { wrapMode: WrapMode.STRICT_WIDTH, width: 2 })).toBe("a\n\uD83C\uDE00\nbc\n\uD83C\uDE00\nd\n\uD83C\uDE00");
    });

    it("should handle emoji sequences correctly", () => {
        expect(wordWrap("👩🏽 person", { width: 4 })).toBe("👩🏽\nperson");
        expect(wordWrap("🏴‍☠️ flag", { width: 4 })).toBe("🏴‍☠️\nflag");
        expect(wordWrap("👨‍👩‍👧‍👦 family", { width: 4 })).toBe("👨‍👩‍👧‍👦\nfamily");
    });

    it("should handle combining characters", () => {
        expect(wordWrap("e\u0301 acute", { width: 4, wrapMode: WrapMode.BREAK_AT_CHARACTERS })).toBe("é ac\nute");
        expect(wordWrap("o\u0308 umlaut", { width: 4, wrapMode: WrapMode.BREAK_AT_CHARACTERS })).toBe("ö um\nlaut");
    });

    it("should handle zero-width characters", () => {
        expect(wordWrap("\u200B\u200Ba\u200Bb", { width: 2 })).toBe("ab");
        expect(wordWrap("a\u200Bb\u200Bc", { wrapMode: WrapMode.STRICT_WIDTH, width: 2 })).toBe("ab\nc");
    });

    // Whitespace handling
    it("should properly wrap whitespace with no trimming", () => {
        expect(wordWrap("   ", { trim: false, width: 2 })).toBe("  \n ");
        expect(wordWrap("   ", { wrapMode: WrapMode.STRICT_WIDTH, trim: false, width: 2 })).toBe("  \n ");
    });

    it("should trim leading and trailing whitespace only on wrapped lines", () => {
        expect(wordWrap("   foo   bar   ", { width: 3 })).toBe("foo\nbar");
        expect(wordWrap("   foo   bar   ", { width: 6 })).toBe("foo\nbar");
        expect(wordWrap("   foo   bar   ", { width: 42 })).toBe("foo   bar");
        expect(wordWrap("   foo   bar   ", { trim: false, width: 42 })).toBe("   foo   bar   ");
    });

    it("should properly wrap whitespace between words with no trimming", () => {
        expect(wordWrap("foo bar", { width: 3 })).toBe("foo\nbar");
        expect(wordWrap("foo bar", { wrapMode: WrapMode.STRICT_WIDTH, width: 3 })).toBe("foo\nbar");
        expect(wordWrap("foo bar", { trim: false, width: 3 })).toBe("foo\n \nbar");
        expect(wordWrap("foo bar", { wrapMode: WrapMode.STRICT_WIDTH, trim: false, width: 3 })).toBe("foo\n \nbar");
    });

    it("should not multiplicate leading spaces with no trimming", () => {
        expect(wordWrap(" a ", { trim: false, width: 10 })).toBe(" a ");
        expect(wordWrap("   a ", { trim: false, width: 10 })).toBe("   a ");
    });

    // Hyperlink handling
    it("should wrap hyperlinks preserving clickability", () => {
        const result1 = wordWrap(
            "Check out \u001B]8;;https://www.example.com\u0007my website\u001B]8;;\u0007, it is \u001B]8;;https://www.example.com\u0007supercalifragilisticexpialidocious\u001B]8;;\u0007.",
            { wrapMode: WrapMode.STRICT_WIDTH, width: 16 },
        );
        expect(result1).toBe(
            [
                "Check out \u001B]8;;https://www.example.com\u0007my web\u001B]8;;\u0007",
                "\u001B]8;;https://www.example.com\u0007site\u001B]8;;\u0007, it is \u001B]8;;https://www.example.com\u0007supe\u001B]8;;\u0007",
                "\u001B]8;;https://www.example.com\u0007rcalifragilistic\u001B]8;;\u0007",
                "\u001B]8;;https://www.example.com\u0007expialidocious\u001B]8;;\u0007.",
            ].join("\n"),
        );
    });

    // Non-SGR ANSI escape handling
    it("should handle non-SGR/non-hyperlink ANSI escapes", () => {
        expect(wordWrap("Hello, \u001B[1D World!", { width: 8 })).toBe("Hello,\u001B[1D\nWorld!");
        expect(wordWrap("Hello, \u001B[1D World!", { trim: false, width: 8 })).toBe("Hello, \u001B[1D \nWorld!");
    });

    // Newline normalization
    it("should normalize newlines", () => {
        expect(wordWrap("foobar\r\nfoobar\r\nfoobar\nfoobar", { wrapMode: WrapMode.STRICT_WIDTH, width: 3 })).toBe("foo\nbar\nfoo\nbar\nfoo\nbar\nfoo\nbar");
        expect(wordWrap("foo bar\r\nfoo bar\r\nfoo bar\nfoo bar", { width: 3 })).toBe("foo\nbar\nfoo\nbar\nfoo\nbar\nfoo\nbar");
    });

    // Tests for option combinations
    describe('option combinations', () => {
        describe('wordWrap option', () => {
            it('should respect WrapMode.PRESERVE_WORDS (default)', () => {
                // Default behavior - preserve word boundaries, words exceed width limit
                expect(wordWrap('hello supercalifragilistic', { width: 10 }))
                    .toBe('hello\nsupercalifragilistic');

                // Explicit WrapMode.PRESERVE_WORDS should match default behavior
                expect(wordWrap('hello supercalifragilistic', { wrapMode: WrapMode.PRESERVE_WORDS, width: 10 }))
                    .toBe('hello\nsupercalifragilistic');
            });

            it('should respect WrapMode.BREAK_AT_CHARACTERS', () => {
                // BREAK_AT_CHARACTERS - words are broken at character boundaries
                expect(wordWrap('hello supercalifragilistic', {
                    width: 10,
                    wrapMode: WrapMode.BREAK_AT_CHARACTERS
                })).toBe('hello supe\nrcalifragi\nlistic');

                // Legacy support - preserveWordBoundaries=false should do the same
                expect(wordWrap('hello supercalifragilistic', {
                    width: 10,
                    wrapMode: WrapMode.BREAK_AT_CHARACTERS
                })).toBe('hello supe\nrcalifragi\nlistic');
            });

            it('should respect wordWrap=false by not wrapping long words', () => {
                // With wordWrap=false - long words stay intact even when exceeding width
                expect(wordWrap('hello supercalifragilistic', { width: 10, wordWrap: false }))
                    .toBe('hello\nsupercalifragilistic');

                // WrapMode.PRESERVE_WORDS with wordWrap=false should behave the same
                expect(wordWrap('hello supercalifragilistic', { width: 10, wrapMode: WrapMode.PRESERVE_WORDS, wordWrap: false }))
                    .toBe('hello\nsupercalifragilistic');
            });

            it('should prioritize wordWrap=false over wrapMode=BREAK_AT_CHARACTERS', () => {
                // When wordWrap=false and wrapMode=BREAK_AT_CHARACTERS
                // The wordWrap option takes precedence - words should not be broken
                expect(wordWrap('hello supercalifragilistic', {
                    width: 10,
                    wordWrap: false,
                    wrapMode: WrapMode.BREAK_AT_CHARACTERS
                })).toBe('hello\nsupercalifragilistic');

                // Legacy support test
                expect(wordWrap('hello supercalifragilistic', {
                    width: 10,
                    wrapMode: WrapMode.BREAK_AT_CHARACTERS
                })).toBe('hello\nsupercalifragilistic');
            });
        });

        describe('WrapMode.STRICT_WIDTH option', () => {
            it('should break at width with STRICT_WIDTH regardless of other options', () => {
                // With STRICT_WIDTH, always break at exactly the width
                expect(wordWrap('supercalifragilistic', { width: 5, wrapMode: WrapMode.STRICT_WIDTH }))
                    .toBe('super\ncalif\nragil\nistic');

                // STRICT_WIDTH should override wordWrap=false
                expect(wordWrap('supercalifragilistic', {
                    width: 5,
                    wrapMode: WrapMode.STRICT_WIDTH,
                    wordWrap: false
                })).toBe('super\ncalif\nragil\nistic');

                // Legacy test - breakAtWidth should behave like STRICT_WIDTH
                expect(wordWrap('supercalifragilistic', { width: 5, wrapMode: WrapMode.STRICT_WIDTH }))
                    .toBe('super\ncalif\nragil\nistic');

                // Legacy test - breakAtWidth=true should override wordWrap=false
                expect(wordWrap('supercalifragilistic', {
                    width: 5,
                    wrapMode: WrapMode.STRICT_WIDTH,
                    wordWrap: false
                })).toBe('super\ncalif\nragil\nistic');
            });
        });

        it('should handle multiple spaces with wordWrap=false', () => {
            // With spaces and wordWrap=false
            expect(wordWrap('word1    word2    longword', { width: 6, wordWrap: false }))
                .toBe('word1\nword2\nlongword');

            // With spaces, wordWrap=false and explicit wrapMode
            expect(wordWrap('word1    word2    longword', {
                width: 6,
                wordWrap: false,
                wrapMode: WrapMode.PRESERVE_WORDS
            })).toBe('word1\nword2\nlongword');
        });

        it('should handle newlines with wordWrap=false', () => {
            // With newlines and wordWrap=false
            expect(wordWrap('word1\nword2\nlongword', { width: 6, wordWrap: false }))
                .toBe('word1\nword2\nlongword');

            // With newlines, wordWrap=false and explicit wrapMode
            expect(wordWrap('word1\nword2\nlongword', {
                width: 6,
                wordWrap: false,
                wrapMode: WrapMode.PRESERVE_WORDS
            })).toBe('word1\nword2\nlongword');
        });
    });
});

// Helper function for testing
function hasAnsi(string_: string): boolean {
    return FAST_ANSI_REGEX.test(string_);
}
