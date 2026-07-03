import ansiTruncate from "ansi-truncate";
import cliTruncate from "cli-truncate";
import { bench, describe } from "vitest";

import { truncate } from "../src/truncate";

describe("truncate", () => {
    const simpleString = "The quick brown fox jumps over the lazy dog";
    const ansiString = "\u001B[31mThe quick\u001B[39m \u001B[32mbrown fox\u001B[39m \u001B[34mjumps\u001B[39m";
    const unicodeString = "👨‍👩‍👧‍👦 The quick 你好 brown 안녕하세요 fox";
    const mixedString = "\u001B[31m你好\u001B[39m world 👨‍👩‍👧‍👦 안녕하세요";

    describe("simple string", () => {
        bench("@visulima/string truncate", () => {
            truncate(simpleString, 20);
        });

        bench.skipIf(process.env.CODSPEED_ENV)("cli-truncate", () => {
            cliTruncate(simpleString, 20);
        });

        bench.skipIf(process.env.CODSPEED_ENV)("ansi-truncate", () => {
            ansiTruncate(simpleString, 20);
        });
    });

    describe("ANSI string", () => {
        bench("@visulima/string truncate", () => {
            truncate(ansiString, 20);
        });

        bench.skipIf(process.env.CODSPEED_ENV)("cli-truncate", () => {
            cliTruncate(ansiString, 20);
        });

        bench.skipIf(process.env.CODSPEED_ENV)("ansi-truncate", () => {
            ansiTruncate(ansiString, 20);
        });
    });

    describe("Unicode string", () => {
        bench("@visulima/string truncate", () => {
            truncate(unicodeString, 20, { width: { emojiWidth: 2, fullWidth: 2 } });
        });

        bench.skipIf(process.env.CODSPEED_ENV)("cli-truncate", () => {
            cliTruncate(unicodeString, 20);
        });

        bench.skipIf(process.env.CODSPEED_ENV)("ansi-truncate", () => {
            ansiTruncate(unicodeString, 20);
        });
    });

    describe("mixed content", () => {
        bench("@visulima/string truncate", () => {
            truncate(mixedString, 20, { width: { emojiWidth: 2, fullWidth: 2 } });
        });

        bench.skipIf(process.env.CODSPEED_ENV)("cli-truncate", () => {
            cliTruncate(mixedString, 20);
        });

        bench.skipIf(process.env.CODSPEED_ENV)("ansi-truncate", () => {
            ansiTruncate(mixedString, 20);
        });
    });

    describe("position truncation", () => {
        bench("@visulima/string truncate - start", () => {
            truncate(simpleString, 20, { position: "start" });
        });

        bench.skipIf(process.env.CODSPEED_ENV)("cli-truncate - start", () => {
            cliTruncate(simpleString, 20, { position: "start" });
        });

        bench("@visulima/string truncate - middle", () => {
            truncate(simpleString, 20, { position: "middle" });
        });

        bench.skipIf(process.env.CODSPEED_ENV)("cli-truncate - middle", () => {
            cliTruncate(simpleString, 20, { position: "middle" });
        });
    });

    describe("space-aware truncation", () => {
        bench("@visulima/string truncate", () => {
            truncate(simpleString, 20, { preferTruncationOnSpace: true });
        });

        bench.skipIf(process.env.CODSPEED_ENV)("cli-truncate", () => {
            cliTruncate(simpleString, 20, { space: true });
        });
    });

    describe("custom ellipsis", () => {
        bench("@visulima/string truncate", () => {
            truncate(simpleString, 20, { ellipsis: "..." });
        });

        bench.skipIf(process.env.CODSPEED_ENV)("cli-truncate", () => {
            cliTruncate(simpleString, 20, { truncationCharacter: "..." });
        });

        bench.skipIf(process.env.CODSPEED_ENV)("ansi-truncate", () => {
            ansiTruncate(simpleString, 20, { ellipsis: "..." });
        });
    });
});
