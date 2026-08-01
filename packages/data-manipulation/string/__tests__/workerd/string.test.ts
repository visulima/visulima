import { describe, expect, it } from "vitest";

import { alignText } from "../../src/align-text";
import camelCase from "../../src/case/camel-case";
import { flipCase } from "../../src/case/flip-case";
import { kebabCase } from "../../src/case/kebab-case";
import pascalCase from "../../src/case/pascal-case";
import snakeCase from "../../src/case/snake-case";
import { splitByCase } from "../../src/case/split-by-case";
import titleCase from "../../src/case/title-case";
import upperFirst from "../../src/case/upper-first";
import { countOccurrences } from "../../src/count-occurrences";
import { direction } from "../../src/direction";
import { excerpt } from "../../src/excerpt";
import { getStringTruncatedWidth } from "../../src/get-string-truncated-width";
import { getStringWidth } from "../../src/get-string-width";
import { dedent, indent } from "../../src/indent";
import { closest, distance, similarity } from "../../src/levenshtein";
import { outdent } from "../../src/outdent";
import replaceString from "../../src/replace-string";
import { slice } from "../../src/slice";
import slugify from "../../src/slugify";
import transliterate from "../../src/transliterate";
import { truncate } from "../../src/truncate";
import { wordWrap, WrapMode } from "../../src/word-wrap";

const RED_OPEN = "\u001B[31m";
const RED_CLOSE = "\u001B[39m";
const GREEN_OPEN = "\u001B[32m";
const GREEN_CLOSE = "\u001B[39m";

describe("getStringWidth in workerd", () => {
    it("should measure plain ascii, cjk and mixed strings", () => {
        expect.assertions(8);

        expect(getStringWidth("")).toBe(0);
        expect(getStringWidth("abcde")).toBe(5);
        expect(getStringWidth("古池や")).toBe(6);
        expect(getStringWidth("あいうabc")).toBe(9);
        expect(getStringWidth("你好")).toBe(4);
        expect(getStringWidth("안녕하세요")).toBe(10);
        expect(getStringWidth("ノード.js")).toBe(9);
        expect(getStringWidth("───────────────")).toBe(15);
    });

    it("should apply the ambiguousIsNarrow option", () => {
        expect.assertions(3);

        expect(getStringWidth("あいう★")).toBe(8);
        expect(getStringWidth("あいう★", { ambiguousIsNarrow: true })).toBe(7);
        expect(getStringWidth("⛣", { ambiguousIsNarrow: false })).toBe(2);
    });

    it("should measure emoji, skin-tone and variation-selector sequences", () => {
        expect.assertions(6);

        expect(getStringWidth("👩")).toBe(2);
        expect(getStringWidth("👩🏿")).toBe(2);
        expect(getStringWidth("⌚")).toBe(2);
        expect(getStringWidth("↔️")).toBe(2);
        expect(getStringWidth("🔀")).toBe(2);
        expect(getStringWidth("👋 hello")).toBe(8);
    });

    it("should collapse combining marks and thai vowel marks to zero width", () => {
        expect.assertions(4);

        expect(getStringWidth("é")).toBe(1);
        expect(getStringWidth("กั")).toBe(1);
        expect(getStringWidth("ปฏัก")).toBe(3);
        expect(getStringWidth("_ิ")).toBe(1);
    });

    it("should ignore ansi escapes unless countAnsiEscapeCodes is set", () => {
        expect.assertions(4);

        expect(getStringWidth(`${RED_OPEN}${RED_CLOSE}`)).toBe(0);
        expect(getStringWidth(`${RED_OPEN}${RED_CLOSE}`, { countAnsiEscapeCodes: true })).toBe(10);
        expect(getStringWidth(`${RED_OPEN}unicorn${RED_CLOSE}`)).toBe(7);
        expect(getStringWidth("\u001B]8;;https://github.com\u0007Click\u001B]8;;\u0007")).toBe(5);
    });

    it("should honour custom per-class widths", () => {
        expect.assertions(3);

        expect(getStringWidth("hello", { regularWidth: 2 })).toBe(10);
        expect(getStringWidth("\t", { tabWidth: 4 })).toBe(4);
        expect(getStringWidth("👋", { emojiWidth: 3 })).toBe(3);
    });

    it("should report truncation metadata through getStringTruncatedWidth", () => {
        expect.assertions(3);

        const result = getStringTruncatedWidth("hello world", { ellipsis: "…", limit: 5 });

        expect(result.truncated).toBe(true);
        expect(result.width).toBeLessThanOrEqual(5);
        expect(getStringTruncatedWidth("hello", { limit: Number.POSITIVE_INFINITY }).truncated).toBe(false);
    });
});

