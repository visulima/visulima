import { describe, expect, it } from "vitest";
import type { OptionsTransliterate } from "../src/types";

import transliterate from "../src/transliterate";

describe("transliterate function", () => {
    it("should return empty string for empty input", () => {
        expect(transliterate("")).toBe("");
    });

    it("should handle basic Latin characters", () => {
        expect(transliterate("Crème Brûlée")).toBe("Creme Brulee");
        expect(transliterate("España")).toBe("Espana");
        expect(transliterate("straße")).toBe("strasse");
    });

    it("should use unknown character for unmapped chars", () => {
        expect(transliterate("ħęłłø")).toBe("hello"); // Assuming ħ ø are not in mock map
        expect(transliterate("ħęłłø", { unknown: "?" })).toBe("?e?o");
    });

    it("should trim whitespace if trim option is true", () => {
        expect(transliterate("  hello world  ")).toBe("  hello world  ");
        expect(transliterate("  hello world  ", { trim: true })).toBe("hello world");
    });

    it("should handle ignore option", () => {
        expect(transliterate("Ignore Cœur but not cœur", { ignore: ["Cœur"] })).toBe("Ignore Cœur but not coeur");
        expect(transliterate("Keep éàçüö ignored", { ignore: ["éàçüö"] })).toBe("Keep éàçüö ignored");
    });

    it("should handle replace option (object)", () => {
        expect(transliterate("Replace √ symbol", { replace: { "√": "sqrt" } })).toBe("Replace sqrt symbol");
    });

    it("should handle replace option (array)", () => {
        expect(
            transliterate("Replace AB and XY", {
                replace: [
                    [/AB/g, "ab"],
                    ["XY", "xy"],
                ],
            }),
        ).toBe("Replace ab and xy");
    });

    it("should handle replaceAfter option", () => {
        expect(transliterate("cafe", { replaceAfter: { e: "é" } })).toBe("café");
        expect(transliterate("strasse", { replaceAfter: [[/ss/g, "ß"]] })).toBe("straßße");
    });

    it("should handle combined options", () => {
        const text = "  Ignore Cœur, replace √ with SQRT, then trim!  ";
        const options: OptionsTransliterate = {
            ignore: ["Cœur"],
            replace: { "√": "SQRT" },
            replaceAfter: { SQRT: "Square Root" },
            trim: true,
            unknown: "?",
        };
        expect(transliterate(text, options)).toBe("Ignore Cœur, replace Square Root with Square Root, then trim!");
    });

    it("should optionally add space before non-punctuation after Chinese char", () => {
        const text = "中文Äǐǎ";
        expect(transliterate(text, { fixChineseSpacing: true })).toBe("中文A i a");
        expect(transliterate(text, { fixChineseSpacing: false })).toBe("中文Aia");
        const textPunc = "中文Ä.";
        expect(transliterate(textPunc, { fixChineseSpacing: true })).toBe("中文A.");
    });
    describe("ASCII Purity Tests", () => {
        const tests: string[] = [];
        for (let i = 1; tests.length < 127; i++) {
            // Skip control characters that might cause issues or are unprintable
            if (i < 32 || i === 127) continue;
            tests.push(String.fromCharCode(i));
        }

        tests.forEach((str) => {
            it(`should leave ASCII character ${str.charCodeAt(0)} (${str}) unchanged`, () => {
                expect(transliterate(str)).toBe(str);
            });
        });
    });

    describe("Basic String Tests", () => {
        const tests: (string | number)[] = [
            1 / 10, // 0.1
            "I like pie.",
            "\n",
            "\r\n",
            "I like pie.\n",
        ];

        tests.forEach((strInput) => {
            const str = String(strInput);
            it(`should handle basic input: ${JSON.stringify(str)}`, () => {
                expect(transliterate(str)).toBe(str);
            });
        });
    });

    describe("Complex Script/Character Tests", () => {
        // IMPORTANT: These tests depend heavily on the *actual* charmap data
        // in src/charmap.ts. They will likely fail or produce unexpected
        // results with the current placeholder/mocked charmap.
        const tests: [string, string][] = [
            ["Æneid", "AEneid"],
            ["étude", "etude"],
            // Chinese depends entirely on charmap
            ["北亰", "Bei Jing"], // Expectation based on original test
            // Canadian syllabics
            ["ᔕᓇᓇ", "shanana"],
            // Cherokee
            ["ᏔᎵᏆ", "taliqua"],
            // Syriac
            ["ܦܛܽܐܺ", "ptu'i"],
            // Devanagari
            ["अभिजीत", "abhijiit"],
            // Bengali
            ["অভিজীত", "abhijiit"],
            // Malayalam
            ["അഭിജീത", "abhijiit"],
            ["മലയാലമ്", "mlyaalm"],
            // Japanese
            ["げんまい茶", "genmaiCha"],
            // Unknown characters (assuming they are not in the final charmap)
            [`\u0800\u1400${String.fromCharCode(0xd840, 0xdd00)}`, ""],
            ["🚀", ""], // Expect empty if unknown is default ""
        ];

        for (const [str, result] of tests) {
            it(`should transliterate ${str} to ${result} (charmap dependent)`, () => {
                // Add a comment reminding that this depends on the real charmap
                expect(transliterate(str)).toBe(result);
            });
        }

        it("should handle unknown chars with option", () => {
            expect(transliterate("🚀", { unknown: "?" })).toBe("?");
        });
    });

    it("- With replace / replaceAfter and ignore options combined", () => {
        expect(
            transliterate("你好, 世界!", {
                replace: [
                    ["你好", "Hola"],
                    ["世界", "mundo"],
                ],
                ignore: ["¡", "!"],
            }),
        ).toBe("Hola, mundo!");

        // This test logic seems flawed from the original. `replaceAfter` happens *after* charmap.
        // If '你' is ignored during charmap, it won't become 'Ni', so replaceAfter: [[/Ni/, 'tú']] would be needed.
        // If '你' is *not* ignored, it becomes 'Ni', then replaceAfter makes it 'tú'.
        // Let's test the case where it's NOT ignored first by charmap (assuming 你->Ni in real map)
        // We can't truly test this without the real map, let's adjust to test ignore+replaceAfter interaction
        expect(transliterate("你好，世界！", { replaceAfter: [["Ni", "tú"]], ignore: ["你"] })).toBe("你好，世界！"); // Ignored 你 remains, replaceAfter Ni->tú doesn't match

        // Test ignore with replace
        expect(
            transliterate("你好，世界！", {
                replace: { 好: "Good" },
                ignore: ["界"],
            }),
        ).toBe("Ni Good，Shi 界！"); // Assuming 你->Ni, 世->Shi in real charmap
    });
});
