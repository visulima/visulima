import fastStringTruncatedWidth from "fast-string-truncated-width";
import { describe, test } from "vitest";

import { getStringTruncatedWidth } from "../src";

describe("string truncated width", () => {
    const simpleString = "The quick brown fox jumps over the lazy dog";
    const ansiString = "\u001B[31mThe quick\u001B[39m \u001B[32mbrown fox\u001B[39m \u001B[34mjumps\u001B[39m";
    const unicodeString = "👨‍👩‍👧‍👦 The quick 你好 brown 안녕하세요 fox";
    const mixedString = "\u001B[31m你好\u001B[39m world 👨‍👩‍👧‍👦 안녕하세요";
    const ambiguousString = "ｈｅｌｌｏ ｗｏｒｌｄ";
    const controlString = "Hello\tWorld\nNew\rLine";

    describe("simple ASCII string", () => {
        test("@visulima/string getStringTruncatedWidth", async ({ bench }) => {
            await bench("@visulima/string getStringTruncatedWidth", () => {
                getStringTruncatedWidth(simpleString, { limit: 20 });
            }).run();
        });

        test.skipIf(process.env.CODSPEED_ENV)("fast-string-truncated-width", async ({ bench }) => {
            await bench("fast-string-truncated-width", () => {
                fastStringTruncatedWidth(simpleString, { limit: 20 });
            }).run();
        });
    });

    describe("ANSI string", () => {
        test("@visulima/string getStringTruncatedWidth", async ({ bench }) => {
            await bench("@visulima/string getStringTruncatedWidth", () => {
                getStringTruncatedWidth(ansiString, { limit: 20 });
            }).run();
        });

        test.skipIf(process.env.CODSPEED_ENV)("fast-string-truncated-width", async ({ bench }) => {
            await bench("fast-string-truncated-width", () => {
                fastStringTruncatedWidth(ansiString, { limit: 20 });
            }).run();
        });

        test("@visulima/string getStringTruncatedWidth (count ANSI)", async ({ bench }) => {
            await bench("@visulima/string getStringTruncatedWidth (count ANSI)", () => {
                getStringTruncatedWidth(ansiString, { countAnsiEscapeCodes: true, limit: 20 });
            }).run();
        });

        test.skipIf(process.env.CODSPEED_ENV)("fast-string-truncated-width (count ANSI)", async ({ bench }) => {
            await bench("fast-string-truncated-width (count ANSI)", () => {
                fastStringTruncatedWidth(ansiString, { countAnsiEscapeCodes: true, limit: 20 });
            }).run();
        });
    });

    describe("Unicode string", () => {
        test("@visulima/string getStringTruncatedWidth", async ({ bench }) => {
            await bench("@visulima/string getStringTruncatedWidth", () => {
                getStringTruncatedWidth(unicodeString, { limit: 20 });
            }).run();
        });

        test.skipIf(process.env.CODSPEED_ENV)("fast-string-truncated-width", async ({ bench }) => {
            await bench("fast-string-truncated-width", () => {
                fastStringTruncatedWidth(unicodeString, { limit: 20 });
            }).run();
        });
    });

    describe("mixed content", () => {
        test("@visulima/string getStringTruncatedWidth", async ({ bench }) => {
            await bench("@visulima/string getStringTruncatedWidth", () => {
                getStringTruncatedWidth(mixedString, { limit: 20 });
            }).run();
        });

        test.skipIf(process.env.CODSPEED_ENV)("fast-string-truncated-width", async ({ bench }) => {
            await bench("fast-string-truncated-width", () => {
                fastStringTruncatedWidth(mixedString, { limit: 20 });
            }).run();
        });
    });

    describe("ambiguous-width characters", () => {
        test("@visulima/string getStringTruncatedWidth (default)", async ({ bench }) => {
            await bench("@visulima/string getStringTruncatedWidth (default)", () => {
                getStringTruncatedWidth(ambiguousString, { limit: 20 });
            }).run();
        });

        test.skipIf(process.env.CODSPEED_ENV)("fast-string-truncated-width (default)", async ({ bench }) => {
            await bench("fast-string-truncated-width (default)", () => {
                fastStringTruncatedWidth(ambiguousString, { limit: 20 });
            }).run();
        });
    });

    describe("ambiguous-width characters (narrow)", () => {
        test("@visulima/string getStringTruncatedWidth (narrow)", async ({ bench }) => {
            await bench("@visulima/string getStringTruncatedWidth (narrow)", () => {
                getStringTruncatedWidth(ambiguousString, { ambiguousIsNarrow: true, limit: 20 });
            }).run();
        });

        test.skipIf(process.env.CODSPEED_ENV)("fast-string-truncated-width (narrow)", async ({ bench }) => {
            await bench("fast-string-truncated-width (narrow)", () => {
                fastStringTruncatedWidth(ambiguousString, { ambiguousIsNarrow: true, limit: 20 });
            }).run();
        });
    });

    describe("control characters", () => {
        test("@visulima/string getStringTruncatedWidth", async ({ bench }) => {
            await bench("@visulima/string getStringTruncatedWidth", () => {
                getStringTruncatedWidth(controlString, { limit: 20 });
            }).run();
        });

        test.skipIf(process.env.CODSPEED_ENV)("fast-string-truncated-width", async ({ bench }) => {
            await bench("fast-string-truncated-width", () => {
                fastStringTruncatedWidth(controlString, { limit: 20 });
            }).run();
        });
    });

    describe("custom width options", () => {
        test("@visulima/string getStringTruncatedWidth (custom widths)", async ({ bench }) => {
            await bench("@visulima/string getStringTruncatedWidth (custom widths)", () => {
                getStringTruncatedWidth(mixedString, {
                    emojiWidth: 2,
                    fullWidth: 2,
                    limit: 20,
                    regularWidth: 1,
                    tabWidth: 4,
                });
            }).run();
        });

        test.skipIf(process.env.CODSPEED_ENV)("fast-string-truncated-width (custom widths)", async ({ bench }) => {
            await bench("fast-string-truncated-width (custom widths)", () => {
                fastStringTruncatedWidth(mixedString, {
                    emojiWidth: 2,
                    fullWidth: 2,
                    limit: 20,
                    regularWidth: 1,
                    tabWidth: 4,
                });
            }).run();
        });
    });

    describe("with ellipsis", () => {
        test("@visulima/string getStringTruncatedWidth (default ellipsis)", async ({ bench }) => {
            await bench("@visulima/string getStringTruncatedWidth (default ellipsis)", () => {
                getStringTruncatedWidth(simpleString, { ellipsis: "…", limit: 20 });
            }).run();
        });

        test.skipIf(process.env.CODSPEED_ENV)("fast-string-truncated-width (default ellipsis)", async ({ bench }) => {
            await bench("fast-string-truncated-width (default ellipsis)", () => {
                fastStringTruncatedWidth(simpleString, { ellipsis: "…", limit: 20 });
            }).run();
        });

        test("@visulima/string getStringTruncatedWidth (custom ellipsis)", async ({ bench }) => {
            await bench("@visulima/string getStringTruncatedWidth (custom ellipsis)", () => {
                getStringTruncatedWidth(simpleString, { ellipsis: "...", limit: 20 });
            }).run();
        });

        test.skipIf(process.env.CODSPEED_ENV)("fast-string-truncated-width (custom ellipsis)", async ({ bench }) => {
            await bench("fast-string-truncated-width (custom ellipsis)", () => {
                fastStringTruncatedWidth(simpleString, { ellipsis: "...", limit: 20 });
            }).run();
        });

        test("@visulima/string getStringTruncatedWidth (ANSI ellipsis)", async ({ bench }) => {
            await bench("@visulima/string getStringTruncatedWidth (ANSI ellipsis)", () => {
                getStringTruncatedWidth(simpleString, { ellipsis: "\u001B[31m...\u001B[39m", limit: 20 });
            }).run();
        });

        test.skipIf(process.env.CODSPEED_ENV)("fast-string-truncated-width (ANSI ellipsis)", async ({ bench }) => {
            await bench("fast-string-truncated-width (ANSI ellipsis)", () => {
                fastStringTruncatedWidth(simpleString, { ellipsis: "\u001B[31m...\u001B[39m", limit: 20 });
            }).run();
        });
    });
});
