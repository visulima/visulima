import { splitByCase } from "@visulima/string/case";
import { splitByCase as sculeSplitByCase } from "scule";
import { describe, test } from "vitest";

import {
    AFRIKAANS_STRINGS,
    ALBANIAN_STRINGS,
    AMHARIC_STRINGS,
    ARABIC_STRINGS,
    ARMENIAN_STRINGS,
    BELARUSIAN_STRINGS,
    BENGALI_STRINGS,
    BOSNIAN_STRINGS,
    BULGARIAN_STRINGS,
    CATALAN_STRINGS,
    CHINESE_HONGKONG_STRINGS,
    CHINESE_SIMPLIFIED_STRINGS,
    CHINESE_TRADITIONAL_STRINGS,
    CROATIAN_STRINGS,
    CZECH_STRINGS,
    DANISH_STRINGS,
    DUTCH_STRINGS,
    ESTONIAN_STRINGS,
    FILIPINO_STRINGS,
    FINNISH_STRINGS,
    FRENCH_STRINGS,
    GALICIAN_STRINGS,
    GEORGIAN_STRINGS,
    GERMAN_STRINGS,
    GREEK_STRINGS,
    GUJARATI_STRINGS,
    HEBREW_STRINGS,
    HINDI_STRINGS,
    HUNGARIAN_STRINGS,
    ICELANDIC_STRINGS,
    INDONESIAN_STRINGS,
    IRISH_STRINGS,
    ITALIAN_STRINGS,
    JAPANESE_STRINGS,
    KANNADA_STRINGS,
    KAZAKH_STRINGS,
    KHMER_STRINGS,
    KOREAN_STRINGS,
    KYRGYZ_STRINGS,
    LAO_STRINGS,
    LATVIAN_STRINGS,
    LITHUANIAN_STRINGS,
    MACEDONIAN_STRINGS,
    MALAY_STRINGS,
    MALAYALAM_STRINGS,
    MALTESE_STRINGS,
    MARATHI_STRINGS,
    MONGOLIAN_STRINGS,
    NEPALI_STRINGS,
    NORWEGIAN_STRINGS,
    PERSIAN_STRINGS,
    POLISH_STRINGS,
    PORTUGUESE_STRINGS,
    PUNJABI_STRINGS,
    ROMANIAN_STRINGS,
    RUSSIAN_STRINGS,
    SERBIAN_STRINGS,
    SINHALA_STRINGS,
    SLOVAK_STRINGS,
    SLOVENIAN_STRINGS,
    SWEDISH_STRINGS,
    TAMIL_STRINGS,
    TELUGU_STRINGS,
    THAI_STRINGS,
    TURKISH_STRINGS,
    UKRAINIAN_STRINGS,
    URDU_STRINGS,
    UZBEK_STRINGS,
    VIETNAMESE_STRINGS,
    WELSH_STRINGS,
} from "../../__fixtures__/locale-test-strings";
import { ACRONYM_STRINGS, SPECIAL_STRINGS, TEST_STRINGS } from "../../__fixtures__/test-strings";

