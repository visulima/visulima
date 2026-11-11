import ansiTruncate from "ansi-truncate";
import cliTruncate from "cli-truncate";
import { describe, test } from "vitest";

import { truncate } from "../src/truncate";

describe("truncate", () => {
    const simpleString = "The quick brown fox jumps over the lazy dog";
    const ansiString = "\u001B[31mThe quick\u001B[39m \u001B[32mbrown fox\u001B[39m \u001B[34mjumps\u001B[39m";
    const unicodeString = "👨‍👩‍👧‍👦 The quick 你好 brown 안녕하세요 fox";
    const mixedString = "\u001B[31m你好\u001B[39m world 👨‍👩‍👧‍👦 안녕하세요";

    describe("simple string", () => {
        test("@visulima/string truncate", async ({ bench }) => {
            await bench("@visulima/string truncate", () => {
                truncate(simpleString, 20);
            }).run();
        });

        test.skipIf(process.env.CODSPEED_ENV)("cli-truncate", async ({ bench }) => {
            await bench("cli-truncate", () => {
                cliTruncate(simpleString, 20);
            }).run();
        });

        test.skipIf(process.env.CODSPEED_ENV)("ansi-truncate", async ({ bench }) => {
            await bench("ansi-truncate", () => {
                ansiTruncate(simpleString, 20);
            }).run();
        });
    });

    describe("ANSI string", () => {
        test("@visulima/string truncate", async ({ bench }) => {
            await bench("@visulima/string truncate", () => {
                truncate(ansiString, 20);
            }).run();
        });

        test.skipIf(process.env.CODSPEED_ENV)("cli-truncate", async ({ bench }) => {
            await bench("cli-truncate", () => {
                cliTruncate(ansiString, 20);
            }).run();
        });

        test.skipIf(process.env.CODSPEED_ENV)("ansi-truncate", async ({ bench }) => {
            await bench("ansi-truncate", () => {
                ansiTruncate(ansiString, 20);
            }).run();
        });
    });

    describe("Unicode string", () => {
        test("@visulima/string truncate", async ({ bench }) => {
            await bench("@visulima/string truncate", () => {
                truncate(unicodeString, 20, { width: { emojiWidth: 2, fullWidth: 2 } });
            }).run();
        });

        test.skipIf(process.env.CODSPEED_ENV)("cli-truncate", async ({ bench }) => {
            await bench("cli-truncate", () => {
                cliTruncate(unicodeString, 20);
            }).run();
        });

        test.skipIf(process.env.CODSPEED_ENV)("ansi-truncate", async ({ bench }) => {
            await bench("ansi-truncate", () => {
                ansiTruncate(unicodeString, 20);
            }).run();
        });
    });

    describe("mixed content", () => {
        test("@visulima/string truncate", async ({ bench }) => {
            await bench("@visulima/string truncate", () => {
                truncate(mixedString, 20, { width: { emojiWidth: 2, fullWidth: 2 } });
            }).run();
        });

        test.skipIf(process.env.CODSPEED_ENV)("cli-truncate", async ({ bench }) => {
            await bench("cli-truncate", () => {
                cliTruncate(mixedString, 20);
            }).run();
        });

        test.skipIf(process.env.CODSPEED_ENV)("ansi-truncate", async ({ bench }) => {
            await bench("ansi-truncate", () => {
                ansiTruncate(mixedString, 20);
            }).run();
        });
    });

    describe("position truncation", () => {
        test("@visulima/string truncate - start", async ({ bench }) => {
            await bench("@visulima/string truncate - start", () => {
                truncate(simpleString, 20, { position: "start" });
            }).run();
        });

        test.skipIf(process.env.CODSPEED_ENV)("cli-truncate - start", async ({ bench }) => {
            await bench("cli-truncate - start", () => {
                cliTruncate(simpleString, 20, { position: "start" });
            }).run();
        });

        test("@visulima/string truncate - middle", async ({ bench }) => {
            await bench("@visulima/string truncate - middle", () => {
                truncate(simpleString, 20, { position: "middle" });
            }).run();
        });

        test.skipIf(process.env.CODSPEED_ENV)("cli-truncate - middle", async ({ bench }) => {
            await bench("cli-truncate - middle", () => {
                cliTruncate(simpleString, 20, { position: "middle" });
            }).run();
        });
    });

    describe("space-aware truncation", () => {
        test("@visulima/string truncate", async ({ bench }) => {
            await bench("@visulima/string truncate", () => {
                truncate(simpleString, 20, { preferTruncationOnSpace: true });
            }).run();
        });

        test.skipIf(process.env.CODSPEED_ENV)("cli-truncate", async ({ bench }) => {
            await bench("cli-truncate", () => {
                cliTruncate(simpleString, 20, { space: true });
            }).run();
        });
    });

    describe("custom ellipsis", () => {
        test("@visulima/string truncate", async ({ bench }) => {
            await bench("@visulima/string truncate", () => {
                truncate(simpleString, 20, { ellipsis: "..." });
            }).run();
        });

        test.skipIf(process.env.CODSPEED_ENV)("cli-truncate", async ({ bench }) => {
            await bench("cli-truncate", () => {
                cliTruncate(simpleString, 20, { truncationCharacter: "..." });
            }).run();
        });

        test.skipIf(process.env.CODSPEED_ENV)("ansi-truncate", async ({ bench }) => {
            await bench("ansi-truncate", () => {
                ansiTruncate(simpleString, 20, { ellipsis: "..." });
            }).run();
        });
    });
});
