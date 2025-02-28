import { bench, describe } from "vitest";
import { splitByCase as sculeSplitByCase } from "scule";
import { splitByCase } from "../dist/case";
import { ACRONYM_STRINGS, SPECIAL_STRINGS, TEST_STRINGS } from "../__fixtures__/test-strings";
import {
    AFRIKAANS_STRINGS,
    ALBANIAN_STRINGS,
    AMHARIC_STRINGS,
    ARABIC_STRINGS,
    ARMENIAN_STRINGS,
    BENGALI_STRINGS,
    BELARUSIAN_STRINGS,
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
} from "../__fixtures__/locale-test-strings";

describe("splitByCase", () => {
    bench("visulima/string splitByCase (no cache)", () => {
        for (const str of TEST_STRINGS) {
            splitByCase(str);
        }
    });

    bench("scule splitByCase", () => {
        for (const str of TEST_STRINGS) {
            sculeSplitByCase(str);
        }
    });

    describe("Special characters handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const str of SPECIAL_STRINGS) {
                splitByCase(str);
            }
        });

        bench("scule splitByCase", () => {
            for (const str of SPECIAL_STRINGS) {
                sculeSplitByCase(str);
            }
        });
    });

    describe("Acronym handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const str of ACRONYM_STRINGS) {
                splitByCase(str);
            }
        });

        bench("scule splitByCase", () => {
            for (const str of ACRONYM_STRINGS) {
                sculeSplitByCase(str);
            }
        });
    });

    describe("Japanese script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const str of JAPANESE_STRINGS) {
                splitByCase(str, { locale: "ja-JP" });
            }
        });
    });

    describe("Korean script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const str of KOREAN_STRINGS) {
                splitByCase(str, { locale: "ko-KR" });
            }
        });
    });

    describe("Ukrainian script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const str of UKRAINIAN_STRINGS) {
                splitByCase(str, { locale: "uk-UA" });
            }
        });
    });

    describe("Greek script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const str of GREEK_STRINGS) {
                splitByCase(str, { locale: "el-GR" });
            }
        });
    });

    describe("German script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const str of GERMAN_STRINGS) {
                splitByCase(str, { locale: "de-DE" });
            }
        });
    });

    describe("Russian script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const str of RUSSIAN_STRINGS) {
                splitByCase(str, { locale: "ru-RU" });
            }
        });
    });

    describe("Bulgarian script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const str of BULGARIAN_STRINGS) {
                splitByCase(str, { locale: "bg-BG" });
            }
        });
    });

    describe("Serbian script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const str of SERBIAN_STRINGS) {
                splitByCase(str, { locale: "sr-RS" });
            }
        });
    });

    describe("Macedonian script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const str of MACEDONIAN_STRINGS) {
                splitByCase(str, { locale: "mk-MK" });
            }
        });
    });

    describe("Belarusian script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const str of BELARUSIAN_STRINGS) {
                splitByCase(str, { locale: "be-BY" });
            }
        });
    });

    describe("Chinese (Simplified) script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const str of CHINESE_SIMPLIFIED_STRINGS) {
                splitByCase(str, { locale: "zh-CN" });
            }
        });
    });

    describe("Chinese (Traditional) script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const str of CHINESE_TRADITIONAL_STRINGS) {
                splitByCase(str, { locale: "zh-TW" });
            }
        });
    });

    describe("Chinese (Hong Kong) script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const str of CHINESE_HONGKONG_STRINGS) {
                splitByCase(str, { locale: "zh-HK" });
            }
        });
    });

    describe("Arabic script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const str of ARABIC_STRINGS) {
                splitByCase(str, { locale: "ar" });
            }
        });
    });

    describe("Persian script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const str of PERSIAN_STRINGS) {
                splitByCase(str, { locale: "fa" });
            }
        });
    });

    describe("Hebrew script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const str of HEBREW_STRINGS) {
                splitByCase(str, { locale: "he" });
            }
        });
    });

    describe("Thai script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const str of THAI_STRINGS) {
                splitByCase(str, { locale: "th" });
            }
        });
    });

    describe("Hindi script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const str of HINDI_STRINGS) {
                splitByCase(str, { locale: "hi" });
            }
        });
    });

    describe("Marathi script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const str of MARATHI_STRINGS) {
                splitByCase(str, { locale: "mr" });
            }
        });
    });

    describe("Nepali script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const str of NEPALI_STRINGS) {
                splitByCase(str, { locale: "ne" });
            }
        });
    });

    describe("Turkish script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const str of TURKISH_STRINGS) {
                splitByCase(str, { locale: "tr-TR" });
            }
        });
    });
});
