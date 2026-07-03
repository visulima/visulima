import { describe, expect, it } from "vitest";

import escapeHtml from "../../src/escape-html";

describe(escapeHtml, () => {
    describe("content escaping", () => {
        it("should escape HTML special characters in content", () => {
            expect.assertions(1);

            const result = escapeHtml("<script>alert(\"xss\")</script>");

            expect(result).toBe("&lt;script>alert(\"xss\")&lt;/script>");
        });

        it("should escape ampersand in content", () => {
            expect.assertions(1);

            const result = escapeHtml("Hello & World");

            expect(result).toBe("Hello &amp; World");
        });

        it("should escape less-than in content", () => {
            expect.assertions(1);

            const result = escapeHtml("<div>Hello</div>");

            expect(result).toBe("&lt;div>Hello&lt;/div>");
        });

        it("should not escape greater-than in content", () => {
            expect.assertions(1);

            const result = escapeHtml(">");

            expect(result).toBe(">");
        });

        it("should not escape double quotes in content", () => {
            expect.assertions(1);

            const result = escapeHtml("value=\"test\"");

            expect(result).toBe("value=\"test\"");
        });

        it("should handle empty string", () => {
            expect.assertions(1);

            const result = escapeHtml("");

            expect(result).toBe("");
        });

        it("should handle null", () => {
            expect.assertions(1);

            const result = escapeHtml(null);

            expect(result).toBe("");
        });

        it("should handle undefined", () => {
            expect.assertions(1);

            const result = escapeHtml(undefined);

            expect(result).toBe("");
        });

        it("should convert non-string values to string", () => {
            expect.assertions(3);

            expect(escapeHtml(123)).toBe("123");
            expect(escapeHtml(true)).toBe("true");
            expect(escapeHtml(false)).toBe("false");
        });

        it("should handle strings with no special characters", () => {
            expect.assertions(1);

            const result = escapeHtml("Hello World");

            expect(result).toBe("Hello World");
        });

        it("should handle multiple special characters", () => {
            expect.assertions(1);

            const result = escapeHtml("& < & <");

            expect(result).toBe("&amp; &lt; &amp; &lt;");
        });
    });

    describe("attribute escaping", () => {
        it("should escape HTML special characters in attributes", () => {
            expect.assertions(1);

            const result = escapeHtml("<script>alert(\"xss\")</script>", true);

            expect(result).toBe("&lt;script>alert(&quot;xss&quot;)&lt;/script>");
        });

        it("should escape double quotes in attributes", () => {
            expect.assertions(1);

            const result = escapeHtml("value=\"test\"", true);

            expect(result).toBe("value=&quot;test&quot;");
        });

        it("should escape ampersand in attributes", () => {
            expect.assertions(1);

            const result = escapeHtml("Hello & World", true);

            expect(result).toBe("Hello &amp; World");
        });

        it("should escape less-than in attributes", () => {
            expect.assertions(1);

            const result = escapeHtml("<div>", true);

            expect(result).toBe("&lt;div>");
        });

        it("should escape single quotes in attributes to prevent single-quoted attribute breakout", () => {
            expect.assertions(1);

            const result = escapeHtml("' onmouseover='x", true);

            expect(result).toBe("&#39; onmouseover=&#39;x");
        });

        it("should handle boolean isAttr parameter", () => {
            expect.assertions(1);

            const result = escapeHtml("value=\"test\"", true);

            expect(result).toBe("value=&quot;test&quot;");
        });

        it("should handle empty string in attributes", () => {
            expect.assertions(1);

            const result = escapeHtml("", true);

            expect(result).toBe("");
        });

        it("should handle null in attributes", () => {
            expect.assertions(1);

            const result = escapeHtml(null, true);

            expect(result).toBe("");
        });

        it("should handle strings with no special characters in attributes", () => {
            expect.assertions(1);

            const result = escapeHtml("Hello World", true);

            expect(result).toBe("Hello World");
        });

        it("should handle multiple special characters in attributes", () => {
            expect.assertions(1);

            const result = escapeHtml("& < \" & < \"", true);

            expect(result).toBe("&amp; &lt; &quot; &amp; &lt; &quot;");
        });
    });

    describe("edge cases", () => {
        it("should handle strings with only ampersand", () => {
            expect.assertions(1);

            const result = escapeHtml("&");

            expect(result).toBe("&amp;");
        });

        it("should handle strings with only less-than", () => {
            expect.assertions(1);

            const result = escapeHtml("<");

            expect(result).toBe("&lt;");
        });

        it("should handle strings with only double quote in attribute mode", () => {
            expect.assertions(1);

            const result = escapeHtml("\"", true);

            expect(result).toBe("&quot;");
        });

        it("should handle strings starting with special characters", () => {
            expect.assertions(1);

            const result = escapeHtml("&Hello");

            expect(result).toBe("&amp;Hello");
        });

        it("should handle strings ending with special characters", () => {
            expect.assertions(1);

            const result = escapeHtml("Hello&");

            expect(result).toBe("Hello&amp;");
        });

        it("should handle consecutive special characters", () => {
            expect.assertions(1);

            const result = escapeHtml("&&&");

            expect(result).toBe("&amp;&amp;&amp;");
        });

        it("should handle mixed content with special characters", () => {
            expect.assertions(1);

            const result = escapeHtml("Hello & < World > Test");

            expect(result).toBe("Hello &amp; &lt; World > Test");
        });
    });
});