describe("splitByCase", () => {
    test("visulima/string splitByCase (no cache)", async ({ bench }) => {
        await bench("visulima/string splitByCase (no cache)", () => {
            for (const stringValue of TEST_STRINGS) {
                splitByCase(stringValue);
            }
        }).run();
    });

    test.skipIf(process.env.CODSPEED_ENV)("scule splitByCase", async ({ bench }) => {
        await bench("scule splitByCase", () => {
            for (const stringValue of TEST_STRINGS) {
                sculeSplitByCase(stringValue);
            }
        }).run();
    });

    describe("Special characters handling", () => {
        test("visulima/string splitByCase (no cache)", async ({ bench }) => {
            await bench("visulima/string splitByCase (no cache)", () => {
                for (const stringValue of SPECIAL_STRINGS) {
                    splitByCase(stringValue);
                }
            }).run();
        });

        test.skipIf(process.env.CODSPEED_ENV)("scule splitByCase", async ({ bench }) => {
            await bench("scule splitByCase", () => {
                for (const stringValue of SPECIAL_STRINGS) {
                    sculeSplitByCase(stringValue);
                }
            }).run();
        });
    });

    describe("Acronym handling", () => {
        test("visulima/string splitByCase (no cache)", async ({ bench }) => {
            await bench("visulima/string splitByCase (no cache)", () => {
                for (const stringValue of ACRONYM_STRINGS) {
                    splitByCase(stringValue);
                }
            }).run();
        });

        test.skipIf(process.env.CODSPEED_ENV)("scule splitByCase", async ({ bench }) => {
            await bench("scule splitByCase", () => {
                for (const stringValue of ACRONYM_STRINGS) {
                    sculeSplitByCase(stringValue);
                }
            }).run();
        });
    });

    describe("Japanese script handling", () => {
        test("visulima/string splitByCase (no cache)", async ({ bench }) => {
            await bench("visulima/string splitByCase (no cache)", () => {
                for (const stringValue of JAPANESE_STRINGS) {
                    splitByCase(stringValue, { locale: "ja-JP" });
                }
            }).run();
        });
    });

    describe("Korean script handling", () => {
        test("visulima/string splitByCase (no cache)", async ({ bench }) => {
            await bench("visulima/string splitByCase (no cache)", () => {
                for (const stringValue of KOREAN_STRINGS) {
                    splitByCase(stringValue, { locale: "ko-KR" });
                }
            }).run();
        });
    });

    describe("Ukrainian script handling", () => {
        test("visulima/string splitByCase (no cache)", async ({ bench }) => {
            await bench("visulima/string splitByCase (no cache)", () => {
                for (const stringValue of UKRAINIAN_STRINGS) {
                    splitByCase(stringValue, { locale: "uk-UA" });
                }
            }).run();
        });
    });

    describe("Greek script handling", () => {
        test("visulima/string splitByCase (no cache)", async ({ bench }) => {
            await bench("visulima/string splitByCase (no cache)", () => {
                for (const stringValue of GREEK_STRINGS) {
                    splitByCase(stringValue, { locale: "el-GR" });
                }
            }).run();
        });
    });

    describe("German script handling", () => {
        test("visulima/string splitByCase (no cache)", async ({ bench }) => {
            await bench("visulima/string splitByCase (no cache)", () => {
                for (const stringValue of GERMAN_STRINGS) {
                    splitByCase(stringValue, { locale: "de-DE" });
                }
            }).run();
        });
    });

    describe("Russian script handling", () => {
        test("visulima/string splitByCase (no cache)", async ({ bench }) => {
            await bench("visulima/string splitByCase (no cache)", () => {
                for (const stringValue of RUSSIAN_STRINGS) {
                    splitByCase(stringValue, { locale: "ru-RU" });
                }
            }).run();
        });
    });

    describe("Bulgarian script handling", () => {
        test("visulima/string splitByCase (no cache)", async ({ bench }) => {
            await bench("visulima/string splitByCase (no cache)", () => {
                for (const stringValue of BULGARIAN_STRINGS) {
                    splitByCase(stringValue, { locale: "bg-BG" });
                }
            }).run();
        });
    });

    describe("Serbian script handling", () => {
        test("visulima/string splitByCase (no cache)", async ({ bench }) => {
            await bench("visulima/string splitByCase (no cache)", () => {
                for (const stringValue of SERBIAN_STRINGS) {
                    splitByCase(stringValue, { locale: "sr-RS" });
                }
            }).run();
        });
    });

    describe("Macedonian script handling", () => {
        test("visulima/string splitByCase (no cache)", async ({ bench }) => {
            await bench("visulima/string splitByCase (no cache)", () => {
                for (const stringValue of MACEDONIAN_STRINGS) {
                    splitByCase(stringValue, { locale: "mk-MK" });
                }
            }).run();
        });
    });

    describe("Belarusian script handling", () => {
        test("visulima/string splitByCase (no cache)", async ({ bench }) => {
            await bench("visulima/string splitByCase (no cache)", () => {
                for (const stringValue of BELARUSIAN_STRINGS) {
                    splitByCase(stringValue, { locale: "be-BY" });
                }
            }).run();
        });
    });

    describe("Chinese (Simplified) script handling", () => {
        test("visulima/string splitByCase (no cache)", async ({ bench }) => {
            await bench("visulima/string splitByCase (no cache)", () => {
                for (const stringValue of CHINESE_SIMPLIFIED_STRINGS) {
                    splitByCase(stringValue, { locale: "zh-CN" });
                }
            }).run();
        });
    });

    describe("Chinese (Traditional) script handling", () => {
        test("visulima/string splitByCase (no cache)", async ({ bench }) => {
            await bench("visulima/string splitByCase (no cache)", () => {
                for (const stringValue of CHINESE_TRADITIONAL_STRINGS) {
                    splitByCase(stringValue, { locale: "zh-TW" });
                }
            }).run();
        });
    });

    describe("Chinese (Hong Kong) script handling", () => {
        test("visulima/string splitByCase (no cache)", async ({ bench }) => {
            await bench("visulima/string splitByCase (no cache)", () => {
                for (const stringValue of CHINESE_HONGKONG_STRINGS) {
                    splitByCase(stringValue, { locale: "zh-HK" });
                }
            }).run();
        });
    });

    describe("Arabic script handling", () => {
        test("visulima/string splitByCase (no cache)", async ({ bench }) => {
            await bench("visulima/string splitByCase (no cache)", () => {
                for (const stringValue of ARABIC_STRINGS) {
                    splitByCase(stringValue, { locale: "ar" });
                }
            }).run();
        });
    });

    describe("Persian script handling", () => {
        test("visulima/string splitByCase (no cache)", async ({ bench }) => {
            await bench("visulima/string splitByCase (no cache)", () => {
                for (const stringValue of PERSIAN_STRINGS) {
                    splitByCase(stringValue, { locale: "fa" });
                }
            }).run();
        });
    });

    describe("Hebrew script handling", () => {
        test("visulima/string splitByCase (no cache)", async ({ bench }) => {
            await bench("visulima/string splitByCase (no cache)", () => {
                for (const stringValue of HEBREW_STRINGS) {
                    splitByCase(stringValue, { locale: "he" });
                }
            }).run();
        });
    });

    describe("Thai script handling", () => {
        test("visulima/string splitByCase (no cache)", async ({ bench }) => {
            await bench("visulima/string splitByCase (no cache)", () => {
                for (const stringValue of THAI_STRINGS) {
                    splitByCase(stringValue, { locale: "th" });
                }
            }).run();
        });
    });

    describe("Hindi script handling", () => {
        test("visulima/string splitByCase (no cache)", async ({ bench }) => {
            await bench("visulima/string splitByCase (no cache)", () => {
                for (const stringValue of HINDI_STRINGS) {
                    splitByCase(stringValue, { locale: "hi" });
                }
            }).run();
        });
    });

    describe("Marathi script handling", () => {
        test("visulima/string splitByCase (no cache)", async ({ bench }) => {
            await bench("visulima/string splitByCase (no cache)", () => {
                for (const stringValue of MARATHI_STRINGS) {
                    splitByCase(stringValue, { locale: "mr" });
                }
            }).run();
        });
    });

    describe("Nepali script handling", () => {
        test("visulima/string splitByCase (no cache)", async ({ bench }) => {
            await bench("visulima/string splitByCase (no cache)", () => {
                for (const stringValue of NEPALI_STRINGS) {
                    splitByCase(stringValue, { locale: "ne" });
                }
            }).run();
        });
    });

    describe("Turkish script handling", () => {
        test("visulima/string splitByCase (no cache)", async ({ bench }) => {
            await bench("visulima/string splitByCase (no cache)", () => {
                for (const stringValue of TURKISH_STRINGS) {
                    splitByCase(stringValue, { locale: "tr-TR" });
                }
            }).run();
        });
    });

    describe("Gujarati script handling", () => {
        test("visulima/string splitByCase (no cache)", async ({ bench }) => {
            await bench("visulima/string splitByCase (no cache)", () => {
                for (const stringValue of GUJARATI_STRINGS) {
                    splitByCase(stringValue, { locale: "gu" });
                }
            }).run();
        });
    });

    describe("Kannada script handling", () => {
        test("visulima/string splitByCase (no cache)", async ({ bench }) => {
            await bench("visulima/string splitByCase (no cache)", () => {
                for (const stringValue of KANNADA_STRINGS) {
                    splitByCase(stringValue, { locale: "kn" });
                }
            }).run();
        });
    });

    describe("Malayalam script handling", () => {
        test("visulima/string splitByCase (no cache)", async ({ bench }) => {
            await bench("visulima/string splitByCase (no cache)", () => {
                for (const stringValue of MALAYALAM_STRINGS) {
                    splitByCase(stringValue, { locale: "ml" });
                }
            }).run();
        });
    });

    describe("Sinhala script handling", () => {
        test("visulima/string splitByCase (no cache)", async ({ bench }) => {
            await bench("visulima/string splitByCase (no cache)", () => {
                for (const stringValue of SINHALA_STRINGS) {
                    splitByCase(stringValue, { locale: "si" });
                }
            }).run();
        });
    });

    describe("Tamil script handling", () => {
        test("visulima/string splitByCase (no cache)", async ({ bench }) => {
            await bench("visulima/string splitByCase (no cache)", () => {
                for (const stringValue of TAMIL_STRINGS) {
                    splitByCase(stringValue, { locale: "ta" });
                }
            }).run();
        });
    });

    describe("Telugu script handling", () => {
        test("visulima/string splitByCase (no cache)", async ({ bench }) => {
            await bench("visulima/string splitByCase (no cache)", () => {
                for (const stringValue of TELUGU_STRINGS) {
                    splitByCase(stringValue, { locale: "te" });
                }
            }).run();
        });
    });

    describe("Afrikaans script handling", () => {
        test("visulima/string splitByCase (no cache)", async ({ bench }) => {
            await bench("visulima/string splitByCase (no cache)", () => {
                for (const stringValue of AFRIKAANS_STRINGS) {
                    splitByCase(stringValue, { locale: "af" });
                }
            }).run();
        });
    });

    describe("Albanian script handling", () => {
        test("visulima/string splitByCase (no cache)", async ({ bench }) => {
            await bench("visulima/string splitByCase (no cache)", () => {
                for (const stringValue of ALBANIAN_STRINGS) {
                    splitByCase(stringValue, { locale: "sq" });
                }
            }).run();
        });
    });

    describe("Amharic script handling", () => {
        test("visulima/string splitByCase (no cache)", async ({ bench }) => {
            await bench("visulima/string splitByCase (no cache)", () => {
                for (const stringValue of AMHARIC_STRINGS) {
                    splitByCase(stringValue, { locale: "am" });
                }
            }).run();
        });
    });

    describe("Armenian script handling", () => {
        test("visulima/string splitByCase (no cache)", async ({ bench }) => {
            await bench("visulima/string splitByCase (no cache)", () => {
                for (const stringValue of ARMENIAN_STRINGS) {
                    splitByCase(stringValue, { locale: "hy" });
                }
            }).run();
        });
    });

    describe("Bengali script handling", () => {
        test("visulima/string splitByCase (no cache)", async ({ bench }) => {
            await bench("visulima/string splitByCase (no cache)", () => {
                for (const stringValue of BENGALI_STRINGS) {
                    splitByCase(stringValue, { locale: "bn" });
                }
            }).run();
        });
    });

    describe("Bosnian script handling", () => {
        test("visulima/string splitByCase (no cache)", async ({ bench }) => {
            await bench("visulima/string splitByCase (no cache)", () => {
                for (const stringValue of BOSNIAN_STRINGS) {
                    splitByCase(stringValue, { locale: "bs" });
                }
            }).run();
        });
    });

    describe("Catalan script handling", () => {
        test("visulima/string splitByCase (no cache)", async ({ bench }) => {
            await bench("visulima/string splitByCase (no cache)", () => {
                for (const stringValue of CATALAN_STRINGS) {
                    splitByCase(stringValue, { locale: "ca" });
                }
            }).run();
        });
    });

    describe("Croatian script handling", () => {
        test("visulima/string splitByCase (no cache)", async ({ bench }) => {
            await bench("visulima/string splitByCase (no cache)", () => {
                for (const stringValue of CROATIAN_STRINGS) {
                    splitByCase(stringValue, { locale: "hr" });
                }
            }).run();
        });
    });

    describe("Czech script handling", () => {
        test("visulima/string splitByCase (no cache)", async ({ bench }) => {
            await bench("visulima/string splitByCase (no cache)", () => {
                for (const stringValue of CZECH_STRINGS) {
                    splitByCase(stringValue, { locale: "cs" });
                }
            }).run();
        });
    });

    describe("Danish script handling", () => {
        test("visulima/string splitByCase (no cache)", async ({ bench }) => {
            await bench("visulima/string splitByCase (no cache)", () => {
                for (const stringValue of DANISH_STRINGS) {
                    splitByCase(stringValue, { locale: "da" });
                }
            }).run();
        });
    });

    describe("Dutch script handling", () => {
        test("visulima/string splitByCase (no cache)", async ({ bench }) => {
            await bench("visulima/string splitByCase (no cache)", () => {
                for (const stringValue of DUTCH_STRINGS) {
                    splitByCase(stringValue, { locale: "nl" });
                }
            }).run();
        });
    });

    describe("Estonian script handling", () => {
        test("visulima/string splitByCase (no cache)", async ({ bench }) => {
            await bench("visulima/string splitByCase (no cache)", () => {
                for (const stringValue of ESTONIAN_STRINGS) {
                    splitByCase(stringValue, { locale: "et" });
                }
            }).run();
        });
    });

    describe("Finnish script handling", () => {
        test("visulima/string splitByCase (no cache)", async ({ bench }) => {
            await bench("visulima/string splitByCase (no cache)", () => {
                for (const stringValue of FINNISH_STRINGS) {
                    splitByCase(stringValue, { locale: "fi" });
                }
            }).run();
        });
    });

    describe("French script handling", () => {
        test("visulima/string splitByCase (no cache)", async ({ bench }) => {
            await bench("visulima/string splitByCase (no cache)", () => {
                for (const stringValue of FRENCH_STRINGS) {
                    splitByCase(stringValue, { locale: "fr" });
                }
            }).run();
        });
    });

    describe("Filipino script handling", () => {
        test("visulima/string splitByCase (no cache)", async ({ bench }) => {
            await bench("visulima/string splitByCase (no cache)", () => {
                for (const stringValue of FILIPINO_STRINGS) {
                    splitByCase(stringValue, { locale: "fil" });
                }
            }).run();
        });
    });

    describe("Galician script handling", () => {
        test("visulima/string splitByCase (no cache)", async ({ bench }) => {
            await bench("visulima/string splitByCase (no cache)", () => {
                for (const stringValue of GALICIAN_STRINGS) {
                    splitByCase(stringValue, { locale: "gl" });
                }
            }).run();
        });
    });

    describe("Georgian script handling", () => {
        test("visulima/string splitByCase (no cache)", async ({ bench }) => {
            await bench("visulima/string splitByCase (no cache)", () => {
                for (const stringValue of GEORGIAN_STRINGS) {
                    splitByCase(stringValue, { locale: "ka" });
                }
            }).run();
        });
    });

    describe("Hungarian script handling", () => {
        test("visulima/string splitByCase (no cache)", async ({ bench }) => {
            await bench("visulima/string splitByCase (no cache)", () => {
                for (const stringValue of HUNGARIAN_STRINGS) {
                    splitByCase(stringValue, { locale: "hu" });
                }
            }).run();
        });
    });

    describe("Indonesian script handling", () => {
        test("visulima/string splitByCase (no cache)", async ({ bench }) => {
            await bench("visulima/string splitByCase (no cache)", () => {
                for (const stringValue of INDONESIAN_STRINGS) {
                    splitByCase(stringValue, { locale: "id" });
                }
            }).run();
        });
    });

    describe("Icelandic script handling", () => {
        test("visulima/string splitByCase (no cache)", async ({ bench }) => {
            await bench("visulima/string splitByCase (no cache)", () => {
                for (const stringValue of ICELANDIC_STRINGS) {
                    splitByCase(stringValue, { locale: "is" });
                }
            }).run();
        });
    });

    describe("Irish script handling", () => {
        test("visulima/string splitByCase (no cache)", async ({ bench }) => {
            await bench("visulima/string splitByCase (no cache)", () => {
                for (const stringValue of IRISH_STRINGS) {
                    splitByCase(stringValue, { locale: "ga" });
                }
            }).run();
        });
    });

    describe("Italian script handling", () => {
        test("visulima/string splitByCase (no cache)", async ({ bench }) => {
            await bench("visulima/string splitByCase (no cache)", () => {
                for (const stringValue of ITALIAN_STRINGS) {
                    splitByCase(stringValue, { locale: "it" });
                }
            }).run();
        });
    });

    describe("Kazakh script handling", () => {
        test("visulima/string splitByCase (no cache)", async ({ bench }) => {
            await bench("visulima/string splitByCase (no cache)", () => {
                for (const stringValue of KAZAKH_STRINGS) {
                    splitByCase(stringValue, { locale: "kk" });
                }
            }).run();
        });
    });

    describe("Khmer script handling", () => {
        test("visulima/string splitByCase (no cache)", async ({ bench }) => {
            await bench("visulima/string splitByCase (no cache)", () => {
                for (const stringValue of KHMER_STRINGS) {
                    splitByCase(stringValue, { locale: "km" });
                }
            }).run();
        });
    });

    describe("Kyrgyz script handling", () => {
        test("visulima/string splitByCase (no cache)", async ({ bench }) => {
            await bench("visulima/string splitByCase (no cache)", () => {
                for (const stringValue of KYRGYZ_STRINGS) {
                    splitByCase(stringValue, { locale: "ky" });
                }
            }).run();
        });
    });

    describe("Lao script handling", () => {
        test("visulima/string splitByCase (no cache)", async ({ bench }) => {
            await bench("visulima/string splitByCase (no cache)", () => {
                for (const stringValue of LAO_STRINGS) {
                    splitByCase(stringValue, { locale: "lo" });
                }
            }).run();
        });
    });

    describe("Latvian script handling", () => {
        test("visulima/string splitByCase (no cache)", async ({ bench }) => {
            await bench("visulima/string splitByCase (no cache)", () => {
                for (const stringValue of LATVIAN_STRINGS) {
                    splitByCase(stringValue, { locale: "lv" });
                }
            }).run();
        });
    });

    describe("Lithuanian script handling", () => {
        test("visulima/string splitByCase (no cache)", async ({ bench }) => {
            await bench("visulima/string splitByCase (no cache)", () => {
                for (const stringValue of LITHUANIAN_STRINGS) {
                    splitByCase(stringValue, { locale: "lt" });
                }
            }).run();
        });
    });

    describe("Malay script handling", () => {
        test("visulima/string splitByCase (no cache)", async ({ bench }) => {
            await bench("visulima/string splitByCase (no cache)", () => {
                for (const stringValue of MALAY_STRINGS) {
                    splitByCase(stringValue, { locale: "ms" });
                }
            }).run();
        });
    });

    describe("Maltese script handling", () => {
        test("visulima/string splitByCase (no cache)", async ({ bench }) => {
            await bench("visulima/string splitByCase (no cache)", () => {
                for (const stringValue of MALTESE_STRINGS) {
                    splitByCase(stringValue, { locale: "mt" });
                }
            }).run();
        });
    });

    describe("Mongolian script handling", () => {
        test("visulima/string splitByCase (no cache)", async ({ bench }) => {
            await bench("visulima/string splitByCase (no cache)", () => {
                for (const stringValue of MONGOLIAN_STRINGS) {
                    splitByCase(stringValue, { locale: "mn" });
                }
            }).run();
        });
    });

    describe("Norwegian script handling", () => {
        test("visulima/string splitByCase (no cache)", async ({ bench }) => {
            await bench("visulima/string splitByCase (no cache)", () => {
                for (const stringValue of NORWEGIAN_STRINGS) {
                    splitByCase(stringValue, { locale: "nb" });
                }
            }).run();
        });
    });

    describe("Polish script handling", () => {
        test("visulima/string splitByCase (no cache)", async ({ bench }) => {
            await bench("visulima/string splitByCase (no cache)", () => {
                for (const stringValue of POLISH_STRINGS) {
                    splitByCase(stringValue, { locale: "pl" });
                }
            }).run();
        });
    });

    describe("Portuguese script handling", () => {
        test("visulima/string splitByCase (no cache)", async ({ bench }) => {
            await bench("visulima/string splitByCase (no cache)", () => {
                for (const stringValue of PORTUGUESE_STRINGS) {
                    splitByCase(stringValue, { locale: "pt" });
                }
            }).run();
        });
    });

    describe("Punjabi script handling", () => {
        test("visulima/string splitByCase (no cache)", async ({ bench }) => {
            await bench("visulima/string splitByCase (no cache)", () => {
                for (const stringValue of PUNJABI_STRINGS) {
                    splitByCase(stringValue, { locale: "pa" });
                }
            }).run();
        });
    });

    describe("Romanian script handling", () => {
        test("visulima/string splitByCase (no cache)", async ({ bench }) => {
            await bench("visulima/string splitByCase (no cache)", () => {
                for (const stringValue of ROMANIAN_STRINGS) {
                    splitByCase(stringValue, { locale: "ro" });
                }
            }).run();
        });
    });

    describe("Slovak script handling", () => {
        test("visulima/string splitByCase (no cache)", async ({ bench }) => {
            await bench("visulima/string splitByCase (no cache)", () => {
                for (const stringValue of SLOVAK_STRINGS) {
                    splitByCase(stringValue, { locale: "sk" });
                }
            }).run();
        });
    });

    describe("Slovenian script handling", () => {
        test("visulima/string splitByCase (no cache)", async ({ bench }) => {
            await bench("visulima/string splitByCase (no cache)", () => {
                for (const stringValue of SLOVENIAN_STRINGS) {
                    splitByCase(stringValue, { locale: "sl" });
                }
            }).run();
        });
    });

    describe("Swedish script handling", () => {
        test("visulima/string splitByCase (no cache)", async ({ bench }) => {
            await bench("visulima/string splitByCase (no cache)", () => {
                for (const stringValue of SWEDISH_STRINGS) {
                    splitByCase(stringValue, { locale: "sv" });
                }
            }).run();
        });
    });

    describe("Urdu script handling", () => {
        test("visulima/string splitByCase (no cache)", async ({ bench }) => {
            await bench("visulima/string splitByCase (no cache)", () => {
                for (const stringValue of URDU_STRINGS) {
                    splitByCase(stringValue, { locale: "ur" });
                }
            }).run();
        });
    });

    describe("Uzbek script handling", () => {
        test("visulima/string splitByCase (no cache)", async ({ bench }) => {
            await bench("visulima/string splitByCase (no cache)", () => {
                for (const stringValue of UZBEK_STRINGS) {
                    splitByCase(stringValue, { locale: "uz" });
                }
            }).run();
        });
    });

    describe("Vietnamese script handling", () => {
        test("visulima/string splitByCase (no cache)", async ({ bench }) => {
            await bench("visulima/string splitByCase (no cache)", () => {
                for (const stringValue of VIETNAMESE_STRINGS) {
                    splitByCase(stringValue, { locale: "vi" });
                }
            }).run();
        });
    });

    describe("Welsh script handling", () => {
        test("visulima/string splitByCase (no cache)", async ({ bench }) => {
            await bench("visulima/string splitByCase (no cache)", () => {
                for (const stringValue of WELSH_STRINGS) {
                    splitByCase(stringValue, { locale: "cy" });
                }
            }).run();
        });
    });
});
