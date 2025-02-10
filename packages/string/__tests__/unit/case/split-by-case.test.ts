import { describe, expect, it } from "vitest";

import { splitByCase } from "../../../src/case";

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
        it("should handle Turkish specific cases", () => {
            const locale = "tr-TR";
            expect(splitByCase("İstanbulCity", { locale })).toEqual(["İstanbul", "City"]);
            expect(splitByCase("izmirŞehir", { locale })).toEqual(["izmir", "Şehir"]);
            expect(splitByCase("türkçeTest", { locale })).toEqual(["türkçe", "Test"]);
        });

        it("should handle German specific cases", () => {
            const locale = "de-DE";
            expect(splitByCase("GROSSE STRAßE", { locale })).toEqual(["GROSSE", "STRAßE"]);
            expect(splitByCase("straßeTest", { locale })).toEqual(["straße", "Test"]);
            expect(splitByCase("großeHaus", { locale })).toEqual(["große", "Haus"]);
            expect(splitByCase("äußereForm", { locale })).toEqual(["äußere", "Form"]);
        });
    });

    describe("aNSI escape codes", () => {
        it("should handle ANSI escape codes", () => {
            expect(splitByCase("\u001B[31mRedText\u001B[0m")).toEqual(["\u001B[31m", "Red", "Text", "\u001B[0m"]);
            expect(splitByCase("\u001B[1mBoldText\u001B[0m")).toEqual(["\u001B[1m", "Bold", "Text", "\u001B[0m"]);
            expect(splitByCase("\u001B[32mGreenFOO\u001B[0m_\u001B[34mBlueBAR\u001B[0m")).toEqual([
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

        it("should handle ANSI escape codes with numbers", () => {
            expect(splitByCase("\u001B[31mError404Found\u001B[0m")).toEqual(["\u001B[31m", "Error", "404", "Found", "\u001B[0m"]);
            expect(splitByCase("\u001B[33mWarning2xx\u001B[0m")).toEqual(["\u001B[33m", "Warning", "2", "xx", "\u001B[0m"]);
        });
    });

    describe("emoji support", () => {
        it("should handle emojis in text", () => {
            expect(splitByCase("hello🌍World")).toEqual(["hello", "🌍", "World"]);
            expect(splitByCase("test🎉Party🎈Fun")).toEqual(["test", "🎉", "Party", "🎈", "Fun"]);
            expect(splitByCase("EMOJI👾Gaming")).toEqual(["EMOJI", "👾", "Gaming"]);
        });

        it("should handle emojis with numbers and special characters", () => {
            expect(splitByCase("iOS15.4📱Update")).toEqual(["i", "OS", "15", "4", "📱", "Update"]);
            expect(splitByCase("version2.0✨Release")).toEqual(["version", "2", "0", "✨", "Release"]);
            expect(splitByCase("error❌404Page")).toEqual(["error", "❌", "404", "Page"]);
        });

        it("should handle multiple consecutive emojis", () => {
            expect(splitByCase("weather🌞🌤️🌧️Forecast")).toEqual(["weather", "🌞", "🌤️", "🌧️", "Forecast"]);
            expect(splitByCase("reaction👍👎Rating")).toEqual(["reaction", "👍", "👎", "Rating"]);
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
            expect(splitByCase("email@domain.com")).toEqual(["email@domain", "com"]);
            expect(splitByCase("user+alias@email.com")).toEqual(["user+alias@email", "com"]);
            expect(splitByCase("$specialPrice100")).toEqual(["$special", "Price", "100"]);
            expect(splitByCase("100%Complete")).toEqual(["100%Complete"]);
            expect(splitByCase("#FF00FF")).toEqual(["#FF", "00", "FF"]);
        });

        it("should handle mixed number formats", () => {
            expect(splitByCase("ISO8601Format")).toEqual(["ISO", "8601", "Format"]);
            expect(splitByCase("3DPrinter")).toEqual(["3", "D", "Printer"]);
            expect(splitByCase("4KDisplay")).toEqual(["4", "K", "Display"]);
            expect(splitByCase("Win32API")).toEqual(["Win", "32", "API"]);
            expect(splitByCase("ES2015Features")).toEqual(["ES", "2015", "Features"]);
        });
    });
});
