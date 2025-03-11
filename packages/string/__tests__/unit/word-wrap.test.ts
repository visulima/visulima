import { bgGreen, green, red } from "@visulima/colorize";
import { describe, expect, it } from "vitest";

import { FAST_ANSI_REGEX, stripAnsi } from "../../src/case/utils/regex";
import { wordWrap, WrapMode } from "../../src/word-wrap";

// eslint-disable-next-line @typescript-eslint/restrict-template-expressions
const fixture = `The quick brown ${red("fox jumped over")} the lazy ${green("dog and then ran away with the unicorn.")}`;
const fixture2 = "12345678\n901234567890";
const fixture3 = "12345678\n901234567890 12345";
const fixture4 = "12345678\n ";

// Helper function for testing
const hasAnsi = (string_: string): boolean => FAST_ANSI_REGEX.test(string_)

describe("wordWrap", () => {
    // Basic functionality tests
    it("should wrap string at 20 characters", () => {
        const result = wordWrap(fixture, { width: 20 });

        expect(result).toBe(
            // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
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
        const result = wordWrap(fixture, { width: 5, wrapMode: WrapMode.PRESERVE_WORDS });

        expect(result).toBe(
            `The\nquick\nbrown\n${red("fox")}\n${red("jumped")}\n${red("over")}\nthe\nlazy\n${green("dog")}\n${green("and")}\n${green("then")}\n${green("ran")}\n${green("away")}\n${green("with")}\n${green("the")}\n${green("unicorn.")}`,
        );
        expect(result.split("\n").some((line) => stripAnsi(line).length > 5)).toBeTruthy();
    });

    it("should break strings longer than width when using STRICT_WIDTH mode", () => {
        const result = wordWrap(fixture, { width: 5, wrapMode: WrapMode.STRICT_WIDTH });

        expect(result).toMatchInlineSnapshot(`
          "The q
          uick
          brown
          [31mfox j[39m
          [31m[31mumped[39m
          [31m[31mover[39m
          the l
          azy [32md[39m
          [32m[32mog an[39m
          [32m[32md the[39m
          [32m[32mn ran[39m
          [32m[32maway[39m
          [32m[32mwith[39m
          [32m[32mthe u[39m
          [32m[32mnicor[39m
          [32m[32mn.[39m"
        `);
        expect(result.split("\n").every((line) => stripAnsi(line).length <= 5)).toBeTruthy();
    });

    // ANSI handling tests
    it("should handle colored string that wraps onto multiple lines", () => {
        const result = wordWrap(`${green("hello world")} hey!`, { width: 5, wrapMode: WrapMode.PRESERVE_WORDS });
        const lines = result.split("\n");

        expect(hasAnsi(lines[0])).toBeTruthy();
        expect(hasAnsi(lines[1])).toBeTruthy();
        expect(hasAnsi(lines[2])).toBeFalsy();
    });

    it("should not prepend newline if first string is greater than width", () => {
        const result = wordWrap(`${green("hello")}-world`, { width: 5, wrapMode: WrapMode.PRESERVE_WORDS });
        expect(result.split("\n")).toHaveLength(1);
    });

    // Line breaks and whitespace handling
    it("should take into account line returns inside input", () => {
        expect(wordWrap(fixture2, { width: 10, wrapMode: WrapMode.STRICT_WIDTH })).toBe("12345678\n9012345678\n90");
    });

    it("should handle no word-wrapping", () => {
        expect(wordWrap("supercalifragilistic", { width: 5, wrapMode: WrapMode.BREAK_AT_CHARACTERS })).toBe("super\ncalif\nragil\nistic");

        const result = wordWrap(fixture3, { width: 15, wrapMode: WrapMode.BREAK_AT_CHARACTERS });
        expect(result).toBe("12345678\n901234567890 12\n345");

        const result2 = wordWrap(fixture3, { width: 5, wrapMode: WrapMode.BREAK_AT_CHARACTERS });
        expect(result2).toBe("12345\n678\n90123\n45678\n90 12\n345");

        const result3 = wordWrap(fixture4, { width: 5, wrapMode: WrapMode.BREAK_AT_CHARACTERS });
        expect(result3).toBe("12345\n678\n");
    });

    // Unicode and special character handling
    it("should support fullwidth characters", () => {
        expect(wordWrap("안녕하세", { width: 4, wrapMode: WrapMode.STRICT_WIDTH })).toBe("안녕\n하세");
        expect(wordWrap("古池や蛙飛び込む水の音", { width: 8, wrapMode: WrapMode.STRICT_WIDTH })).toBe("古池や蛙\n飛び込む\n水の音");
    });

    it("should support unicode surrogate pairs", () => {
        expect(wordWrap("a\uD83C\uDE00bc", { width: 2, wrapMode: WrapMode.STRICT_WIDTH })).toBe("a\uD83C\n\uDE00b\nc");
        expect(wordWrap("a\uD83C\uDE00bc\uD83C\uDE00d\uD83C\uDE00", { width: 2, wrapMode: WrapMode.STRICT_WIDTH })).toBe(
            "a\uD83C\n\uDE00b\nc\uD83C\n\uDE00d\n\uD83C\uDE00",
        );
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

    it("should handle background colors with strict width wrapping", () => {
        expect(
            wordWrap(bgGreen.black("test"), {
                trim: false,
                width: 3,
                wrapMode: WrapMode.STRICT_WIDTH,
            }),
            // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        ).toBe(`${bgGreen.black("tes")}\n${bgGreen.black("t")}`);
    });

    it("should handle zero-width characters", () => {
        expect(wordWrap("\u200B\u200Ba\u200Bb", { width: 2 })).toBe("ab");
        expect(wordWrap("a\u200Bb\u200Bc", { width: 2, wrapMode: WrapMode.STRICT_WIDTH })).toBe("ab\nc");
    });

    it("should handle tab characters correctly", () => {
        const textWithTabs = "\t\t\t\ttestingtesting";

        expect(wordWrap(textWithTabs, { width: 10 })).toBe("testingtesting");
        expect(wordWrap(textWithTabs, { width: 10, trim: false })).toBe("\t\n\t\n\t\n\t\ntestingtesting");
        expect(wordWrap(textWithTabs, { width: 5, wrapMode: WrapMode.BREAK_AT_CHARACTERS, trim: false })).toBe("\t\n\t\n\t\n\t\ntesti\nngtes\nting");
        expect(wordWrap(textWithTabs, { width: 5, wrapMode: WrapMode.STRICT_WIDTH, trim: false })).toBe("\t\n\t\n\t\n\t\ntesti\nngtes\nting");
    });

    // Whitespace handling
    it("should properly wrap whitespace with no trimming", () => {
        expect(wordWrap("   ", { trim: false, width: 2 })).toBe("  \n ");
        expect(wordWrap("   ", { trim: false, width: 2, wrapMode: WrapMode.STRICT_WIDTH })).toBe("  \n ");
    });

    it("should trim leading and trailing whitespace only on wrapped lines", () => {
        expect(wordWrap("   foo   bar   ", { width: 3 })).toBe("foo\nbar");
        expect(wordWrap("   foo   bar   ", { width: 6 })).toBe("foo\nbar");
        expect(wordWrap("   foo   bar   ", { width: 42 })).toBe("foo   bar");
        expect(wordWrap("   foo   bar   ", { trim: false, width: 42 })).toBe("   foo   bar   ");
    });

    it("should not multiplicate leading spaces with no trimming", () => {
        expect(wordWrap(" a ", { trim: false, width: 10 })).toBe(" a ");
        expect(wordWrap("   a ", { trim: false, width: 10 })).toBe("   a ");
    });

    // Hyperlink handling
    it("should wrap hyperlinks preserving clickability", () => {
        expect(
            wordWrap(
                "Check out \u001B]8;;https://www.example.com\u0007my website\u001B]8;;\u0007, it is \u001B]8;;https://www.example.com\u0007supercalifragilisticexpialidocious\u001B]8;;\u0007.",
                { width: 16, wrapMode: WrapMode.STRICT_WIDTH },
            ),
        ).toBe(
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
        expect(wordWrap("foobar\r\nfoobar\r\nfoobar\nfoobar", { width: 3, wrapMode: WrapMode.STRICT_WIDTH })).toBe("foo\nbar\nfoo\nbar\nfoo\nbar\nfoo\nbar");
        expect(wordWrap("foo bar\r\nfoo bar\r\nfoo bar\nfoo bar", { width: 3 })).toBe("foo\nbar\nfoo\nbar\nfoo\nbar\nfoo\nbar");
    });

    // Tests for option combinations
    describe("option combinations", () => {
        describe("wordWrap option", () => {
            it("should respect WrapMode.PRESERVE_WORDS (default)", () => {
                // Default behavior - preserve word boundaries, words exceed width limit
                expect(wordWrap("hello supercalifragilistic", { width: 10 })).toBe("hello\nsupercalifragilistic");

                // Explicit WrapMode.PRESERVE_WORDS should match default behavior
                expect(wordWrap("hello supercalifragilistic", { width: 10, wrapMode: WrapMode.PRESERVE_WORDS })).toBe("hello\nsupercalifragilistic");
            });

            it("should respect WrapMode.BREAK_AT_CHARACTERS", () => {
                // BREAK_AT_CHARACTERS - words are broken at character boundaries
                expect(
                    wordWrap("hello supercalifragilistic", {
                        width: 10,
                        wrapMode: WrapMode.BREAK_AT_CHARACTERS,
                    }),
                ).toBe("hello supe\nrcalifragi\nlistic");
            });
        });

        describe("wrapMode.STRICT_WIDTH option", () => {
            it("should break at width with STRICT_WIDTH regardless of other options", () => {
                // With STRICT_WIDTH, always break at exactly the width
                expect(wordWrap("supercalifragilistic", { width: 5, wrapMode: WrapMode.STRICT_WIDTH })).toBe("super\ncalif\nragil\nistic");

                // STRICT_WIDTH should override wordWrap=false
                expect(
                    wordWrap("supercalifragilistic", {
                        width: 5,
                        wrapMode: WrapMode.STRICT_WIDTH,
                    }),
                ).toBe("super\ncalif\nragil\nistic");
            });
        });
    });

    describe("sTRICT_WIDTH mode", () => {
        it("should break at exact width with trim=true", () => {
            expect(wordWrap("foo bar", { width: 3, wrapMode: WrapMode.STRICT_WIDTH })).toBe("foo\nbar");
            expect(wordWrap("foo  bar", { width: 3, wrapMode: WrapMode.STRICT_WIDTH })).toBe("foo\nbar");
            expect(wordWrap("foo bar baz", { width: 3, wrapMode: WrapMode.STRICT_WIDTH })).toBe("foo\nbar\nbaz");
        });

        it("should handle spaces properly at line breaks with trim=false", () => {
            expect(wordWrap("foo bar", { trim: false, width: 3, wrapMode: WrapMode.STRICT_WIDTH })).toBe("foo\n ba\nr");
            expect(wordWrap("foo  bar", { trim: false, width: 3, wrapMode: WrapMode.STRICT_WIDTH })).toBe("foo\n  b\nar");
            expect(wordWrap("foo bar baz", { trim: false, width: 3, wrapMode: WrapMode.STRICT_WIDTH })).toBe("foo\n ba\nr b\naz");
        });

        it("should handle words that exceed width", () => {
            expect(wordWrap("foobar", { width: 3, wrapMode: WrapMode.STRICT_WIDTH })).toBe("foo\nbar");
            expect(wordWrap("verylongword", { width: 4, wrapMode: WrapMode.STRICT_WIDTH })).toBe("very\nlong\nword");
        });

        it("should handle empty strings and edge cases", () => {
            expect(wordWrap("", { width: 3, wrapMode: WrapMode.STRICT_WIDTH })).toBe("");
            expect(wordWrap(" ", { width: 3, wrapMode: WrapMode.STRICT_WIDTH })).toBe("");
            expect(wordWrap(" ", { trim: false, width: 3, wrapMode: WrapMode.STRICT_WIDTH })).toBe(" ");
        });
    });

    describe("pRESERVE_WORDS mode (default)", () => {
        it("should keep words intact with default settings", () => {
            expect(wordWrap("foo bar", { width: 3 })).toBe("foo\nbar");
            expect(wordWrap("foo bar baz", { width: 7 })).toBe("foo bar\nbaz");
        });

        it("should handle spaces properly with trim=false", () => {
            expect(wordWrap("foo bar", { trim: false, width: 3 })).toBe("foo\n \nbar");
            expect(wordWrap("foo  bar", { trim: false, width: 3 })).toBe("foo\n  \nbar");
        });

        it("should respect width limits for each word", () => {
            expect(wordWrap("verylongword short", { width: 4 })).toBe("verylongword\nshort");
        });
    });

    describe("bREAK_AT_CHARACTERS mode", () => {
        it("should break words at character boundaries", () => {
            expect(wordWrap("foobar", { width: 3, wrapMode: WrapMode.BREAK_AT_CHARACTERS })).toBe("foo\nbar");
            expect(wordWrap("foo bar", { width: 5, wrapMode: WrapMode.BREAK_AT_CHARACTERS })).toBe("foo b\nar");
        });

        it("should handle spaces with trim=false", () => {
            expect(wordWrap("foo bar", { trim: false, width: 3, wrapMode: WrapMode.BREAK_AT_CHARACTERS })).toBe("foo\n \nbar");
        });
    });

    describe("multiple lines input", () => {
        it("should handle newlines in the input", () => {
            expect(wordWrap("foo\nbar", { width: 3, wrapMode: WrapMode.STRICT_WIDTH })).toBe("foo\nbar");
            expect(wordWrap("foo\nbar baz", { width: 3, wrapMode: WrapMode.STRICT_WIDTH })).toBe("foo\nbar\nbaz");
        });
    });

    describe("custom test cases", () => {
        it("should handle edge cases with spaces and different wrap modes", () => {
            expect(wordWrap("f o o bar", { width: 3, wrapMode: WrapMode.STRICT_WIDTH })).toBe("f o\no b\nar");
            expect(wordWrap("f o o bar", { trim: false, width: 3, wrapMode: WrapMode.STRICT_WIDTH })).toBe("f o\n o \nbar");

            expect(wordWrap("foo   bar", { width: 3, wrapMode: WrapMode.STRICT_WIDTH })).toBe("foo\nbar");
            expect(wordWrap("foo   bar", { trim: false, width: 3, wrapMode: WrapMode.STRICT_WIDTH })).toBe("foo\n   \nbar");
        });
    });
});
