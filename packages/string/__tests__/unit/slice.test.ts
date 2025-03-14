import { stripVTControlCharacters } from "node:util";

import colorize, { black,blue, cyan, green, red, yellow } from "@visulima/colorize";
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
    it("should behave exactly like regular JS slice", () => {
        // The slice should behave exactly as a regular JS slice behaves
        for (let index = 0; index < 20; index++) {
            for (let index2 = 19; index2 > index; index2--) {
                const nativeSlice = stripped.slice(index, index2);
                const ansiSlice = slice(fixture, index, index2);
                expect(stripVTControlCharacters(ansiSlice)).toBe(nativeSlice);
            }
        }

        const a = JSON.stringify("\u001B[31mthe \u001B[39m\u001B[32mquick \u001B[39m");
        const b = JSON.stringify("\u001B[34mbrown \u001B[39m\u001B[36mfox \u001B[39m");
        const c = JSON.stringify("\u001B[31m \u001B[39m\u001B[32mquick \u001B[39m\u001B[34mbrown \u001B[39m\u001B[36mfox \u001B[39m");

        expect(JSON.stringify(slice(fixture, 0, 10))).toBe(a);
        expect(JSON.stringify(slice(fixture, 10, 20))).toBe(b);
        expect(JSON.stringify(slice(fixture, 3, 20))).toBe(c);

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

    it("handles grapheme clusters correctly", () => {
        // Family emoji (👨‍👩‍👧‍👦) is a single grapheme made up of multiple code points
        const family = "👨‍👩‍👧‍👦";
        expect(slice(family, 0, 1)).toBe(family);
        expect(slice(family, 0, 2)).toBe(family);

        // Combining characters
        const combined = "e\u0301"; // é (e + acute accent)
        expect(slice(combined, 0, 1)).toBe(combined);
    });

    it("handles zero width joiner sequences", () => {
        // Woman technologist emoji (👩‍💻) uses ZWJ
        const technologist = "👩‍💻";
        expect(slice(technologist, 0, 1)).toBe(technologist);
    });

    it("supports unicode surrogate pairs", () => {
        expect(slice("a\uD83C\uDE00BC", 0, 2)).toBe("a\uD83C\uDE00");
    });

    it("doesn't add unnecessary escape codes", () => {
        expect(slice("\u001B[31municorn\u001B[39m", 0, 3)).toBe("\u001B[31muni\u001B[39m");
    });

    it("can slice a normal character before a colored character", () => {
        expect(slice("a\u001B[31mb\u001B[39m", 0, 1)).toBe("a");
    });

    it("can slice a normal character after a colored character", () => {
        expect(slice("\u001B[31ma\u001B[39mb", 1, 2)).toBe("b");
    });

    it("can slice a string styled with both background and foreground", () => {
        // Test string: `bgGreen.black('test');`
        expect(slice("\u001B[42m\u001B[30mtest\u001B[39m\u001B[49m", 0, 1)).toBe("\u001B[42m\u001B[30mt\u001B[39m\u001B[49m");
    });

    it("can slice a string styled with modifier", () => {
        // Test string: `underline('test');`
        expect(slice("\u001B[4mtest\u001B[24m", 0, 1)).toBe("\u001B[4mt\u001B[24m");
    });

    it("can slice a string with unknown ANSI color", () => {
        // The slice will not use a full reset sequence of unknown colors
        expect(slice("\u001B[20mTEST\u001B[49m", 0, 4)).toBe("\u001B[20mTEST\u001B[49m");
        expect(slice("\u001B[1001mTEST\u001B[49m", 0, 3)).toBe("\u001B[1001mTES\u001B[49m");
        expect(slice("\u001B[1001mTEST\u001B[49m", 0, 2)).toBe("\u001B[1001mTE\u001B[49m");
    });

    it("handles null issue correctly", () => {
        const s = '\u001B[1mautotune.flipCoin("easy as") ? 🎂 : 🍰 \u001B[33m★\u001B[39m\u001B[22m';
        const result = slice(s, 38);
        expect(result).not.toContain("null");
    });

    it("supports true color escape sequences", () => {
        expect(slice("\u001B[1m\u001B[48;2;255;255;255m\u001B[38;2;255;0;0municorn\u001B[39m\u001B[49m\u001B[22m", 0, 3)).toBe(
            "\u001B[1m\u001B[48;2;255;255;255m\u001B[38;2;255;0;0muni\u001B[39m\u001B[49m\u001B[22m",
        );
    });

    it("doesn't add extra escapes", () => {
        const output = `${black.bgYellow(" RUNS ")}  ${green("test")}`;
        expect(slice(output, 0, 7)).toBe(`${black.bgYellow(" RUNS ")} `);
        expect(slice(output, 0, 8)).toBe(`${black.bgYellow(" RUNS ")}  `);
        expect(JSON.stringify(slice("\u001B[31m" + output, 0, 4))).toBe(JSON.stringify(black.bgYellow(" RUN")));
    });

    it("does not lose fullwidth characters", () => {
        expect(slice("古古test", 0)).toBe("古古test");
    });

    it("can create empty slices", () => {
        expect(slice("test", 0, 0)).toBe("");
    });

    it("handles hyperlinks correctly", () => {
        const link = "\u001B]8;;https://google.com\u0007Google\u001B]8;;\u0007";
        expect(slice(link, 0, 6)).toBe(link);
    });

    it("handles invalid ANSI sequences correctly", () => {
        // Incomplete sequence
        expect(slice("\u001B[test", 0, 4)).toBe("\u001B[te");

        // Invalid characters in sequence
        expect(slice("\u001B[abc31mtest\u001B[39m", 0, 4)).toBe("\u001B[test");

        // Missing terminator
        expect(slice("\u001B[31test\u001B[39m", 0, 4)).toBe("\u001B[test");

        // Multiple invalid sequences
        expect(slice("\u001B[31m\u001B[test\u001B[39m", 0, 4)).toBe("\u001B[31mtest\u001B[39m");
    });

    it("handles multiple consecutive ANSI codes", () => {
        // Multiple valid codes
        expect(slice("\u001B[1m\u001B[31m\u001B[42mtest\u001B[0m", 0, 4)).toBe("\u001B[1m\u001B[31m\u001B[42mtest\u001B[0m");

        // Mix of valid and invalid codes
        expect(slice("\u001B[1m\u001B[invalid\u001B[31mtest\u001B[0m", 0, 4)).toBe("\u001B[1m\u001B[31mtest\u001B[0m");
    });

    // Locale-specific tests
    describe("with different locales", () => {
        // East Asian languages
        describe("East Asian languages", () => {
            describe("Japanese", () => {
                it("handles Japanese characters correctly with default locale", () => {
                    const text = JAPANESE_STRINGS[0]; // "ひらがなカタカナABC"
                    expect(slice(text, 0, 5)).toBe("ひらがなカ");
                    expect(slice(text, 2, 7)).toBe("がなカタカ");
                });

                it("handles Japanese characters correctly with ja locale", () => {
                    const text = JAPANESE_STRINGS[1]; // "カタカナひらがな漢字"
                    expect(slice(text, 0, 4, "ja")).toBe("カタカナ");
                    expect(slice(text, 3, 7, "ja")).toBe("ナひらが");
                });

                it("handles mixed Japanese and Latin characters", () => {
                    const text = JAPANESE_STRINGS[4]; // "テストString"
                    expect(slice(text, 0, 5, "ja")).toBe("テストSt");
                    expect(slice(text, 2, 8, "ja")).toBe("トStrin");
                });
            });

            describe("Korean", () => {
                it("handles Korean characters correctly with default locale", () => {
                    const text = KOREAN_STRINGS[0]; // "대문자UPPER"
                    expect(slice(text, 0, 3)).toBe("대문자");
                    expect(slice(text, 2, 6)).toBe("자UPP");
                });

                it("handles Korean characters correctly with ko locale", () => {
                    const text = KOREAN_STRINGS[1]; // "한글Text"
                    expect(slice(text, 0, 3, "ko")).toBe("한글T");
                    expect(slice(text, 1, 5, "ko")).toBe("글Tex");
                });

                it("handles mixed Korean and Latin characters", () => {
                    const text = KOREAN_STRINGS[2]; // "테스트String"
                    expect(slice(text, 0, 5, "ko")).toBe("테스트St");
                    expect(slice(text, 2, 8, "ko")).toBe("트Strin");
                });
            });

            describe("Chinese", () => {
                it("handles Chinese characters correctly with default locale", () => {
                    const text = CHINESE_SIMPLIFIED_STRINGS[0]; // "中文Text"
                    expect(slice(text, 0, 3)).toBe("中文T");
                    expect(slice(text, 1, 5)).toBe("文Tex");
                });

                it("handles Chinese characters correctly with zh locale", () => {
                    const text = CHINESE_SIMPLIFIED_STRINGS[1]; // "文本String"
                    expect(slice(text, 0, 3, "zh")).toBe("文本S");
                    expect(slice(text, 1, 6, "zh")).toBe("本Stri");
                });

                it("handles Chinese characters with zh-CN locale", () => {
                    const text = CHINESE_SIMPLIFIED_STRINGS[4]; // "测试Test"
                    expect(slice(text, 0, 3, "zh-CN")).toBe("测试T");
                    expect(slice(text, 1, 5, "zh-CN")).toBe("试Tes");
                });

                it("handles Chinese characters with zh-TW locale", () => {
                    const text = CHINESE_TRADITIONAL_STRINGS[2]; // "程式Program"
                    expect(slice(text, 0, 3, "zh-TW")).toBe("程式P");
                    expect(slice(text, 1, 8, "zh-TW")).toBe("式Progra");
                });
            });

            describe("Thai", () => {
                it("handles Thai characters correctly with default locale", () => {
                    const text = THAI_STRINGS[0]; // "ไทยText"
                    expect(slice(text, 0, 3)).toBe("ไทย");
                    expect(slice(text, 1, 5)).toBe("ทยTe");
                });

                it("handles Thai characters correctly with th locale", () => {
                    const text = THAI_STRINGS[1]; // "ข้อความString"
                    expect(slice(text, 0, 5, "th")).toBe("ข้อควา");
                    expect(slice(text, 2, 9, "th")).toBe("ความStr");
                });
            });
        });

        // Middle Eastern and South Asian languages
        describe("Middle Eastern and South Asian languages", () => {
            describe("Arabic", () => {
                it("handles Arabic characters correctly with default locale", () => {
                    const text = ARABIC_STRINGS[0]; // "عربيText"
                    expect(slice(text, 0, 4)).toBe("عربي");
                    expect(slice(text, 2, 6)).toBe("بيTe");
                });

                it("handles Arabic characters correctly with ar locale", () => {
                    const text = ARABIC_STRINGS[1]; // "نصString"
                    expect(slice(text, 0, 3, "ar")).toBe("نصS");
                    expect(slice(text, 1, 6, "ar")).toBe("صStri");
                });
            });

            describe("Hebrew", () => {
                it("handles Hebrew characters correctly with default locale", () => {
                    const text = HEBREW_STRINGS[0]; // "עבריתText"
                    expect(slice(text, 0, 4)).toBe("עברי");
                    expect(slice(text, 2, 6)).toBe("ריתT");
                });

                it("handles Hebrew characters correctly with he locale", () => {
                    const text = HEBREW_STRINGS[1]; // "טקסטString"
                    expect(slice(text, 0, 4, "he")).toBe("טקסט");
                    expect(slice(text, 2, 8, "he")).toBe("סטStri");
                });
            });

            describe("Hindi", () => {
                it("handles Hindi characters correctly with default locale", () => {
                    const text = HINDI_STRINGS[0]; // "हिन्दीText"
                    expect(slice(text, 0, 5)).toBe("हिंदीTex");
                    expect(slice(text, 2, 7)).toBe("Text");
                });

                it("handles Hindi characters correctly with hi locale", () => {
                    const text = HINDI_STRINGS[1]; // "पाठString"
                    expect(slice(text, 0, 3, "hi")).toBe("पाठS");
                    expect(slice(text, 1, 6, "hi")).toBe("ठStri");
                });
            });

            describe("Bengali", () => {
                it("handles Bengali characters correctly with default locale", () => {
                    const text = BENGALI_STRINGS[0]; // "বাংলাText"
                    expect(slice(text, 0, 5)).toBe("বাংলাTex");
                    expect(slice(text, 2, 7)).toBe("Text");
                });

                it("handles Bengali characters correctly with bn locale", () => {
                    const text = BENGALI_STRINGS[1]; // "টেক্সটString"
                    expect(slice(text, 0, 5, "bn")).toBe("টেক্সটSt");
                    expect(slice(text, 2, 9, "bn")).toBe("টString");
                });
            });
        });

        // European languages
        describe("European languages", () => {
            describe("German", () => {
                it("handles German special characters correctly with default locale", () => {
                    const text = GERMAN_STRINGS[0]; // "straßeName"
                    expect(slice(text, 0, 6)).toBe("straße");
                    expect(slice(text, 3, 9)).toBe("aßeNam");
                });

                it("handles German special characters correctly with de locale", () => {
                    const text = GERMAN_STRINGS[1]; // "GROẞBUCHSTABE"
                    expect(slice(text, 0, 4, "de")).toBe("GROẞ");
                    expect(slice(text, 2, 8, "de")).toBe("OẞBUCH");
                });
            });

            describe("Greek", () => {
                it("handles Greek characters correctly with default locale", () => {
                    const text = GREEK_STRINGS[0]; // "ΕλληνικάText"
                    expect(slice(text, 0, 5)).toBe("Ελλην");
                    expect(slice(text, 3, 8)).toBe("ηνικά");
                });

                it("handles Greek characters correctly with el locale", () => {
                    const text = GREEK_STRINGS[1]; // "ΚείμενοString"
                    expect(slice(text, 0, 5, "el")).toBe("Κείμε");
                    expect(slice(text, 3, 9, "el")).toBe("μενοSt");
                });
            });

            describe("Russian", () => {
                it("handles Russian characters correctly with default locale", () => {
                    const text = RUSSIAN_STRINGS[0]; // "русскийText"
                    expect(slice(text, 0, 5)).toBe("Русск");
                    expect(slice(text, 3, 8)).toBe("скийT");
                });

                it("handles Russian characters correctly with ru locale", () => {
                    const text = RUSSIAN_STRINGS[1]; // "текстString"
                    expect(slice(text, 0, 4, "ru")).toBe("Текс");
                    expect(slice(text, 2, 8, "ru")).toBe("кстStr");
                });
            });

            describe("Ukrainian", () => {
                it("handles Ukrainian characters correctly with default locale", () => {
                    const text = UKRAINIAN_STRINGS[0]; // "УкраїнськаMова"
                    expect(slice(text, 0, 5)).toBe("Украї");
                    expect(slice(text, 3, 8)).toBe("аїнсь");
                });

                it("handles Ukrainian characters correctly with uk locale", () => {
                    const text = UKRAINIAN_STRINGS[1]; // "ТекстText"
                    expect(slice(text, 0, 4, "uk")).toBe("Текс");
                    expect(slice(text, 2, 7, "uk")).toBe("кстTe");
                });
            });
        });

        // Special cases
        describe("Special cases", () => {
            describe("Turkish", () => {
                it("handles Turkish dotted/dotless i correctly with default locale", () => {
                    const text = TURKISH_STRINGS[0]; // "İstanbulCity"
                    expect(slice(text, 0, 5)).toBe("İstan");
                    expect(slice(text, 3, 8)).toBe("anbul");
                });

                it("handles Turkish dotted/dotless i correctly with tr locale", () => {
                    const text = TURKISH_STRINGS[3]; // "IıİiTest"
                    expect(slice(text, 0, 4, "tr")).toBe("Iıİi");
                    expect(slice(text, 2, 7, "tr")).toBe("İiTes");
                });
            });

            describe("Lao", () => {
                it("handles Lao characters correctly with default locale", () => {
                    const text = LAO_STRINGS[0]; // "ລາວText"
                    expect(slice(text, 0, 3)).toBe("ລາວ");
                    expect(slice(text, 1, 5)).toBe("າວTe");
                });

                it("handles Lao characters correctly with lo locale", () => {
                    const text = LAO_STRINGS[1]; // "ຂໍ້ຄວາມString"
                    expect(slice(text, 0, 5, "lo")).toBe("ຂໍ້ຄວາມ");
                    expect(slice(text, 2, 9, "lo")).toBe("ວາມStri");
                });
            });
        });

        // Mixed language tests
        describe("Mixed language strings", () => {
            it("handles mixed scripts correctly", () => {
                const mixedText = "English日本語한국어العربية";
                expect(slice(mixedText, 0, 10)).toBe("English日本語");
                expect(slice(mixedText, 7, 15)).toBe("日本語한국어ال");
                expect(slice(mixedText, 10, 20)).toBe("한국어العربية");
            });

            it("handles mixed scripts with ANSI colors", () => {
                const mixedColoredText = `\u001B[31mEnglish\u001B[32m日本語\u001B[33m한국어\u001B[34mالعربية\u001B[0m`;
                expect(slice(mixedColoredText, 0, 10)).toBe("\u001B[31mEnglish\u001B[32m日本語\u001B[0m");
                expect(slice(mixedColoredText, 7, 15)).toBe("\u001B[32m日本語\u001B[33m한국\u001B[0m");
            });
        });
    });
});
