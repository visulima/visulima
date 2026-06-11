import { describe, expect, it } from "vitest";

import { stripHtml } from "../../src/index";

describe(stripHtml, () => {
    describe("basic stripping", () => {
        it("should strip HTML tags from string", () => {
            expect.assertions(1);

            const result = stripHtml("Some text <b>and</b> text.");

            expect(result.result).toBe("Some text and text.");
        });

        it("should prevent accidental string concatenation", () => {
            expect.assertions(1);

            const result = stripHtml("aaa<div>bbb</div>ccc");

            expect(result.result).toBe("aaa bbb ccc");
        });

        it("should handle empty string", () => {
            expect.assertions(1);

            const result = stripHtml("");

            expect(result.result).toBe("");
        });

        it("should handle string with only HTML tags", () => {
            expect.assertions(1);

            const result = stripHtml("<div><span></span></div>");

            expect(result.result).toBe("");
        });

        it("should handle string with no HTML tags", () => {
            expect.assertions(1);

            const result = stripHtml("Plain text without tags");

            expect(result.result).toBe("Plain text without tags");
        });
    });

    describe("tag pairs with content", () => {
        it("should strip tags together with their contents when configured", () => {
            expect.assertions(1);

            const result = stripHtml("a <pre><code>void a;</code></pre> b", {
                stripTogetherWithTheirContents: ["script", "style", "xml", "pre"],
            });

            expect(result.result).toBe("a b");
        });

        it("should strip script tags with content by default", () => {
            expect.assertions(1);

            const result = stripHtml("Text <script>alert('xss')</script> more text");

            expect(result.result).toBe("Text more text");
        });

        it("should strip style tags with content by default", () => {
            expect.assertions(1);

            const result = stripHtml("Text <style>body { color: red; }</style> more text");

            expect(result.result).toBe("Text more text");
        });
    });

    describe("raw brackets detection", () => {
        it("should detect raw, legit brackets and not strip them", () => {
            expect.assertions(1);

            const result = stripHtml("a < b and c > d");

            expect(result.result).toBe("a < b and c > d");
        });

        it("should handle comparison operators in text", () => {
            expect.assertions(1);

            const result = stripHtml("5 < 10 and 20 > 15");

            expect(result.result).toBe("5 < 10 and 20 > 15");
        });

        it("should handle mixed HTML tags and comparison operators", () => {
            expect.assertions(1);

            const result = stripHtml("Value <b>5</b> < 10");

            expect(result.result).toBe("Value 5 < 10");
        });
    });

    describe("edge cases", () => {
        it("should handle nested HTML tags", () => {
            expect.assertions(1);

            const result = stripHtml("<div><p>Text <b>bold</b></p></div>");

            expect(result.result).toBe("Text bold");
        });

        it("should handle self-closing tags", () => {
            expect.assertions(1);

            const result = stripHtml("Line 1<br/>Line 2<br />Line 3");

            expect(result.result).toBe("Line 1 Line 2 Line 3");
        });

        it("should handle HTML with attributes", () => {
            expect.assertions(1);

            const result = stripHtml('<div class="container">Content</div>');

            expect(result.result).toBe("Content");
        });

        it("should handle malformed HTML", () => {
            expect.assertions(1);

            const result = stripHtml("<div>Text</span>More text");

            expect(result.result).toBe("TextMore text");
        });

        it("should handle HTML entities in text", () => {
            expect.assertions(1);

            const result = stripHtml("<p>Hello &amp; World</p>");

            expect(result.result).toBe("Hello & World");
        });

        it("should handle whitespace between tags", () => {
            expect.assertions(1);

            const result = stripHtml("<div>  Text  </div>");

            expect(result.result.trim()).toBe("Text");
        });
    });
});
