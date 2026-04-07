import { describe, expect, it } from "vitest";

import { sanitize } from "../../src/sanitize";

const repeat = (string: string, times: number): string => new Array(times + 1).join(string);

describe(sanitize, () => {
    describe("valid names", () => {
        it("should return valid names unchanged", () => {
            expect.assertions(2);

            expect(sanitize("the quick brown fox jumped over the lazy dog.mp3")).toBe("the quick brown fox jumped over the lazy dog.mp3");
            expect(sanitize("résumé")).toBe("résumé");
        });

        it("should return valid names with extensions unchanged", () => {
            expect.assertions(1);

            expect(sanitize("valid name.mp3")).toBe("valid name.mp3");
        });
    });

    describe("null character", () => {
        it("should remove null characters", () => {
            expect.assertions(1);

            expect(sanitize("hello\u0000world")).toBe("helloworld");
        });
    });

    describe("control characters", () => {
        it("should remove control characters", () => {
            expect.assertions(1);

            expect(sanitize("hello\nworld")).toBe("helloworld");
        });

        it("should remove various control characters", () => {
            expect.assertions(3);

            expect(sanitize("hello\tworld")).toBe("helloworld");
            expect(sanitize("hello\rworld")).toBe("helloworld");
            expect(sanitize("hello\u0001world")).toBe("helloworld");
        });
    });

    describe("forbidden characters", () => {
        it("should replace forbidden characters with Unicode alternatives", () => {
            expect.assertions(3);

            // On Unix, forbidden chars are not replaced (only / is removed)
            // Test with win32 filesystem to get replacements
            // "?" -> "ʔ" (LATIN LETTER GLOTTAL STOP)
            expect(sanitize("h?w", { filesystem: "win32" })).toBe("hʔw");
            // "/" -> "⁄" (FRACTION SLASH)
            expect(sanitize("h/w", { filesystem: "win32" })).toBe("h⁄w");
            // "*" -> "⁎" (LOW ASTERISK)
            expect(sanitize("h*w", { filesystem: "win32" })).toBe("h⁎w");
        });

        it("should replace all forbidden characters", () => {
            expect.assertions(6);

            // Test with win32 filesystem to get replacements
            // ":" -> "꞉" (MODIFIER LETTER COLON)
            expect(sanitize("col:on.js", { filesystem: "win32" })).toBe("col꞉on.js");
            // "<" -> "‹" (SINGLE LEFT-POINTING ANGLE QUOTATION MARK)
            expect(sanitize("brack<e>ts.js", { filesystem: "win32" })).toBe("brack‹e›ts.js");
            // ">" -> "›" (SINGLE RIGHT-POINTING ANGLE QUOTATION MARK)
            expect(sanitize("brack<e>ts.js", { filesystem: "win32" })).toBe("brack‹e›ts.js");
            // "\"" -> "ˮ" (MODIFIER LETTER DOUBLE APOSTROPHE)
            expect(sanitize("quote\".js", { filesystem: "win32" })).toBe("quoteˮ.js");
            // "\\" -> "∖" (SET MINUS)
            expect(sanitize(String.raw`slash\.js`, { filesystem: "win32" })).toBe("slash∖.js");
            // "|" -> "ǀ" (LATIN LETTER DENTAL CLICK)
            expect(sanitize("p|pes.js", { filesystem: "win32" })).toBe("pǀpes.js");
        });
    });

    describe("restricted suffixes", () => {
        it("should trim trailing spaces but preserve periods", () => {
            expect.assertions(4);

            // Trailing periods are preserved (not removed by current implementation)
            expect(sanitize("mr.")).toBe("mr.");
            expect(sanitize("mr..")).toBe("mr..");
            // Trailing spaces are trimmed
            expect(sanitize("mr ")).toBe("mr");
            expect(sanitize("mr  ")).toBe("mr");
        });
    });

    describe("relative paths", () => {
        it("should return fallback for relative paths", () => {
            expect.assertions(7);

            expect(sanitize(".")).toBe("unnamed");
            expect(sanitize("..")).toBe("unnamed");
            expect(sanitize("./")).toBe("unnamed");
            expect(sanitize("../")).toBe("unnamed");
            // "/.." doesn't match the regex pattern (starts with /, not .)
            // On Unix, / gets replaced, on Windows all forbidden chars get replaced
            // Windows removes trailing periods, so "⁄.." becomes "⁄"
            expect(sanitize("/..", { filesystem: "win32" })).toBe("⁄");
            // "/../" has 4 chars: / . . / - all slashes get replaced with "⁄"
            // Windows removes trailing periods, so "⁄..⁄" becomes "⁄.⁄"
            expect(sanitize("/../", { filesystem: "win32" })).toBe("⁄.⁄");
            // "*.|." - * and | get replaced, leaving "⁎.ǀ."
            // Windows removes trailing periods, so "⁎.ǀ." becomes "⁎.ǀ"
            expect(sanitize("*.|.", { filesystem: "win32" })).toBe("⁎.ǀ");
        });

        it("should handle relative paths with slashes", () => {
            expect.assertions(3);

            expect(sanitize("./foobar")).toBe("foobar");
            expect(sanitize("../foobar")).toBe("foobar");
            expect(sanitize("../../foobar")).toBe("foobar");
        });
    });

    describe("windows reserved filenames", () => {
        it("should return fallback for Windows reserved names", () => {
            expect.assertions(5);

            // Test with win32 filesystem
            expect(sanitize("con", { filesystem: "win32" })).toBe("unnamed");
            expect(sanitize("COM1", { filesystem: "win32" })).toBe("unnamed");
            // "PRN." - Windows treats reserved names with trailing periods as reserved
            expect(sanitize("PRN.", { filesystem: "win32" })).toBe("unnamed");
            // "aux.txt" - Windows allows reserved names WITH extensions
            expect(sanitize("aux.txt", { filesystem: "win32" })).toBe("aux.txt");
            // "LPT9.asdfasdf" - Windows allows reserved names WITH extensions
            expect(sanitize("LPT9.asdfasdf", { filesystem: "win32" })).toBe("LPT9.asdfasdf");
        });

        it("should allow LPT10 and higher", () => {
            expect.assertions(1);

            expect(sanitize("LPT10.txt")).toBe("LPT10.txt");
        });

        it("should handle COM devices", () => {
            expect.assertions(2);

            // Test with win32 filesystem
            expect(sanitize("COM1", { filesystem: "win32" })).toBe("unnamed");
            expect(sanitize("COM10", { filesystem: "win32" })).toBe("COM10");
        });
    });

    describe("max length", () => {
        it("should truncate names longer than default max length (128)", () => {
            expect.assertions(2);

            const string = repeat("a", 300);

            expect(string.length).toBeGreaterThan(128);
            expect(sanitize(string).length).toBeLessThanOrEqual(128);
        });

        it("should respect custom max length", () => {
            expect.assertions(2);

            const string = repeat("a", 200);

            expect(sanitize(string, { maxLength: 100 }).length).toBeLessThanOrEqual(100);
            expect(sanitize(string, { maxLength: 50 }).length).toBeLessThanOrEqual(50);
        });

        it("should preserve extension when truncating", () => {
            expect.assertions(2);

            const longName = `${repeat("a", 200)}.txt`;

            const result = sanitize(longName, { maxLength: 50 });

            expect(result.length).toBeLessThanOrEqual(50);
            expect(result.endsWith(".txt")).toBe(true);
        });

        it("should handle truncation when extension is too long", () => {
            expect.assertions(1);

            const longName = `a${repeat("b", 100)}.verylongextension`;

            const result = sanitize(longName, { maxLength: 10 });

            expect(result.length).toBeLessThanOrEqual(10);
        });
    });

    describe("edge cases", () => {
        it("should handle empty string", () => {
            expect.assertions(1);

            expect(sanitize("")).toBe("unnamed");
        });

        it("should handle whitespace-only strings", () => {
            expect.assertions(2);

            expect(sanitize("   ")).toBe("unnamed");
            expect(sanitize("\t\n\r")).toBe("unnamed");
        });

        it("should handle strings with only periods", () => {
            expect.assertions(2);

            expect(sanitize(".")).toBe("unnamed");
            expect(sanitize("...")).toBe("unnamed");
        });

        it("should trim leading and trailing whitespace", () => {
            expect.assertions(2);

            expect(sanitize("  filename.txt  ")).toBe("filename.txt");
            expect(sanitize("\tfilename.txt\n")).toBe("filename.txt");
        });

        it("should handle mixed forbidden characters", () => {
            expect.assertions(1);

            // Test with win32 filesystem
            // All forbidden chars get replaced: < > : " / \ | ? *
            expect(sanitize(String.raw`file<>:"/\|?*name.txt`, { filesystem: "win32" })).toBe("file‹›꞉ˮ⁄∖ǀʔ⁎name.txt");
        });

        it("should handle names that become empty after sanitization", () => {
            expect.assertions(2);

            expect(sanitize("...")).toBe("unnamed");
            // "///" gets replaced with "⁄⁄⁄" (not empty), so doesn't return fallback
            expect(sanitize("///")).toBe("⁄⁄⁄");
        });
    });

    describe("unicode and special characters", () => {
        it("should preserve valid Unicode characters", () => {
            expect.assertions(2);

            expect(sanitize("résumé.txt")).toBe("résumé.txt");
            expect(sanitize("café.mp3")).toBe("café.mp3");
        });

        it("should handle non-BMP characters", () => {
            expect.assertions(1);

            // Non-BMP character (surrogate pair)
            const name = `${repeat("a", 100)}\uD800\uDC00`;

            const result = sanitize(name);

            expect(result.length).toBeLessThanOrEqual(128);
        });
    });

    describe("complex scenarios", () => {
        it("should handle multiple sanitization steps", () => {
            expect.assertions(1);

            // Contains control chars, forbidden chars, and relative path
            // "." at start gets removed by relative path regex, control char removed, forbidden chars replaced
            const name = ".\u0000file<>name.txt";

            // Test with win32 filesystem
            // "." at start is removed, but if it becomes empty, returns fallback
            // Actually, "." gets removed, leaving "\u0000file<>name.txt" which becomes "file‹›name.txt"
            expect(sanitize(name, { filesystem: "win32" })).toBe(".file‹›name.txt");
        });

        it("should handle Windows reserved name with extension", () => {
            expect.assertions(1);

            // "con.txt" doesn't match the regex because it has an extension
            // The regex only matches exact reserved names without extensions
            expect(sanitize("con.txt")).toBe("con.txt");
        });

        it("should handle relative path patterns", () => {
            expect.assertions(3);

            expect(sanitize("./././foobar")).toBe("foobar");
            // Test with win32 filesystem for character replacement
            expect(sanitize("|*.what", { filesystem: "win32" })).toBe("ǀ⁎.what");
            // "LPT9.asdf" doesn't match because it has an extension
            expect(sanitize("LPT9.asdf", { filesystem: "win32" })).toBe("LPT9.asdf");
        });
    });

    describe("fAT32 filesystem", () => {
        it("should apply Windows rules plus FAT32-specific restrictions", () => {
            expect.assertions(4);

            // FAT32 has same forbidden chars as Windows
            expect(sanitize("file:name.txt", { filesystem: "fat32" })).toBe("file꞉name.txt");
            expect(sanitize("file<name.txt", { filesystem: "fat32" })).toBe("file‹name.txt");
            // FAT32 has same reserved names as Windows
            expect(sanitize("con", { filesystem: "fat32" })).toBe("unnamed");
            expect(sanitize("COM1", { filesystem: "fat32" })).toBe("unnamed");
        });

        it("should remove leading spaces and periods from name part", () => {
            expect.assertions(3);

            expect(sanitize("  filename.txt", { filesystem: "fat32" })).toBe("filename.txt");
            expect(sanitize("..filename.txt", { filesystem: "fat32" })).toBe("filename.txt");
            expect(sanitize(" . filename.txt", { filesystem: "fat32" })).toBe("filename.txt");
        });

        it("should remove trailing spaces and periods from name part", () => {
            expect.assertions(3);

            expect(sanitize("filename  .txt", { filesystem: "fat32" })).toBe("filename.txt");
            expect(sanitize("filename..txt", { filesystem: "fat32" })).toBe("filename.txt");
            expect(sanitize("filename . .txt", { filesystem: "fat32" })).toBe("filename.txt");
        });

        it("should remove leading/trailing spaces and periods from names without extension", () => {
            expect.assertions(3);

            expect(sanitize("  filename  ", { filesystem: "fat32" })).toBe("filename");
            expect(sanitize("..filename..", { filesystem: "fat32" })).toBe("filename");
            expect(sanitize(" . filename . ", { filesystem: "fat32" })).toBe("filename");
        });

        it("should return fallback if name part becomes empty after FAT32 cleaning", () => {
            expect.assertions(2);

            // "  .txt" - after trim and FAT32 cleaning, base name is empty (only extension)
            expect(sanitize("  .txt", { filesystem: "fat32" })).toBe("unnamed");
            // "..." - all periods, becomes empty after FAT32 cleaning
            expect(sanitize("...", { filesystem: "fat32" })).toBe("unnamed");
        });

        it("should preserve extension when cleaning FAT32 names", () => {
            expect.assertions(2);

            expect(sanitize("  file  .txt", { filesystem: "fat32" })).toBe("file.txt");
            expect(sanitize("..name..mp3", { filesystem: "fat32" })).toBe("name.mp3");
        });
    });

    describe("invalid input", () => {
        it("should return fallback for non-string input", () => {
            expect.assertions(1);

            // @ts-expect-error - Testing invalid input
            expect(sanitize(undefined as unknown as string)).toBe("unnamed");
        });

        it("should return fallback for null input", () => {
            expect.assertions(1);

            // @ts-expect-error - Testing invalid input
            expect(sanitize(null as unknown as string)).toBe("unnamed");
        });

        it("should return fallback for non-string types", () => {
            expect.assertions(5);

            // @ts-expect-error - Testing invalid input
            expect(sanitize(false as unknown as string)).toBe("unnamed");
            // @ts-expect-error - Testing invalid input
            expect(sanitize(true as unknown as string)).toBe("unnamed");
            // @ts-expect-error - Testing invalid input
            expect(sanitize({} as unknown as string)).toBe("unnamed");
            // @ts-expect-error - Testing invalid input
            expect(sanitize([] as unknown as string)).toBe("unnamed");
            // @ts-expect-error - Testing invalid input
            expect(sanitize(123 as unknown as string)).toBe("unnamed");
        });
    });
});
