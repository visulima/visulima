import { bench, describe } from "vitest";
import { toLowerCase } from "../src/case/utils/to-lower-case";
import { toUpperCase } from "../src/case/utils/to-upper-case";

const TEST_STRINGS = [
    "foo bar",
    "Foo Bar",
    "fooBar",
    "FooBar",
    "foo-bar",
    "FOO_BAR",
    "foo.bar",
    "foo_bar",
    "foo🎉bar",
    "foo\u001B[31mbar\u001B[0m", // ANSI colored string
    "foo__bar___baz",
    "FOO_BAR_BAZ",
    "foo.bar.baz",
    "fooBarBaz",
    "Foo Bar Baz",
];

describe("Case Utility Functions Benchmark", () => {
    // toLowerCase vs fastLowerCase
    describe("toLowerCase", () => {
        bench("native toLowerCase", () => {
            for (const str of TEST_STRINGS) {
                str.toLowerCase();
            }
        });

        bench("visulima/string fastLowerCase", () => {
            for (const str of TEST_STRINGS) {
                toLowerCase(str);
            }
        });

        bench("native toLocaleLowerCase", () => {
            for (const str of TEST_STRINGS) {
                str.toLocaleLowerCase("de-DE");
            }
        });

        bench("visulima/string fastLowerCase with locale", () => {
            for (const str of TEST_STRINGS) {
                toLowerCase(str, "de-DE");
            }
        });
    });

    // toUpperCase vs fastUpperCase
    describe("toUpperCase", () => {
        bench("native toUpperCase", () => {
            for (const str of TEST_STRINGS) {
                str.toUpperCase();
            }
        });

        bench("visulima/string fastUpperCase", () => {
            for (const str of TEST_STRINGS) {
                toUpperCase(str);
            }
        });

        bench("native toLocaleUpperCase", () => {
            for (const str of TEST_STRINGS) {
                str.toLocaleUpperCase("de-DE");
            }
        });

        bench("visulima/string fastUpperCase with locale", () => {
            for (const str of TEST_STRINGS) {
                toUpperCase(str, "de-DE");
            }
        });
    });

    // Cache effectiveness
    describe("Cache effectiveness", () => {
        const repeatedStrings = Array(100).fill("FooBarBaz");

        bench("fastLowerCase", () => {
            for (const str of repeatedStrings) {
                toLowerCase(str);
            }
        });

        bench("native toLowerCase", () => {
            for (const str of repeatedStrings) {
                str.toLowerCase();
            }
        });

        bench("fastUpperCase", () => {
            for (const str of repeatedStrings) {
                toUpperCase(str);
            }
        });

        bench("native toUpperCase", () => {
            for (const str of repeatedStrings) {
                str.toUpperCase();
            }
        });
    });

    // Special characters handling
    describe("Special characters", () => {
        const specialStrings = [
            "foo\u001B[31mbar\u001B[0m",
            "foo🎉bar",
            "foo💻bar_baz",
            "\u001B[31mFOO\u001B[0m_BAR",
            "foo🚀bar-baz",
        ];

        bench("fastLowerCase with special chars", () => {
            for (const str of specialStrings) {
                toLowerCase(str);
            }
        });

        bench("native toLowerCase with special chars", () => {
            for (const str of specialStrings) {
                str.toLowerCase();
            }
        });

        bench("fastUpperCase with special chars", () => {
            for (const str of specialStrings) {
                toUpperCase(str);
            }
        });

        bench("native toUpperCase with special chars", () => {
            for (const str of specialStrings) {
                str.toUpperCase();
            }
        });
    });
});
