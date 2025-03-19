import { stripVTControlCharacters } from "node:util";

import colorize, { black, blue, cyan, green, red, yellow } from "@visulima/colorize";
import { describe, expect, it } from "vitest";

import {
    ARABIC_STRINGS,
    BENGALI_STRINGS,
    CHINESE_SIMPLIFIED_STRINGS,
    CHINESE_TRADITIONAL_STRINGS,
    GERMAN_STRINGS,
    GREEK_STRINGS,
    HEBREW_STRINGS,
    HINDI_STRINGS,
    JAPANESE_STRINGS,
    KOREAN_STRINGS,
    LAO_STRINGS,
    RUSSIAN_STRINGS,
    THAI_STRINGS,
    TURKISH_STRINGS,
    UKRAINIAN_STRINGS,
} from "../../__fixtures__/locale-test-strings";
import slice from "../../src/slice";
import { toEqualAnsi } from "../../src/test/vitest";

const fixture = red("the ") + green("quick ") + blue("brown ") + cyan("fox ") + yellow("jumped ");
const stripped = stripVTControlCharacters(fixture);

function randomItem<T>(array: T[]): T {
    return array[Math.floor(Math.random() * array.length)];
}

function generate(string: number | string) {
    const random1 = randomItem(["rock", "paper", "scissors"]);
    const random2 = randomItem(["blue", "green", "yellow", "red"]);
    return `${string}:${colorize[random2](random1)} `;
}

