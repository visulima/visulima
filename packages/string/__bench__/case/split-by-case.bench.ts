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
} from "../../__fixtures__/locale-test-strings";
import { ACRONYM_STRINGS, SPECIAL_STRINGS, TEST_STRINGS } from "../../__fixtures__/test-strings";
import { splitByCase } from "../../dist/case";

describe("splitByCase", () => {
    bench("visulima/string splitByCase (no cache)", () => {
        for (const stringValue of TEST_STRINGS) {
            splitByCase(stringValue);
        }
    });

    bench("scule splitByCase", () => {
        for (const stringValue of TEST_STRINGS) {
            sculeSplitByCase(stringValue);
        }
    });

    describe("Special characters handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const stringValue of SPECIAL_STRINGS) {
                splitByCase(stringValue);
            }
        });

        bench("scule splitByCase", () => {
            for (const stringValue of SPECIAL_STRINGS) {
                sculeSplitByCase(stringValue);
            }
        });
    });

    describe("Acronym handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const stringValue of ACRONYM_STRINGS) {
                splitByCase(stringValue);
            }
        });

        bench("scule splitByCase", () => {
            for (const stringValue of ACRONYM_STRINGS) {
                sculeSplitByCase(stringValue);
            }
        });
    });

    describe("Japanese script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const stringValue of JAPANESE_STRINGS) {
                splitByCase(stringValue, { locale: "ja-JP" });
            }
        });
    });

    describe("Korean script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const stringValue of KOREAN_STRINGS) {
                splitByCase(stringValue, { locale: "ko-KR" });
            }
        });
    });

    describe("Ukrainian script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const stringValue of UKRAINIAN_STRINGS) {
                splitByCase(stringValue, { locale: "uk-UA" });
            }
        });
    });

    describe("Greek script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const stringValue of GREEK_STRINGS) {
                splitByCase(stringValue, { locale: "el-GR" });
            }
        });
    });

    describe("German script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const stringValue of GERMAN_STRINGS) {
                splitByCase(stringValue, { locale: "de-DE" });
            }
        });
    });

    describe("Russian script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const stringValue of RUSSIAN_STRINGS) {
                splitByCase(stringValue, { locale: "ru-RU" });
            }
        });
    });

    describe("Bulgarian script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const stringValue of BULGARIAN_STRINGS) {
                splitByCase(stringValue, { locale: "bg-BG" });
            }
        });
    });

    describe("Serbian script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const stringValue of SERBIAN_STRINGS) {
                splitByCase(stringValue, { locale: "sr-RS" });
            }
        });
    });

    describe("Macedonian script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const stringValue of MACEDONIAN_STRINGS) {
                splitByCase(stringValue, { locale: "mk-MK" });
            }
        });
    });

    describe("Belarusian script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const stringValue of BELARUSIAN_STRINGS) {
                splitByCase(stringValue, { locale: "be-BY" });
            }
        });
    });

    describe("Chinese (Simplified) script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const stringValue of CHINESE_SIMPLIFIED_STRINGS) {
                splitByCase(stringValue, { locale: "zh-CN" });
            }
        });
    });

    describe("Chinese (Traditional) script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const stringValue of CHINESE_TRADITIONAL_STRINGS) {
                splitByCase(stringValue, { locale: "zh-TW" });
            }
        });
    });

    describe("Chinese (Hong Kong) script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const stringValue of CHINESE_HONGKONG_STRINGS) {
                splitByCase(stringValue, { locale: "zh-HK" });
            }
        });
    });

    describe("Arabic script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const stringValue of ARABIC_STRINGS) {
                splitByCase(stringValue, { locale: "ar" });
            }
        });
    });

    describe("Persian script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const stringValue of PERSIAN_STRINGS) {
                splitByCase(stringValue, { locale: "fa" });
            }
        });
    });

    describe("Hebrew script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const stringValue of HEBREW_STRINGS) {
                splitByCase(stringValue, { locale: "he" });
            }
        });
    });

    describe("Thai script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const stringValue of THAI_STRINGS) {
                splitByCase(stringValue, { locale: "th" });
            }
        });
    });

    describe("Hindi script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const stringValue of HINDI_STRINGS) {
                splitByCase(stringValue, { locale: "hi" });
            }
        });
    });

    describe("Marathi script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const stringValue of MARATHI_STRINGS) {
                splitByCase(stringValue, { locale: "mr" });
            }
        });
    });

    describe("Nepali script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const stringValue of NEPALI_STRINGS) {
                splitByCase(stringValue, { locale: "ne" });
            }
        });
    });

    describe("Turkish script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const stringValue of TURKISH_STRINGS) {
                splitByCase(stringValue, { locale: "tr-TR" });
            }
        });
    });

    describe("Gujarati script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const stringValue of GUJARATI_STRINGS) {
                splitByCase(stringValue, { locale: "gu" });
            }
        });
    });

    describe("Kannada script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const stringValue of KANNADA_STRINGS) {
                splitByCase(stringValue, { locale: "kn" });
            }
        });
    });

    describe("Malayalam script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const stringValue of MALAYALAM_STRINGS) {
                splitByCase(stringValue, { locale: "ml" });
            }
        });
    });

    describe("Sinhala script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const stringValue of SINHALA_STRINGS) {
                splitByCase(stringValue, { locale: "si" });
            }
        });
    });

    describe("Tamil script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const stringValue of TAMIL_STRINGS) {
                splitByCase(stringValue, { locale: "ta" });
            }
        });
    });

    describe("Telugu script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const stringValue of TELUGU_STRINGS) {
                splitByCase(stringValue, { locale: "te" });
            }
        });
    });

    describe("Telugu script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const stringValue of TELUGU_STRINGS) {
                splitByCase(stringValue, { locale: "te" });
            }
        });
    });

    describe("Afrikaans script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const stringValue of AFRIKAANS_STRINGS) {
                splitByCase(stringValue, { locale: "af" });
            }
        });
    });

    describe("Albanian script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const stringValue of ALBANIAN_STRINGS) {
                splitByCase(stringValue, { locale: "sq" });
            }
        });
    });

    describe("Amharic script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const stringValue of AMHARIC_STRINGS) {
                splitByCase(stringValue, { locale: "am" });
            }
        });
    });

    describe("Armenian script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const stringValue of ARMENIAN_STRINGS) {
                splitByCase(stringValue, { locale: "hy" });
            }
        });
    });

    describe("Bengali script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const stringValue of BENGALI_STRINGS) {
                splitByCase(stringValue, { locale: "bn" });
            }
        });
    });

    describe("Bosnian script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const stringValue of BOSNIAN_STRINGS) {
                splitByCase(stringValue, { locale: "bs" });
            }
        });
    });

    describe("Catalan script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const stringValue of CATALAN_STRINGS) {
                splitByCase(stringValue, { locale: "ca" });
            }
        });
    });

    describe("Croatian script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const stringValue of CROATIAN_STRINGS) {
                splitByCase(stringValue, { locale: "hr" });
            }
        });
    });

    describe("Czech script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const stringValue of CZECH_STRINGS) {
                splitByCase(stringValue, { locale: "cs" });
            }
        });
    });

    describe("Danish script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const stringValue of DANISH_STRINGS) {
                splitByCase(stringValue, { locale: "da" });
            }
        });
    });

    describe("Dutch script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const stringValue of DUTCH_STRINGS) {
                splitByCase(stringValue, { locale: "nl" });
            }
        });
    });

    describe("Estonian script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const stringValue of ESTONIAN_STRINGS) {
                splitByCase(stringValue, { locale: "et" });
            }
        });
    });

    describe("Finnish script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const stringValue of FINNISH_STRINGS) {
                splitByCase(stringValue, { locale: "fi" });
            }
        });
    });

    describe("French script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const stringValue of FRENCH_STRINGS) {
                splitByCase(stringValue, { locale: "fr" });
            }
        });
    });

    describe("Filipino script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const stringValue of FILIPINO_STRINGS) {
                splitByCase(stringValue, { locale: "fil" });
            }
        });
    });

    describe("Galician script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const stringValue of GALICIAN_STRINGS) {
                splitByCase(stringValue, { locale: "gl" });
            }
        });
    });

    describe("Georgian script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const stringValue of GEORGIAN_STRINGS) {
                splitByCase(stringValue, { locale: "ka" });
            }
        });
    });

    describe("Hungarian script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const stringValue of HUNGARIAN_STRINGS) {
                splitByCase(stringValue, { locale: "hu" });
            }
        });
    });

    describe("Indonesian script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const stringValue of INDONESIAN_STRINGS) {
                splitByCase(stringValue, { locale: "id" });
            }
        });
    });

    describe("Icelandic script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const stringValue of ICELANDIC_STRINGS) {
                splitByCase(stringValue, { locale: "is" });
            }
        });
    });

    describe("Irish script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const stringValue of IRISH_STRINGS) {
                splitByCase(stringValue, { locale: "ga" });
            }
        });
    });

    describe("Italian script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const stringValue of ITALIAN_STRINGS) {
                splitByCase(stringValue, { locale: "it" });
            }
        });
    });

    describe("Kazakh script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const stringValue of KAZAKH_STRINGS) {
                splitByCase(stringValue, { locale: "kk" });
            }
        });
    });

    describe("Khmer script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const stringValue of KHMER_STRINGS) {
                splitByCase(stringValue, { locale: "km" });
            }
        });
    });

    describe("Kyrgyz script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const stringValue of KYRGYZ_STRINGS) {
                splitByCase(stringValue, { locale: "ky" });
            }
        });
    });

    describe("Lao script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const stringValue of LAO_STRINGS) {
                splitByCase(stringValue, { locale: "lo" });
            }
        });
    });

    describe("Latvian script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const stringValue of LATVIAN_STRINGS) {
                splitByCase(stringValue, { locale: "lv" });
            }
        });
    });

    describe("Lithuanian script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const stringValue of LITHUANIAN_STRINGS) {
                splitByCase(stringValue, { locale: "lt" });
            }
        });
    });

    describe("Malay script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const stringValue of MALAY_STRINGS) {
                splitByCase(stringValue, { locale: "ms" });
            }
        });
    });

    describe("Maltese script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const stringValue of MALTESE_STRINGS) {
                splitByCase(stringValue, { locale: "mt" });
            }
        });
    });

    describe("Mongolian script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const stringValue of MONGOLIAN_STRINGS) {
                splitByCase(stringValue, { locale: "mn" });
            }
        });
    });

    describe("Norwegian script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const stringValue of NORWEGIAN_STRINGS) {
                splitByCase(stringValue, { locale: "nb" });
            }
        });
    });

    describe("Polish script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const stringValue of POLISH_STRINGS) {
                splitByCase(stringValue, { locale: "pl" });
            }
        });
    });

    describe("Portuguese script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const stringValue of PORTUGUESE_STRINGS) {
                splitByCase(stringValue, { locale: "pt" });
            }
        });
    });

    describe("Punjabi script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const stringValue of PUNJABI_STRINGS) {
                splitByCase(stringValue, { locale: "pa" });
            }
        });
    });

    describe("Romanian script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const stringValue of ROMANIAN_STRINGS) {
                splitByCase(stringValue, { locale: "ro" });
            }
        });
    });

    describe("Slovak script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const stringValue of SLOVAK_STRINGS) {
                splitByCase(stringValue, { locale: "sk" });
            }
        });
    });

    describe("Slovenian script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const stringValue of SLOVENIAN_STRINGS) {
                splitByCase(stringValue, { locale: "sl" });
            }
        });
    });

    describe("Swedish script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const stringValue of SWEDISH_STRINGS) {
                splitByCase(stringValue, { locale: "sv" });
            }
        });
    });

    describe("Urdu script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const stringValue of URDU_STRINGS) {
                splitByCase(stringValue, { locale: "ur" });
            }
        });
    });

    describe("Uzbek script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const stringValue of UZBEK_STRINGS) {
                splitByCase(stringValue, { locale: "uz" });
            }
        });
    });

    describe("Vietnamese script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const stringValue of VIETNAMESE_STRINGS) {
                splitByCase(stringValue, { locale: "vi" });
            }
        });
    });

    describe("Welsh script handling", () => {
        bench("visulima/string splitByCase (no cache)", () => {
            for (const stringValue of WELSH_STRINGS) {
                splitByCase(stringValue, { locale: "cy" });
            }
        });
    });
});
