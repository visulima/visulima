import sindresorhusSlugify from "@sindresorhus/slugify";
import simovSlugify from "slugify";
import { slugify as transliterationSlugify } from "transliteration";
import { bench, describe } from "vitest";

import visulimaSlugify from "../src/slugify";

const testStrings = [
    "Foo Bar Baz foo bar baz",
    "       leading and trailing spaces       ",
    "[foo] [bar] {baz} (qux)",
    "Crème Brûlée and Hællæ, hva skjera? Стратегия!",
    "UNICORNS AND RAINBOWS AND MORE UNICORNS",
    "Foo & Bar | Baz = Qux < > ' \" ` ~ ! @ # $ % ^ & * ( ) _ + - = { } [ ] : ; ' < > , . ? /",
    "I ♥ Dogs and 🦄s and even 🚀s",
    "你好世界 Welcome to the Jungle Привет мир",
    // eslint-disable-next-line no-secrets/no-secrets
    "ThisIsALongStringWithoutSpacesOrSpecialCharactersToTestPerformanceOnSimpleStrings",
    "a_b-c.d~e f/g\\h'i\"j[k]l{m}n(o)p|q@r#s$t%u^v&w*x(y)z",
    "long string with many words ".repeat(20).trim(),
    "重複字符重複字符重複字符重複字符 ".repeat(10).trim(),
];

const uppercaseTestStrings = testStrings.map((s) => s.toUpperCase());

// Default options objects to ensure we're starting from a known base for each lib
const visulimaDefaultOptions = {};
const sindresorhusDefaultOptions = {}; // Their default is decamelize:true, lowercase:true
const simovDefaultOptionsOurComparison = { lower: true }; // To match our common case (lowercase output)
const simovActualDefaultOptions = { lower: false }; // Their actual library default
const transliterationPackageDefaultOptions = {}; // Assuming default behavior is transliteration ON

describe("Slugify Benchmark Comparison by Feature", () => {
    describe("Default Behavior (Transliteration generally ON by default for libs)", () => {
        bench("@visulima/string (default: transliterate ON)", async () => {
            for (const item of testStrings) {
                visulimaSlugify(item, visulimaDefaultOptions);
            }
        });

        bench("@visulima/string (transliterate: false)", async () => {
            for (const item of testStrings) {
                visulimaSlugify(item, { ...visulimaDefaultOptions, transliterate: false });
            }
        });

        bench("@sindresorhus/slugify (default: transliterate ON)", () => {
            for (const item of testStrings) {
                sindresorhusSlugify(item, sindresorhusDefaultOptions);
            }
        });

        bench("slugify (simov) (common default: lower=true, transliterate ON)", () => {
            for (const item of testStrings) {
                simovSlugify(item, simovDefaultOptionsOurComparison);
            }
        });

        bench("slugify (simov) (actual library default: lower=false, transliterate ON)", () => {
            for (const item of testStrings) {
                simovSlugify(item, simovActualDefaultOptions);
            }
        });

        bench("transliteration slugify (default: transliterate ON)", () => {
            for (const item of testStrings) {
                transliterationSlugify(item, transliterationPackageDefaultOptions);
            }
        });
    });

    describe("Separator Option: '_'", () => {
        bench("@visulima/string", async () => {
            for (const item of testStrings) {
                visulimaSlugify(item, { ...visulimaDefaultOptions, separator: "_" });
            }
        });

        bench("@sindresorhus/slugify", () => {
            for (const item of testStrings) {
                sindresorhusSlugify(item, { ...sindresorhusDefaultOptions, separator: "_" });
            }
        });

        bench("slugify (simov)", () => {
            for (const item of testStrings) {
                simovSlugify(item, { ...simovActualDefaultOptions, replacement: "_" });
            }
        });

        bench("transliteration slugify", () => {
            for (const item of testStrings) {
                transliterationSlugify(item, { ...transliterationPackageDefaultOptions, separator: "_" });
            }
        });
    });

    // Note: Sindresorhus & Simov might not support empty string separator in the same way
    // Sindresorhus: separator must be a non-empty string.
    // Simov: empty replacement effectively joins words if no other logic separates them.
    describe("Separator Option: '' (Empty - where supported)", () => {
        bench("@visulima/string", async () => {
            for (const item of testStrings) {
                visulimaSlugify(item, { ...visulimaDefaultOptions, separator: "" });
            }
        });
        // Simov can achieve this by setting replacement to '' and ensuring no space-based logic interferes
        bench("slugify (simov) (replacement: '')", () => {
            for (const item of testStrings) {
                simovSlugify(item, { ...simovActualDefaultOptions, replacement: "" });
            }
        });
        bench("transliteration slugify", () => {
            for (const item of testStrings) {
                transliterationSlugify(item, { ...transliterationPackageDefaultOptions, separator: "" });
            }
        });
    });

    describe("Case Option: Output Lowercase (Common Expectation)", () => {
        bench("@visulima/string (default is lowercase)", async () => {
            for (const item of testStrings) {
                visulimaSlugify(item, { ...visulimaDefaultOptions, lowercase: true, uppercase: false });
            }
        });

        bench("@sindresorhus/slugify (default is lowercase)", () => {
            for (const item of testStrings) {
                sindresorhusSlugify(item, { ...sindresorhusDefaultOptions, lowercase: true });
            }
        });

        bench("slugify (simov) (lower: true)", () => {
            for (const item of testStrings) {
                simovSlugify(item, { ...simovActualDefaultOptions, lower: true });
            }
        });

        bench("transliteration slugify", () => {
            for (const item of testStrings) {
                transliterationSlugify(item, { ...transliterationPackageDefaultOptions, lowercase: true });
            }
        });
    });

    describe("Case Option: Preserve/Output Uppercase (from UC input)", () => {
        bench("@visulima/string", async () => {
            for (const item of uppercaseTestStrings) {
                visulimaSlugify(item, { ...visulimaDefaultOptions, lowercase: false, uppercase: true });
            }
        });

        bench("@sindresorhus/slugify", () => {
            for (const item of uppercaseTestStrings) {
                sindresorhusSlugify(item, { ...sindresorhusDefaultOptions, lowercase: false });
            }
        });

        bench("slugify (simov)", () => {
            for (const item of uppercaseTestStrings) {
                simovSlugify(item, { ...simovActualDefaultOptions, lower: false });
            }
        });

        bench("transliteration slugify", () => {
            for (const item of uppercaseTestStrings) {
                transliterationSlugify(item, { ...transliterationPackageDefaultOptions, lowercase: false });
            }
        });
    });

    // This block is specific to visulima as others don't have a simple on/off toggle for all transliteration
    describe("Transliteration Control (Visulima Specific Focus)", () => {
        bench("@visulima/string (transliterate: true - default)", async () => {
            for (const item of testStrings) {
                visulimaSlugify(item, { ...visulimaDefaultOptions, transliterate: true });
            }
        });
        bench("@visulima/string (transliterate: false)", async () => {
            for (const item of testStrings) {
                visulimaSlugify(item, { ...visulimaDefaultOptions, transliterate: false });
            }
        });
    });
});
