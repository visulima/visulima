/* eslint-disable e18e/ban-dependencies */
import stringWidth from "string-width";
import { describe, test } from "vitest";

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
        test("@visulima/string getStringWidth", async ({ bench }) => {
            await bench("@visulima/string getStringWidth", () => {
                getStringWidth(simpleString);
            }).run();
        });

        test.skipIf(process.env.CODSPEED_ENV)("string-width", async ({ bench }) => {
            await bench("string-width", () => {
                stringWidth(simpleString);
            }).run();
        });
    });

    describe("ANSI string (getStringWidth)", () => {
        test("@visulima/string getStringWidth", async ({ bench }) => {
            await bench("@visulima/string getStringWidth", () => {
                getStringWidth(ansiString);
            }).run();
        });

        test.skipIf(process.env.CODSPEED_ENV)("string-width", async ({ bench }) => {
            await bench("string-width", () => {
                stringWidth(ansiString);
            }).run();
        });

        test("@visulima/string getStringWidth (count ANSI)", async ({ bench }) => {
            await bench("@visulima/string getStringWidth (count ANSI)", () => {
                getStringWidth(ansiString, { countAnsiEscapeCodes: true });
            }).run();
        });
    });

    describe("Unicode string (getStringWidth)", () => {
        test("@visulima/string getStringWidth", async ({ bench }) => {
            await bench("@visulima/string getStringWidth", () => {
                getStringWidth(unicodeString);
            }).run();
        });

        test.skipIf(process.env.CODSPEED_ENV)("string-width", async ({ bench }) => {
            await bench("string-width", () => {
                stringWidth(unicodeString);
            }).run();
        });
    });

    describe("mixed content (getStringWidth)", () => {
        test("@visulima/string getStringWidth", async ({ bench }) => {
            await bench("@visulima/string getStringWidth", () => {
                getStringWidth(mixedString);
            }).run();
        });

        test.skipIf(process.env.CODSPEED_ENV)("string-width", async ({ bench }) => {
            await bench("string-width", () => {
                stringWidth(mixedString);
            }).run();
        });
    });

    describe("ambiguous-width characters (getStringWidth)", () => {
        test("@visulima/string getStringWidth (default)", async ({ bench }) => {
            await bench("@visulima/string getStringWidth (default)", () => {
                getStringWidth(ambiguousString);
            }).run();
        });

        test("@visulima/string getStringWidth (narrow)", async ({ bench }) => {
            await bench("@visulima/string getStringWidth (narrow)", () => {
                getStringWidth(ambiguousString, { ambiguousIsNarrow: true });
            }).run();
        });

        test.skipIf(process.env.CODSPEED_ENV)("string-width", async ({ bench }) => {
            await bench("string-width", () => {
                stringWidth(ambiguousString);
            }).run();
        });
    });

    describe("control characters (getStringWidth)", () => {
        test("@visulima/string getStringWidth", async ({ bench }) => {
            await bench("@visulima/string getStringWidth", () => {
                getStringWidth(controlString);
            }).run();
        });

        test.skipIf(process.env.CODSPEED_ENV)("string-width", async ({ bench }) => {
            await bench("string-width", () => {
                stringWidth(controlString);
            }).run();
        });
    });

    describe("custom width options (getStringWidth)", () => {
        test("@visulima/string getStringWidth (custom widths)", async ({ bench }) => {
            await bench("@visulima/string getStringWidth (custom widths)", () => {
                getStringWidth(mixedString, {
                    emojiWidth: 2,
                    fullWidth: 2,
                    regularWidth: 1,
                    tabWidth: 4,
                });
            }).run();
        });

        test.skipIf(process.env.CODSPEED_ENV)("string-width", async ({ bench }) => {
            await bench("string-width", () => {
                stringWidth(mixedString);
            }).run();
        });
    });

    describe("half-width katakana (getStringWidth)", () => {
        test("@visulima/string getStringWidth", async ({ bench }) => {
            await bench("@visulima/string getStringWidth", () => {
                getStringWidth(katakanaString);
            }).run();
        });

        test.skipIf(process.env.CODSPEED_ENV)("string-width", async ({ bench }) => {
            await bench("string-width", () => {
                stringWidth(katakanaString);
            }).run();
        });
    });

    describe("long string (getStringWidth)", () => {
        test("@visulima/string getStringWidth", async ({ bench }) => {
            await bench("@visulima/string getStringWidth", () => {
                getStringWidth(longString);
            }).run();
        });

        test.skipIf(process.env.CODSPEED_ENV)("string-width", async ({ bench }) => {
            await bench("string-width", () => {
                stringWidth(longString);
            }).run();
        });
    });
});
