import { splitByCase as sculeSplitByCase } from "scule";
import { bench, describe } from "vitest";

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
} from "../__fixtures__/locale-test-strings";
import { ACRONYM_STRINGS, SPECIAL_STRINGS, TEST_STRINGS } from "../__fixtures__/test-strings";
import { splitByCase } from "../dist/case";

describe("splitByCase", () => {
    bench("visulima/string splitByCase (no cache)", () => {
        for (const string_ of TEST_STRINGS) {
            splitByCase(string_);
        }
    });

    bench("scule splitByCase", () => {
        for (const string_ of TEST_STRINGS) {
            sculeSplitByCase(string_);
        }
    });

    describe("Special characters handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const string_ of SPECIAL_STRINGS) {
                splitByCase(string_);
            }
        });

        bench("scule splitByCase", () => {
            for (const string_ of SPECIAL_STRINGS) {
                sculeSplitByCase(string_);
            }
        });
    });

    describe("Acronym handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const string_ of ACRONYM_STRINGS) {
                splitByCase(string_);
            }
        });

        bench("scule splitByCase", () => {
            for (const string_ of ACRONYM_STRINGS) {
                sculeSplitByCase(string_);
            }
        });
    });

    describe("Japanese script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const string_ of JAPANESE_STRINGS) {
                splitByCase(string_, { locale: "ja-JP" });
            }
        });
    });

    describe("Korean script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const string_ of KOREAN_STRINGS) {
                splitByCase(string_, { locale: "ko-KR" });
            }
        });
    });

    describe("Ukrainian script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const string_ of UKRAINIAN_STRINGS) {
                splitByCase(string_, { locale: "uk-UA" });
            }
        });
    });

    describe("Greek script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const string_ of GREEK_STRINGS) {
                splitByCase(string_, { locale: "el-GR" });
            }
        });
    });

    describe("German script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const string_ of GERMAN_STRINGS) {
                splitByCase(string_, { locale: "de-DE" });
            }
        });
    });

    describe("Russian script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const string_ of RUSSIAN_STRINGS) {
                splitByCase(string_, { locale: "ru-RU" });
            }
        });
    });

    describe("Bulgarian script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const string_ of BULGARIAN_STRINGS) {
                splitByCase(string_, { locale: "bg-BG" });
            }
        });
    });

    describe("Serbian script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const string_ of SERBIAN_STRINGS) {
                splitByCase(string_, { locale: "sr-RS" });
            }
        });
    });

    describe("Macedonian script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const string_ of MACEDONIAN_STRINGS) {
                splitByCase(string_, { locale: "mk-MK" });
            }
        });
    });

    describe("Belarusian script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const string_ of BELARUSIAN_STRINGS) {
                splitByCase(string_, { locale: "be-BY" });
            }
        });
    });

    describe("Chinese (Simplified) script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const string_ of CHINESE_SIMPLIFIED_STRINGS) {
                splitByCase(string_, { locale: "zh-CN" });
            }
        });
    });

    describe("Chinese (Traditional) script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const string_ of CHINESE_TRADITIONAL_STRINGS) {
                splitByCase(string_, { locale: "zh-TW" });
            }
        });
    });

    describe("Chinese (Hong Kong) script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const string_ of CHINESE_HONGKONG_STRINGS) {
                splitByCase(string_, { locale: "zh-HK" });
            }
        });
    });

    describe("Arabic script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const string_ of ARABIC_STRINGS) {
                splitByCase(string_, { locale: "ar" });
            }
        });
    });

    describe("Persian script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const string_ of PERSIAN_STRINGS) {
                splitByCase(string_, { locale: "fa" });
            }
        });
    });

    describe("Hebrew script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const string_ of HEBREW_STRINGS) {
                splitByCase(string_, { locale: "he" });
            }
        });
    });

    describe("Thai script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const string_ of THAI_STRINGS) {
                splitByCase(string_, { locale: "th" });
            }
        });
    });

    describe("Hindi script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const string_ of HINDI_STRINGS) {
                splitByCase(string_, { locale: "hi" });
            }
        });
    });

    describe("Marathi script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const string_ of MARATHI_STRINGS) {
                splitByCase(string_, { locale: "mr" });
            }
        });
    });

    describe("Nepali script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const string_ of NEPALI_STRINGS) {
                splitByCase(string_, { locale: "ne" });
            }
        });
    });

    describe("Turkish script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const string_ of TURKISH_STRINGS) {
                splitByCase(string_, { locale: "tr-TR" });
            }
        });
    });

    describe("Gujarati script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const string_ of GUJARATI_STRINGS) {
                splitByCase(string_, { locale: "gu" });
            }
        });
    });

    describe("Kannada script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const string_ of KANNADA_STRINGS) {
                splitByCase(string_, { locale: "kn" });
            }
        });
    });

    describe("Malayalam script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const string_ of MALAYALAM_STRINGS) {
                splitByCase(string_, { locale: "ml" });
            }
        });
    });

    describe("Sinhala script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const string_ of SINHALA_STRINGS) {
                splitByCase(string_, { locale: "si" });
            }
        });
    });

    describe("Tamil script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const string_ of TAMIL_STRINGS) {
                splitByCase(string_, { locale: "ta" });
            }
        });
    });

    describe("Telugu script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const string_ of TELUGU_STRINGS) {
                splitByCase(string_, { locale: "te" });
            }
        });
    });

    describe("Telugu script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const string_ of TELUGU_STRINGS) {
                splitByCase(string_, { locale: "te" });
            }
        });
    });

    describe("Afrikaans script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const string_ of AFRIKAANS_STRINGS) {
                splitByCase(string_, { locale: "af" });
            }
        });
    });

    describe("Albanian script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const string_ of ALBANIAN_STRINGS) {
                splitByCase(string_, { locale: "sq" });
            }
        });
    });

    describe("Amharic script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const string_ of AMHARIC_STRINGS) {
                splitByCase(string_, { locale: "am" });
            }
        });
    });

    describe("Armenian script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const string_ of ARMENIAN_STRINGS) {
                splitByCase(string_, { locale: "hy" });
            }
        });
    });

    describe("Bengali script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const string_ of BENGALI_STRINGS) {
                splitByCase(string_, { locale: "bn" });
            }
        });
    });

    describe("Bosnian script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const string_ of BOSNIAN_STRINGS) {
                splitByCase(string_, { locale: "bs" });
            }
        });
    });

    describe("Catalan script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const string_ of CATALAN_STRINGS) {
                splitByCase(string_, { locale: "ca" });
            }
        });
    });

    describe("Croatian script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const string_ of CROATIAN_STRINGS) {
                splitByCase(string_, { locale: "hr" });
            }
        });
    });

    describe("Czech script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const string_ of CZECH_STRINGS) {
                splitByCase(string_, { locale: "cs" });
            }
        });
    });

    describe("Danish script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const string_ of DANISH_STRINGS) {
                splitByCase(string_, { locale: "da" });
            }
        });
    });

    describe("Dutch script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const string_ of DUTCH_STRINGS) {
                splitByCase(string_, { locale: "nl" });
            }
        });
    });

    describe("Estonian script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const string_ of ESTONIAN_STRINGS) {
                splitByCase(string_, { locale: "et" });
            }
        });
    });

    describe("Finnish script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const string_ of FINNISH_STRINGS) {
                splitByCase(string_, { locale: "fi" });
            }
        });
    });

    describe("French script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const string_ of FRENCH_STRINGS) {
                splitByCase(string_, { locale: "fr" });
            }
        });
    });

    describe("Filipino script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const string_ of FILIPINO_STRINGS) {
                splitByCase(string_, { locale: "fil" });
            }
        });
    });

    describe("Galician script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const string_ of GALICIAN_STRINGS) {
                splitByCase(string_, { locale: "gl" });
            }
        });
    });

    describe("Georgian script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const string_ of GEORGIAN_STRINGS) {
                splitByCase(string_, { locale: "ka" });
            }
        });
    });

    describe("Hungarian script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const string_ of HUNGARIAN_STRINGS) {
                splitByCase(string_, { locale: "hu" });
            }
        });
    });

    describe("Indonesian script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const string_ of INDONESIAN_STRINGS) {
                splitByCase(string_, { locale: "id" });
            }
        });
    });

    describe("Icelandic script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const string_ of ICELANDIC_STRINGS) {
                splitByCase(string_, { locale: "is" });
            }
        });
    });

    describe("Irish script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const string_ of IRISH_STRINGS) {
                splitByCase(string_, { locale: "ga" });
            }
        });
    });

    describe("Italian script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const string_ of ITALIAN_STRINGS) {
                splitByCase(string_, { locale: "it" });
            }
        });
    });

    describe("Kazakh script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const string_ of KAZAKH_STRINGS) {
                splitByCase(string_, { locale: "kk" });
            }
        });
    });

    describe("Khmer script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const string_ of KHMER_STRINGS) {
                splitByCase(string_, { locale: "km" });
            }
        });
    });

    describe("Kyrgyz script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const string_ of KYRGYZ_STRINGS) {
                splitByCase(string_, { locale: "ky" });
            }
        });
    });

    describe("Lao script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const string_ of LAO_STRINGS) {
                splitByCase(string_, { locale: "lo" });
            }
        });
    });

    describe("Latvian script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const string_ of LATVIAN_STRINGS) {
                splitByCase(string_, { locale: "lv" });
            }
        });
    });

    describe("Lithuanian script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const string_ of LITHUANIAN_STRINGS) {
                splitByCase(string_, { locale: "lt" });
            }
        });
    });

    describe("Malay script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const string_ of MALAY_STRINGS) {
                splitByCase(string_, { locale: "ms" });
            }
        });
    });

    describe("Maltese script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const string_ of MALTESE_STRINGS) {
                splitByCase(string_, { locale: "mt" });
            }
        });
    });

    describe("Mongolian script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const string_ of MONGOLIAN_STRINGS) {
                splitByCase(string_, { locale: "mn" });
            }
        });
    });

    describe("Norwegian script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const string_ of NORWEGIAN_STRINGS) {
                splitByCase(string_, { locale: "nb" });
            }
        });
    });

    describe("Polish script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const string_ of POLISH_STRINGS) {
                splitByCase(string_, { locale: "pl" });
            }
        });
    });

    describe("Portuguese script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const string_ of PORTUGUESE_STRINGS) {
                splitByCase(string_, { locale: "pt" });
            }
        });
    });

    describe("Punjabi script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const string_ of PUNJABI_STRINGS) {
                splitByCase(string_, { locale: "pa" });
            }
        });
    });

    describe("Romanian script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const string_ of ROMANIAN_STRINGS) {
                splitByCase(string_, { locale: "ro" });
            }
        });
    });

    describe("Slovak script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const string_ of SLOVAK_STRINGS) {
                splitByCase(string_, { locale: "sk" });
            }
        });
    });

    describe("Slovenian script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const string_ of SLOVENIAN_STRINGS) {
                splitByCase(string_, { locale: "sl" });
            }
        });
    });

    describe("Swedish script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const string_ of SWEDISH_STRINGS) {
                splitByCase(string_, { locale: "sv" });
            }
        });
    });

    describe("Urdu script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const string_ of URDU_STRINGS) {
                splitByCase(string_, { locale: "ur" });
            }
        });
    });

    describe("Uzbek script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const string_ of UZBEK_STRINGS) {
                splitByCase(string_, { locale: "uz" });
            }
        });
    });

    describe("Vietnamese script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const string_ of VIETNAMESE_STRINGS) {
                splitByCase(string_, { locale: "vi" });
            }
        });
    });

    describe("Welsh script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const string_ of WELSH_STRINGS) {
                splitByCase(string_, { locale: "cy" });
            }
        });
    });
});
