import { describe, expect, it } from "vitest";

import transliterate from "../../src/transliterate";
import type { OptionsTransliterate } from "../../src/types";

describe("transliterate function", () => {
    it("should return empty string for empty input", async () => {
        expect.assertions(1);

        expect(transliterate("")).toBe("");
    });

    it("should handle basic Latin characters", async () => {
        expect.assertions(3);

        expect(transliterate("Crème Brûlée")).toBe("Creme Brulee");
        expect(transliterate("España")).toBe("Espana");
        expect(transliterate("straße")).toBe("strasse");
    });

    it("should use unknown character for unmapped chars", async () => {
        expect.assertions(2);

        const unmappedString = "\u{E000}\u{E001}🚀";

        expect(transliterate(unmappedString)).toBe("");
        expect(transliterate(unmappedString, { unknown: "?" })).toBe("???");
    });

    it("should trim whitespace if trim option is true", async () => {
        expect.assertions(2);

        expect(transliterate("  hello world  ")).toBe("  hello world  ");
        expect(transliterate("  hello world  ", { trim: true })).toBe("hello world");
    });

    it("should handle ignore option", async () => {
        expect.assertions(2);

        expect(transliterate("Ignore Cœur but not cœur", { ignore: ["Cœur"] })).toBe("Ignore Cœur but not coeur");
        expect(transliterate("Keep éàçüö ignored", { ignore: ["éàçüö"] })).toBe("Keep éàçüö ignored");
    });

    it("should handle replace option (object)", async () => {
        expect.assertions(1);

        expect(transliterate("Replace √ symbol", { replaceBefore: { "√": "sqrt" } })).toBe("Replace sqrt symbol");
    });

    it("should handle replace option (array)", async () => {
        expect.assertions(1);

        expect(
            transliterate("Replace AB and XY", {
                replaceBefore: [
                    [/AB/g, "ab"],
                    ["XY", "xy"],
                ],
            }),
        ).toBe("Replace ab and xy");
    });

    it("should handle replaceAfter option", async () => {
        expect.assertions(2);

        expect(transliterate("cafe", { replaceAfter: { e: "é" } })).toBe("café");
        expect(transliterate("strasse", { replaceAfter: [[/ss/g, "ß"]] })).toBe("straße");
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

        expect(transliterate(text, options)).toBe("Ignore Cœur, replace Square Root with Square Root, then trim!");
    });

    it("should optionally add space before non-punctuation after Chinese char", async () => {
        expect.assertions(3);

        const text = "中文Äǐǎ";

        expect(transliterate(text, { fixChineseSpacing: true })).toBe("Zhong Wen Aeia");
        expect(transliterate(text, { fixChineseSpacing: false })).toBe("ZhongWenAeia");

        const textPunc = "中文Ä.";

        expect(transliterate(textPunc, { fixChineseSpacing: true })).toBe("Zhong Wen Ae.");
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
            expect(transliterate(char)).toBe(char);
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

            expect(transliterate(char)).toBe(""); // Default unknown is empty string
        });

        // Use it.each for C1 controls (specified unknown)
        it.each(c1ControlCodes)("should map C1 control character %s to specified unknown ('?')", async (code) => {
            expect.assertions(1);

            const char = String.fromCodePoint(code);

            expect(transliterate(char, { unknown: "?" })).toBe("?");
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

            expect(transliterate(string_)).toBe(string_);
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
            // Latin with circumflex below
            ["ṉṉ", "nn"],
            // Japanese
            ["げんまい茶", "genmaiCha"],
            // Unknown characters
            [`\u0800\u1400${String.fromCodePoint(0xD8_40, 0xDD_00)}`, "\u{20100}"],
            ["🚀", ""], // Expect empty if unknown is default ""
        ])("should transliterate %s to %s (charmap dependent)", async (string_, result) => {
            expect.assertions(1);

            expect(transliterate(string_)).toBe(result);
        });

        it("should correctly transliterate tamil ன", async () => {
            expect.assertions(1);

            expect(transliterate("கன்னியாகுமரி")).toBe("kannnniyaakaumri");
        });

        it("should handle unknown chars with option", async () => {
            expect.assertions(1);

            expect(transliterate("🚀", { unknown: "?" })).toBe("?");
        });
    });

    it("with replace / replaceAfter and ignore options combined", async () => {
        expect.assertions(4);

        expect(
            transliterate("你好, 世界!", {
                ignore: ["¡", "!"],
                replaceBefore: [
                    ["你好", "Hola"],
                    ["世界", "mundo"],
                ],
            }),
        ).toBe("Hola, mundo!");
        expect(transliterate("Hola, mundo!", { replaceBefore: [["mundo", "world"]] })).toBe("Hola, world!");
        expect(transliterate("你好，世界！", { ignore: ["你"], replaceAfter: [["Ni", "tú"]] })).toBe("你Hao,Shi Jie!");
        expect(
            transliterate("你好，世界！", {
                ignore: ["界"],
                replaceBefore: { 好: "Good" }, // Changed back from replace
            }),
        ).toBe("Ni Good,Shi界!"); // ignore 界, no space added by default logic
    });

    it("supports German umlauts", async () => {
        expect.assertions(1);

        expect(transliterate("ä ö ü Ä Ö Ü ß")).toBe("ae oe ue Ae Oe Ue ss");
    });

    it("supports Vietnamese", async () => {
        expect.assertions(1);

        expect(transliterate("ố Ừ Đ")).toBe("o U D");
    });

    it("supports Thai", async () => {
        expect.assertions(1);
        // Ideal: ochiangmai, Current: oechiiyngaihm
        expect(transliterate("ốเชียงใหม่")).toBe("ochianghaim");
    });

    describe("more Thai examples (based on current charmap behavior)", () => {
        it.each([
            ["สวัสดี", "swasdi"],
            ["ขอบคุณ", "khobkhun"],
            ["ไม่เป็นไร", "maipunrai"],
            ["ประเทศไทย", "prathesthai"],
        ])("should transliterate Thai '%s' to '%s' (target behavior)", async (input, expected) => {
            expect.assertions(1);
            expect(transliterate(input)).toBe(expected);
        });
    });

    it("supports Arabic", async () => {
        expect.assertions(1);

        expect(transliterate("ث س و")).toBe("th s w");
    });

    it("supports Persian / Farsi", async () => {
        expect.assertions(1);

        expect(transliterate("چ ی پ")).toBe("ch y p");
    });

    it("supports Urdu", async () => {
        expect.assertions(1);

        const input = "ٹ ڈ ھ";
        const expected = "t d h";
        const result = transliterate(input);

        expect(result).toBe(expected);
    });

    it("supports Pashto", async () => {
        expect.assertions(1);

        const input = "ګ ړ څ";
        const expected = "g r c";
        const result = transliterate(input);

        expect(result).toBe(expected);
    });

    it("supports Russian", async () => {
        expect.assertions(1);

        expect(transliterate("Ж п ю")).toBe("Zh p yu");
    });

    it("supports Romanian", async () => {
        expect.assertions(1);

        expect(transliterate("ș Ț")).toBe("s T");
    });

    it("supports Turkish", async () => {
        expect.assertions(1);

        expect(transliterate("İ ı Ş ş Ç ç Ğ ğ")).toBe("I i S s C c G g");
    });

    it("supports Armenian", async () => {
        expect.assertions(1);

        expect(transliterate("Ե ր և ա ն")).toBe("Ye r yev a n");
    });

    it("supports Georgian", async () => {
        expect.assertions(1);

        expect(transliterate("თ პ ღ")).toBe("t p gh");
    });

    it("supports Latin", async () => {
        expect.assertions(1);

        expect(transliterate("Ä Ð Ø")).toBe("Ae D Oe");
    });

    it("supports Czech", async () => {
        expect.assertions(1);

        expect(transliterate("č ž Ň")).toBe("c z N");
    });

    it("supports Danish", async () => {
        expect.assertions(1);

        expect(transliterate("æ ø å Æ Ø Å")).toBe("ae oe aa AE Oe Aa");
    });

    it("supports Dhivehi", async () => {
        expect.assertions(1);

        expect(transliterate("ޝ ޓ ބ")).toBe("sh t b");
    });

    it("supports Greek", async () => {
        expect.assertions(1);

        expect(transliterate("θ Γ Ξ")).toBe("th G KS");
    });

    it("supports Hungarian", async () => {
        expect.assertions(1);

        expect(transliterate("ű ö Ö")).toBe("u oe Oe");
    });

    it("supports Latvian", async () => {
        expect.assertions(1);

        expect(transliterate("ā Ņ Ģ")).toBe("a N G");
    });

    it("supports Lithuanian", async () => {
        expect.assertions(1);

        expect(transliterate("ą į Š")).toBe("a i S");
    });

    it("supports Macedonian", async () => {
        expect.assertions(1);

        expect(transliterate("Ќ љ Тс")).toBe("Kj lj Ts");
    });

    it("supports Polish", async () => {
        expect.assertions(1);

        expect(transliterate("ą Ą Ł")).toBe("a A L");
    });

    it("supports Serbian", async () => {
        expect.assertions(1);

        expect(transliterate("ђ џ Ђ Љ")).toBe("dj dz Dj Lj");
    });

    it("supports Slovak", async () => {
        expect.assertions(1);

        expect(transliterate("ľ Ľ Ŕ")).toBe("l L R");
    });

    it("supports Swedish", async () => {
        expect.assertions(1);

        expect(transliterate("ä ö Ä Ö")).toBe("ae oe Ae Oe");
    });

    it("supports Ukrainian", async () => {
        expect.assertions(1);

        expect(transliterate("Є Ґ ї")).toBe("Ye G yi");
    });
});
