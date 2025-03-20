import { bench, describe } from "vitest";
import stringWidth from "string-width";
import { getStringWidth, getStringTruncatedWidth } from "../src";

describe("string width", () => {
    const simpleString = "The quick brown fox jumps over the lazy dog";
    const ansiString = "\u001B[31mThe quick\u001B[39m \u001B[32mbrown fox\u001B[39m \u001B[34mjumps\u001B[39m";
    const unicodeString = "👨‍👩‍👧‍👦 The quick 你好 brown 안녕하세요 fox";
    const mixedString = "\u001B[31m你好\u001B[39m world 👨‍👩‍👧‍👦 안녕하세요";
    const ambiguousString = "ｈｅｌｌｏ ｗｏｒｌｄ";
    const controlString = "Hello\tWorld\nNew\rLine";
    const katakanaString = "ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜｦﾝ";
    const longString = simpleString.repeat(1000); // ~44,000 characters

    describe("simple ASCII string (getStringWidth)", () => {
        bench("@visulima/string getStringWidth", () => {
            getStringWidth(simpleString);
        });

        bench("string-width", () => {
            stringWidth(simpleString);
        });
    });

    describe("ANSI string (getStringWidth)", () => {
        bench("@visulima/string getStringWidth", () => {
            getStringWidth(ansiString);
        });

        bench("string-width", () => {
            stringWidth(ansiString);
        });

        bench("@visulima/string getStringWidth (count ANSI)", () => {
            getStringWidth(ansiString, { countAnsiEscapeCodes: true });
        });
    });

    describe("Unicode string (getStringWidth)", () => {
        bench("@visulima/string getStringWidth", () => {
            getStringWidth(unicodeString);
        });

        bench("string-width", () => {
            stringWidth(unicodeString);
        });
    });

    describe("mixed content (getStringWidth)", () => {
        bench("@visulima/string getStringWidth", () => {
            getStringWidth(mixedString);
        });

        bench("string-width", () => {
            stringWidth(mixedString);
        });
    });

    describe("ambiguous-width characters (getStringWidth)", () => {
        bench("@visulima/string getStringWidth (default)", () => {
            getStringWidth(ambiguousString);
        });

        bench("@visulima/string getStringWidth (narrow)", () => {
            getStringWidth(ambiguousString, { ambiguousIsNarrow: true });
        });

        bench("string-width", () => {
            stringWidth(ambiguousString);
        });
    });

    describe("control characters (getStringWidth)", () => {
        bench("@visulima/string getStringWidth", () => {
            getStringWidth(controlString);
        });

        bench("string-width", () => {
            stringWidth(controlString);
        });
    });

    describe("custom width options (getStringWidth)", () => {
        bench("@visulima/string getStringWidth (custom widths)", () => {
            getStringWidth(mixedString, {
                ambiguousWidth: 2,
                emojiWidth: 2,
                fullWidth: 2,
                regularWidth: 1,
                tabWidth: 4,
            });
        });

        bench("string-width", () => {
            stringWidth(mixedString);
        });
    });

    describe("simple ASCII string (getStringTruncatedWidth)", () => {
        bench("@visulima/string getStringTruncatedWidth", () => {
            getStringTruncatedWidth(simpleString, { limit: 20 });
        });
    });

    describe("ANSI string (getStringTruncatedWidth)", () => {
        bench("@visulima/string getStringTruncatedWidth", () => {
            getStringTruncatedWidth(ansiString, { limit: 20 });
        });

        bench("@visulima/string getStringTruncatedWidth (count ANSI)", () => {
            getStringTruncatedWidth(ansiString, { limit: 20, countAnsiEscapeCodes: true });
        });
    });

    describe("Unicode string (getStringTruncatedWidth)", () => {
        bench("@visulima/string getStringTruncatedWidth", () => {
            getStringTruncatedWidth(unicodeString, { limit: 20 });
        });
    });

    describe("mixed content (getStringTruncatedWidth)", () => {
        bench("@visulima/string getStringTruncatedWidth", () => {
            getStringTruncatedWidth(mixedString, { limit: 20 });
        });
    });

    describe("ambiguous-width characters (getStringTruncatedWidth)", () => {
        bench("@visulima/string getStringTruncatedWidth (default)", () => {
            getStringTruncatedWidth(ambiguousString, { limit: 20 });
        });

        bench("@visulima/string getStringTruncatedWidth (narrow)", () => {
            getStringTruncatedWidth(ambiguousString, { limit: 20, ambiguousIsNarrow: true });
        });
    });

    describe("control characters (getStringTruncatedWidth)", () => {
        bench("@visulima/string getStringTruncatedWidth", () => {
            getStringTruncatedWidth(controlString, { limit: 20 });
        });
    });

    describe("custom width options (getStringTruncatedWidth)", () => {
        bench("@visulima/string getStringTruncatedWidth (custom widths)", () => {
            getStringTruncatedWidth(mixedString, {
                limit: 20,
                ambiguousWidth: 2,
                emojiWidth: 2,
                fullWidth: 2,
                regularWidth: 1,
                tabWidth: 4,
            });
        });
    });

    describe("half-width katakana (getStringWidth)", () => {
        bench("@visulima/string getStringWidth", () => {
            getStringWidth(katakanaString);
        });

        bench("string-width", () => {
            stringWidth(katakanaString);
        });
    });

    describe("half-width katakana (getStringTruncatedWidth)", () => {
        bench("@visulima/string getStringTruncatedWidth", () => {
            getStringTruncatedWidth(katakanaString, { limit: 20 });
        });

        bench("@visulima/string getStringTruncatedWidth (narrow)", () => {
            getStringTruncatedWidth(katakanaString, { limit: 20, ambiguousIsNarrow: true });
        });
    });

    describe("long string (getStringWidth)", () => {
        bench("@visulima/string getStringWidth", () => {
            getStringWidth(longString);
        });

        bench("string-width", () => {
            stringWidth(longString);
        });
    });

    describe("long string (getStringTruncatedWidth)", () => {
        bench("@visulima/string getStringTruncatedWidth", () => {
            getStringTruncatedWidth(longString, { limit: 1000 });
        });

        bench("@visulima/string getStringTruncatedWidth (with cache)", () => {
            getStringTruncatedWidth(longString, { limit: 1000 });
        });
    });

    describe("with ellipsis (getStringTruncatedWidth)", () => {
        bench("@visulima/string getStringTruncatedWidth (default ellipsis)", () => {
            getStringTruncatedWidth(simpleString, { limit: 20, ellipsis: "…" });
        });

        bench("@visulima/string getStringTruncatedWidth (custom ellipsis)", () => {
            getStringTruncatedWidth(simpleString, { limit: 20, ellipsis: "..." });
        });

        bench("@visulima/string getStringTruncatedWidth (ANSI ellipsis)", () => {
            getStringTruncatedWidth(simpleString, { limit: 20, ellipsis: "\u001B[31m...\u001B[39m" });
        });
    });
});
