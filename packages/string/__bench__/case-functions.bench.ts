import { bench, describe } from "vitest";
import { camelCase as lodashCamelCase, kebabCase as lodashKebabCase, snakeCase as lodashSnakeCase } from "lodash";
import { camelCase, kebabCase, snakeCase } from "../src/case";

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
    "foo-bar-baz",
    "foo_Bar_Baz",
    "foo-Bar-Baz",
    "foo.Bar.Baz",
    "FooBarBaz",
    "fooBARBaz",
    "FOOBarBAZ",
    "foo_barBaz",
    "foo-barBaz",
    "foo.barBaz",
    "FOO BAR BAZ",
];

describe("Case Functions Benchmark", () => {
    // Camel Case
    describe("camelCase", () => {
        bench("visulima/string camelCase", () => {
            for (const str of TEST_STRINGS) {
                camelCase(str);
            }
        });

        bench("lodash camelCase", () => {
            for (const str of TEST_STRINGS) {
                lodashCamelCase(str);
            }
        });
    });

    // Kebab Case
    describe("kebabCase", () => {
        bench("visulima/string kebabCase", () => {
            for (const str of TEST_STRINGS) {
                kebabCase(str);
            }
        });

        bench("lodash kebabCase", () => {
            for (const str of TEST_STRINGS) {
                lodashKebabCase(str);
            }
        });
    });

    // Snake Case
    describe("snakeCase", () => {
        bench("visulima/string snakeCase", () => {
            for (const str of TEST_STRINGS) {
                snakeCase(str);
            }
        });

        bench("lodash snakeCase", () => {
            for (const str of TEST_STRINGS) {
                lodashSnakeCase(str);
            }
        });
    });

    // Test with locale
    describe("camelCase with locale", () => {
        bench("visulima/string camelCase with German locale", () => {
            for (const str of TEST_STRINGS) {
                camelCase(str, { locale: "de-DE" });
            }
        });

        bench("lodash camelCase (no locale support)", () => {
            for (const str of TEST_STRINGS) {
                lodashCamelCase(str);
            }
        });
    });

    // Test with ANSI and emoji
    describe("Special characters handling", () => {
        const specialStrings = [
            "foo\u001B[31mbar\u001B[0m",
            "foo🎉bar",
            "foo💻bar_baz",
            "\u001B[31mFOO\u001B[0m_BAR",
            "foo🚀bar-baz",
        ];

        bench("visulima/string camelCase with special chars", () => {
            for (const str of specialStrings) {
                camelCase(str);
            }
        });

        bench("lodash camelCase with special chars", () => {
            for (const str of specialStrings) {
                lodashCamelCase(str);
            }
        });
    });

    // Test with known acronyms
    describe("Acronym handling", () => {
        const acronymStrings = [
            "XMLHttpRequest",
            "APIClient",
            "OAuth2Provider",
            "SSLCertificate",
            "JSONParser",
        ];

        bench("visulima/string camelCase with acronyms", () => {
            for (const str of acronymStrings) {
                camelCase(str, { knownAcronyms: ["XML", "API", "OAuth", "SSL", "JSON"] });
            }
        });

        bench("lodash camelCase with acronyms", () => {
            for (const str of acronymStrings) {
                lodashCamelCase(str);
            }
        });
    });
});
