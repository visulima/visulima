import { describe, expect, it } from "vitest";

import { disposeHighlighter, isLanguageSupported, resolveLanguage } from "../../src/ink/highlighter";

describe("highlighter", () => {
    describe(resolveLanguage, () => {
        it("should resolve common aliases", () => {
            expect.assertions(8);

            expect(resolveLanguage("js")).toBe("javascript");
            expect(resolveLanguage("ts")).toBe("typescript");
            expect(resolveLanguage("py")).toBe("python");
            expect(resolveLanguage("rb")).toBe("ruby");
            expect(resolveLanguage("rs")).toBe("rust");
            expect(resolveLanguage("sh")).toBe("bash");
            expect(resolveLanguage("yml")).toBe("yaml");
            expect(resolveLanguage("md")).toBe("markdown");
        });

        it("should be case-insensitive", () => {
            expect.assertions(2);

            expect(resolveLanguage("JS")).toBe("javascript");
            expect(resolveLanguage("TypeScript")).toBe("typescript");
        });

        it("should pass through unknown names", () => {
            expect.assertions(2);

            expect(resolveLanguage("rust")).toBe("rust");
            expect(resolveLanguage("unknown")).toBe("unknown");
        });

        it("should resolve docker alias", () => {
            expect.assertions(1);

            expect(resolveLanguage("docker")).toBe("dockerfile");
        });

        it("should resolve C++ aliases", () => {
            expect.assertions(2);

            expect(resolveLanguage("c++")).toBe("cpp");
            expect(resolveLanguage("c#")).toBe("csharp");
        });
    });

    describe(isLanguageSupported, () => {
        it("should recognize supported languages", () => {
            expect.assertions(7);

            expect(isLanguageSupported("javascript")).toBe(true);
            expect(isLanguageSupported("typescript")).toBe(true);
            expect(isLanguageSupported("python")).toBe(true);
            expect(isLanguageSupported("rust")).toBe(true);
            expect(isLanguageSupported("go")).toBe(true);
            expect(isLanguageSupported("html")).toBe(true);
            expect(isLanguageSupported("css")).toBe(true);
        });

        it("should recognize aliases", () => {
            expect.assertions(3);

            expect(isLanguageSupported("js")).toBe(true);
            expect(isLanguageSupported("ts")).toBe(true);
            expect(isLanguageSupported("py")).toBe(true);
        });

        it("should reject unknown languages", () => {
            expect.assertions(2);

            expect(isLanguageSupported("brainfuck")).toBe(false);
            expect(isLanguageSupported("nonexistent")).toBe(false);
        });

        it("should recognize new languages", () => {
            expect.assertions(8);

            expect(isLanguageSupported("c")).toBe(true);
            expect(isLanguageSupported("cpp")).toBe(true);
            expect(isLanguageSupported("php")).toBe(true);
            expect(isLanguageSupported("swift")).toBe(true);
            expect(isLanguageSupported("kotlin")).toBe(true);
            expect(isLanguageSupported("zig")).toBe(true);
            expect(isLanguageSupported("lua")).toBe(true);
            expect(isLanguageSupported("dockerfile")).toBe(true);
        });
    });

    describe(disposeHighlighter, () => {
        it("should not throw when called without initialization", () => {
            expect.assertions(1);

            expect(() => {
                disposeHighlighter();
            }).not.toThrow();
        });

        it("should not throw when called multiple times", () => {
            expect.assertions(1);

            disposeHighlighter();

            expect(() => {
                disposeHighlighter();
            }).not.toThrow();
        });
    });
});
