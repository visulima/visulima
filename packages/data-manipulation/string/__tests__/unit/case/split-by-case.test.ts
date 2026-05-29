import { bgRed } from "@visulima/colorize";
import { describe, expect, it } from "vitest";

import type { NodeLocale } from "../../../src";
import { splitByCase } from "../../../src/case/split-by-case";

describe(splitByCase, () => {
    it("should handle empty string", () => {
        expect.assertions(1);
        expect(splitByCase("")).toStrictEqual([]);
    });

    it("should handle single word", () => {
        expect.assertions(2);
        expect(splitByCase("foo")).toStrictEqual(["foo"]);
        expect(splitByCase("FOO")).toStrictEqual(["FOO"]);
    });

    it("should split basic camelCase", () => {
        expect.assertions(2);
        expect(splitByCase("fooBar")).toStrictEqual(["foo", "Bar"]);
        expect(splitByCase("fooBarBaz")).toStrictEqual(["foo", "Bar", "Baz"]);
    });

    it("should split PascalCase with multiple words", () => {
        expect.assertions(2);
        expect(splitByCase("FooBarBaz")).toStrictEqual(["Foo", "Bar", "Baz"]);
        expect(splitByCase("ThisIsATest")).toStrictEqual(["This", "Is", "A", "Test"]);
    });

    it("should handle mixed case patterns", () => {
        expect.assertions(5);
        expect(splitByCase("FooBARb")).toStrictEqual(["Foo", "BA", "Rb"]);
        expect(splitByCase("FOOBar")).toStrictEqual(["FOO", "Bar"]);
        expect(splitByCase("ABCdef")).toStrictEqual(["AB", "Cdef"]);

        expect(
            splitByCase("FooBARb", {
                knownAcronyms: ["BAR"],
            }),
        ).toStrictEqual(["Foo", "BAR", "b"]);
        expect(
            splitByCase("ABCdef", {
                knownAcronyms: ["ABC"],
            }),
        ).toStrictEqual(["ABC", "def"]);
    });

    it("should handle multiple separators", () => {
        expect.assertions(2);
        expect(splitByCase("foo_bar-baz/qux")).toStrictEqual(["foo", "bar", "baz", "qux"]);
        expect(splitByCase("foo.bar_baz/qux")).toStrictEqual(["foo", "bar", "baz", "qux"]);
    });

    it("should handle consecutive uppercase letters", () => {
        expect.assertions(3);
        expect(splitByCase("XMLHttpRequest")).toStrictEqual(["XML", "Http", "Request"]);
        expect(splitByCase("AJAXRequest")).toStrictEqual(["AJAX", "Request"]);
        expect(splitByCase("getXMLData")).toStrictEqual(["get", "XML", "Data"]);
    });

    it("should handle numbers mixed with letters", () => {
        expect.assertions(4);
        expect(splitByCase("Query123String")).toStrictEqual(["Query", "123", "String"]);
        expect(splitByCase("123Test")).toStrictEqual(["123", "Test"]);
        expect(splitByCase("test123")).toStrictEqual(["test", "123"]);
        expect(splitByCase("TEST123string")).toStrictEqual(["TEST", "123", "string"]);
    });

    it("should handle dot case", () => {
        expect.assertions(2);
        expect(splitByCase("foo.bar.baz")).toStrictEqual(["foo", "bar", "baz"]);
        expect(splitByCase("some.mixed.Case.test")).toStrictEqual(["some", "mixed", "Case", "test"]);
    });

    it("should handle path case", () => {
        expect.assertions(4);
        expect(splitByCase("foo/bar/baz")).toStrictEqual(["foo", "bar", "baz"]);
        expect(splitByCase("some/mixed/Case/test")).toStrictEqual(["some", "mixed", "Case", "test"]);

        expect(splitByCase("../foo/bar")).toStrictEqual(["..", "foo", "bar"]);
        expect(splitByCase("foo/../../bar")).toStrictEqual(["foo", "..", "..", "bar"]);
    });

    it("should handle complex mixed cases", () => {
        expect.assertions(3);
        expect(splitByCase("ThisXMLParser123Test")).toStrictEqual(["This", "XML", "Parser", "123", "Test"]);
        expect(splitByCase("parseDBURL2HTTP")).toStrictEqual(["parse", "DBURL", "2", "HTTP"]);
        expect(splitByCase("API_KEY_123_TEST")).toStrictEqual(["API", "KEY", "123", "TEST"]);
    });

    it("should handle custom splitters", () => {
        expect.assertions(3);
        expect(splitByCase(String.raw`foo\Bar.fuzz-FIZz`, { separators: ["\\", ".", "-"] })).toStrictEqual(["foo", "Bar", "fuzz", "FI", "Zz"]);
        expect(splitByCase("new-name-value", { separators: ["_"] })).toStrictEqual(["new-name-value"]);
        expect(splitByCase("foo|bar|baz", { separators: ["|"] })).toStrictEqual(["foo", "bar", "baz"]);
    });

    it("should handle edge cases", () => {
        expect.assertions(4);
        expect(splitByCase("__FOO__BAR__")).toStrictEqual(["FOO", "BAR"]);
        expect(splitByCase("...test...case...")).toStrictEqual(["test", "case"]);
        expect(splitByCase("///path///case///")).toStrictEqual(["path", "case"]);

        expect(splitByCase("MixedXMLAndJSON123Data")).toStrictEqual(["Mixed", "XML", "And", "JSON", "123", "Data"]);
    });

    describe("locale support", () => {
        it("should handle Afrikaans cases", () => {
            expect.assertions(2);

            const locale = "af";

            expect(splitByCase("grootWoord", { locale })).toStrictEqual(["groot", "Woord"]);
            expect(splitByCase("kleinLetters", { locale })).toStrictEqual(["klein", "Letters"]);
        });

        it("should handle Amharic cases", () => {
            expect.assertions(2);

            const locale = "am";

            expect(splitByCase("ሰላምWorld", { locale })).toStrictEqual(["ሰላም", "World"]);
            expect(splitByCase("ኢትዮጵያText", { locale })).toStrictEqual(["ኢትዮጵያ", "Text"]);
        });

        it("should handle Arabic cases", () => {
            expect.assertions(2);

            const locale = "ar";

            expect(splitByCase("مرحباWorld", { locale })).toStrictEqual(["مرحبا", "World"]);
            expect(splitByCase("عربيText", { locale })).toStrictEqual(["عربي", "Text"]);
        });

        it("should handle Bengali cases", () => {
            expect.assertions(2);

            const locale = "bn";

            expect(splitByCase("স্বাগতWorld", { locale })).toStrictEqual(["স্বাগত", "World"]);
            expect(splitByCase("বাংলাText", { locale })).toStrictEqual(["বাংলা", "Text"]);
        });

        it("should handle Bosnian cases", () => {
            expect.assertions(2);

            const locale = "bs";

            expect(splitByCase("zdravoSvijete", { locale })).toStrictEqual(["zdravo", "Svijete"]);
            expect(splitByCase("bosanskiText", { locale })).toStrictEqual(["bosanski", "Text"]);
        });

        it("should handle Catalan cases", () => {
            expect.assertions(2);

            const locale = "ca";

            expect(splitByCase("holaMón", { locale })).toStrictEqual(["hola", "Món"]);
            expect(splitByCase("catalàText", { locale })).toStrictEqual(["català", "Text"]);
        });

        it("should handle Czech cases", () => {
            expect.assertions(2);

            const locale = "cs";

            expect(splitByCase("ahojSvěte", { locale })).toStrictEqual(["ahoj", "Světe"]);
            expect(splitByCase("českýText", { locale })).toStrictEqual(["český", "Text"]);
        });

        it("should handle Danish cases", () => {
            expect.assertions(2);

            const locale = "da";

            expect(splitByCase("halloVerden", { locale })).toStrictEqual(["hallo", "Verden"]);
            expect(splitByCase("danskText", { locale })).toStrictEqual(["dansk", "Text"]);
        });

        it("should handle Dutch cases", () => {
            expect.assertions(2);

            const locale = "nl";

            expect(splitByCase("halloWereld", { locale })).toStrictEqual(["hallo", "Wereld"]);
            expect(splitByCase("nederlandsText", { locale })).toStrictEqual(["nederlands", "Text"]);
        });

        it("should handle Estonian cases", () => {
            expect.assertions(2);

            const locale = "et";

            expect(splitByCase("tereMailm", { locale })).toStrictEqual(["tere", "Mailm"]);
            expect(splitByCase("eestiText", { locale })).toStrictEqual(["eesti", "Text"]);
        });

        it("should handle Finnish cases", () => {
            expect.assertions(2);

            const locale = "fi";

            expect(splitByCase("heiMaailma", { locale })).toStrictEqual(["hei", "Maailma"]);
            expect(splitByCase("suomiText", { locale })).toStrictEqual(["suomi", "Text"]);
        });

        it("should handle Filipino cases", () => {
            expect.assertions(2);

            const locale = "fil";

            expect(splitByCase("helloMundo", { locale })).toStrictEqual(["hello", "Mundo"]);
            expect(splitByCase("filipinoText", { locale })).toStrictEqual(["filipino", "Text"]);
        });

        it("should handle French cases", () => {
            expect.assertions(2);

            const locale = "fr";

            expect(splitByCase("bonjourMonde", { locale })).toStrictEqual(["bonjour", "Monde"]);
            expect(splitByCase("françaisText", { locale })).toStrictEqual(["français", "Text"]);
        });

        it("should handle Galician cases", () => {
            expect.assertions(2);

            const locale = "gl";

            expect(splitByCase("holaMundo", { locale })).toStrictEqual(["hola", "Mundo"]);
            expect(splitByCase("galegoText", { locale })).toStrictEqual(["galego", "Text"]);
        });

        it("should handle Georgian cases", () => {
            expect.assertions(2);

            const locale = "ka";

            expect(splitByCase("გამარჯობაWorld", { locale })).toStrictEqual(["გამარჯობა", "World"]);
            expect(splitByCase("ქართულიText", { locale })).toStrictEqual(["ქართული", "Text"]);
        });

        it("should handle Greek cases", () => {
            expect.assertions(2);

            const locale = "el";

            expect(splitByCase("γειαΣας", { locale })).toStrictEqual(["γεια", "Σας"]);
            expect(splitByCase("ελληνικάText", { locale })).toStrictEqual(["ελληνικά", "Text"]);
        });

        it("should handle Gujarati cases", () => {
            expect.assertions(2);

            const locale = "gu";

            expect(splitByCase("નમસ્તેWorld", { locale })).toStrictEqual(["નમસ્તે", "World"]);
            expect(splitByCase("ગુજરાતીText", { locale })).toStrictEqual(["ગુજરાતી", "Text"]);
        });

        it("should handle Hebrew cases", () => {
            expect.assertions(2);

            const locale = "he";

            expect(splitByCase("שלוםWorld", { locale })).toStrictEqual(["שלום", "World"]);
            expect(splitByCase("עבריתטקסט", { locale })).toStrictEqual(["עבריתטקסט"]);
        });

        it("should handle Hindi cases", () => {
            expect.assertions(2);

            const locale = "hi";

            expect(splitByCase("नमस्तेWorld", { locale })).toStrictEqual(["नमस्ते", "World"]);
            expect(splitByCase("हिंदीText", { locale })).toStrictEqual(["हिंदी", "Text"]);
        });

        it("should handle Hungarian cases", () => {
            expect.assertions(2);

            const locale = "hu";

            expect(splitByCase("hellóVilág", { locale })).toStrictEqual(["helló", "Világ"]);
            expect(splitByCase("magyarText", { locale })).toStrictEqual(["magyar", "Text"]);
        });

        it("should handle Icelandic cases", () => {
            expect.assertions(2);

            const locale = "is";

            expect(splitByCase("hallóHeimur", { locale })).toStrictEqual(["halló", "Heimur"]);
            expect(splitByCase("íslenskaText", { locale })).toStrictEqual(["íslenska", "Text"]);
        });

        it("should handle Indonesian cases", () => {
            expect.assertions(2);

            const locale = "id";

            expect(splitByCase("haloDunia", { locale })).toStrictEqual(["halo", "Dunia"]);
            expect(splitByCase("bahasaText", { locale })).toStrictEqual(["bahasa", "Text"]);
        });

        it("should handle Irish cases", () => {
            expect.assertions(2);

            const locale = "ga";

            expect(splitByCase("diaDuit", { locale })).toStrictEqual(["dia", "Duit"]);
            expect(splitByCase("gaeilgeText", { locale })).toStrictEqual(["gaeilge", "Text"]);
        });

        it("should handle Italian cases", () => {
            expect.assertions(2);

            const locale = "it";

            expect(splitByCase("ciaoMondo", { locale })).toStrictEqual(["ciao", "Mondo"]);
            expect(splitByCase("italianoText", { locale })).toStrictEqual(["italiano", "Text"]);
        });

        it("should handle Japanese cases", () => {
            expect.assertions(3);

            const locale = "ja";

            expect(splitByCase("こんにちはWorld", { locale })).toStrictEqual(["こんにちは", "World"]);
            expect(splitByCase("日本語Text", { locale })).toStrictEqual(["日本語", "Text"]);
            expect(splitByCase("テストデータ", { locale })).toStrictEqual(["テストデータ"]);
        });

        it("should handle Kazakh cases", () => {
            expect.assertions(2);

            const locale = "kk";

            expect(splitByCase("сәлемWorld", { locale })).toStrictEqual(["сәлем", "World"]);
            expect(splitByCase("қазақText", { locale })).toStrictEqual(["қазақ", "Text"]);
        });

        it("should handle Khmer cases", () => {
            expect.assertions(2);

            const locale = "km";

            expect(splitByCase("ជំរាបសួរWorld", { locale })).toStrictEqual(["ជំរាបសួរ", "World"]);
            expect(splitByCase("ខ្មែរText", { locale })).toStrictEqual(["ខ្មែរ", "Text"]);
        });

        it("should handle Kannada cases", () => {
            expect.assertions(2);

            const locale = "kn";

            expect(splitByCase("ನಮಸ್ಕಾರWorld", { locale })).toStrictEqual(["ನಮಸ್ಕಾರ", "World"]);
            expect(splitByCase("ಕನ್ನಡText", { locale })).toStrictEqual(["ಕನ್ನಡ", "Text"]);
        });

        it("should handle Korean cases", () => {
            expect.assertions(3);

            const locale = "ko";

            expect(splitByCase("안녕하세요World", { locale })).toStrictEqual(["안녕하세요", "World"]);
            expect(splitByCase("한국어Text", { locale })).toStrictEqual(["한국어", "Text"]);
            expect(splitByCase("테스트데이터", { locale })).toStrictEqual(["테스트데이터"]);
        });

        it("should handle Kyrgyz cases", () => {
            expect.assertions(2);

            const locale = "ky";

            expect(splitByCase("саламWorld", { locale })).toStrictEqual(["салам", "World"]);
            expect(splitByCase("кыргызText", { locale })).toStrictEqual(["кыргыз", "Text"]);
        });

        it("should handle Lao cases", () => {
            expect.assertions(2);

            const locale = "lo";

            expect(splitByCase("ສະບາຍດີWorld", { locale })).toStrictEqual(["ສະບາຍດີ", "World"]);
            expect(splitByCase("ລາວText", { locale })).toStrictEqual(["ລາວ", "Text"]);
        });

        it("should handle Lithuanian cases", () => {
            expect.assertions(2);

            const locale = "lt";

            expect(splitByCase("labasŠviesa", { locale })).toStrictEqual(["labas", "Šviesa"]);
            expect(splitByCase("lietuviųText", { locale })).toStrictEqual(["lietuvių", "Text"]);
        });

        it("should handle Latvian cases", () => {
            expect.assertions(2);

            const locale = "lv";

            expect(splitByCase("sveikiPasaule", { locale })).toStrictEqual(["sveiki", "Pasaule"]);
            expect(splitByCase("latviešuText", { locale })).toStrictEqual(["latviešu", "Text"]);
        });

        it("should handle Malayalam cases", () => {
            expect.assertions(2);

            const locale = "ml";

            expect(splitByCase("നമസ്കാരംWorld", { locale })).toStrictEqual(["നമസ്കാരം", "World"]);
            expect(splitByCase("മലയാളംText", { locale })).toStrictEqual(["മലയാളം", "Text"]);
        });

        it("should handle Mongolian cases", () => {
            expect.assertions(2);

            const locale = "mn";

            expect(splitByCase("сайнWorld", { locale })).toStrictEqual(["сайн", "World"]);
            expect(splitByCase("монголText", { locale })).toStrictEqual(["монгол", "Text"]);
        });

        it("should handle Marathi cases", () => {
            expect.assertions(2);

            const locale = "mr";

            expect(splitByCase("नमस्कारWorld", { locale })).toStrictEqual(["नमस्कार", "World"]);
            expect(splitByCase("मराठीText", { locale })).toStrictEqual(["मराठी", "Text"]);
        });

        it("should handle Malay cases", () => {
            expect.assertions(2);

            const locale = "ms";

            expect(splitByCase("haloDunia", { locale })).toStrictEqual(["halo", "Dunia"]);
            expect(splitByCase("malayText", { locale })).toStrictEqual(["malay", "Text"]);
        });

        it("should handle Maltese cases", () => {
            expect.assertions(2);

            const locale = "mt";

            expect(splitByCase("bonguDinja", { locale })).toStrictEqual(["bongu", "Dinja"]);
            expect(splitByCase("maltiText", { locale })).toStrictEqual(["malti", "Text"]);
        });

        it("should handle Nepali cases", () => {
            expect.assertions(2);

            const locale = "ne";

            expect(splitByCase("नमस्तेWorld", { locale })).toStrictEqual(["नमस्ते", "World"]);
            expect(splitByCase("नेपालीText", { locale })).toStrictEqual(["नेपाली", "Text"]);
        });

        it("should handle Norwegian cases", () => {
            expect.assertions(2);

            const locale = "no";

            expect(splitByCase("heiVerden", { locale })).toStrictEqual(["hei", "Verden"]);
            expect(splitByCase("norskText", { locale })).toStrictEqual(["norsk", "Text"]);
        });

        it("should handle Persian cases", () => {
            expect.assertions(2);

            const locale = "fa";

            expect(splitByCase("سلامWorld", { locale })).toStrictEqual(["سلام", "World"]);
            expect(splitByCase("فارسیText", { locale })).toStrictEqual(["فارسی", "Text"]);
        });

        it("should handle Polish cases", () => {
            expect.assertions(2);

            const locale = "pl";

            expect(splitByCase("cześćŚwiat", { locale })).toStrictEqual(["cześć", "Świat"]);
            expect(splitByCase("polskiText", { locale })).toStrictEqual(["polski", "Text"]);
        });

        it("should handle Portuguese cases", () => {
            expect.assertions(2);

            const locale = "pt";

            expect(splitByCase("oláMundo", { locale })).toStrictEqual(["olá", "Mundo"]);
            expect(splitByCase("portuguêsText", { locale })).toStrictEqual(["português", "Text"]);
        });

        it("should handle Punjabi cases", () => {
            expect.assertions(2);

            const locale = "pa";

            expect(splitByCase("ਸਤਿਸ੍ਰੀWorld", { locale })).toStrictEqual(["ਸਤਿਸ੍ਰੀ", "World"]);
            expect(splitByCase("ਪੰਜਾਬੀText", { locale })).toStrictEqual(["ਪੰਜਾਬੀ", "Text"]);
        });

        it("should handle Romanian cases", () => {
            expect.assertions(2);

            const locale = "ro";

            expect(splitByCase("salutLume", { locale })).toStrictEqual(["salut", "Lume"]);
            expect(splitByCase("românăText", { locale })).toStrictEqual(["română", "Text"]);
        });

        it("should handle Russian cases", () => {
            expect.assertions(2);

            const locale = "ru";

            expect(splitByCase("приветМир", { locale })).toStrictEqual(["привет", "Мир"]);
            expect(splitByCase("русскийText", { locale })).toStrictEqual(["русский", "Text"]);
        });

        it("should handle Serbian cases", () => {
            expect.assertions(2);

            const locale = "sr";

            expect(splitByCase("здравоСвете", { locale })).toStrictEqual(["здраво", "Свете"]);
            expect(splitByCase("српскиText", { locale })).toStrictEqual(["српски", "Text"]);
        });

        it("should handle Sinhala cases", () => {
            expect.assertions(2);

            const locale = "si";

            expect(splitByCase("ආයුබෝවන්දWorld", { locale })).toStrictEqual(["ආයුබෝවන්ද", "World"]);
            expect(splitByCase("සිංහලයText", { locale })).toStrictEqual(["සිංහලය", "Text"]);
        });

        it("should handle Slovak cases", () => {
            expect.assertions(2);

            const locale = "sk";

            expect(splitByCase("ahojSvet", { locale })).toStrictEqual(["ahoj", "Svet"]);
            expect(splitByCase("slovenskýText", { locale })).toStrictEqual(["slovenský", "Text"]);
        });

        it("should handle Slovenian cases", () => {
            expect.assertions(2);

            const locale = "sl";

            expect(splitByCase("zdravoSvet", { locale })).toStrictEqual(["zdravo", "Svet"]);
            expect(splitByCase("slovenskiČText", { locale })).toStrictEqual(["slovenski", "Č", "Text"]);
        });

        it("should handle Albanian cases", () => {
            expect.assertions(2);

            const locale = "sq";

            expect(splitByCase("përshëndetjeBotë", { locale })).toStrictEqual(["përshëndetje", "Botë"]);
            expect(splitByCase("shqipText", { locale })).toStrictEqual(["shqip", "Text"]);
        });

        it("should handle Swedish cases", () => {
            expect.assertions(2);

            const locale = "sv";

            expect(splitByCase("hejVärlden", { locale })).toStrictEqual(["hej", "Världen"]);
            expect(splitByCase("svenskaText", { locale })).toStrictEqual(["svenska", "Text"]);
        });

        it("should handle Tamil cases", () => {
            expect.assertions(2);

            const locale = "ta";

            expect(splitByCase("வணக்கம்World", { locale })).toStrictEqual(["வணக்கம்", "World"]);
            expect(splitByCase("தமிழ்Text", { locale })).toStrictEqual(["தமிழ்", "Text"]);
        });

        it("should handle Telugu cases", () => {
            expect.assertions(2);

            const locale = "te";

            expect(splitByCase("నమస్కారంWorld", { locale })).toStrictEqual(["నమస్కారం", "World"]);
            expect(splitByCase("తెలుగుText", { locale })).toStrictEqual(["తెలుగు", "Text"]);
        });

        it("should handle Thai cases", () => {
            expect.assertions(2);

            const locale = "th";

            expect(splitByCase("สวัสดีWorld", { locale })).toStrictEqual(["สวัสดี", "World"]);
            expect(splitByCase("ไทยText", { locale })).toStrictEqual(["ไทย", "Text"]);
        });

        it("should handle Turkish cases", () => {
            expect.assertions(2);

            const locale = "tr";

            expect(splitByCase("merhabaDünya", { locale })).toStrictEqual(["merhaba", "Dünya"]);
            expect(splitByCase("türkçeText", { locale })).toStrictEqual(["türkçe", "Text"]);
        });

        it("should handle Ukrainian cases", () => {
            expect.assertions(2);

            const locale = "uk";

            expect(splitByCase("привітСвіт", { locale })).toStrictEqual(["привіт", "Світ"]);
            expect(splitByCase("українськаText", { locale })).toStrictEqual(["українська", "Text"]);
        });

        it("should handle Urdu cases", () => {
            expect.assertions(2);

            const locale = "ur";

            expect(splitByCase("سلامWorld", { locale })).toStrictEqual(["سلام", "World"]);
            expect(splitByCase("اردوText", { locale })).toStrictEqual(["اردو", "Text"]);
        });

        describe("uzbek case handling", () => {
            const options = { locale: "uz" as NodeLocale };

            it("should handle Uzbek Latin script", () => {
                expect.assertions(3);

                expect(splitByCase("salomDunyo", options)).toStrictEqual(["salom", "Dunyo"]);
                expect(splitByCase("oʻzbekText", options)).toStrictEqual(["oʻzbek", "Text"]);
                expect(splitByCase("kattaHarf", options)).toStrictEqual(["katta", "Harf"]);
            });

            it("should handle Uzbek Cyrillic script", () => {
                expect.assertions(3);

                expect(splitByCase("саломДунё", options)).toStrictEqual(["салом", "Дунё"]);
                expect(splitByCase("ўзбекText", options)).toStrictEqual(["ўзбек", "Text"]);
                expect(splitByCase("каттаҲарф", options)).toStrictEqual(["катта", "Ҳарф"]);
            });

            it("should handle mixed script cases", () => {
                expect.assertions(2);

                expect(splitByCase("oʻzbekЎзбек", options)).toStrictEqual(["oʻzbek", "Ўзбек"]);
                expect(splitByCase("latinКирилText", options)).toStrictEqual(["latin", "Кирил", "Text"]);
            });
        });

        it("should handle Vietnamese cases", () => {
            expect.assertions(2);

            const locale = "vi";

            expect(splitByCase("xin chàoThếGiới", { locale })).toStrictEqual(["xin", "chào", "Thế", "Giới"]);
            expect(splitByCase("tiếngViệtText", { locale })).toStrictEqual(["tiếng", "Việt", "Text"]);
        });

        it("should handle Chinese cases", () => {
            expect.assertions(2);

            const locale = "zh";

            expect(splitByCase("你好World", { locale })).toStrictEqual(["你好", "World"]);
            expect(splitByCase("中文Text", { locale })).toStrictEqual(["中文", "Text"]);
        });

        it("should handle Turkish specific cases", () => {
            expect.assertions(4);

            const locale = "tr-TR" as NodeLocale;

            expect(splitByCase("İstanbulCity", { locale })).toStrictEqual(["İstanbul", "City"]);
            expect(splitByCase("izmirŞehir", { locale })).toStrictEqual(["izmir", "Şehir"]);
            expect(splitByCase("türkçeTest", { locale })).toStrictEqual(["türkçe", "Test"]);
            expect(splitByCase("IıİiTest", { locale })).toStrictEqual(["Iı", "İi", "Test"]);
        });

        it("should handle Azerbaijani specific cases", () => {
            expect.assertions(3);

            const locale = "az-AZ" as NodeLocale;

            expect(splitByCase("İlkinTest", { locale })).toStrictEqual(["İlkin", "Test"]);
            expect(splitByCase("bakıŞəhər", { locale })).toStrictEqual(["bakı", "Şəhər"]);
            expect(splitByCase("IıİiTest", { locale })).toStrictEqual(["Iı", "İi", "Test"]);
        });

        describe("german case handling", () => {
            const options = { locale: "de-DE" as NodeLocale };

            it("should handle German specific cases", () => {
                expect.assertions(6);
                expect(splitByCase("GROSSE STRAßE", options)).toStrictEqual(["GROSSE", "STRAßE"]);
                expect(splitByCase("straßeTest", options)).toStrictEqual(["straße", "Test"]);
                expect(splitByCase("großeHaus", options)).toStrictEqual(["große", "Haus"]);
                expect(splitByCase("äußereForm", options)).toStrictEqual(["äußere", "Form"]);
                expect(splitByCase("GROẞESHAUS", options)).toStrictEqual(["GROẞESHAUS"]);
                expect(splitByCase("DERGroßeWAGEN", options)).toStrictEqual(["DER", "Große", "WAGEN"]);
            });

            it("should handle eszett in uppercase sequences", () => {
                expect.assertions(3);
                expect(splitByCase("STRAßE", options)).toStrictEqual(["STRAßE"]);
                expect(splitByCase("GROßE", options)).toStrictEqual(["GROßE"]);
                expect(splitByCase("GROẞE", options)).toStrictEqual(["GROẞE"]);
            });

            it("should handle mixed case with eszett", () => {
                expect.assertions(2);
                expect(splitByCase("großeSTRASSE", options)).toStrictEqual(["große", "STRASSE"]);
                expect(splitByCase("DieGROSSEStadtStraße", options)).toStrictEqual(["Die", "GROSSE", "Stadt", "Straße"]);
            });

            it("should handle compound words", () => {
                expect.assertions(3);
                expect(splitByCase("BundesstraßeNummer", options)).toStrictEqual(["Bundesstraße", "Nummer"]);
                expect(splitByCase("GROßSTADT", options)).toStrictEqual(["GROßSTADT"]);
                expect(splitByCase("KLEINSTRAßE", options)).toStrictEqual(["KLEINSTRAßE"]);
            });

            it("should handle German eszett cases", () => {
                expect.assertions(4);
                expect(splitByCase("straßeName", options)).toStrictEqual(["straße", "Name"]);
                expect(splitByCase("STRAẞENAME", options)).toStrictEqual(["STRAẞENAME"]);
                expect(splitByCase("GROẞBUCHSTABE", options)).toStrictEqual(["GROẞBUCHSTABE"]);
                expect(splitByCase("großBuchstabe", options)).toStrictEqual(["groß", "Buchstabe"]);
            });
        });

        it("should handle Greek specific cases", () => {
            expect.assertions(5);

            const locale = "el-GR";

            expect(splitByCase("καλημέραΚόσμε", { locale })).toStrictEqual(["καλημέρα", "Κόσμε"]);
            expect(splitByCase("ΕλληνικάTest", { locale })).toStrictEqual(["Ελληνικά", "Test"]);
            expect(splitByCase("αβγΔΕΖ", { locale })).toStrictEqual(["αβγ", "ΔΕΖ"]);
            expect(splitByCase("ΚόσμοςTest", { locale })).toStrictEqual(["Κόσμος", "Test"]);
            expect(splitByCase("ΠΡΟΣΘΕΣΗTest", { locale })).toStrictEqual(["ΠΡΟΣΘΕΣΗ", "Test"]);
        });

        it("should handle Russian specific cases", () => {
            expect.assertions(3);

            const locale = "ru-RU";

            expect(splitByCase("привет Мир", { locale })).toStrictEqual(["привет", "Мир"]);
            expect(splitByCase("РусскийText", { locale })).toStrictEqual(["Русский", "Text"]);
            expect(splitByCase("тестКейс", { locale })).toStrictEqual(["тест", "Кейс"]);
        });

        it("should handle Ukrainian specific cases", () => {
            expect.assertions(3);

            const locale = "uk-UA";

            expect(splitByCase("привітСвіт", { locale })).toStrictEqual(["привіт", "Світ"]);
            expect(splitByCase("УкраїнськаMова", { locale })).toStrictEqual(["Українська", "Mова"]);
            expect(splitByCase("тестКейс", { locale })).toStrictEqual(["тест", "Кейс"]);
        });

        it("should handle Bulgarian specific cases", () => {
            expect.assertions(3);

            const locale = "bg-BG";

            expect(splitByCase("здравейСвят", { locale })).toStrictEqual(["здравей", "Свят"]);
            expect(splitByCase("БългарскиText", { locale })).toStrictEqual(["Български", "Text"]);
            expect(splitByCase("тестКейс", { locale })).toStrictEqual(["тест", "Кейс"]);
        });

        it("should handle Serbian specific cases", () => {
            expect.assertions(3);

            const locale = "sr-RS";

            expect(splitByCase("здравоСвете", { locale })).toStrictEqual(["здраво", "Свете"]);
            expect(splitByCase("СрпскиText", { locale })).toStrictEqual(["Српски", "Text"]);
            expect(splitByCase("тестКейс", { locale })).toStrictEqual(["тест", "Кейс"]);
        });

        it("should handle Macedonian specific cases", () => {
            expect.assertions(3);

            const locale = "mk-MK";

            expect(splitByCase("здравоСвету", { locale })).toStrictEqual(["здраво", "Свету"]);
            expect(splitByCase("МакедонскиText", { locale })).toStrictEqual(["Македонски", "Text"]);
            expect(splitByCase("тестКејс", { locale })).toStrictEqual(["тест", "Кејс"]);
        });

        it("should handle Belarusian specific cases", () => {
            expect.assertions(3);

            const locale = "be-BY";

            expect(splitByCase("прывітанеСвет", { locale })).toStrictEqual(["прывітане", "Свет"]);
            expect(splitByCase("БеларускаяText", { locale })).toStrictEqual(["Беларуская", "Text"]);
            expect(splitByCase("тэстКейс", { locale })).toStrictEqual(["тэст", "Кейс"]);
        });

        it("should handle Chinese (Simplified) specific cases", () => {
            expect.assertions(3);

            const locale = "zh-CN";

            expect(splitByCase("你好World", { locale })).toStrictEqual(["你好", "World"]);
            expect(splitByCase("测试Test", { locale })).toStrictEqual(["测试", "Test"]);
            expect(splitByCase("中文English混合", { locale })).toStrictEqual(["中文", "English", "混合"]);
        });

        it("should handle Chinese (Traditional) specific cases", () => {
            expect.assertions(3);

            const locale = "zh-TW";

            expect(splitByCase("你好World", { locale })).toStrictEqual(["你好", "World"]);
            expect(splitByCase("測試Test", { locale })).toStrictEqual(["測試", "Test"]);
            expect(splitByCase("中文English混合", { locale })).toStrictEqual(["中文", "English", "混合"]);
        });

        it("should handle Chinese (Hong Kong) specific cases", () => {
            expect.assertions(3);

            const locale = "zh-HK";

            expect(splitByCase("你好World", { locale })).toStrictEqual(["你好", "World"]);
            expect(splitByCase("測試Test", { locale })).toStrictEqual(["測試", "Test"]);
            expect(splitByCase("中文English混合", { locale })).toStrictEqual(["中文", "English", "混合"]);
        });

        it("should handle Japanese specific cases", () => {
            expect.assertions(4);

            const locale = "ja-JP";

            expect(splitByCase("こんにちは World", { locale })).toStrictEqual(["こんにちは", "World"]);
            expect(splitByCase("テストTest", { locale })).toStrictEqual(["テスト", "Test"]);
            expect(splitByCase("ひらがなカタカナABC", { locale })).toStrictEqual(["ひらがな", "カタカナ", "ABC"]);
            expect(splitByCase("漢字とKanji", { locale })).toStrictEqual(["漢字と", "Kanji"]);
        });

        it("should handle Arabic specific cases", () => {
            expect.assertions(3);

            const locale = "ar-SA";

            expect(splitByCase("مرحباWorld", { locale })).toStrictEqual(["مرحبا", "World"]);
            expect(splitByCase("اختبارTest", { locale })).toStrictEqual(["اختبار", "Test"]);
            expect(splitByCase("عربيEnglishمختلط", { locale })).toStrictEqual(["عربي", "English", "مختلط"]);
        });

        it("should handle Persian specific cases", () => {
            expect.assertions(3);

            const locale = "fa-IR";

            expect(splitByCase("سلامWorld", { locale })).toStrictEqual(["سلام", "World"]);
            expect(splitByCase("تستTest", { locale })).toStrictEqual(["تست", "Test"]);
            expect(splitByCase("فارسیEnglishمخلوط", { locale })).toStrictEqual(["فارسی", "English", "مخلوط"]);
        });

        it("should handle Hebrew specific cases", () => {
            expect.assertions(3);

            const locale = "he-IL";

            expect(splitByCase("שלוםWorld", { locale })).toStrictEqual(["שלום", "World"]);
            expect(splitByCase("בדיקהTest", { locale })).toStrictEqual(["בדיקה", "Test"]);
            expect(splitByCase("עבריתEnglishמעורב", { locale })).toStrictEqual(["עברית", "English", "מעורב"]);
        });

        it("should handle Thai specific cases", () => {
            expect.assertions(3);

            const locale = "th-TH";

            expect(splitByCase("สวัสดีWorld", { locale })).toStrictEqual(["สวัสดี", "World"]);
            expect(splitByCase("ทดสอบTest", { locale })).toStrictEqual(["ทดสอบ", "Test"]);
            expect(splitByCase("ไทยEnglishผสม", { locale })).toStrictEqual(["ไทย", "English", "ผสม"]);
        });

        it("should handle Hindi specific cases", () => {
            expect.assertions(3);

            const locale = "hi-IN";

            expect(splitByCase("नमस्तेWorld", { locale })).toStrictEqual(["नमस्ते", "World"]);
            expect(splitByCase("परीक्षणTest", { locale })).toStrictEqual(["परीक्षण", "Test"]);
            expect(splitByCase("हिंदीEnglishमिश्रित", { locale })).toStrictEqual(["हिंदी", "English", "मिश्रित"]);
        });

        it("should handle Marathi specific cases", () => {
            expect.assertions(3);

            const locale = "mr-IN";

            expect(splitByCase("नमस्कारWorld", { locale })).toStrictEqual(["नमस्कार", "World"]);
            expect(splitByCase("चाचणीTest", { locale })).toStrictEqual(["चाचणी", "Test"]);
            expect(splitByCase("मराठीEnglishमिश्र", { locale })).toStrictEqual(["मराठी", "English", "मिश्र"]);
        });

        it("should handle Nepali specific cases", () => {
            expect.assertions(3);

            const locale = "ne-NP";

            expect(splitByCase("नमस्तेWorld", { locale })).toStrictEqual(["नमस्ते", "World"]);
            expect(splitByCase("परीक्षणTest", { locale })).toStrictEqual(["परीक्षण", "Test"]);
            expect(splitByCase("नेपालीEnglishमिश्रित", { locale })).toStrictEqual(["नेपाली", "English", "मिश्रित"]);
        });

        it("should handle Korean specific cases", () => {
            expect.assertions(4);

            const locale = "ko-KR";

            expect(splitByCase("안녕하세요World", { locale })).toStrictEqual(["안녕하세요", "World"]);
            expect(splitByCase("테스트Test", { locale })).toStrictEqual(["테스트", "Test"]);
            expect(splitByCase("한글English혼합", { locale })).toStrictEqual(["한글", "English", "혼합"]);
            expect(splitByCase("대문자UPPER", { locale })).toStrictEqual(["대문자", "UPPER"]);
        });
    });

    describe("aNSI escape codes", () => {
        it("should strip ANSI escape codes when stripAnsi is true", () => {
            expect.assertions(5);
            expect(splitByCase("\u001B[31mRedText\u001B[0m", { stripAnsi: true })).toStrictEqual(["Red", "Text"]);
            expect(splitByCase("\u001B[1mBoldText\u001B[0m", { stripAnsi: true })).toStrictEqual(["Bold", "Text"]);
            expect(splitByCase("\u001B[32mGreenFOO\u001B[0m_\u001B[34mBlueBAR\u001B[0m", { stripAnsi: true })).toStrictEqual(["Green", "FOO", "Blue", "BAR"]);
            expect(splitByCase("\u001B[31mError404Found\u001B[0m", { stripAnsi: true })).toStrictEqual(["Error", "404", "Found"]);
            expect(splitByCase("\u001B[33mWarning2xx\u001B[0m", { stripAnsi: true })).toStrictEqual(["Warning", "2", "xx"]);
        });

        it("should handle ANSI escape codes when handleAnsi is true", () => {
            expect.assertions(4);
            expect(splitByCase("\u001B[31mRedText\u001B[0m", { handleAnsi: true })).toStrictEqual(["\u001B[31m", "Red", "Text", "\u001B[0m"]);
            expect(splitByCase("\u001B[1mBoldText\u001B[0m", { handleAnsi: true })).toStrictEqual(["\u001B[1m", "Bold", "Text", "\u001B[0m"]);
            expect(splitByCase("\u001B[32mGreenFOO\u001B[0m_\u001B[34mBlueBAR\u001B[0m", { handleAnsi: true })).toStrictEqual([
                "\u001B[32m",
                "Green",
                "FOO",
                "\u001B[0m",
                "\u001B[34m",
                "Blue",
                "BAR",
                "\u001B[0m",
            ]);
            expect(splitByCase(bgRed.green("RedText"), { handleAnsi: true })).toStrictEqual([
                "\u001B[41m",
                "\u001B[32m",
                "Red",
                "Text",
                "\u001B[39m",
                "\u001B[49m",
            ]);
        });

        it("should handle ANSI escape codes with numbers when handleAnsi is true", () => {
            expect.assertions(2);
            expect(splitByCase("\u001B[31mError404Found\u001B[0m", { handleAnsi: true })).toStrictEqual(["\u001B[31m", "Error", "404", "Found", "\u001B[0m"]);
            expect(splitByCase("\u001B[33mWarning2xx\u001B[0m", { handleAnsi: true })).toStrictEqual(["\u001B[33m", "Warning", "2", "xx", "\u001B[0m"]);
        });
    });

    describe("emoji support", () => {
        it("should handle emojis when handleEmoji is true", () => {
            expect.assertions(3);
            expect(splitByCase("hello🌍World", { handleEmoji: true })).toStrictEqual(["hello", "🌍", "World"]);
            expect(splitByCase("test🎉Party🎈Fun", { handleEmoji: true })).toStrictEqual(["test", "🎉", "Party", "🎈", "Fun"]);
            expect(splitByCase("EMOJI👾Gaming", { handleEmoji: true })).toStrictEqual(["EMOJI", "👾", "Gaming"]);
        });

        it("should ignore emojis with numbers and special characters when stripEmoji is true", () => {
            expect.assertions(3);
            expect(splitByCase("iOS15.4📱Update", { stripEmoji: true })).toStrictEqual(["i", "OS", "15", "4", "Update"]);
            expect(splitByCase("version2.0✨Release", { stripEmoji: true })).toStrictEqual(["version", "2", "0", "Release"]);
            expect(splitByCase("error❌404Page", { stripEmoji: true })).toStrictEqual(["error", "404", "Page"]);
        });

        it("should handle emojis with numbers when handleEmoji is true", () => {
            expect.assertions(3);
            expect(splitByCase("iOS15.4📱Update", { handleEmoji: true })).toStrictEqual(["i", "OS", "15", "4", "📱", "Update"]);
            expect(splitByCase("version2.0✨Release", { handleEmoji: true })).toStrictEqual(["version", "2", "0", "✨", "Release"]);
            expect(splitByCase("error❌404Page", { handleEmoji: true })).toStrictEqual(["error", "❌", "404", "Page"]);
        });

        it("should strip multiple consecutive emojis when stripEmoji is true", () => {
            expect.assertions(2);
            expect(splitByCase("weather🌞🌤️🌧️Forecast", { stripEmoji: true })).toStrictEqual(["weather", "Forecast"]);
            expect(splitByCase("reaction👍👎Rating", { stripEmoji: true })).toStrictEqual(["reaction", "Rating"]);
        });

        it("should handle multiple consecutive emojis when handleEmoji is true", () => {
            expect.assertions(2);
            expect(splitByCase("weather🌞🌤️🌧️Forecast", { handleEmoji: true })).toStrictEqual(["weather", "🌞", "🌤️", "🌧️", "Forecast"]);
            expect(splitByCase("reaction👍👎Rating", { handleEmoji: true })).toStrictEqual(["reaction", "👍", "👎", "Rating"]);
        });
    });

    describe("combined ANSI and emoji handling", () => {
        const mixedText = "\u001B[31mhappy😊Face\u001B[0m";

        it("should ignore both ANSI and emoji by default", () => {
            expect.assertions(1);
            expect(splitByCase(mixedText, { stripAnsi: true, stripEmoji: true })).toStrictEqual(["happy", "Face"]);
        });

        it("should handle both when both are enabled", () => {
            expect.assertions(1);
            expect(splitByCase(mixedText, { handleAnsi: true, handleEmoji: true })).toStrictEqual(["\u001B[31m", "happy", "😊", "Face", "\u001B[0m"]);
        });

        it("should handle only ANSI when only ANSI is enabled", () => {
            expect.assertions(1);
            expect(splitByCase(mixedText, { handleAnsi: true, stripEmoji: true })).toStrictEqual(["\u001B[31m", "happy", "Face", "\u001B[0m"]);
        });

        it("should handle only emoji when only emoji is enabled", () => {
            expect.assertions(1);
            expect(splitByCase(mixedText, { handleEmoji: true, stripAnsi: true })).toStrictEqual(["happy", "😊", "Face"]);
        });
    });

    describe("special formats and mixed cases", () => {
        it("should handle movie and product references", () => {
            expect.assertions(6);
            expect(splitByCase("C3POAndR2D2")).toStrictEqual(["C", "3", "PO", "And", "R", "2", "D", "2"]);
            expect(splitByCase("C-3PO_and_R2-D2")).toStrictEqual(["C", "3PO", "and", "R2", "D2"]);

            expect(splitByCase("Episode7TheForceAwakens")).toStrictEqual(["Episode", "7", "The", "Force", "Awakens"]);
            expect(splitByCase("iPhone12ProMax")).toStrictEqual(["i", "Phone", "12", "Pro", "Max"]);
            expect(splitByCase("iPhone12_Pro_Max")).toStrictEqual(["i", "Phone", "12", "Pro", "Max"]);
            expect(splitByCase("iPhone12-Pro-Max")).toStrictEqual(["i", "Phone", "12", "Pro", "Max"]);
        });

        it("should handle scientific notations and units", () => {
            expect.assertions(6);
            expect(splitByCase("pH7Solution")).toStrictEqual(["p", "H", "7", "Solution"]);
            expect(splitByCase("Na2CO3Compound")).toStrictEqual(["Na", "2", "CO", "3", "Compound"]);
            expect(splitByCase("v1Point2Release")).toStrictEqual(["v", "1", "Point", "2", "Release"]);
            expect(splitByCase("H2SO4Molecule")).toStrictEqual(["H", "2", "SO", "4", "Molecule"]);
            expect(splitByCase("CO2Emission")).toStrictEqual(["CO", "2", "Emission"]);
            expect(splitByCase("KWh2Day")).toStrictEqual(["K", "Wh", "2", "Day"]);
        });

        it("should handle file paths and versions", () => {
            expect.assertions(5);
            expect(splitByCase("src/components/Button.tsx")).toStrictEqual(["src", "components", "Button", "tsx"]);
            expect(splitByCase("v1.2.3-beta.1")).toStrictEqual(["v", "1", "2", "3", "beta", "1"]);
            expect(splitByCase("README.md")).toStrictEqual(["README", "md"]);
            expect(splitByCase("package-lock.json")).toStrictEqual(["package", "lock", "json"]);
            expect(splitByCase("tsconfig.build.json")).toStrictEqual(["tsconfig", "build", "json"]);
        });

        it("should handle special characters and symbols", () => {
            expect.assertions(5);
            expect(splitByCase("email@domain.com", { separators: /[-_/\s]+/g })).toStrictEqual(["email@domain.com"]);
            expect(splitByCase("user+alias@email.com", { separators: /[-_/\s]+/g })).toStrictEqual(["user+alias@email.com"]);
            expect(splitByCase("$specialPrice100")).toStrictEqual(["$special", "Price", "100"]);
            expect(splitByCase("100%Complete")).toStrictEqual(["100", "%Complete"]);
            expect(splitByCase("#FF00FF")).toStrictEqual(["#FF00FF"]);
        });

        it("should handle mixed number formats", () => {
            expect.assertions(5);
            expect(splitByCase("ISO8601Format")).toStrictEqual(["ISO", "8601", "Format"]);
            expect(splitByCase("3DPrinter")).toStrictEqual(["3", "D", "Printer"]);
            expect(splitByCase("4KDisplay")).toStrictEqual(["4", "K", "Display"]);
            expect(splitByCase("Win32API")).toStrictEqual(["Win", "32", "API"]);
            expect(splitByCase("ES2015Features")).toStrictEqual(["ES", "2015", "Features"]);
        });

        it("should handle special formats with ANSI and emoji", () => {
            expect.assertions(6);
            expect(splitByCase("\u001B[31mVersion2.0\u001B[0m", { stripAnsi: true })).toStrictEqual(["Version", "2", "0"]);
            expect(splitByCase("\u001B[31mVersion2.0\u001B[0m", { handleAnsi: true })).toStrictEqual(["\u001B[31m", "Version", "2", "0", "\u001B[0m"]);

            expect(splitByCase("Version2.0✨", { stripEmoji: true })).toStrictEqual(["Version", "2", "0"]);
            expect(splitByCase("Version2.0✨", { handleEmoji: true })).toStrictEqual(["Version", "2", "0", "✨"]);

            expect(splitByCase("\u001B[31mVersion2.0✨\u001B[0m", { stripAnsi: true, stripEmoji: true })).toStrictEqual(["Version", "2", "0"]);
            expect(splitByCase("\u001B[31mVersion2.0✨\u001B[0m", { handleAnsi: true, handleEmoji: true })).toStrictEqual([
                "\u001B[31m",
                "Version",
                "2",
                "0",
                "✨",
                "\u001B[0m",
            ]);
        });
    });

    describe("normalize option", () => {
        it("should title-case all-upper tokens without a locale", () => {
            expect.assertions(2);
            expect(splitByCase("FOO_BAR", { normalize: true })).toStrictEqual(["Foo", "Bar"]);
            expect(splitByCase("API_KEY", { normalize: true })).toStrictEqual(["Api", "Key"]);
        });

        it("should preserve known acronyms when normalizing", () => {
            expect.assertions(1);
            expect(splitByCase("HTMLElement", { knownAcronyms: ["HTML"], normalize: true })).toStrictEqual(["HTML", "Element"]);
        });

        it("should title-case all-upper tokens with a locale", () => {
            expect.assertions(2);
            expect(splitByCase("FOO_BAR", { locale: "en", normalize: true })).toStrictEqual(["Foo", "Bar"]);
            expect(splitByCase("ПРИВЕТ_МИР", { locale: "ru", normalize: true })).toStrictEqual(["Привет", "Мир"]);
        });
    });

    describe("known acronyms in locale and fast paths", () => {
        it("should split a known acronym at the start of the fast (non-locale) path", () => {
            expect.assertions(2);
            expect(splitByCase("HTMLElement", { knownAcronyms: ["HTML"] })).toStrictEqual(["HTML", "Element"]);
            expect(splitByCase("getHTMLData", { knownAcronyms: ["HTML"] })).toStrictEqual(["get", "HTML", "Data"]);
        });

        it("should split a known acronym in the middle of the locale path", () => {
            expect.assertions(1);
            expect(splitByCase("getHTMLData", { knownAcronyms: ["HTML"], locale: "en" })).toStrictEqual(["get", "HTML", "Data"]);
        });
    });

    describe("exact cyrillic locale (case-sensitive script transitions)", () => {
        it("should split case transitions for bare cyrillic locale codes", () => {
            expect.assertions(3);
            expect(splitByCase("приветМир", { locale: "ru" })).toStrictEqual(["привет", "Мир"]);
            expect(splitByCase("прыветМир", { locale: "be" })).toStrictEqual(["прывет", "Мир"]);
            expect(splitByCase("здравоСвете", { locale: "sr" })).toStrictEqual(["здраво", "Свете"]);
        });
    });

    describe("exact rtl locale handling", () => {
        it("should split bare arabic and hebrew locale codes on script transitions", () => {
            expect.assertions(2);
            expect(splitByCase("مرحباWorld", { locale: "ar" })).toStrictEqual(["مرحبا", "World"]);
            expect(splitByCase("שלוםWorld", { locale: "he" })).toStrictEqual(["שלום", "World"]);
        });
    });

    describe("slovenian special characters", () => {
        it("should split before a special character followed by an uppercase letter", () => {
            expect.assertions(2);
            expect(splitByCase("najČSlovo", { locale: "sl" })).toStrictEqual(["naj", "Č", "Slovo"]);
            expect(splitByCase("nekiĐWord", { locale: "sl" })).toStrictEqual(["neki", "Đ", "Word"]);
        });
    });

    describe("greek multi-part handling", () => {
        it("should split mixed greek and latin runs", () => {
            expect.assertions(2);
            expect(splitByCase("αβγTestΔΕΖfoo", { locale: "el" })).toStrictEqual(["αβγ", "Test", "ΔΕΖ", "foo"]);
            expect(splitByCase("αβγΔ", { locale: "el" })).toStrictEqual(["αβγ", "Δ"]);
        });

        it("should keep a single non-greek or single-char greek part intact", () => {
            expect.assertions(2);
            expect(splitByCase("Test", { locale: "el" })).toStrictEqual(["Test"]);
            expect(splitByCase("Α", { locale: "el" })).toStrictEqual(["Α"]);
        });
    });

    describe("path traversal edge cases", () => {
        it("should handle trailing dot-dot and dot segments", () => {
            expect.assertions(2);
            expect(splitByCase("foo/..")).toStrictEqual(["foo"]);
            expect(splitByCase("foo/.")).toStrictEqual(["foo"]);
        });

        it("should handle leading dot-dot and dot only", () => {
            expect.assertions(4);
            expect(splitByCase("..")).toStrictEqual([".."]);
            expect(splitByCase(".")).toStrictEqual(["."]);
            expect(splitByCase("../foo")).toStrictEqual(["..", "foo"]);
            expect(splitByCase("./foo")).toStrictEqual([".", "foo"]);
        });

        it("should handle consecutive dot-dot and dot inside a path", () => {
            expect.assertions(2);
            expect(splitByCase("a/../../b")).toStrictEqual(["a", "..", "..", "b"]);
            expect(splitByCase("a/././b")).toStrictEqual(["a", ".", ".", "b"]);
        });
    });

    describe("custom separator regex caching", () => {
        it("should reuse the cached separator regex on repeated calls with the same separators", () => {
            expect.assertions(2);

            // First call builds and caches the regex for these separators.
            expect(splitByCase("a:b:c", { separators: [":"] })).toStrictEqual(["a", "b", "c"]);
            // Second identical call must hit the cached regex branch.
            expect(splitByCase("x:y:z", { separators: [":"] })).toStrictEqual(["x", "y", "z"]);
        });
    });

    describe("locale fast-return guards for non-script input", () => {
        it("should return digit-only input unchanged under the Greek locale", () => {
            expect.assertions(1);
            // No Greek and no Latin characters -> Greek branch returns the string untouched.
            expect(splitByCase("123", { locale: "el" })).toStrictEqual(["123"]);
        });

        it("should return digit-only input unchanged under a Cyrillic locale", () => {
            expect.assertions(1);
            // No Cyrillic and no Latin characters -> Cyrillic branch returns the string untouched.
            expect(splitByCase("123", { locale: "ru" })).toStrictEqual(["123"]);
        });

        it("should return a single Greek character unchanged under the Greek locale", () => {
            expect.assertions(1);
            expect(splitByCase("α", { locale: "el" })).toStrictEqual(["α"]);
        });
    });
});
