import { describe, expect, it } from "vitest";

import { extractCidReferences, rewriteCidLinks } from "../../src/render/cid";
import inlineCss from "../../src/render/css-inline";
import { addDarkModeSupport } from "../../src/render/dark-mode";
import { injectPreheader } from "../../src/render/preheader";

describe("render pipeline", () => {
    describe(injectPreheader, () => {
        it("injects a hidden preheader after <body>", () => {
            expect.assertions(3);

            const html = injectPreheader("<html><body><h1>Hi</h1></body></html>", "Preview me");

            expect(html).toContain("display:none");
            expect(html).toContain("Preview me");
            expect(html.indexOf("Preview me")).toBeLessThan(html.indexOf("<h1>"));
        });

        it("escapes HTML in the preheader and prepends when no body tag", () => {
            expect.assertions(2);

            const html = injectPreheader("<p>x</p>", "<script>&", { spacer: false });

            expect(html).toContain("&lt;script&gt;&amp;");
            expect(html.startsWith("<div")).toBe(true);
        });
    });

    describe(rewriteCidLinks, () => {
        it("rewrites cid: src references via the resolver", () => {
            expect.assertions(2);

            const resolver = (cid: string): string | undefined => {
                if (cid === "logo") {
                    return "https://cdn/logo.png";
                }

                return undefined;
            };
            const html = rewriteCidLinks("<img src=\"cid:logo\"><img src=\"cid:keep\">", resolver);

            expect(html).toContain("src=\"https://cdn/logo.png\"");
            expect(html).toContain("src=\"cid:keep\"");
        });

        it("extracts referenced content-ids", () => {
            expect.assertions(1);
            expect(extractCidReferences("<img src=\"cid:a\"><img src='cid:b'><img src=\"cid:a\">")).toStrictEqual(["a", "b"]);
        });
    });

    describe(addDarkModeSupport, () => {
        it("adds color-scheme meta into <head> and a dark media block", () => {
            expect.assertions(2);

            const html = addDarkModeSupport("<html><head><title>x</title></head><body></body></html>", { styles: "body{background:#000}" });

            expect(html).toContain("name=\"color-scheme\"");
            expect(html).toContain("@media (prefers-color-scheme: dark){body{background:#000}}");
        });

        it("creates a <head> when none exists", () => {
            expect.assertions(1);

            const html = addDarkModeSupport("<html><body></body></html>");

            expect(html).toContain("<head><meta");
        });
    });

    describe(inlineCss, () => {
        it("inlines a <style> rule into the matching element", () => {
            expect.assertions(1);

            const html = inlineCss("<html><head><style>p{color:red}</style></head><body><p>Hi</p></body></html>");

            expect(html).toContain("style=\"color: red");
        });
    });

    describe("composing the helpers", () => {
        it("applies preheader, dark-mode, and CID rewrite when chained", () => {
            expect.assertions(3);

            const html = rewriteCidLinks(
                addDarkModeSupport(injectPreheader("<html><head></head><body><p>Hi</p></body></html>", "Preview")),
                () => "https://cdn/x.png",
            );

            expect(html).toContain("Preview");
            expect(html).toContain("name=\"color-scheme\"");
            expect(html).toContain("<p>Hi</p>");
        });
    });
});
