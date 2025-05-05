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
        // Use characters highly unlikely to be in the charmap
        const unmappedStr = "\u{E000}\u{E001}🚀"; // PUA chars + emoji
        // With default unknown: ""
        expect(transliterate(unmappedStr)).toBe("");
        // With unknown: "?"
        expect(transliterate(unmappedStr, { unknown: "?" })).toBe("???");
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
        expect(transliterate("strasse", { replaceAfter: [[/ss/g, "ß"]] })).toBe("straße");
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
        expect(transliterate(text, { fixChineseSpacing: true })).toBe("中文 Aia");
        expect(transliterate(text, { fixChineseSpacing: false })).toBe("中文Aia");
        const textPunc = "中文Ä.";
        expect(transliterate(textPunc, { fixChineseSpacing: true })).toBe("中文 A.");
    });
    describe("ASCII Purity Tests", () => {
        // Test characters 32-126 (Standard Printable ASCII) + Tab, LF, CR
        const printableAsciiTests: number[] = [9, 10, 13];
        for (let i = 32; i <= 126; i++) {
            printableAsciiTests.push(i);
        }

        printableAsciiTests.forEach((code) => {
            const char = String.fromCharCode(code);
            it(`should leave printable ASCII character ${code} (${JSON.stringify(char)}) unchanged`, () => {
                // Assuming these characters map to themselves in the real charmap
                expect(transliterate(char)).toBe(char);
            });
        });

        // Test characters 128-159 (C1 Controls) - Default Unknown
        const c1ControlTests: number[] = [];
        for (let i = 128; i <= 159; i++) {
            c1ControlTests.push(i);
        }

        c1ControlTests.forEach((code) => {
            const char = String.fromCharCode(code);
            // C1 controls are not mapped, should become default unknown ""
            it(`should map C1 control character ${code} to default unknown ('')`, () => {
                expect(transliterate(char)).toBe(""); // Default unknown is empty string
            });
        });

        // Test characters 128-159 (C1 Controls) - Specified Unknown
        c1ControlTests.forEach((code) => {
            const char = String.fromCharCode(code);
            // C1 controls are not mapped, should become specified unknown "?"
            it(`should map C1 control character ${code} to specified unknown ('?')`, () => {
                expect(transliterate(char, { unknown: "?" })).toBe("?");
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

    // --- Language Specific Tests ---

    it('supports German umlauts', () => {
        expect(transliterate('ä ö ü Ä Ö Ü ß')).toBe('ae oe ue Ae Oe Ue ss');
    });

    it('supports Vietnamese', () => {
        expect(transliterate('ố Ừ Đ')).toBe('o U D');
    });

    it('supports Arabic', () => {
        expect(transliterate('ث س و')).toBe('th s w');
    });

    it('supports Persian / Farsi', () => {
        expect(transliterate('چ ی پ')).toBe('ch y p');
    });

    it('supports Urdu', () => {
        expect(transliterate('ٹ ڈ ھ')).toBe('t d h');
    });

    it('supports Pashto', () => {
        expect(transliterate('ګ ړ څ')).toBe('g r c');
    });

    it('supports Russian', () => {
        expect(transliterate('Ж п ю')).toBe('Zh p yu');
    });

    it('supports Romanian', () => {
        expect(transliterate('ș Ț')).toBe('s T');
    });

    it('supports Turkish', () => {
        expect(transliterate('İ ı Ş ş Ç ç Ğ ğ')).toBe('I i S s C c G g');
    });

    it('supports Armenian', () => {
        expect(transliterate('Ե ր և ա ն')).toBe('Ye r yev a n');
    });

    it('supports Georgian', () => {
        expect(transliterate('თ პ ღ')).toBe('t p gh');
    });

    it('supports Latin', () => {
        expect(transliterate('Ä Ð Ø')).toBe('Ae D O');
    });

    it('supports Czech', () => {
        expect(transliterate('č ž Ň')).toBe('c z N');
    });

    it('supports Danish', () => {
        expect(transliterate('æ ø å Æ Ø Å')).toBe('ae oe aa Ae Oe Aa');
    });

    it('supports Dhivehi', () => {
        expect(transliterate('ޝ ޓ ބ')).toBe('sh t b');
    });

    it('supports Greek', () => {
        expect(transliterate('θ Γ Ξ')).toBe('th G KS');
    });

    it('supports Hungarian', () => {
        expect(transliterate('ű ö Ö')).toBe('u o O');
    });

    it('supports Latvian', () => {
        expect(transliterate('ā Ņ Ģ')).toBe('a N G');
    });

    it('supports Lithuanian', () => {
        expect(transliterate('ą į Š')).toBe('a i S');
    });

    it('supports Macedonian', () => {
        expect(transliterate('Ќ љ Тс')).toBe('Kj lj Ts');
    });

    it('supports Polish', () => {
        expect(transliterate('ą Ą Ł')).toBe('a A L');
    });

    it('supports Serbian', () => {
        expect(transliterate('ђ џ Ђ Љ')).toBe('dj dz Dj Lj');
    });

    it('supports Slovak', () => {
        expect(transliterate('ľ Ľ Ŕ')).toBe('l L R');
    });

    it('supports Swedish', () => {
        expect(transliterate('ä ö Ä Ö')).toBe('a o A O');
    });

    it('supports Ukrainian', () => {
        expect(transliterate('Є Ґ ї')).toBe('Ye G yi');
    });

});
