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

    describe("Gujarati script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const str of GUJARATI_STRINGS) {
                splitByCase(str, { locale: "gu" });
            }
        });
    });

    describe("Kannada script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const str of KANNADA_STRINGS) {
                splitByCase(str, { locale: "kn" });
            }
        });
    });

    describe("Malayalam script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const str of MALAYALAM_STRINGS) {
                splitByCase(str, { locale: "ml" });
            }
        });
    });

    describe("Sinhala script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const str of SINHALA_STRINGS) {
                splitByCase(str, { locale: "si" });
            }
        });
    });

    describe("Tamil script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const str of TAMIL_STRINGS) {
                splitByCase(str, { locale: "ta" });
            }
        });
    });

    describe("Telugu script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const str of TELUGU_STRINGS) {
                splitByCase(str, { locale: "te" });
            }
        });
    });

    describe("Tamil script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const str of TAMIL_STRINGS) {
                splitByCase(str, { locale: "ta" });
            }
        });
    });

    describe("Telugu script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const str of TELUGU_STRINGS) {
                splitByCase(str, { locale: "te" });
            }
        });
    });

    describe("Tamil script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const str of TAMIL_STRINGS) {
                splitByCase(str, { locale: "ta" });
            }
        });
    });

    describe("Telugu script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const str of TELUGU_STRINGS) {
                splitByCase(str, { locale: "te" });
            }
        });
    });

    describe("Afrikaans script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const str of AFRIKAANS_STRINGS) {
                splitByCase(str, { locale: "af" });
            }
        });
    });

    describe("Albanian script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const str of ALBANIAN_STRINGS) {
                splitByCase(str, { locale: "sq" });
            }
        });
    });

    describe("Amharic script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const str of AMHARIC_STRINGS) {
                splitByCase(str, { locale: "am" });
            }
        });
    });

    describe("Armenian script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const str of ARMENIAN_STRINGS) {
                splitByCase(str, { locale: "hy" });
            }
        });
    });

    describe("Bengali script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const str of BENGALI_STRINGS) {
                splitByCase(str, { locale: "bn" });
            }
        });
    });

    describe("Bosnian script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const str of BOSNIAN_STRINGS) {
                splitByCase(str, { locale: "bs" });
            }
        });
    });

    describe("Catalan script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const str of CATALAN_STRINGS) {
                splitByCase(str, { locale: "ca" });
            }
        });
    });

    describe("Croatian script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const str of CROATIAN_STRINGS) {
                splitByCase(str, { locale: "hr" });
            }
        });
    });

    describe("Czech script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const str of CZECH_STRINGS) {
                splitByCase(str, { locale: "cs" });
            }
        });
    });

    describe("Danish script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const str of DANISH_STRINGS) {
                splitByCase(str, { locale: "da" });
            }
        });
    });

    describe("Dutch script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const str of DUTCH_STRINGS) {
                splitByCase(str, { locale: "nl" });
            }
        });
    });

    describe("Estonian script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const str of ESTONIAN_STRINGS) {
                splitByCase(str, { locale: "et" });
            }
        });
    });

    describe("Finnish script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const str of FINNISH_STRINGS) {
                splitByCase(str, { locale: "fi" });
            }
        });
    });

    describe("French script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const str of FRENCH_STRINGS) {
                splitByCase(str, { locale: "fr" });
            }
        });
    });

    describe("Filipino script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const str of FILIPINO_STRINGS) {
                splitByCase(str, { locale: "fil" });
            }
        });
    });

    describe("Galician script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const str of GALICIAN_STRINGS) {
                splitByCase(str, { locale: "gl" });
            }
        });
    });

    describe("Georgian script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const str of GEORGIAN_STRINGS) {
                splitByCase(str, { locale: "ka" });
            }
        });
    });

    describe("Hungarian script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const str of HUNGARIAN_STRINGS) {
                splitByCase(str, { locale: "hu" });
            }
        });
    });

    describe("Indonesian script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const str of INDONESIAN_STRINGS) {
                splitByCase(str, { locale: "id" });
            }
        });
    });

    describe("Icelandic script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const str of ICELANDIC_STRINGS) {
                splitByCase(str, { locale: "is" });
            }
        });
    });

    describe("Irish script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const str of IRISH_STRINGS) {
                splitByCase(str, { locale: "ga" });
            }
        });
    });

    describe("Italian script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const str of ITALIAN_STRINGS) {
                splitByCase(str, { locale: "it" });
            }
        });
    });

    describe("Kazakh script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const str of KAZAKH_STRINGS) {
                splitByCase(str, { locale: "kk" });
            }
        });
    });

    describe("Khmer script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const str of KHMER_STRINGS) {
                splitByCase(str, { locale: "km" });
            }
        });
    });

    describe("Kyrgyz script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const str of KYRGYZ_STRINGS) {
                splitByCase(str, { locale: "ky" });
            }
        });
    });

    describe("Lao script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const str of LAO_STRINGS) {
                splitByCase(str, { locale: "lo" });
            }
        });
    });

    describe("Latvian script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const str of LATVIAN_STRINGS) {
                splitByCase(str, { locale: "lv" });
            }
        });
    });

    describe("Lithuanian script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const str of LITHUANIAN_STRINGS) {
                splitByCase(str, { locale: "lt" });
            }
        });
    });

    describe("Malay script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const str of MALAY_STRINGS) {
                splitByCase(str, { locale: "ms" });
            }
        });
    });

    describe("Maltese script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const str of MALTESE_STRINGS) {
                splitByCase(str, { locale: "mt" });
            }
        });
    });

    describe("Mongolian script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const str of MONGOLIAN_STRINGS) {
                splitByCase(str, { locale: "mn" });
            }
        });
    });

    describe("Norwegian script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const str of NORWEGIAN_STRINGS) {
                splitByCase(str, { locale: "nb" });
            }
        });
    });

    describe("Polish script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const str of POLISH_STRINGS) {
                splitByCase(str, { locale: "pl" });
            }
        });
    });

    describe("Portuguese script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const str of PORTUGUESE_STRINGS) {
                splitByCase(str, { locale: "pt" });
            }
        });
    });

    describe("Punjabi script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const str of PUNJABI_STRINGS) {
                splitByCase(str, { locale: "pa" });
            }
        });
    });

    describe("Romanian script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const str of ROMANIAN_STRINGS) {
                splitByCase(str, { locale: "ro" });
            }
        });
    });

    describe("Slovak script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const str of SLOVAK_STRINGS) {
                splitByCase(str, { locale: "sk" });
            }
        });
    });

    describe("Slovenian script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const str of SLOVENIAN_STRINGS) {
                splitByCase(str, { locale: "sl" });
            }
        });
    });

    describe("Swedish script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const str of SWEDISH_STRINGS) {
                splitByCase(str, { locale: "sv" });
            }
        });
    });

    describe("Urdu script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const str of URDU_STRINGS) {
                splitByCase(str, { locale: "ur" });
            }
        });
    });

    describe("Uzbek script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const str of UZBEK_STRINGS) {
                splitByCase(str, { locale: "uz" });
            }
        });
    });

    describe("Vietnamese script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const str of VIETNAMESE_STRINGS) {
                splitByCase(str, { locale: "vi" });
            }
        });
    });

    describe("Welsh script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const str of WELSH_STRINGS) {
                splitByCase(str, { locale: "cy" });
            }
        });
    });
});
