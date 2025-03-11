import { bench, describe } from "vitest";
import { green, red } from "@visulima/colorize";

import { wordWrap, WrapMode } from "../src/word-wrap";
import wrapAnsi from "wrap-ansi";

const shortText = "The quick brown fox jumped over the lazy dog";
const mediumText =
    "The quick brown fox jumped over the lazy dog and then ran away with the unicorn. The quick brown fox jumped over the lazy dog and then ran away with the unicorn.";
const longText = `The quick brown fox jumped over the lazy dog and then ran away with the unicorn.
This is a multi-line text with several paragraphs.
Each paragraph might have different lengths and wrapping needs.

Some paragraphs are short.
Others are much longer and contain more content that needs to be wrapped properly without breaking words unless absolutely necessary.

The final paragraph includes some ANSI-colored text with ${red("red highlights")} and ${green("green highlights")} to test how the wrapping functions handle ANSI escape sequences correctly.`;

const complexText = `The quick brown ${red("fox jumped over")} the lazy ${green("dog and then ran away with the unicorn.")}
This text contains ${green("nested")} ANSI ${red("colors")} ${green("and")} multiple ${red("sequences")} on the ${green("same")} line.
It also has very long words like supercalifragilisticexpialidocious and antidisestablishmentarianism.`;

const fixtures = {
    short: shortText,
    medium: mediumText,
    long: longText,
    complex: complexText,
    emoji: "🚀 Rockets and 🌟 stars are flying across the 🌌 galaxy! 🪐 Planets align while 🌍 Earth watches from afar.",
    unicode: "Unicode characters like résumé, café, piñata, über, and noël can be challenging for wrapping algorithms.",
    spaces: "   This    text     has     many    spaces     between     words     that     should     be     handled     correctly.   ",
    hyperlinks:
        "Check out \u001B]8;;https://www.example.com\u0007my website\u001B]8;;\u0007, it is \u001B]8;;https://www.example.com\u0007supercalifragilisticexpialidocious\u001B]8;;\u0007.",
};

describe("Word Wrap Benchmarks", () => {
    const widths = [20, 40, 80];

    // First section: Direct comparison between wordWrap and wrap-ansi
    describe("Direct Comparison: wordWrap vs wrap-ansi", () => {
        // Common settings comparison - default modes
        describe("Default settings (preserve words)", () => {
            for (const [name, text] of Object.entries(fixtures)) {
                for (const width of widths) {
                    bench(`wordWrap - ${name} at width ${width}`, () => {
                        wordWrap(text, { width }); // Default is PRESERVE_WORDS
                    });

                    bench(`wrap-ansi - ${name} at width ${width}`, () => {
                        wrapAnsi(text, width, { hard: false }); // false = preserve words
                    });
                }
            }
        });

        // Hard break comparison (STRICT_WIDTH vs hard: true)
        describe("Hard breaks (STRICT_WIDTH vs hard: true)", () => {
            for (const [name, text] of Object.entries(fixtures)) {
                for (const width of widths) {
                    bench(`wordWrap - ${name} at width ${width}`, () => {
                        wordWrap(text, { width, wrapMode: WrapMode.STRICT_WIDTH });
                    });

                    bench(`wrap-ansi - ${name} at width ${width}`, () => {
                        wrapAnsi(text, width, { hard: true });
                    });
                }
            }
        });

        // ANSI color handling comparison
        describe("ANSI color handling", () => {
            bench("wordWrap - complex ANSI text", () => {
                wordWrap(complexText, { width: 40 });
            });

            bench("wrap-ansi - complex ANSI text", () => {
                wrapAnsi(complexText, 40, { hard: false });
            });
        });

        // Trimming comparison
        describe("Space handling", () => {
            bench("wordWrap - with trim=true (default)", () => {
                wordWrap(fixtures.spaces, { width: 40 });
            });

            bench("wordWrap - with trim=false", () => {
                wordWrap(fixtures.spaces, { width: 40, trim: false });
            });

            bench("wrap-ansi - with trim=true", () => {
                wrapAnsi(fixtures.spaces, 40, { hard: false, trim: true });
            });

            bench("wrap-ansi - with trim=false", () => {
                wrapAnsi(fixtures.spaces, 40, { hard: false, trim: false });
            });
        });
    });

    // Additional detailed benchmarks
    describe("Detailed wordWrap Mode Benchmarks", () => {
        describe("PRESERVE_WORDS mode (default)", () => {
            for (const [name, text] of Object.entries(fixtures)) {
                for (const width of widths) {
                    bench(`${name} text at width ${width}`, () => {
                        wordWrap(text, { width });
                    });
                }
            }
        });

        describe("BREAK_AT_CHARACTERS mode", () => {
            for (const [name, text] of Object.entries(fixtures)) {
                for (const width of widths) {
                    bench(`${name} text at width ${width}`, () => {
                        wordWrap(text, { width, wrapMode: WrapMode.BREAK_AT_CHARACTERS });
                    });
                }
            }
        });

        describe("STRICT_WIDTH mode", () => {
            for (const [name, text] of Object.entries(fixtures)) {
                for (const width of widths) {
                    bench(`${name} text at width ${width}`, () => {
                        wordWrap(text, { width, wrapMode: WrapMode.STRICT_WIDTH });
                    });
                }
            }
        });
    });
    
    // Benchmark specific edge cases
    describe("Edge Cases", () => {
        bench("Empty string", () => {
            wordWrap("", { width: 10 });
        });

        bench("String exactly at width", () => {
            wordWrap("1234567890", { width: 10 });
        });

        bench("Single character", () => {
            wordWrap("a", { width: 10 });
        });

        bench("Very long word", () => {
            wordWrap("supercalifragilisticexpialidocious", { width: 10 });
        });

        bench("Very narrow width", () => {
            wordWrap(longText, { width: 5 });
        });

        bench("Very wide width", () => {
            wordWrap(longText, { width: 200 });
        });
    });
});
