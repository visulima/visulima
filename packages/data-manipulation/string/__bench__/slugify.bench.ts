import sindresorhusSlugify from "@sindresorhus/slugify";
import slugPackage from "slug";
import simovSlugify from "slugify";
import { slugify as transliterationSlugify } from "transliteration";
import { describe, test } from "vitest";

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
    String.raw`a_b-c.d~e f/g\h'i"j[k]l{m}n(o)p|q@r#s$t%u^v&w*x(y)z`,
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
        test("@visulima/string (default: transliterate ON)", async ({ bench }) => {
            await bench("@visulima/string (default: transliterate ON)", async () => {
                for (const item of testStrings) {
                    visulimaSlugify(item, visulimaDefaultOptions);
                }
            }).run();
        });

        test("@visulima/string (transliterate: false)", async ({ bench }) => {
            await bench("@visulima/string (transliterate: false)", async () => {
                for (const item of testStrings) {
                    visulimaSlugify(item, { ...visulimaDefaultOptions, transliterate: false });
                }
            }).run();
        });

        test.skipIf(process.env.CODSPEED_ENV)("@sindresorhus/slugify (default: transliterate ON)", async ({ bench }) => {
            await bench("@sindresorhus/slugify (default: transliterate ON)", () => {
                for (const item of testStrings) {
                    sindresorhusSlugify(item, sindresorhusDefaultOptions);
                }
            }).run();
        });

        test.skipIf(process.env.CODSPEED_ENV)("slugify (simov) (common default: lower=true, transliterate ON)", async ({ bench }) => {
            await bench("slugify (simov) (common default: lower=true, transliterate ON)", () => {
                for (const item of testStrings) {
                    simovSlugify(item, simovDefaultOptionsOurComparison);
                }
            }).run();
        });

        test.skipIf(process.env.CODSPEED_ENV)("slugify (simov) (actual library default: lower=false, transliterate ON)", async ({ bench }) => {
            await bench("slugify (simov) (actual library default: lower=false, transliterate ON)", () => {
                for (const item of testStrings) {
                    simovSlugify(item, simovActualDefaultOptions);
                }
            }).run();
        });

        test.skipIf(process.env.CODSPEED_ENV)("transliteration slugify (default: transliterate ON)", async ({ bench }) => {
            await bench("transliteration slugify (default: transliterate ON)", () => {
                for (const item of testStrings) {
                    transliterationSlugify(item, transliterationPackageDefaultOptions);
                }
            }).run();
        });

        test.skipIf(process.env.CODSPEED_ENV)("slug (default: transliterate ON)", async ({ bench }) => {
            await bench("slug (default: transliterate ON)", () => {
                for (const item of testStrings) {
                    slugPackage(item);
                }
            }).run();
        });
    });

    describe("Separator Option: '_'", () => {
        test("@visulima/string", async ({ bench }) => {
            await bench("@visulima/string", async () => {
                for (const item of testStrings) {
                    visulimaSlugify(item, { ...visulimaDefaultOptions, separator: "_" });
                }
            }).run();
        });

        test.skipIf(process.env.CODSPEED_ENV)("@sindresorhus/slugify", async ({ bench }) => {
            await bench("@sindresorhus/slugify", () => {
                for (const item of testStrings) {
                    sindresorhusSlugify(item, { ...sindresorhusDefaultOptions, separator: "_" });
                }
            }).run();
        });

        test.skipIf(process.env.CODSPEED_ENV)("slugify (simov)", async ({ bench }) => {
            await bench("slugify (simov)", () => {
                for (const item of testStrings) {
                    simovSlugify(item, { ...simovActualDefaultOptions, replacement: "_" });
                }
            }).run();
        });

        test.skipIf(process.env.CODSPEED_ENV)("transliteration slugify", async ({ bench }) => {
            await bench("transliteration slugify", () => {
                for (const item of testStrings) {
                    transliterationSlugify(item, { ...transliterationPackageDefaultOptions, separator: "_" });
                }
            }).run();
        });

        test.skipIf(process.env.CODSPEED_ENV)("slug", async ({ bench }) => {
            await bench("slug", () => {
                for (const item of testStrings) {
                    slugPackage(item, { replacement: "_" });
                }
            }).run();
        });
    });

    // Note: Sindresorhus & Simov might not support empty string separator in the same way
    // Sindresorhus: separator must be a non-empty string.
    // Simov: empty replacement effectively joins words if no other logic separates them.
    describe("Separator Option: '' (Empty - where supported)", () => {
        test("@visulima/string", async ({ bench }) => {
            await bench("@visulima/string", async () => {
                for (const item of testStrings) {
                    visulimaSlugify(item, { ...visulimaDefaultOptions, separator: "" });
                }
            }).run();
        });
        // Simov can achieve this by setting replacement to '' and ensuring no space-based logic interferes
        test.skipIf(process.env.CODSPEED_ENV)("slugify (simov) (replacement: '')", async ({ bench }) => {
            await bench("slugify (simov) (replacement: '')", () => {
                for (const item of testStrings) {
                    simovSlugify(item, { ...simovActualDefaultOptions, replacement: "" });
                }
            }).run();
        });
        test.skipIf(process.env.CODSPEED_ENV)("transliteration slugify", async ({ bench }) => {
            await bench("transliteration slugify", () => {
                for (const item of testStrings) {
                    transliterationSlugify(item, { ...transliterationPackageDefaultOptions, separator: "" });
                }
            }).run();
        });
        test.skipIf(process.env.CODSPEED_ENV)("slug (replacement: '')", async ({ bench }) => {
            await bench("slug (replacement: '')", () => {
                for (const item of testStrings) {
                    slugPackage(item, { replacement: "" });
                }
            }).run();
        });
    });

    describe("Case Option: Output Lowercase (Common Expectation)", () => {
        test("@visulima/string (default is lowercase)", async ({ bench }) => {
            await bench("@visulima/string (default is lowercase)", async () => {
                for (const item of testStrings) {
                    visulimaSlugify(item, { ...visulimaDefaultOptions, lowercase: true, uppercase: false });
                }
            }).run();
        });

        test.skipIf(process.env.CODSPEED_ENV)("@sindresorhus/slugify (default is lowercase)", async ({ bench }) => {
            await bench("@sindresorhus/slugify (default is lowercase)", () => {
                for (const item of testStrings) {
                    sindresorhusSlugify(item, { ...sindresorhusDefaultOptions, lowercase: true });
                }
            }).run();
        });

        test.skipIf(process.env.CODSPEED_ENV)("slugify (simov) (lower: true)", async ({ bench }) => {
            await bench("slugify (simov) (lower: true)", () => {
                for (const item of testStrings) {
                    simovSlugify(item, { ...simovActualDefaultOptions, lower: true });
                }
            }).run();
        });

        test.skipIf(process.env.CODSPEED_ENV)("transliteration slugify", async ({ bench }) => {
            await bench("transliteration slugify", () => {
                for (const item of testStrings) {
                    transliterationSlugify(item, { ...transliterationPackageDefaultOptions, lowercase: true });
                }
            }).run();
        });

        test.skipIf(process.env.CODSPEED_ENV)("slug (lower: true)", async ({ bench }) => {
            await bench("slug (lower: true)", () => {
                for (const item of testStrings) {
                    slugPackage(item, { lower: true });
                }
            }).run();
        });
    });

    describe("Case Option: Preserve/Output Uppercase (from UC input)", () => {
        test("@visulima/string", async ({ bench }) => {
            await bench("@visulima/string", async () => {
                for (const item of uppercaseTestStrings) {
                    visulimaSlugify(item, { ...visulimaDefaultOptions, lowercase: false, uppercase: true });
                }
            }).run();
        });

        test.skipIf(process.env.CODSPEED_ENV)("@sindresorhus/slugify", async ({ bench }) => {
            await bench("@sindresorhus/slugify", () => {
                for (const item of uppercaseTestStrings) {
                    sindresorhusSlugify(item, { ...sindresorhusDefaultOptions, lowercase: false });
                }
            }).run();
        });

        test.skipIf(process.env.CODSPEED_ENV)("slugify (simov)", async ({ bench }) => {
            await bench("slugify (simov)", () => {
                for (const item of uppercaseTestStrings) {
                    simovSlugify(item, { ...simovActualDefaultOptions, lower: false });
                }
            }).run();
        });

        test.skipIf(process.env.CODSPEED_ENV)("transliteration slugify", async ({ bench }) => {
            await bench("transliteration slugify", () => {
                for (const item of uppercaseTestStrings) {
                    transliterationSlugify(item, { ...transliterationPackageDefaultOptions, lowercase: false });
                }
            }).run();
        });

        test.skipIf(process.env.CODSPEED_ENV)("slug (lower: false)", async ({ bench }) => {
            await bench("slug (lower: false)", () => {
                for (const item of uppercaseTestStrings) {
                    slugPackage(item, { lower: false });
                }
            }).run();
        });
    });

    // This block is specific to visulima as others don't have a simple on/off toggle for all transliteration
    describe("Transliteration Control (Visulima Specific Focus)", () => {
        test("@visulima/string (transliterate: true - default)", async ({ bench }) => {
            await bench("@visulima/string (transliterate: true - default)", async () => {
                for (const item of testStrings) {
                    visulimaSlugify(item, { ...visulimaDefaultOptions, transliterate: true });
                }
            }).run();
        });
        test("@visulima/string (transliterate: false)", async ({ bench }) => {
            await bench("@visulima/string (transliterate: false)", async () => {
                for (const item of testStrings) {
                    visulimaSlugify(item, { ...visulimaDefaultOptions, transliterate: false });
                }
            }).run();
        });
    });
});
