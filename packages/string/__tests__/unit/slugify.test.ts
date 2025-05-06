import { describe, expect, it } from "vitest";

import slugify, { type SlugifyOptions } from "../../src/slugify";

describe("slugify function", () => {
    it("should convert basic strings", () => {
        expect.assertions(2);
        expect(slugify("Hello World")).toBe("hello-world");
        expect(slugify("foo bar baz")).toBe("foo-bar-baz");
    });

    it("should handle accented characters via transliterate", () => {
        expect.assertions(3);
        expect(slugify("Crème Brûlée")).toBe("creme-brulee");
        expect(slugify("čeština ďábelská")).toBe("cestina-dabelska");
        expect(slugify("straße")).toBe("strasse");
    });

    it("should handle different whitespace characters (replaced by separator)", () => {
        expect.assertions(1);
        // Whitespace is not in default allowedChars, so it becomes a separator
        expect(slugify("foo\tbar\nbaz")).toBe("foo-bar-baz");
    });

    it("should handle leading/trailing whitespace (removed)", () => {
        expect.assertions(1);
        expect(slugify("  leading and trailing spaces  ")).toBe("leading-and-trailing-spaces");
    });

    it("should collapse multiple separators", () => {
        expect.assertions(2);
        expect(slugify("foo --- bar - baz")).toBe("foo-bar-baz");
        expect(slugify("disallowed###chars---become--separators")).toBe("disallowed-chars-become-separators");
    });

    it("should remove disallowed characters (replacing with separator)", () => {
        expect.assertions(3);
        expect(slugify("foo!bar?baz#")).toBe("foo-bar-baz"); // !, ?, # not in allowedChars
        expect(slugify("keep $ * _ + ~ . ( ) ' \" ! : @")).toBe("keep-_-~-."); // Only - is allowed by default
        expect(slugify("email@domain.com")).toBe("email-domain.com"); // @ replaced, . kept
    });

    it("should handle leading/trailing separators", () => {
        expect.assertions(3);
        expect(slugify("- foo - bar -")).toBe("foo-bar");
        expect(slugify("__foo__bar__", { separator: "_", allowedChars: "a-z_" })).toBe("foo_bar");
        expect(slugify("--foo--bar--")).toBe("foo-bar");
    });

    it("should handle edge cases", () => {
        expect.assertions(3);
        expect(slugify("")).toBe("");
        expect(slugify("-------")).toBe("");
        expect(slugify("!@#$%^")).toBe(""); // All disallowed
    });

    it("should respect the lowercase option", () => {
        expect.assertions(2);
        expect(slugify("Hello World", { lowercase: true, uppercase: false })).toBe("hello-world");
        expect(slugify("Hello World", { lowercase: true, uppercase: true })).toBe("hello-world"); // lowercase wins if both true
    });

    it("should respect the uppercase option", () => {
        expect.assertions(2);
        expect(slugify("Hello World", { lowercase: false, uppercase: true })).toBe("HELLO-WORLD");
        expect(slugify("hello world", { lowercase: false, uppercase: true })).toBe("HELLO-WORLD");
    });

    it("should respect the separator option", () => {
        expect.assertions(3);
        // Ensure separator is included in allowedChars if needed
        expect(slugify("Hello World", { separator: "_", allowedChars: "a-zA-Z0-9_" })).toBe("hello_world");
        expect(slugify("foo bar baz", { separator: "~", allowedChars: "a-zA-Z0-9~" })).toBe("foo~bar~baz");
        expect(slugify("multiple--separators", { separator: "-", allowedChars: "a-zA-Z-" })).toBe("multiple-separators");
    });

    it("should respect the allowedChars option", () => {
        expect.assertions(3);
        // Only allow letters
        expect(slugify("Foo 123 Bar!", { allowedChars: "a-zA-Z" })).toBe("foo-bar");
        // Allow letters and numbers
        expect(slugify("Foo 123 Bar!", { allowedChars: "a-zA-Z0-9" })).toBe("foo-123-bar");
        // Allow specific chars including separator
        expect(slugify("keep.!@#$-this", { allowedChars: "a-z.!-" })).toBe("keep.!.-this");
    });

    it("should respect fixChineseSpacing option", () => {
        expect.assertions(2);
        expect(slugify("你好世界", { fixChineseSpacing: true })).toBe("ni-hao-shi-jie");
        expect(slugify("你好世界", { fixChineseSpacing: false })).toBe("nihaoshijie");
    });

    // Tests passing transliterate options through
    it("should respect transliterate ignore option", () => {
        expect.assertions(1);
        expect(slugify("Ignore Cœur but not cœur", { ignore: ["Cœur"] })).toBe("ignore-coeur-but-not-coeur");
    });

    it("should respect transliterate replaceBefore option", () => {
        expect.assertions(1);
        expect(slugify("Keep C++ & C#", { replaceBefore: { "C++": "cpp", "C#": "csharp" } })).toBe("keep-cpp-csharp");
    });

    it("should respect transliterate replaceAfter option", () => {
        expect.assertions(1);
        // Transliterate café -> cafe, then replaceAfter e -> é, then slugify replaces é -> e
        expect(slugify("café", { replaceAfter: { e: "é" } })).toBe("cafe");
    });

    it("should respect transliterate unknown option", () => {
        expect.assertions(1);
        expect(slugify("a🚀b", { unknown: "UNK" })).toBe("aunkb"); // 🚀 -> UNK -> unk
    });

    // Add the new it.each block here
    describe("additional mixed tests", () => {
        const tests: [string, SlugifyOptions | undefined, string][] = [
            ["你好, 世界!", {}, "ni-hao-shi-jie"],
            ["你好, 世界!", undefined, "ni-hao-shi-jie"],
            // Note: separator must be in allowedChars for this to work as expected
            ["你好, 世界!", { separator: "_", allowedChars: "a-z_" }, "ni_hao_shi_jie"],
            ["你好, 世界!", { lowercase: false }, "Ni-Hao-Shi-Jie"],
            ["你好, 世界!", { uppercase: true, lowercase: false }, "NI-HAO-SHI-JIE"],
            // ignore is passed to transliterate
            ["你好, 世界!", { ignore: ["!", ","] }, "ni-hao-shi-jie"],
            // replaceBefore is passed to transliterate
            ["你好, 世界!", { replaceBefore: [["世界", "未来"]] }, "ni-hao-wei-lai"],
            [
                "你好, 世界!",
                {
                    replaceBefore: [
                        ["你好", "Hello"],
                        ["世界", "World"],
                    ],
                },
                "hello-world",
            ],
            [
                "你好, 世界!",
                {
                    separator: ", ", // Separator needs escaping and might be complex with allowedChars
                    allowedChars: "a-zA-Z, !", // Must allow comma and space
                    replaceBefore: [
                        ["你好", "Hola"],
                        ["世界", "mundo"],
                    ],
                    ignore: ["¡", "!"], // ignore passed to transliterate
                    lowercase: false,
                    fixChineseSpacing: false, // Prevent Ni Hao -> Ni-Hao
                },
                "Hola, mundo", // Final slug removes trailing !
            ],
            // Duplicates from original data - kept for consistency
            ["你好, 世界!", {}, "ni-hao-shi-jie"],
            ["你好, 世界!", { separator: "_", allowedChars: "a-z_" }, "ni_hao_shi_jie"],
            ["你好, 世界!", { lowercase: false }, "Ni-Hao-Shi-Jie"],
            ["你好, 世界!", { ignore: ["!", ","] }, "ni-hao-shi-jie"],
            ["你好, 世界!", { replaceBefore: [["世界", "未来"]] }, "ni-hao-wei-lai"],
            [
                "你好, 世界!",
                {
                    replaceBefore: [
                        ["你好", "Hello "], // Note trailing space
                        ["世界", "World "], // Note trailing space
                    ],
                },
                "hello-world", // Slugify removes trailing space -> separator, then trims
            ],
            [
                "你好, 世界!",
                {
                    separator: ", ",
                    allowedChars: "a-zA-Z, !",
                    replaceBefore: [
                        ["你好", "Hola"],
                        ["世界", "mundo"],
                    ],
                    ignore: ["¡", "!"],
                    lowercase: false,
                    fixChineseSpacing: false,
                },
                "Hola, mundo",
            ],
        ];

        // Use it.each for the provided tests
        it.each(tests)("should correctly slugify '%s' with options %o to '%s'", (input, options, expected) => {
            expect.assertions(1);
            expect(slugify(input, options)).toBe(expected);
        });
    });
});