describe("truncate in workerd", () => {
    it("should truncate from the end by default", () => {
        expect.assertions(6);

        expect(truncate("unicorn", 4)).toBe("uni…");
        expect(truncate("unicorn", 1)).toBe("…");
        expect(truncate("unicorn", 0)).toBe("");
        expect(truncate("unicorn", 20)).toBe("unicorn");
        expect(truncate("unicorn", 7)).toBe("unicorn");
        expect(truncate("unicorn", 6)).toBe("unico…");
    });

    it("should truncate from the start and middle", () => {
        expect.assertions(3);

        expect(truncate("unicorn", 5, { position: "start" })).toBe("…corn");
        expect(truncate("unicorn", 5, { position: "middle" })).toBe("un…rn");
        expect(truncate("unicorns rainbow dragons", 20, { position: "middle" })).toBe("unicorns r…w dragons");
    });

    it("should keep ansi styling intact while truncating", () => {
        expect.assertions(2);

        expect(truncate(`${RED_OPEN}unicorn${RED_CLOSE}`, 7)).toBe(`${RED_OPEN}unicorn${RED_CLOSE}`);
        expect(truncate(`${RED_OPEN}unicorn${RED_CLOSE}`, 4)).toBe(`${RED_OPEN}uni${RED_CLOSE}…`);
    });

    it("should truncate full-width text on grapheme boundaries", () => {
        expect.assertions(1);

        expect(truncate("안녕하세요", 3, { width: { fullWidth: 2 } })).toBe("안…");
    });
});

describe("wordWrap in workerd", () => {
    it("should wrap on word boundaries", () => {
        expect.assertions(2);

        expect(wordWrap("aaa bbb ccc", { width: 4 })).toBe("aaa\nbbb\nccc");
        expect(wordWrap("The quick brown fox", { width: 10 })).toBe("The quick\nbrown fox");
    });

    it("should respect PRESERVE_WORDS and STRICT_WIDTH modes", () => {
        expect.assertions(2);

        expect(wordWrap("abcdefghij", { width: 5, wrapMode: WrapMode.PRESERVE_WORDS })).toBe("abcdefghij");
        expect(wordWrap("abcdefghij", { width: 5, wrapMode: WrapMode.STRICT_WIDTH })).toBe("abcde\nfghij");
    });

    it("should keep each wrapped line within the requested visual width", () => {
        expect.assertions(1);

        const wrapped = wordWrap(`The quick brown ${RED_OPEN}fox jumped over${RED_CLOSE} the lazy dog`, { width: 20 });

        expect(wrapped.split("\n").every((line) => getStringWidth(line) <= 20)).toBe(true);
    });

    it("should wrap wide cjk text without exceeding the width", () => {
        expect.assertions(1);

        const wrapped = wordWrap("古池や蛙飛び込む水の音", { width: 6, wrapMode: WrapMode.STRICT_WIDTH });

        expect(wrapped.split("\n").every((line) => getStringWidth(line) <= 6)).toBe(true);
    });
});

describe("slice in workerd", () => {
    it("should slice plain strings by visual width", () => {
        expect.assertions(3);

        expect(slice("hello world", 0, 5)).toBe("hello");
        expect(slice("hello world", 6)).toBe("world");
        expect(slice("古池や蛙", 0, 4)).toBe("古池");
    });

    it("should preserve ansi styling across slice boundaries", () => {
        expect.assertions(2);

        const fixture = `${RED_OPEN}the ${RED_CLOSE}${GREEN_OPEN}quick${GREEN_CLOSE}`;

        expect(getStringWidth(slice(fixture, 0, 4))).toBe(4);
        expect(slice(fixture, 0, 4)).toContain(RED_OPEN);
    });

    it("should not split an emoji in half", () => {
        expect.assertions(1);

        expect(slice("👋👋👋", 0, 2)).toBe("👋");
    });
});

