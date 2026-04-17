import { describe, expect, it } from "vitest";

import { excerpt } from "../../src/excerpt";

describe(excerpt, () => {
    describe("basic functionality", () => {
        it("should strip HTML tags and truncate", () => {
            expect.assertions(3);

            expect(excerpt("<p>Hello world</p>", 11)).toBe("Hello world");
            expect(excerpt("<p>Hello <strong>world</strong>!</p>", 10)).toBe("Hello wor…");
            expect(excerpt("<div>This is a <em>long</em> text</div>", 20)).toBe("This is a long text");
        });

        it("should handle self-closing tags", () => {
            expect.assertions(2);

            expect(excerpt("Hello<br/>world", 11)).toBe("Hello world");
            expect(excerpt("Text<br>with<br/>breaks", 20)).toBe("Text with breaks");
        });

        it("should handle HTML entities", () => {
            expect.assertions(3);

            // &nbsp; is decoded to a non-breaking space character (U+00A0), not a regular space
            expect(excerpt("Hello&nbsp;world", 11)).toBe("Hello\u00A0world");
            expect(excerpt("A &amp; B", 5)).toBe("A & B");
            // &lt;tag&gt; decodes to <tag>, which string-strip-html then strips as an HTML tag
            expect(excerpt("&lt;tag&gt;", 7)).toBe("");
        });

        it("should remove HTML comments", () => {
            expect.assertions(1);

            expect(excerpt("Hello<!-- comment -->world", 11)).toBe("Hello world");
        });

        it("should handle block-level tags", () => {
            expect.assertions(2);

            expect(excerpt("<p>First</p><p>Second</p>", 12)).toBe("First Second");
            expect(excerpt("<div>Content</div>", 7)).toBe("Content");
        });
    });

    describe("truncation", () => {
        it("should truncate at the end by default", () => {
            expect.assertions(3);

            expect(excerpt("<p>This is a very long text</p>", 10)).toBe("This is a…");
            expect(excerpt("<div>Short</div>", 10)).toBe("Short");
            expect(excerpt("<p>Exactly ten</p>", 10)).toBe("Exactly t…");
        });

        it("should handle custom ellipsis", () => {
            expect.assertions(2);

            expect(excerpt("<p>Hello world</p>", 5, { ellipsis: "..." })).toBe("He...");
            expect(excerpt("<div>Long text here</div>", 10, { ellipsis: " →" })).toBe("Long te →");
        });

        it("should handle empty or zero limit", () => {
            expect.assertions(3);

            expect(excerpt("<p>Hello</p>", 0)).toBe("");
            expect(excerpt("<p>Hello</p>", -1)).toBe("");
            expect(excerpt("", 10)).toBe("");
        });
    });

    describe("edge cases", () => {
        it("should handle nested HTML tags", () => {
            expect.assertions(2);

            expect(excerpt("<div><p><strong>Nested</strong> content</p></div>", 15)).toBe("Nested content");
            expect(excerpt("<span><em>Text</em> here</span>", 10)).toBe("Text here");
        });

        it("should handle tags with attributes", () => {
            expect.assertions(2);

            expect(excerpt("<p class=\"test\">Content</p>", 7)).toBe("Content");
            expect(excerpt("<div id=\"main\" data-value=\"123\">Text</div>", 4)).toBe("Text");
        });

        it("should preserve whitespace", () => {
            expect.assertions(2);

            // string-strip-html preserves whitespace as-is, it doesn't normalize it
            // "Multiple   spaces" is 17 characters, so with limit 16 it gets truncated
            expect(excerpt("<p>Multiple   spaces</p>", 16)).toBe("Multiple   spac…");
            expect(excerpt("<div>Line\n\nbreaks</div>", 12)).toBe("Line\n\nbreaks");
        });

        it("should handle malformed HTML", () => {
            expect.assertions(2);

            expect(excerpt("<p>Unclosed tag", 13)).toBe("Unclosed tag");
            // string-strip-html only strips valid HTML tags, standalone '>' is preserved
            expect(excerpt(">Starts with closing", 17)).toBe(">Starts with clo…");
        });

        it("should handle mixed content", () => {
            expect.assertions(1);

            expect(excerpt("Plain text <strong>with</strong> HTML", 20)).toBe("Plain text with HTML");
        });
    });

    describe("error handling", () => {
        it("should throw TypeError for invalid input", () => {
            expect.assertions(2);

            expect(() => {
                // @ts-expect-error - Testing invalid input
                excerpt(null, 10);
            }).toThrow(TypeError);

            expect(() => {
                // @ts-expect-error - Testing invalid input
                excerpt("<p>test</p>", "10");
            }).toThrow(TypeError);
        });
    });
});
