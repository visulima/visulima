import { bench, describe } from "vitest";
import stringWidth from "string-width";
import { getStringWidth } from "../src";

describe("string width", () => {
    const simpleString = "The quick brown fox jumps over the lazy dog";
    const ansiString = "\u001B[31mThe quick\u001B[39m \u001B[32mbrown fox\u001B[39m \u001B[34mjumps\u001B[39m";
    const unicodeString = "👨‍👩‍👧‍👦 The quick 你好 brown 안녕하세요 fox";
    const mixedString = "\u001B[31m你好\u001B[39m world 👨‍👩‍👧‍👦 안녕하세요";
    const ambiguousString = "ｈｅｌｌｏ ｗｏｒｌｄ";
    const controlString = "Hello\tWorld\nNew\rLine";

    describe("simple ASCII string", () => {
        bench("@visulima/string getStringWidth", () => {
            getStringWidth(simpleString);
        });

        bench("string-width", () => {
            stringWidth(simpleString);
        });
    });

    describe("ANSI string", () => {
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

    describe("Unicode string", () => {
        bench("@visulima/string getStringWidth", () => {
            getStringWidth(unicodeString);
        });

        bench("string-width", () => {
            stringWidth(unicodeString);
        });
    });

    describe("mixed content", () => {
        bench("@visulima/string getStringWidth", () => {
            getStringWidth(mixedString);
        });

        bench("string-width", () => {
            stringWidth(mixedString);
        });
    });

    describe("ambiguous-width characters", () => {
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

    describe("control characters", () => {
        bench("@visulima/string getStringWidth", () => {
            getStringWidth(controlString);
        });

        bench("string-width", () => {
            stringWidth(controlString);
        });
    });

    describe("custom width options", () => {
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

});
