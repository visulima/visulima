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
});