describe("case conversion in workerd", () => {
    it("should convert between the common cases", () => {
        expect.assertions(5);

        expect(camelCase("foo-bar-baz")).toBe("fooBarBaz");
        expect(pascalCase("foo-bar-baz")).toBe("FooBarBaz");
        expect(snakeCase("fooBarBaz")).toBe("foo_bar_baz");
        expect(kebabCase("fooBarBaz")).toBe("foo-bar-baz");
        expect(titleCase("foo bar baz")).toBe("Foo Bar Baz");
    });

    it("should split identifiers into their segments", () => {
        expect.assertions(3);

        expect(splitByCase("fooBarBaz")).toStrictEqual(["foo", "Bar", "Baz"]);
        expect(splitByCase("XMLHttpRequest")).toStrictEqual(["XML", "Http", "Request"]);
        expect(splitByCase("foo_bar-baz/qux")).toStrictEqual(["foo", "bar", "baz", "qux"]);
    });

    it("should flip case", () => {
        expect.assertions(3);

        expect(flipCase("FooBar")).toBe("fOObAR");
        expect(flipCase("foobar")).toBe("FOOBAR");
        expect(flipCase("FOOBAR")).toBe("foobar");
    });

    it("should strip ansi before converting when asked to", () => {
        expect.assertions(2);

        expect(flipCase(`${RED_OPEN}FooBar${RED_CLOSE}`, { stripAnsi: true })).toBe("fOObAR");
        expect(splitByCase(`${RED_OPEN}fooBar${RED_CLOSE}`, { stripAnsi: true })).toStrictEqual(["foo", "Bar"]);
    });

    it("should honour Intl-backed locale casing rules", () => {
        expect.assertions(4);

        // Turkish dotless-i: `i`.toLocaleUpperCase("tr") is `İ`, not `I`.
        expect(upperFirst("istanbul", { locale: "tr" })).toBe("İstanbul");
        expect(upperFirst("istanbul")).toBe("Istanbul");
        expect("i".toLocaleUpperCase("tr")).toBe("İ");
        expect("I".toLocaleLowerCase("tr")).toBe("ı");
    });

    it("should handle the german eszett", () => {
        expect.assertions(2);

        expect(camelCase("straße-test")).toBe("straßeTest");
        expect(snakeCase("GROSSE STRASSE")).toBe("grosse_strasse");
    });
});

describe("transliteration and slugify in workerd", () => {
    it("should transliterate non-ascii scripts", () => {
        expect.assertions(3);

        expect(transliterate("Привет")).toBe("Privet");
        expect(transliterate("你好")).toBe("Ni Hao");
        expect(transliterate("Ä Ð Ø")).toBe("Ae D Oe");
    });

    it("should build url-safe slugs", () => {
        expect.assertions(3);

        expect(slugify("Hello World")).toBe("hello-world");
        expect(slugify("Größe")).toBe("groesse");
        expect(slugify("Größe", { locale: "de" })).toBe("groesse");
    });
});

describe("misc string helpers in workerd", () => {
    it("should align text against the widest line", () => {
        expect.assertions(2);

        expect(alignText("one two three\nfour five")).toBe("one two three\n  four five");
        expect(alignText("one two three\nfour five", { align: "right" })).toBe("one two three\n    four five");
    });

    it("should indent, dedent and outdent", () => {
        expect.assertions(3);

        expect(indent("a\nb", 2)).toBe("  a\n  b");
        expect(dedent("  a\n  b")).toBe("a\nb");
        expect(outdent`
            hello
            world
        `).toBe("hello\nworld");
    });

    it("should compute levenshtein distances and pick the closest match", () => {
        expect.assertions(3);

        expect(distance("kitten", "sitting")).toBe(3);
        expect(similarity("hello", "hello")).toBe(1);
        expect(closest("helo", ["hello", "goodbye"])).toBe("hello");
    });

    it("should count occurrences and replace substrings", () => {
        expect.assertions(2);

        expect(countOccurrences("abcabc", "abc")).toBe(2);
        expect(replaceString("Hello world, hello universe", [["hello", "Hi"]], [])).toBe("Hello world, Hi universe");
    });

    it("should detect text direction", () => {
        expect.assertions(3);

        expect(direction("hello")).toBe("ltr");
        expect(direction("שלום")).toBe("rtl");
        expect(direction("123")).toBe("neutral");
    });

    it("should strip html and build excerpts", () => {
        expect.assertions(2);

        expect(excerpt("<p>Hello world</p>", 11)).toBe("Hello world");
        expect(excerpt("<p>Hello <strong>world</strong>!</p>", 10)).toBe("Hello wor…");
    });
});
