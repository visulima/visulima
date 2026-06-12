import { describe, expect, it } from "vitest";

import renderSafeMarkdown, { escapeHtml } from "../../../src/utils/render-safe-markdown";

const IMG_TAG_RE = /<img\b/i;

// Built from parts so the `no-script-url` lint rule does not flag the literal scheme,
// and so the rendered output is checked against the exact dangerous scheme.
const JS_SCHEME = ["java", "script:"].join("");

describe(renderSafeMarkdown, () => {
    it("escapes raw <script> tags instead of passing them through", async () => {
        expect.assertions(2);

        const html = await renderSafeMarkdown("Boom <script>alert(1)</script>");

        expect(html).not.toContain("<script>");
        expect(html).toContain("&lt;script&gt;");
    });

    it("neutralizes an <img onerror> XSS payload (error-derived solution content)", async () => {
        expect.assertions(2);

        // Simulates an attacker-influenceable error message reflected into a solution body.
        const html = await renderSafeMarkdown("Cannot resolve <img src=x onerror=\"alert(document.cookie)\">");

        // No live <img> element reaches the DOM; the markup is rendered as inert escaped text.
        expect(html).not.toMatch(IMG_TAG_RE);
        expect(html).toContain("&lt;img");
    });

    it("drops javascript: URLs while keeping the visible link text", async () => {
        expect.assertions(2);

        const html = await renderSafeMarkdown(`[click me](${JS_SCHEME}alert(1))`);

        expect(html).not.toContain(JS_SCHEME);
        expect(html).toContain("click me");
    });

    it("ignores scheme obfuscation via embedded control characters", async () => {
        expect.assertions(1);

        const html = await renderSafeMarkdown("[x](java\tscript:alert(1))");

        expect(html.toLowerCase()).not.toContain(JS_SCHEME);
    });

    it("renders image markdown as alt text only", async () => {
        expect.assertions(2);

        const html = await renderSafeMarkdown("![evil](x onerror=alert(1))");

        expect(html).not.toMatch(IMG_TAG_RE);
        expect(html).toContain("evil");
    });

    it("preserves intended markdown formatting (code blocks, inline code, safe links)", async () => {
        expect.assertions(4);

        const html = await renderSafeMarkdown(["Use `import.meta.env`.", "", "```js", "const a = 1;", "```", "", "[docs](https://vite.dev)"].join("\n"));

        expect(html).toContain("<code");
        expect(html).toContain("const a = 1;");
        expect(html).toContain("<pre>");
        expect(html).toContain("href=\"https://vite.dev\"");
    });

    it("keeps relative, mailto and anchor links", async () => {
        expect.assertions(3);

        const relative = await renderSafeMarkdown("[a](./file.js)");
        const mail = await renderSafeMarkdown("[m](mailto:dev@example.com)");
        const anchor = await renderSafeMarkdown("[h](#section)");

        expect(relative).toContain("href=\"./file.js\"");
        expect(mail).toContain("mailto:dev@example.com");
        expect(anchor).toContain("href=\"#section\"");
    });
});

describe(escapeHtml, () => {
    it("escapes all HTML-significant characters", () => {
        expect.assertions(1);

        expect(escapeHtml("<a href=\"x\" data='y'>&</a>")).toBe("&lt;a href=&quot;x&quot; data=&#39;y&#39;&gt;&amp;&lt;/a&gt;");
    });
});