describe("slice", () => {
    expect.extend({ toEqualAnsi });

    it.skip("should behave exactly like regular JavaScript string slice", () => {
        // The slice should behave exactly as a regular JS slice behaves
        for (let index = 0; index < 20; index++) {
            for (let index2 = 19; index2 > index; index2--) {
                const nativeSlice = stripped.slice(index, index2);
                const ansiSlice = slice(fixture, index, index2);
                expect(stripVTControlCharacters(ansiSlice)).toBe(nativeSlice);
            }
        }

        const a = "\u001B[31mthe \u001B[39m\u001B[32mquick \u001B[39m";
        const b = "\u001B[34mbrown \u001B[39m\u001B[36mfox \u001B[39m";
        const c = "\u001B[31m \u001B[39m\u001B[32mquick \u001B[39m\u001B[34mbrown \u001B[39m\u001B[36mfox \u001B[39m";

        expect(slice(fixture, 0, 10)).toEqualAnsi(a);
        expect(slice(fixture, 10, 20)).toEqualAnsi(b);
        expect(slice(fixture, 3, 20)).toEqualAnsi(c);

        const string =
            generate(1) +
            generate(2) +
            generate(3) +
            generate(4) +
            generate(5) +
            generate(6) +
            generate(7) +
            generate(8) +
            generate(9) +
            generate(10) +
            generate(11) +
            generate(12) +
            generate(13) +
            generate(14) +
            generate(15) +
            generate(1) +
            generate(2) +
            generate(3) +
            generate(4) +
            generate(5) +
            generate(6) +
            generate(7) +
            generate(8) +
            generate(9) +
            generate(10) +
            generate(11) +
            generate(12) +
            generate(13) +
            generate(14) +
            generate(15);

        const native = stripVTControlCharacters(string).slice(0, 55);
        const ansi = stripVTControlCharacters(slice(string, 0, 55));

        expect(ansi).toBe(native);
    });

    it("should handle grapheme clusters correctly for emoji and combining characters", () => {
        // Family emoji (👨‍👩‍👧‍👦) is a single grapheme made up of multiple code points
        const family = "👨‍👩‍👧‍👦";
        expect(slice(family, 0, 1)).toEqualAnsi("");
        expect(slice(family, 0, 2)).toEqualAnsi(family);

        // Combining characters
        const combined = "e\u0301"; // é (e + acute accent)
        expect(slice(combined, 0, 1)).toEqualAnsi(combined);
    });

    it("should handle zero width joiner sequences in composite emoji", () => {
        // Woman technologist emoji (👩‍💻) uses ZWJ
        const technologist = "👩‍💻";
        expect(slice(technologist, 0, 1)).toEqualAnsi("");
    });

    it("should support unicode surrogate pairs without breaking characters", () => {
        expect(slice("a\uD83C\uDE00BC", 0, 2)).toEqualAnsi("a");
    });

    it("should not add unnecessary escape codes when slicing colored strings", () => {
        expect(slice("\u001B[31municorn\u001B[39m", 0, 3)).toEqualAnsi("\u001B[31muni\u001B[39m");
    });

    it("should correctly slice a normal character before a colored character", () => {
        expect(slice("a\u001B[31mb\u001B[39m", 0, 1)).toEqualAnsi("a");
    });

    it("should correctly slice a normal character after a colored character", () => {
        expect(slice("\u001B[31ma\u001B[39mb", 1, 2)).toEqualAnsi("b");
    });

    it("should correctly slice a string styled with both background and foreground colors", () => {
        // Test string: `bgGreen.black('test');`
        expect(slice("\u001B[42m\u001B[30mtest\u001B[39m\u001B[49m", 0, 1)).toEqualAnsi("\u001B[42m\u001B[30mt\u001B[39m\u001B[49m");
    });

    it("should correctly slice a string styled with text modifiers", () => {
        // Test string: `underline('test');`
        expect(slice("\u001B[4mtest\u001B[24m", 0, 1)).toEqualAnsi("\u001B[4mt\u001B[24m");
    });

    it("should correctly slice a string with unknown ANSI color codes", () => {
        // The slice will not use a full reset sequence of unknown colors
        expect(slice("\u001B[20mTEST\u001B[49m", 0, 4)).toEqualAnsi("\u001B[20mTEST");
        expect(slice("\u001B[1001mTEST\u001B[49m", 0, 3)).toEqualAnsi("\u001B[1001mTES\u001B[49m");
        expect(slice("\u001B[1001mTEST\u001B[49m", 0, 2)).toEqualAnsi("\u001B[1001mTE\u001B[49m");
    });

    it("should handle null issue correctly when slicing special emoji strings", () => {
        const s = '\u001B[1mautotune.flipCoin("easy as") ? 🎂 : 🍰 \u001B[33m★\u001B[39m\u001B[22m';
        const result = slice(s, 38);

        expect(result).not.toContain("null");
    });

    it("should support true color RGB escape sequences", () => {
        expect(slice("\u001B[1m\u001B[48;2;255;255;255m\u001B[38;2;255;0;0municorn\u001B[39m\u001B[49m\u001B[22m", 0, 3)).toEqualAnsi(
            "\u001B[1m\u001B[48;2;255;255;255m\u001B[38;2;255;0;0muni\u001B[39m\u001B[49m\u001B[22m",
        );
    });

    it("should not add extra escape sequences when slicing styled text", () => {
        const output = `${black.bgYellow(" RUNS ")}  ${green("test")}`;

        expect(slice(output, 0, 7)).toEqualAnsi(`${black.bgYellow(" RUNS ")} `);
        expect(slice(output, 0, 8)).toEqualAnsi(`${black.bgYellow(" RUNS ")}  `);
        expect(slice("\u001B[31m" + output, 0, 4)).toBe(black.bgYellow(" RUN"));
    });

    it("should not lose fullwidth characters when slicing multibyte strings", () => {
        expect(slice("古古test", 0)).toEqualAnsi("古古test");
    });

    it("should create empty slices when start and end positions are equal", () => {
        expect(slice("test", 0, 0)).toEqualAnsi("");
    });

    it("should handle hyperlinks correctly while preserving the formatting", () => {
        const link = "\u001B]8;;https://google.com\u0007Google\u001B]8;;\u0007";
        expect(slice(link, 0, 6)).toEqualAnsi(link);

        expect(
            slice("\u001B]8;;https://google.com\u0007Google\u001B]8;;\u0007 and a second link \u001B]8;;https://google.com\u0007Google\u001B]8;;\u0007", 0, 17),
        ).toEqualAnsi("\u001B]8;;https://google.com\u0007Google\u001B]8;;\u0007 and a seco");
    });

    it("should handle invalid ANSI sequences correctly without breaking", () => {
        // Incomplete sequence
        expect(slice("\u001B[test", 0, 4)).toEqualAnsi("\u001B[te");

        // Invalid characters in sequence
        expect(slice("\u001B[abc31mtest\u001B[39m", 0, 4)).toEqualAnsi("\u001B[ab");

        // Missing terminator
        expect(slice("\u001B[31test\u001B[39m", 0, 4)).toEqualAnsi("\u001B[31test");

        // Multiple invalid sequences
        expect(slice("\u001B[31m\u001B[test\u001B[39m", 0, 4)).toEqualAnsi("\u001B[31m\u001B[te\u001B[39m");
    });

    it("should handle multiple consecutive ANSI codes correctly", () => {
        // Multiple valid codes
        expect(slice("\u001B[1m\u001B[31m\u001B[42mtest\u001B[0m", 0, 4)).toEqualAnsi("\u001B[1m\u001B[31m\u001B[42mtest\u001B[0m");

        // Mix of valid and invalid codes
        expect(slice("\u001B[1m\u001B[invalid\u001B[31mtest\u001B[0m", 0, 4)).toEqualAnsi("\u001B[1m\u001B[in\u001B[0m");
    });

    // Locale-specific tests
    describe("with different locales", () => {
        // East Asian languages
        describe("east Asian languages", () => {
            describe("japanese", () => {
                it("should handle Japanese characters correctly with default locale", () => {
                    const text = JAPANESE_STRINGS[0]; // "ひらがなカタカナABC"
                    expect(slice(text, 0, 5)).toEqualAnsi("ひら");
                    expect(slice(text, 2, 7)).toEqualAnsi("らが");
                });

                it("should handle Japanese characters correctly with Japanese locale", () => {
                    const text = JAPANESE_STRINGS[1]; // "カタカナひらがな漢字"
                    expect(slice(text, 0, 4)).toEqualAnsi("カタ");
                    expect(slice(text, 3, 7)).toEqualAnsi("カ");
                });

                it("should handle mixed Japanese and Latin characters properly", () => {
                    const text = JAPANESE_STRINGS[4]; // "テストString"
                    expect(slice(text, 0, 5)).toEqualAnsi("テス");
                    expect(slice(text, 2, 8)).toEqualAnsi("ストSt");
                });
            });

            describe("korean", () => {
                it("should handle Korean characters correctly with default locale", () => {
                    const text = KOREAN_STRINGS[0]; // "대문자UPPER"
                    expect(slice(text, 0, 3)).toEqualAnsi("대");
                    expect(slice(text, 2, 6)).toEqualAnsi("문자");
                });

                it("should handle Korean characters correctly with Korean locale", () => {
                    const text = KOREAN_STRINGS[1]; // "한글Text"
                    expect(slice(text, 0, 3)).toEqualAnsi("한");
                    expect(slice(text, 1, 5)).toEqualAnsi("글T");
                });

                it("should handle mixed Korean and Latin characters properly", () => {
                    const text = KOREAN_STRINGS[2]; // "테스트String"
                    expect(slice(text, 0, 5)).toEqualAnsi("테스");
                    expect(slice(text, 2, 8)).toEqualAnsi("스트St");
                });
            });

            describe("chinese", () => {
                it("should handle Chinese characters correctly with default locale", () => {
                    const text = CHINESE_SIMPLIFIED_STRINGS[0]; // "中文Text"
                    expect(slice(text, 0, 3)).toEqualAnsi("中");
                    expect(slice(text, 1, 5)).toEqualAnsi("文T");
                });

                it("should handle Chinese characters correctly with Chinese locale", () => {
                    const text = CHINESE_SIMPLIFIED_STRINGS[1]; // "文本String"
                    expect(slice(text, 0, 3)).toEqualAnsi("文");
                    expect(slice(text, 1, 6)).toEqualAnsi("本St");
                });

                it("should handle simplified Chinese characters correctly with zh-CN locale", () => {
                    const text = CHINESE_SIMPLIFIED_STRINGS[4]; // "测试Test"
                    expect(slice(text, 0, 3)).toEqualAnsi("测");
                    expect(slice(text, 1, 5)).toEqualAnsi("试T");
                });

                it("should handle traditional Chinese characters correctly with zh-TW locale", () => {
                    const text = CHINESE_TRADITIONAL_STRINGS[2]; // "程式Program"
                    expect(slice(text, 0, 3)).toEqualAnsi("程");
                    expect(slice(text, 1, 8)).toEqualAnsi("式Prog");
                });
            });

            describe("thai", () => {
                it("should handle Thai characters correctly with default locale", () => {
                    const text = THAI_STRINGS[0]; // "ไทยText"
                    expect(slice(text, 0, 3)).toEqualAnsi("ไทย");
                    expect(slice(text, 1, 5)).toEqualAnsi("ทยTe");
                });

                it("should handle Thai characters correctly with Thai locale", () => {
                    const text = THAI_STRINGS[1]; // "ข้อความString"
                    expect(slice(text, 0, 5)).toEqualAnsi("ข้อควา");
                    expect(slice(text, 2, 9)).toEqualAnsi("ความStr");
                });
            });
        });

        // Middle Eastern and South Asian languages
        describe("middle Eastern and South Asian languages", () => {
            describe("arabic", () => {
                it("should handle Arabic characters correctly with default locale", () => {
                    const text = ARABIC_STRINGS[0]; // "عربيText"
                    expect(slice(text, 0, 4)).toEqualAnsi("عربي");
                    expect(slice(text, 2, 6)).toEqualAnsi("بيTe");
                });

                it("should handle Arabic characters correctly with Arabic locale", () => {
                    const text = ARABIC_STRINGS[1]; // "نصString"
                    expect(slice(text, 0, 3)).toEqualAnsi("نصS");
                    expect(slice(text, 1, 6)).toEqualAnsi("صStri");
                });
            });

            describe("hebrew", () => {
                it("should handle Hebrew characters correctly with default locale", () => {
                    const text = HEBREW_STRINGS[0]; // "עבריתText"
                    expect(slice(text, 0, 4)).toEqualAnsi("עברי");
                    expect(slice(text, 2, 6)).toEqualAnsi("ריתT");
                });

                it("should handle Hebrew characters correctly with Hebrew locale", () => {
                    const text = HEBREW_STRINGS[1]; // "טקסטString"
                    expect(slice(text, 0, 4)).toEqualAnsi("טקסט");
                    expect(slice(text, 2, 8)).toEqualAnsi("סטStri");
                });
            });

            describe("hindi", () => {
                it("should handle Hindi characters correctly with default locale", () => {
                    const text = HINDI_STRINGS[0]; // "हिन्दीText"
                    expect(slice(text, 0, 5)).toEqualAnsi("हिंदीTex");
                    expect(slice(text, 2, 7)).toEqualAnsi("Text");
                });

                it("should handle Hindi characters correctly with Hindi locale", () => {
                    const text = HINDI_STRINGS[1]; // "पाठString"
                    expect(slice(text, 0, 3)).toEqualAnsi("पाठS");
                    expect(slice(text, 1, 6)).toEqualAnsi("ठStri");
                });
            });

            describe("bengali", () => {
                it("should handle Bengali characters correctly with default locale", () => {
                    const text = BENGALI_STRINGS[0]; // "বাংলাText"
                    expect(slice(text, 0, 5)).toEqualAnsi("বাংলাTex");
                    expect(slice(text, 2, 7)).toEqualAnsi("Text");
                });

                it("should handle Bengali characters correctly with Bengali locale", () => {
                    const text = BENGALI_STRINGS[1]; // "টেক্সটString"
                    expect(slice(text, 0, 5)).toEqualAnsi("টেক্সটS");
                    expect(slice(text, 2, 9)).toEqualAnsi("টStrin");
                });
            });
        });

        // European languages
        describe("european languages", () => {
            describe("german", () => {
                it("should handle German special characters correctly with default locale", () => {
                    const text = GERMAN_STRINGS[0]; // "straßeName"
                    expect(slice(text, 0, 6)).toEqualAnsi("straße");
                    expect(slice(text, 3, 9)).toEqualAnsi("aßeNam");
                });

                it("should handle German special characters correctly with German locale", () => {
                    const text = GERMAN_STRINGS[1]; // "GROẞBUCHSTABE"
                    expect(slice(text, 0, 4)).toEqualAnsi("GROẞ");
                    expect(slice(text, 2, 8)).toEqualAnsi("OẞBUCH");
                });
            });

            describe("greek", () => {
                it("should handle Greek characters correctly with default locale", () => {
                    const text = GREEK_STRINGS[0]; // "ΕλληνικάText"
                    expect(slice(text, 0, 5)).toEqualAnsi("Ελ");
                    expect(slice(text, 3, 8)).toEqualAnsi("λη");
                });

                it("should handle Greek characters correctly with Greek locale", () => {
                    const text = GREEK_STRINGS[1]; // "ΚείμενοString"
                    expect(slice(text, 0, 5)).toEqualAnsi("Κεί");
                    expect(slice(text, 3, 9)).toEqualAnsi("ίμε");
                });
            });

            describe("russian", () => {
                it("should handle Russian characters correctly with default locale", () => {
                    const text = RUSSIAN_STRINGS[0]; // "русскийText"
                    expect(slice(text, 0, 5)).toEqualAnsi("Ру");
                    expect(slice(text, 3, 8)).toEqualAnsi("сс");
                });

                it("should handle Russian characters correctly with Russian locale", () => {
                    const text = RUSSIAN_STRINGS[1]; // "текстString"
                    expect(slice(text, 0, 4)).toEqualAnsi("Те");
                    expect(slice(text, 2, 8)).toEqualAnsi("екс");
                });
            });

            describe("ukrainian", () => {
                it("should handle Ukrainian characters correctly with default locale", () => {
                    const text = UKRAINIAN_STRINGS[0]; // "УкраїнськаMова"
                    expect(slice(text, 0, 5)).toEqualAnsi("Ук");
                    expect(slice(text, 3, 8)).toEqualAnsi("ра");
                });

                it("should handle Ukrainian characters correctly with Ukrainian locale", () => {
                    const text = UKRAINIAN_STRINGS[1]; // "ТекстText"
                    expect(slice(text, 0, 4)).toEqualAnsi("Те");
                    expect(slice(text, 2, 7)).toEqualAnsi("ек");
                });
            });
        });

        // Special cases
        describe("special cases", () => {
            describe("turkish", () => {
                it("should handle Turkish dotted/dotless i characters correctly with default locale", () => {
                    const text = TURKISH_STRINGS[0]; // "İstanbulCity"
                    expect(slice(text, 0, 5)).toEqualAnsi("İstan");
                    expect(slice(text, 3, 8)).toEqualAnsi("anbul");
                });

                it("should handle Turkish dotted/dotless i characters correctly with Turkish locale", () => {
                    const text = TURKISH_STRINGS[3]; // "IıİiTest"
                    expect(slice(text, 0, 4)).toEqualAnsi("Iıİ");
                    expect(slice(text, 2, 7)).toEqualAnsi("İiTe");
                });
            });

            describe("lao", () => {
                it("should handle Lao characters correctly with default locale", () => {
                    const text = LAO_STRINGS[0]; // "ລາວText"
                    expect(slice(text, 0, 3)).toEqualAnsi("ລາວ");
                    expect(slice(text, 1, 5)).toEqualAnsi("າວTe");
                });

                it("should handle Lao characters correctly with Lao locale", () => {
                    const text = LAO_STRINGS[1]; // "ຂໍ້ຄວາມString"
                    expect(slice(text, 0, 5)).toEqualAnsi("ຂໍ້ຄວາມ");
                    expect(slice(text, 2, 9)).toEqualAnsi("ວາມStri");
                });
            });
        });

        // Mixed language tests
        describe("mixed language strings", () => {
            it("should handle mixed language scripts correctly across different writing systems", () => {
                const mixedText = "English日本語한국어العربية";
                expect(slice(mixedText, 0, 10)).toEqualAnsi("English日");
                expect(slice(mixedText, 7, 15)).toEqualAnsi("日本語한");
                expect(slice(mixedText, 10, 20)).toEqualAnsi("語한국어ا");
            });

            it("should handle mixed language scripts with ANSI colors correctly", () => {
                const mixedColoredText = `${red("English")}${green("日本語")}${yellow("한국어")}${blue("العربية")}`;

                expect(slice(mixedColoredText, 0, 10)).toEqualAnsi(red("English") + green("日本語"));
                expect(slice(mixedColoredText, 7, 15)).toEqualAnsi(green("日本語") + yellow("한국어") + blue("ال"));
            });
        });
    });
});
