/* eslint-disable e18e/ban-dependencies */
import stringWidth from "string-width";
import { bench, describe } from "vitest";

import { getStringWidth } from "../src";

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

        bench.skipIf(process.env.CODSPEED_ENV)("string-width", () => {
            stringWidth(simpleString);
        });
    });

    describe("ANSI string (getStringWidth)", () => {
        bench("@visulima/string getStringWidth", () => {
            getStringWidth(ansiString);
        });

        bench.skipIf(process.env.CODSPEED_ENV)("string-width", () => {
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

        bench.skipIf(process.env.CODSPEED_ENV)("string-width", () => {
            stringWidth(unicodeString);
        });
    });

    describe("mixed content (getStringWidth)", () => {
        bench("@visulima/string getStringWidth", () => {
            getStringWidth(mixedString);
        });

        bench.skipIf(process.env.CODSPEED_ENV)("string-width", () => {
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

        bench.skipIf(process.env.CODSPEED_ENV)("string-width", () => {
            stringWidth(ambiguousString);
        });
    });

    describe("control characters (getStringWidth)", () => {
        bench("@visulima/string getStringWidth", () => {
            getStringWidth(controlString);
        });

        bench.skipIf(process.env.CODSPEED_ENV)("string-width", () => {
            stringWidth(controlString);
        });
    });

    describe("custom width options (getStringWidth)", () => {
        bench("@visulima/string getStringWidth (custom widths)", () => {
            getStringWidth(mixedString, {
                emojiWidth: 2,
                fullWidth: 2,
                regularWidth: 1,
                tabWidth: 4,
            });
        });

        bench.skipIf(process.env.CODSPEED_ENV)("string-width", () => {
            stringWidth(mixedString);
        });
    });

    describe("half-width katakana (getStringWidth)", () => {
        bench("@visulima/string getStringWidth", () => {
            getStringWidth(katakanaString);
        });

        bench.skipIf(process.env.CODSPEED_ENV)("string-width", () => {
            stringWidth(katakanaString);
        });
    });

    describe("long string (getStringWidth)", () => {
        bench("@visulima/string getStringWidth", () => {
            getStringWidth(longString);
        });

        bench.skipIf(process.env.CODSPEED_ENV)("string-width", () => {
            stringWidth(longString);
        });
    });
});
