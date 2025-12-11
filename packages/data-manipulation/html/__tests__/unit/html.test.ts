import { describe, expect, it } from "vitest";

import html from "../../src/html";

describe(html, () => {
    describe("template tag", () => {
        it("should return HTML as-is from template literal", () => {
            expect.assertions(1);

            const result = html`<div></div>`;

            expect(result).toBe("<div></div>");
        });

        it("should handle template literal with values", () => {
            expect.assertions(1);

            const className = "test-class";
            const result = html`<div class="${className}">Hello</div>`;

            expect(result).toBe("<div class=\"test-class\">Hello</div>");
        });

        it("should handle multiple template literal values", () => {
            expect.assertions(1);

            const id = "test-id";
            const content = "Hello World";
            const result = html`<div id="${id}">${content}</div>`;

            expect(result).toBe("<div id=\"test-id\">Hello World</div>");
        });

        it("should handle empty template literal", () => {
            expect.assertions(1);

            const result = html``;

            expect(result).toBe("");
        });

        it("should handle null and undefined values in template literal", () => {
            expect.assertions(2);

            expect(html`<div>${null}</div>`).toBe("<div></div>");
            expect(html`<div>${undefined}</div>`).toBe("<div></div>");
        });
    });

    describe("function call with escape parameter", () => {
        it("should return HTML as-is when escape is false", () => {
            expect.assertions(1);

            const result = html("<div></div>", false);

            expect(result).toBe("<div></div>");
        });

        it("should escape HTML when escape is true", () => {
            expect.assertions(1);

            const result = html("<script>alert(\"xss\")</script>", true);

            expect(result).toBe("&lt;script>alert(&quot;xss&quot;)&lt;/script>");
        });

        it("should return HTML as-is when escape is undefined (default)", () => {
            expect.assertions(1);

            const result = html("<div></div>");

            expect(result).toBe("<div></div>");
        });

        it("should handle empty string", () => {
            expect.assertions(1);

            const result = html("", false);

            expect(result).toBe("");
        });

        it("should handle HTML with special characters when escape is false", () => {
            expect.assertions(1);

            const result = html("<div class=\"test\">Hello & World</div>", false);

            expect(result).toBe("<div class=\"test\">Hello & World</div>");
        });

        it("should escape special characters when escape is true", () => {
            expect.assertions(1);

            const result = html("<div class=\"test\">Hello & World</div>", true);

            expect(result).toBe("&lt;div class=&quot;test&quot;>Hello &amp; World&lt;/div>");
        });
    });
});
