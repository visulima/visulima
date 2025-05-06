import { describe, expect, it } from "vitest";

import transliterate from "../../src/transliterate";
import type { OptionsTransliterate } from "../../src/types";

describe("transliterate function", () => {
    it("should return empty string for empty input", async () => {
        expect.assertions(1);
        await expect(transliterate("")).resolves.toBe("");
    });

    it("should handle basic Latin characters", async () => {
        expect.assertions(3);
        await expect(transliterate("Crème Brûlée")).resolves.toBe("Creme Brulee");
        await expect(transliterate("España")).resolves.toBe("Espana");
        await expect(transliterate("straße")).resolves.toBe("strasse");
    });

    it("should use unknown character for unmapped chars", async () => {
        expect.assertions(2);
        const unmappedString = "\u{E000}\u{E001}🚀";
        await expect(transliterate(unmappedString)).resolves.toBe("");
        await expect(transliterate(unmappedString, { unknown: "?" })).resolves.toBe("???");
    });

    it("should trim whitespace if trim option is true", async () => {
        expect.assertions(2);
        await expect(transliterate("  hello world  ")).resolves.toBe("  hello world  ");
        await expect(transliterate("  hello world  ", { trim: true })).resolves.toBe("hello world");
    });

    it("should handle ignore option", async () => {
        expect.assertions(2);
        await expect(transliterate("Ignore Cœur but not cœur", { ignore: ["Cœur"] })).resolves.toBe("Ignore Cœur but not coeur");
        await expect(transliterate("Keep éàçüö ignored", { ignore: ["éàçüö"] })).resolves.toBe("Keep éàçüö ignored");
    });

    it("should handle replace option (object)", async () => {
        expect.assertions(1);
        await expect(transliterate("Replace √ symbol", { replaceBefore: { "√": "sqrt" } })).resolves.toBe("Replace sqrt symbol");
    });

    it("should handle replace option (array)", async () => {
        expect.assertions(1);
        await expect(
            transliterate("Replace AB and XY", {
                replaceBefore: [
                    [/AB/g, "ab"],
                    ["XY", "xy"],
                ],
            }),
        ).resolves.toBe("Replace ab and xy");
    });

    it("should handle replaceAfter option", async () => {
        expect.assertions(2);
        await expect(transliterate("cafe", { replaceAfter: { e: "é" } })).resolves.toBe("café");
        await expect(transliterate("strasse", { replaceAfter: [[/ss/g, "ß"]] })).resolves.toBe("straße");
    });

    it("should handle combined options", async () => {
        expect.assertions(1);
        const text = "  Ignore Cœur, replace √ with SQRT, then trim!  ";
        const options: OptionsTransliterate = {
            ignore: ["Cœur"],
            replaceAfter: { SQRT: "Square Root" },
            replaceBefore: { "√": "SQRT" },
            trim: true,
            unknown: "?",
        };
        await expect(transliterate(text, options)).resolves.toBe("Ignore Cœur, replace Square Root with Square Root, then trim!");
    });

    it("should optionally add space before non-punctuation after Chinese char", async () => {
        expect.assertions(3);
        const text = "中文Äǐǎ";
        await expect(transliterate(text, { fixChineseSpacing: true })).resolves.toBe("Zhong Wen Aeia");
        await expect(transliterate(text, { fixChineseSpacing: false })).resolves.toBe("ZhongWenAeia");
        const textPunc = "中文Ä.";
        await expect(transliterate(textPunc, { fixChineseSpacing: true })).resolves.toBe("Zhong Wen Ae.");
    });
    describe("aSCII Purity Tests", () => {
        // Test characters 32-126 (Standard Printable ASCII) + Tab, LF, CR
        const printableAsciiCodes: number[] = [9, 10, 13];

        // eslint-disable-next-line no-plusplus
        for (let index = 32; index <= 126; index++) {
            printableAsciiCodes.push(index);
        }

        // Use it.each for printable ASCII
        it.each(printableAsciiCodes)("should leave printable ASCII character %s unchanged", async (code) => {
            expect.assertions(1);
            const char = String.fromCodePoint(code);
            // Assuming these characters map to themselves in the real charmap
            await expect(transliterate(char)).resolves.toBe(char);
        });

        // Test characters 128-159 (C1 Controls) - Default Unknown
        const c1ControlCodes: number[] = [];
        // eslint-disable-next-line no-plusplus
        for (let index = 128; index <= 159; index++) {
            c1ControlCodes.push(index);
        }

        // Use it.each for C1 controls (default unknown)
        it.each(c1ControlCodes)("should map C1 control character %s to default unknown ('')", async (code) => {
            expect.assertions(1);
            const char = String.fromCodePoint(code);
            await expect(transliterate(char)).resolves.toBe(""); // Default unknown is empty string
        });

        // Use it.each for C1 controls (specified unknown)
        it.each(c1ControlCodes)("should map C1 control character %s to specified unknown ('?')", async (code) => {
            expect.assertions(1);
            const char = String.fromCodePoint(code);
            await expect(transliterate(char, { unknown: "?" })).resolves.toBe("?");
        });
    });

    describe("basic String Tests", () => {
        it.each(
            [
                1 / 10, // 0.1
                "I like pie.",
                "\n",
                "\r\n",
                "I like pie.\n",
            ].map(String),
        )("should handle basic input: %s", async (string_) => {
            expect.assertions(1);

            await expect(transliterate(string_)).resolves.toBe(string_);
        });
    });

    describe("complex Script/Character Tests", () => {
        // IMPORTANT: These tests depend heavily on the *actual* charmap data
        // in src/charmap/index.ts.
        it.each([
            ["Æneid", "AEneid"],
            ["étude", "etude"],
            // Chinese depends entirely on charmap
            ["北亰", "Bei Jing"],
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
            // Unknown characters
            [`\u0800\u1400${String.fromCodePoint(0xd8_40, 0xdd_00)}`, "\u{20100}"],
            ["🚀", ""], // Expect empty if unknown is default ""
        ])("should transliterate %s to %s (charmap dependent)", async (string_, result) => {
            expect.assertions(1);

            await expect(transliterate(string_)).resolves.toBe(result);
        });

        it("should handle unknown chars with option", async () => {
            expect.assertions(1);

            await expect(transliterate("🚀", { unknown: "?" })).resolves.toBe("?");
        });
    });

    it("with replace / replaceAfter and ignore options combined", async () => {
        expect.assertions(4);

        await expect(
            transliterate("你好, 世界!", {
                ignore: ["¡", "!"],
                replaceBefore: [
                    ["你好", "Hola"],
                    ["世界", "mundo"],
                ],
            }),
        ).resolves.toBe("Hola, mundo!");
        await expect(transliterate("Hola, mundo!", { replaceBefore: [["mundo", "world"]] })).resolves.toBe("Hola, world!");
        await expect(transliterate("你好，世界！", { ignore: ["你"], replaceAfter: [["Ni", "tú"]] })).resolves.toBe("你Hao,Shi Jie!");
        await expect(
            transliterate("你好，世界！", {
                ignore: ["界"],
                replaceBefore: { 好: "Good" }, // Changed back from replace
            }),
        ).resolves.toBe("Ni Good,Shi界!"); // ignore 界, no space added by default logic
    });

    it("supports German umlauts", async () => {
        expect.assertions(1);

        await expect(transliterate("ä ö ü Ä Ö Ü ß")).resolves.toBe("ae oe ue Ae Oe Ue ss");
    });

    it("supports Vietnamese", async () => {
        expect.assertions(1);

        await expect(transliterate("ố Ừ Đ")).resolves.toBe("o U D");
    });

    it("supports Arabic", async () => {
        expect.assertions(1);

        await expect(transliterate("ث س و")).resolves.toBe("th s w");
    });

    it("supports Persian / Farsi", async () => {
        expect.assertions(1);

        await expect(transliterate("چ ی پ")).resolves.toBe("ch y p");
    });

    it("supports Urdu", async () => {
        expect.assertions(1);

        const input = "ٹ ڈ ھ";
        const expected = "t d h";
        const result = await transliterate(input);
        expect(result).toBe(expected);
    });

    it("supports Pashto", async () => {
        expect.assertions(1);

        const input = "ګ ړ څ";
        const expected = "g r c";
        const result = await transliterate(input);
        expect(result).toBe(expected);
    });

    it("supports Russian", async () => {
        expect.assertions(1);

        await expect(transliterate("Ж п ю")).resolves.toBe("Zh p yu");
    });

    it("supports Romanian", async () => {
        expect.assertions(1);

        await expect(transliterate("ș Ț")).resolves.toBe("s T");
    });

    it("supports Turkish", async () => {
        expect.assertions(1);

        await expect(transliterate("İ ı Ş ş Ç ç Ğ ğ")).resolves.toBe("I i S s C c G g");
    });

    it("supports Armenian", async () => {
        expect.assertions(1);

        await expect(transliterate("Ե ր և ա ն")).resolves.toBe("Ye r yev a n");
    });

    it("supports Georgian", async () => {
        expect.assertions(1);

        await expect(transliterate("თ პ ღ")).resolves.toBe("t p gh");
    });

    it("supports Latin", async () => {
        expect.assertions(1);

        await expect(transliterate("Ä Ð Ø")).resolves.toBe("Ae D Oe");
    });

    it("supports Czech", async () => {
        expect.assertions(1);

        await expect(transliterate("č ž Ň")).resolves.toBe("c z N");
    });

    it("supports Danish", async () => {
        expect.assertions(1);

        await expect(transliterate("æ ø å Æ Ø Å")).resolves.toBe("ae oe aa AE Oe Aa");
    });

    it("supports Dhivehi", async () => {
        expect.assertions(1);

        await expect(transliterate("ޝ ޓ ބ")).resolves.toBe("sh t b");
    });

    it("supports Greek", async () => {
        expect.assertions(1);

        await expect(transliterate("θ Γ Ξ")).resolves.toBe("th G KS");
    });

    it("supports Hungarian", async () => {
        expect.assertions(1);

        await expect(transliterate("ű ö Ö")).resolves.toBe("u oe Oe");
    });

    it("supports Latvian", async () => {
        expect.assertions(1);

        await expect(transliterate("ā Ņ Ģ")).resolves.toBe("a N G");
    });

    it("supports Lithuanian", async () => {
        expect.assertions(1);

        await expect(transliterate("ą į Š")).resolves.toBe("a i S");
    });

    it("supports Macedonian", async () => {
        expect.assertions(1);

        await expect(transliterate("Ќ љ Тс")).resolves.toBe("Kj lj Ts");
    });

    it("supports Polish", async () => {
        expect.assertions(1);

        await expect(transliterate("ą Ą Ł")).resolves.toBe("a A L");
    });

    it("supports Serbian", async () => {
        expect.assertions(1);

        await expect(transliterate("ђ џ Ђ Љ")).resolves.toBe("dj dz Dj Lj");
    });

    it("supports Slovak", async () => {
        expect.assertions(1);

        await expect(transliterate("ľ Ľ Ŕ")).resolves.toBe("l L R");
    });

    it("supports Swedish", async () => {
        expect.assertions(1);

        await expect(transliterate("ä ö Ä Ö")).resolves.toBe("ae oe Ae Oe");
    });

    it("supports Ukrainian", async () => {
        expect.assertions(1);

        await expect(transliterate("Є Ґ ї")).resolves.toBe("Ye G yi");
    });
});
