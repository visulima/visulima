import { describe, expect, it } from "vitest";

import { splitByCase } from "../../../src/case/split-by-case";

describe("splitByCase", () => {
    it("should handle empty string", () => {
        expect(splitByCase("")).toEqual([]);
    });

    it("should handle single word", () => {
        expect(splitByCase("foo")).toEqual(["foo"]);
        expect(splitByCase("FOO")).toEqual(["FOO"]);
    });

    it("should split basic camelCase", () => {
        expect(splitByCase("fooBar")).toEqual(["foo", "Bar"]);
        expect(splitByCase("fooBarBaz")).toEqual(["foo", "Bar", "Baz"]);
    });

    it("should split PascalCase with multiple words", () => {
        expect(splitByCase("FooBarBaz")).toEqual(["Foo", "Bar", "Baz"]);
        expect(splitByCase("ThisIsATest")).toEqual(["This", "Is", "A", "Test"]);
    });

    it("should handle mixed case patterns", () => {
        expect(splitByCase("FooBARb")).toEqual(["Foo", "BA", "Rb"]);
        expect(splitByCase("FOOBar")).toEqual(["FOO", "Bar"]);
        expect(splitByCase("ABCdef")).toEqual(["AB", "Cdef"]);

        expect(
            splitByCase("FooBARb", {
                knownAcronyms: ["BAR"],
            }),
        ).toEqual(["Foo", "BAR", "b"]);
        expect(
            splitByCase("ABCdef", {
                knownAcronyms: ["ABC"],
            }),
        ).toEqual(["ABC", "def"]);
    });

    it("should handle multiple separators", () => {
        expect(splitByCase("foo_bar-baz/qux")).toEqual(["foo", "bar", "baz", "qux"]);
        expect(splitByCase("foo.bar_baz/qux")).toEqual(["foo", "bar", "baz", "qux"]);
    });

    it("should handle consecutive uppercase letters", () => {
        expect(splitByCase("XMLHttpRequest")).toEqual(["XML", "Http", "Request"]);
        expect(splitByCase("AJAXRequest")).toEqual(["AJAX", "Request"]);
        expect(splitByCase("getXMLData")).toEqual(["get", "XML", "Data"]);
    });

    it("should handle numbers mixed with letters", () => {
        expect(splitByCase("Query123String")).toEqual(["Query", "123", "String"]);
        expect(splitByCase("123Test")).toEqual(["123", "Test"]);
        expect(splitByCase("test123")).toEqual(["test", "123"]);
        expect(splitByCase("TEST123string")).toEqual(["TEST", "123", "string"]);
    });

    it("should handle dot case", () => {
        expect(splitByCase("foo.bar.baz")).toEqual(["foo", "bar", "baz"]);
        expect(splitByCase("some.mixed.Case.test")).toEqual(["some", "mixed", "Case", "test"]);
    });

    it("should handle path case", () => {
        expect(splitByCase("foo/bar/baz")).toEqual(["foo", "bar", "baz"]);
        expect(splitByCase("some/mixed/Case/test")).toEqual(["some", "mixed", "Case", "test"]);

        // expect(splitByCase("../foo/bar")).toEqual(["..", "foo", "bar"]);
        // expect(splitByCase("foo/../../bar")).toEqual(["foo", "..", "..", "bar"]);
    });

    it("should handle complex mixed cases", () => {
        expect(splitByCase("ThisXMLParser123Test")).toEqual(["This", "XML", "Parser", "123", "Test"]);
        expect(splitByCase("parseDBURL2HTTP")).toEqual(["parse", "DBURL", "2", "HTTP"]);
        expect(splitByCase("API_KEY_123_TEST")).toEqual(["API", "KEY", "123", "TEST"]);
    });

    it("should handle custom splitters", () => {
        expect(splitByCase("foo\\Bar.fuzz-FIZz", { separators: ["\\", ".", "-"] })).toEqual(["foo", "Bar", "fuzz", "FI", "Zz"]);
        expect(splitByCase("new-name-value", { separators: ["_"] })).toEqual(["new-name-value"]);
        expect(splitByCase("foo|bar|baz", { separators: ["|"] })).toEqual(["foo", "bar", "baz"]);
    });

    it("should handle edge cases", () => {
        expect(splitByCase("__FOO__BAR__")).toEqual(["FOO", "BAR"]);
        expect(splitByCase("...test...case...")).toEqual(["test", "case"]);
        expect(splitByCase("///path///case///")).toEqual(["path", "case"]);
        expect(splitByCase("MixedXMLAndJSON123Data")).toEqual(["Mixed", "XML", "And", "JSON", "123", "Data"]);
    });

    describe("locale support", () => {
        it("should handle German eszett cases", () => {
            const locale = "de-DE";
            expect(splitByCase("straßeName", { locale })).toEqual(["straße", "Name"]);
            expect(splitByCase("STRAẞENAME", { locale })).toEqual(["STRAẞENAME"]);
            expect(splitByCase("GROẞBUCHSTABE", { locale })).toEqual(["GROẞBUCHSTABE"]);
            expect(splitByCase("großBuchstabe", { locale })).toEqual(["groß", "Buchstabe"]);
        });

        it("should handle Turkish specific cases", () => {
            const locale = "tr-TR";
            expect(splitByCase("İstanbulCity", { locale })).toEqual(["İstanbul", "City"]);
            expect(splitByCase("izmirŞehir", { locale })).toEqual(["izmir", "Şehir"]);
            expect(splitByCase("türkçeTest", { locale })).toEqual(["türkçe", "Test"]);
            expect(splitByCase("IıİiTest", { locale })).toEqual(["Iı", "İi", "Test"]);
        });

        it("should handle Azerbaijani specific cases", () => {
            const locale = "az-AZ";
            expect(splitByCase("İlkinTest", { locale })).toEqual(["İlkin", "Test"]);
            expect(splitByCase("bakıŞəhər", { locale })).toEqual(["bakı", "Şəhər"]);
            expect(splitByCase("IıİiTest", { locale })).toEqual(["Iı", "İi", "Test"]);
        });

        describe("German case handling", () => {
            const options = { locale: "de-DE" };

            it("should handle German specific cases", () => {
                expect(splitByCase("GROSSE STRAßE", options)).toEqual(["GROSSE", "STRAßE"]);
                expect(splitByCase("straßeTest", options)).toEqual(["straße", "Test"]);
                expect(splitByCase("großeHaus", options)).toEqual(["große", "Haus"]);
                expect(splitByCase("äußereForm", options)).toEqual(["äußere", "Form"]);
                expect(splitByCase("GROẞESHAUS", options)).toEqual(["GROẞESHAUS"]);
                expect(splitByCase("DERGroßeWAGEN", options)).toEqual(["DER", "Große", "WAGEN"]);
            });

            it("should handle eszett in uppercase sequences", () => {
                expect(splitByCase("STRAßE", options)).toEqual(["STRAßE"]);
                expect(splitByCase("GROßE", options)).toEqual(["GROßE"]);
                expect(splitByCase("GROẞE", options)).toEqual(["GROẞE"]);
            });

            it("should handle mixed case with eszett", () => {
                expect(splitByCase("großeSTRAßE", options)).toEqual(["große", "STRAßE"]);
                expect(splitByCase("DieGROßEStadt", options)).toEqual(["Die", "GROßE", "Stadt"]);
            });

            it("should handle compound words", () => {
                expect(splitByCase("BundesstraßeNummer", options)).toEqual(["Bundesstraße", "Nummer"]);
                expect(splitByCase("GROßSTADT", options)).toEqual(["GROßSTADT"]);
                expect(splitByCase("KLEINSTRAßE", options)).toEqual(["KLEINSTRAßE"]);
            });
        });

        it("should handle Greek specific cases", () => {
            const locale = "el-GR";
            expect(splitByCase("καλημέραΚόσμε", { locale })).toEqual(["καλημέρα", "Κόσμε"]);
            expect(splitByCase("ΕλληνικάTest", { locale })).toEqual(["Ελληνικά", "Test"]);
            expect(splitByCase("αβγΔΕΖ", { locale })).toEqual(["αβγ", "ΔΕΖ"]);
            expect(splitByCase("ΚόσμοςTest", { locale })).toEqual(["Κόσμος", "Test"]);
            expect(splitByCase("ΠΡΟΣΘΕΣΗTest", { locale })).toEqual(["ΠΡΟΣΘΕΣΗ", "Test"]);
        });

        it("should handle Russian specific cases", () => {
            const locale = "ru-RU";
            expect(splitByCase("привет Мир", { locale })).toEqual(["привет", "Мир"]);
            expect(splitByCase("РусскийText", { locale })).toEqual(["Русский", "Text"]);
            expect(splitByCase("тестКейс", { locale })).toEqual(["тест", "Кейс"]);
        });

        it("should handle Ukrainian specific cases", () => {
            const locale = "uk-UA";
            expect(splitByCase("привітСвіт", { locale })).toEqual(["привіт", "Світ"]);
            expect(splitByCase("УкраїнськаMова", { locale })).toEqual(["Українська", "Mова"]);
            expect(splitByCase("тестКейс", { locale })).toEqual(["тест", "Кейс"]);
        });

        it("should handle Bulgarian specific cases", () => {
            const locale = "bg-BG";
            expect(splitByCase("здравейСвят", { locale })).toEqual(["здравей", "Свят"]);
            expect(splitByCase("БългарскиText", { locale })).toEqual(["Български", "Text"]);
            expect(splitByCase("тестКейс", { locale })).toEqual(["тест", "Кейс"]);
        });

        it("should handle Serbian specific cases", () => {
            const locale = "sr-RS";
            expect(splitByCase("здравоСвете", { locale })).toEqual(["здраво", "Свете"]);
            expect(splitByCase("СрпскиText", { locale })).toEqual(["Српски", "Text"]);
            expect(splitByCase("тестКейс", { locale })).toEqual(["тест", "Кейс"]);
        });

        it("should handle Macedonian specific cases", () => {
            const locale = "mk-MK";
            expect(splitByCase("здравоСвету", { locale })).toEqual(["здраво", "Свету"]);
            expect(splitByCase("МакедонскиText", { locale })).toEqual(["Македонски", "Text"]);
            expect(splitByCase("тестКејс", { locale })).toEqual(["тест", "Кејс"]);
        });

        it("should handle Belarusian specific cases", () => {
            const locale = "be-BY";
            expect(splitByCase("прывітанеСвет", { locale })).toEqual(["прывітане", "Свет"]);
            expect(splitByCase("БеларускаяText", { locale })).toEqual(["Беларуская", "Text"]);
            expect(splitByCase("тэстКейс", { locale })).toEqual(["тэст", "Кейс"]);
        });

        it("should handle Chinese (Simplified) specific cases", () => {
            const locale = "zh-CN";
            expect(splitByCase("你好World", { locale })).toEqual(["你好", "World"]);
            expect(splitByCase("测试Test", { locale })).toEqual(["测试", "Test"]);
            expect(splitByCase("中文English混合", { locale })).toEqual(["中文", "English", "混合"]);
        });

        it("should handle Chinese (Traditional) specific cases", () => {
            const locale = "zh-TW";
            expect(splitByCase("你好World", { locale })).toEqual(["你好", "World"]);
            expect(splitByCase("測試Test", { locale })).toEqual(["測試", "Test"]);
            expect(splitByCase("中文English混合", { locale })).toEqual(["中文", "English", "混合"]);
        });

        it("should handle Chinese (Hong Kong) specific cases", () => {
            const locale = "zh-HK";
            expect(splitByCase("你好World", { locale })).toEqual(["你好", "World"]);
            expect(splitByCase("測試Test", { locale })).toEqual(["測試", "Test"]);
            expect(splitByCase("中文English混合", { locale })).toEqual(["中文", "English", "混合"]);
        });

        it("should handle Japanese specific cases", () => {
            const locale = "ja-JP";
            expect(splitByCase("こんにちは World", { locale })).toEqual(["こんにちは", "World"]);
            expect(splitByCase("テストTest", { locale })).toEqual(["テスト", "Test"]);
            expect(splitByCase("ひらがなカタカナABC", { locale })).toEqual(["ひらがな", "カタカナ", "ABC"]);
            expect(splitByCase("漢字とKanji", { locale })).toEqual(["漢字と", "Kanji"]);
        });

        it("should handle Arabic specific cases", () => {
            const locale = "ar-SA";
            expect(splitByCase("مرحباWorld", { locale })).toEqual(["مرحبا", "World"]);
            expect(splitByCase("اختبارTest", { locale })).toEqual(["اختبار", "Test"]);
            expect(splitByCase("عربيEnglishمختلط", { locale })).toEqual(["عربي", "English", "مختلط"]);
        });

        it("should handle Persian specific cases", () => {
            const locale = "fa-IR";
            expect(splitByCase("سلامWorld", { locale })).toEqual(["سلام", "World"]);
            expect(splitByCase("تستTest", { locale })).toEqual(["تست", "Test"]);
            expect(splitByCase("فارسیEnglishمخلوط", { locale })).toEqual(["فارسی", "English", "مخلوط"]);
        });

        it("should handle Hebrew specific cases", () => {
            const locale = "he-IL";
            expect(splitByCase("שלוםWorld", { locale })).toEqual(["שלום", "World"]);
            expect(splitByCase("בדיקהTest", { locale })).toEqual(["בדיקה", "Test"]);
            expect(splitByCase("עבריתEnglishמעורב", { locale })).toEqual(["עברית", "English", "מעורב"]);
        });

        it("should handle Thai specific cases", () => {
            const locale = "th-TH";
            expect(splitByCase("สวัสดีWorld", { locale })).toEqual(["สวัสดี", "World"]);
            expect(splitByCase("ทดสอบTest", { locale })).toEqual(["ทดสอบ", "Test"]);
            expect(splitByCase("ไทยEnglishผสม", { locale })).toEqual(["ไทย", "English", "ผสม"]);
        });

        it("should handle Hindi specific cases", () => {
            const locale = "hi-IN";
            expect(splitByCase("नमस्तेWorld", { locale })).toEqual(["नमस्ते", "World"]);
            expect(splitByCase("परीक्षणTest", { locale })).toEqual(["परीक्षण", "Test"]);
            expect(splitByCase("हिंदीEnglishमिश्रित", { locale })).toEqual(["हिंदी", "English", "मिश्रित"]);
        });

        it("should handle Marathi specific cases", () => {
            const locale = "mr-IN";
            expect(splitByCase("नमस्कारWorld", { locale })).toEqual(["नमस्कार", "World"]);
            expect(splitByCase("चाचणीTest", { locale })).toEqual(["चाचणी", "Test"]);
            expect(splitByCase("मराठीEnglishमिश्र", { locale })).toEqual(["मराठी", "English", "मिश्र"]);
        });

        it("should handle Nepali specific cases", () => {
            const locale = "ne-NP";
            expect(splitByCase("नमस्तेWorld", { locale })).toEqual(["नमस्ते", "World"]);
            expect(splitByCase("परीक्षणTest", { locale })).toEqual(["परीक्षण", "Test"]);
            expect(splitByCase("नेपालीEnglishमिश्रित", { locale })).toEqual(["नेपाली", "English", "मिश्रित"]);
        });

        it("should handle Korean specific cases", () => {
            const locale = "ko-KR";
            expect(splitByCase("안녕하세요World", { locale })).toEqual(["안녕하세요", "World"]);
            expect(splitByCase("테스트Test", { locale })).toEqual(["테스트", "Test"]);
            expect(splitByCase("한글English혼합", { locale })).toEqual(["한글", "English", "혼합"]);
            expect(splitByCase("대문자UPPER", { locale })).toEqual(["대문자", "UPPER"]);
        });
    });

    describe("aNSI escape codes", () => {
        it("should ignore ANSI escape codes by default", () => {
            expect(splitByCase("\u001B[31mRedText\u001B[0m")).toEqual(["Red", "Text"]);
            expect(splitByCase("\u001B[1mBoldText\u001B[0m")).toEqual(["Bold", "Text"]);
            expect(splitByCase("\u001B[32mGreenFOO\u001B[0m_\u001B[34mBlueBAR\u001B[0m")).toEqual(["Green", "FOO", "Blue", "BAR"]);
        });

        it("should handle ANSI escape codes when handleAnsi is true", () => {
            expect(splitByCase("\u001B[31mRedText\u001B[0m", { handleAnsi: true })).toEqual(["\u001B[31m", "Red", "Text", "\u001B[0m"]);
            expect(splitByCase("\u001B[1mBoldText\u001B[0m", { handleAnsi: true })).toEqual(["\u001B[1m", "Bold", "Text", "\u001B[0m"]);
            expect(splitByCase("\u001B[32mGreenFOO\u001B[0m_\u001B[34mBlueBAR\u001B[0m", { handleAnsi: true })).toEqual([
                "\u001B[32m",
                "Green",
                "FOO",
                "\u001B[0m",
                "\u001B[34m",
                "Blue",
                "BAR",
                "\u001B[0m",
            ]);
        });

        it("should ignore ANSI escape codes with numbers by default", () => {
            expect(splitByCase("\u001B[31mError404Found\u001B[0m")).toEqual(["Error", "404", "Found"]);
            expect(splitByCase("\u001B[33mWarning2xx\u001B[0m")).toEqual(["Warning", "2", "xx"]);
        });

        it("should handle ANSI escape codes with numbers when handleAnsi is true", () => {
            expect(splitByCase("\u001B[31mError404Found\u001B[0m", { handleAnsi: true })).toEqual(["\u001B[31m", "Error", "404", "Found", "\u001B[0m"]);
            expect(splitByCase("\u001B[33mWarning2xx\u001B[0m", { handleAnsi: true })).toEqual(["\u001B[33m", "Warning", "2", "xx", "\u001B[0m"]);
        });
    });

    describe("emoji support", () => {
        it("should ignore emojis in text by default", () => {
            expect(splitByCase("hello🌍World")).toEqual(["hello", "World"]);
            expect(splitByCase("test🎉Party🎈Fun")).toEqual(["test", "Party", "Fun"]);
            expect(splitByCase("EMOJI👾Gaming")).toEqual(["EMOJI", "Gaming"]);
        });

        it("should handle emojis when handleEmoji is true", () => {
            expect(splitByCase("hello🌍World", { handleEmoji: true })).toEqual(["hello", "🌍", "World"]);
            expect(splitByCase("test🎉Party🎈Fun", { handleEmoji: true })).toEqual(["test", "🎉", "Party", "🎈", "Fun"]);
            expect(splitByCase("EMOJI👾Gaming", { handleEmoji: true })).toEqual(["EMOJI", "👾", "Gaming"]);
        });

        it("should ignore emojis with numbers and special characters by default", () => {
            expect(splitByCase("iOS15.4📱Update")).toEqual(["i", "OS", "15", "4", "Update"]);
            expect(splitByCase("version2.0✨Release")).toEqual(["version", "2", "0", "Release"]);
            expect(splitByCase("error❌404Page")).toEqual(["error", "404", "Page"]);
        });

        it("should handle emojis with numbers when handleEmoji is true", () => {
            expect(splitByCase("iOS15.4📱Update", { handleEmoji: true })).toEqual(["i", "OS", "15", "4", "📱", "Update"]);
            expect(splitByCase("version2.0✨Release", { handleEmoji: true })).toEqual(["version", "2", "0", "✨", "Release"]);
            expect(splitByCase("error❌404Page", { handleEmoji: true })).toEqual(["error", "❌", "404", "Page"]);
        });

        it("should ignore multiple consecutive emojis by default", () => {
            expect(splitByCase("weather🌞🌤️🌧️Forecast")).toEqual(["weather", "Forecast"]);
            expect(splitByCase("reaction👍👎Rating")).toEqual(["reaction", "Rating"]);
        });

        it("should handle multiple consecutive emojis when handleEmoji is true", () => {
            expect(splitByCase("weather🌞🌤️🌧️Forecast", { handleEmoji: true })).toEqual(["weather", "🌞", "🌤️", "🌧️", "Forecast"]);
            expect(splitByCase("reaction👍👎Rating", { handleEmoji: true })).toEqual(["reaction", "👍", "👎", "Rating"]);
        });
    });

    describe("combined ANSI and emoji handling", () => {
        const mixedText = "\u001B[31mhappy😊Face\u001B[0m";

        it("should ignore both ANSI and emoji by default", () => {
            expect(splitByCase(mixedText)).toEqual(["happy", "Face"]);
        });

        it("should handle both when both are enabled", () => {
            expect(splitByCase(mixedText, { handleAnsi: true, handleEmoji: true })).toEqual(["\u001B[31m", "happy", "😊", "Face", "\u001B[0m"]);
        });

        it("should handle only ANSI when only ANSI is enabled", () => {
            expect(splitByCase(mixedText, { handleAnsi: true })).toEqual(["\u001B[31m", "happy", "Face", "\u001B[0m"]);
        });

        it("should handle only emoji when only emoji is enabled", () => {
            expect(splitByCase(mixedText, { handleEmoji: true })).toEqual(["happy", "😊", "Face"]);
        });
    });

    describe("special formats and mixed cases", () => {
        it("should handle movie and product references", () => {
            expect(splitByCase("C3POAndR2D2")).toEqual(["C", "3", "PO", "And", "R", "2", "D", "2"]);
            expect(splitByCase("Episode7TheForceAwakens")).toEqual(["Episode", "7", "The", "Force", "Awakens"]);
            expect(splitByCase("iPhone12ProMax")).toEqual(["i", "Phone", "12", "Pro", "Max"]);
            expect(splitByCase("iPhone12_Pro_Max")).toEqual(["i", "Phone", "12", "Pro", "Max"]);
            expect(splitByCase("iPhone12-Pro-Max")).toEqual(["i", "Phone", "12", "Pro", "Max"]);
        });

        it("should handle scientific notations and units", () => {
            expect(splitByCase("pH7Solution")).toEqual(["p", "H", "7", "Solution"]);
            expect(splitByCase("Na2CO3Compound")).toEqual(["Na", "2", "CO", "3", "Compound"]);
            expect(splitByCase("v1Point2Release")).toEqual(["v", "1", "Point", "2", "Release"]);
            expect(splitByCase("H2SO4Molecule")).toEqual(["H", "2", "SO", "4", "Molecule"]);
            expect(splitByCase("CO2Emission")).toEqual(["CO", "2", "Emission"]);
            expect(splitByCase("KWh2Day")).toEqual(["K", "Wh", "2", "Day"]);
        });

        it("should handle file paths and versions", () => {
            expect(splitByCase("src/components/Button.tsx")).toEqual(["src", "components", "Button", "tsx"]);
            expect(splitByCase("v1.2.3-beta.1")).toEqual(["v", "1", "2", "3", "beta", "1"]);
            expect(splitByCase("README.md")).toEqual(["README", "md"]);
            expect(splitByCase("package-lock.json")).toEqual(["package", "lock", "json"]);
            expect(splitByCase("tsconfig.build.json")).toEqual(["tsconfig", "build", "json"]);
        });

        it("should handle special characters and symbols", () => {
            expect(splitByCase("email@domain.com", { separators: /[-_/\s]+/g })).toEqual(["email", "@", "domain", ".", "com"]);
            expect(splitByCase("user+alias@email.com", { separators: /[-_/\s]+/g })).toEqual(["user", "+", "alias", "@", "email", ".", "com"]);
            expect(splitByCase("$specialPrice100")).toEqual(["$", "special", "Price", "100"]);
            expect(splitByCase("100%Complete")).toEqual(["100", "%", "Complete"]);
            expect(splitByCase("#FF00FF")).toEqual(["#", "FF", "00", "FF"]);
        });

        it("should handle mixed number formats", () => {
            expect(splitByCase("ISO8601Format")).toEqual(["ISO", "8601", "Format"]);
            expect(splitByCase("3DPrinter")).toEqual(["3", "D", "Printer"]);
            expect(splitByCase("4KDisplay")).toEqual(["4", "K", "Display"]);
            expect(splitByCase("Win32API")).toEqual(["Win", "32", "API"]);
            expect(splitByCase("ES2015Features")).toEqual(["ES", "2015", "Features"]);
        });

        it("should handle special formats with ANSI and emoji", () => {
            expect(splitByCase("\u001B[31mVersion2.0\u001B[0m")).toEqual(["Version", "2", "0"]);
            expect(splitByCase("\u001B[31mVersion2.0\u001B[0m", { handleAnsi: true })).toEqual(["\u001B[31m", "Version", "2", "0", "\u001B[0m"]);

            expect(splitByCase("Version2.0✨")).toEqual(["Version", "2", "0"]);
            expect(splitByCase("Version2.0✨", { handleEmoji: true })).toEqual(["Version", "2", "0", "✨"]);

            expect(splitByCase("\u001B[31mVersion2.0✨\u001B[0m")).toEqual(["Version", "2", "0"]);
            expect(splitByCase("\u001B[31mVersion2.0✨\u001B[0m", { handleAnsi: true, handleEmoji: true })).toEqual([
                "\u001B[31m",
                "Version",
                "2",
                "0",
                "✨",
                "\u001B[0m",
            ]);
        });
    });
});
