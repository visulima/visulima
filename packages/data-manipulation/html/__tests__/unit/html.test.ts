import { describe, expect, it } from "vitest";

import html, { isRawHtml } from "../../src/html";

describe(html, () => {
    describe("template tag", () => {
        it("should return HTML as-is from template literal", () => {
            expect.assertions(1);

            const result = html`<div></div>`;

            expect(result).toBe("<div></div>");
        });

        it("should escape interpolated values by default", () => {
            expect.assertions(1);

            const className = "test-class";
            const result = html`<div class="${className}">Hello</div>`;

            expect(result).toBe('<div class="test-class">Hello</div>');
        });

        it("should escape multiple interpolated values", () => {
            expect.assertions(1);

            const id = "test-id";
            const content = "Hello World";
            const result = html`<div id="${id}">${content}</div>`;

            expect(result).toBe('<div id="test-id">Hello World</div>');
        });

        it("should escape XSS attempts in interpolated values", () => {
            expect.assertions(3);

            // Script tag injection
            const malicious = "<script>alert('xss')</script>";
            const result1 = html`<div>${malicious}</div>`;

            expect(result1).toBe("<div>&lt;script>alert(&#39;xss&#39;)&lt;/script></div>");

            // HTML entity injection
            const htmlContent = "<img src=x onerror=alert(1)>";
            const result2 = html`<div>${htmlContent}</div>`;

            expect(result2).toBe("<div>&lt;img src=x onerror=alert(1)></div>");

            // Attribute injection
            const attributeValue = '" onclick="alert(\'xss\')"';
            const result3 = html`<div class="${attributeValue}">Content</div>`;

            expect(result3).toBe('<div class="&quot; onclick=&quot;alert(&#39;xss&#39;)&quot;">Content</div>');
        });

        it("should escape special characters in interpolated values", () => {
            expect.assertions(2);

            const content = "Hello & World";
            const result1 = html`<div>${content}</div>`;

            expect(result1).toBe("<div>Hello &amp; World</div>");

            const quoteContent = 'He said "Hello"';
            const result2 = html`<div class="${quoteContent}">Test</div>`;

            expect(result2).toBe('<div class="He said &quot;Hello&quot;">Test</div>');
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

        it("should escape numeric values", () => {
            expect.assertions(1);

            const number = 42;
            const result = html`<div>${number}</div>`;

            expect(result).toBe("<div>42</div>");
        });

        it("should escape boolean values", () => {
            expect.assertions(1);

            const bool = true;
            const result = html`<div>${bool}</div>`;

            expect(result).toBe("<div>true</div>");
        });

        it("should handle empty string interpolation", () => {
            expect.assertions(1);

            const result = html`<div>${""}</div>`;

            expect(result).toBe("<div></div>");
        });

        it("should handle zero value", () => {
            expect.assertions(1);

            const result = html`<div>${0}</div>`;

            expect(result).toBe("<div>0</div>");
        });

        it("should handle negative numbers", () => {
            expect.assertions(1);

            const result = html`<div>${-5}</div>`;

            expect(result).toBe("<div>-5</div>");
        });

        it("should handle decimal numbers", () => {
            expect.assertions(1);

            const result = html`<div>${3.14}</div>`;

            expect(result).toBe("<div>3.14</div>");
        });

        it("should handle template literal with only interpolation", () => {
            expect.assertions(1);

            const value = "test";
            // eslint-disable-next-line no-restricted-syntax
            const result = html`${value}`;

            expect(result).toBe("test");
        });

        it("should handle template literal starting with interpolation", () => {
            expect.assertions(1);

            const value = "Hello";
            const result = html`${value} World`;

            expect(result).toBe("Hello World");
        });

        it("should handle template literal ending with interpolation", () => {
            expect.assertions(1);

            const value = "World";
            const result = html`Hello ${value}`;

            expect(result).toBe("Hello World");
        });

        it("should handle object with toString method", () => {
            expect.assertions(1);

            const object = {
                toString: () => "<script>alert('xss')</script>",
            };
            const result = html`<div>${object}</div>`;

            expect(result).toBe("<div>&lt;script>alert(&#39;xss&#39;)&lt;/script></div>");
        });

        it("should flatten array interpolation and join with an empty string", () => {
            expect.assertions(1);

            const array = [1, 2, 3];
            const result = html`<div>${array}</div>`;

            // Arrays are joined with "" (no commas) and each element is escaped,
            // enabling list composition like items.map(...).
            expect(result).toBe("<div>123</div>");
        });

        it("should handle unicode characters", () => {
            expect.assertions(1);

            const unicode = "Hello 世界 🌍";
            const result = html`<div>${unicode}</div>`;

            expect(result).toBe("<div>Hello 世界 🌍</div>");
        });

        it("should fall back to empty string when the leading and trailing strings are missing", () => {
            expect.assertions(1);

            // Crafted template strings array whose entries are all undefined exercises the
            // `strings[0] ?? ""` and `strings[i + 1] ?? ""` fallbacks.
            const strings = Object.assign([undefined, undefined], { raw: ["", ""] }) as unknown as TemplateStringsArray;

            expect(html(strings, "<x>")).toBe("&lt;x>");
        });

        it("should fall back to empty string when the strings array is empty", () => {
            expect.assertions(1);

            const strings = Object.assign([], { raw: [] }) as unknown as TemplateStringsArray;

            expect(html(strings, "Z")).toBe("Z");
        });

        it("should escape each element of a string array", () => {
            expect.assertions(1);

            const parts = ["<a>", "<b>"];
            const result = html`<div>${parts}</div>`;

            expect(result).toBe("<div>&lt;a>&lt;b></div>");
        });

        it("should compose list fragments via html.raw without double-escaping", () => {
            expect.assertions(1);

            const items = ["a", "<b>"];
            const result = html`<ul>${items.map((item) => html.raw(html`<li>${item}</li>`))}</ul>`;

            expect(result).toBe("<ul><li>a</li><li>&lt;b></li></ul>");
        });

        it("should inline a raw fragment verbatim", () => {
            expect.assertions(1);

            const trusted = html.raw("<em>trusted</em>");
            const result = html`<p>${trusted}</p>`;

            expect(result).toBe("<p><em>trusted</em></p>");
        });

        it("should still escape non-raw values placed next to raw fragments", () => {
            expect.assertions(1);

            const trusted = html.raw("<em>ok</em>");
            const untrusted = "<script>";
            const result = html`<p>${trusted}${untrusted}</p>`;

            expect(result).toBe("<p><em>ok</em>&lt;script></p>");
        });

        it("should support nested raw fragments inside arrays", () => {
            expect.assertions(1);

            const fragments = [html.raw("<i>1</i>"), html.raw("<i>2</i>")];
            const result = html`<div>${fragments}</div>`;

            expect(result).toBe("<div><i>1</i><i>2</i></div>");
        });
    });

    describe("html.raw and isRawHtml", () => {
        it("should create a raw marker that isRawHtml recognizes", () => {
            expect.assertions(2);

            const raw = html.raw("<b>x</b>");

            expect(isRawHtml(raw)).toBe(true);
            expect(raw.value).toBe("<b>x</b>");
        });

        it("should return false from isRawHtml for non-raw values", () => {
            expect.assertions(4);

            expect(isRawHtml("string")).toBe(false);
            expect(isRawHtml(null)).toBe(false);
            expect(isRawHtml(undefined)).toBe(false);
            expect(isRawHtml({ value: "x" })).toBe(false);
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

            const result = html('<script>alert("xss")</script>', true);

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

            const result = html('<div class="test">Hello & World</div>', false);

            expect(result).toBe('<div class="test">Hello & World</div>');
        });

        it("should escape special characters when escape is true", () => {
            expect.assertions(1);

            const result = html('<div class="test">Hello & World</div>', true);

            expect(result).toBe("&lt;div class=&quot;test&quot;>Hello &amp; World&lt;/div>");
        });
    });
});
