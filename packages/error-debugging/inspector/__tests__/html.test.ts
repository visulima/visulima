// @vitest-environment happy-dom

import { beforeEach, describe, expect, it } from "vitest";

import { inspect } from "../src";
import h from "./utils/h";

/**
 * The DOM inspectors (`inspectHTMLElement` / `inspectNode` / `inspectNodeCollection`)
 * only dispatch when `window` is present, so these specs need a DOM. They used to be
 * wrapped in `describe.skipIf(!("window" in globalThis))` and paired with hand-rolled
 * `MockHTMLElement` / `MockText` stand-ins — which meant they skipped silently under the
 * Node pool and were never executed anywhere, so nobody noticed the mocks had gone stale
 * (`h()` calls `append()`, which the mock element never implemented).
 *
 * The docblock above gives the file a real DOM instead, so it runs in the ordinary
 * `test` target on every runner. There is deliberately no skip guard: if the environment
 * ever stops being applied these fail loudly rather than disappearing again.
 *
 * `__tests__/html-node.test.ts` remains the complementary suite — it drives the same
 * exports with hostile, DOM-shaped objects (throwing getters, forged tags) that a real
 * DOM cannot produce.
 */
describe("hTMLElement", () => {
    it("returns `<div></div>` for an empty div", () => {
        expect.assertions(1);

        expect(inspect(h("div"))).toBe("<div></div>");
    });

    it("returns `<div id=\"foo\"></div>` for a div with an id", () => {
        expect.assertions(1);

        expect(inspect(h("div", { id: "foo" }))).toBe("<div id=\"foo\"></div>");
    });

    it("returns `<div id=\"foo\" aria-live=\"foo\" hidden></div>` for a div with an id", () => {
        expect.assertions(1);

        expect(inspect(h("div", { "aria-live": "bar", hidden: "", id: "foo" }))).toBe("<div aria-live=\"bar\" hidden id=\"foo\"></div>");
    });

    it("returns output including children", () => {
        expect.assertions(1);

        expect(inspect(h("div", { hidden: "", id: "foo" }, h("pre", {}, h("code", {}, h("span", { style: "color:red" })))))).toBe(
            "<div hidden id=\"foo\"><pre><code><span style=\"color:red\"></span></code></pre></div>",
        );
    });

    describe("truncate", () => {
        let template: object | null = null;

        beforeEach(() => {
            template = h("div", { hidden: "", id: "foo" }, h("pre", {}, h("code", {}, h("span", { style: "color:red" }))));
        });

        it("returns the full representation when truncate is over string length", () => {
            expect.assertions(1);

            expect(inspect(template, { truncate: 100 })).toBe("<div hidden id=\"foo\"><pre><code><span style=\"color:red\"></span></code></pre></div>");
        });

        it("truncates arguments values longer than truncate (81)", () => {
            expect.assertions(1);

            expect(inspect(template, { truncate: 81 })).toBe("<div hidden id=\"foo\"><pre><code><span …(1)></span></code></pre></div>");
        });

        it("truncates arguments values longer than truncate (78)", () => {
            expect.assertions(1);

            expect(inspect(template, { truncate: 78 })).toBe("<div hidden id=\"foo\"><pre><code><span …(1)></span></code></pre></div>");
        });

        it("truncates arguments values longer than truncate (64)", () => {
            expect.assertions(1);

            expect(inspect(template, { truncate: 64 })).toBe("<div hidden id=\"foo\"><pre><code>…(1)</code></pre></div>");
        });

        it("truncates arguments values longer than truncate (63)", () => {
            expect.assertions(1);

            expect(inspect(template, { truncate: 63 })).toBe("<div hidden id=\"foo\"><pre><code>…(1)</code></pre></div>");
        });

        it("truncates arguments values longer than truncate (51)", () => {
            expect.assertions(1);

            expect(inspect(template, { truncate: 51 })).toBe("<div hidden id=\"foo\"><pre>…(1)</pre></div>");
        });

        it("truncates arguments values longer than truncate (49)", () => {
            expect.assertions(1);

            expect(inspect(template, { truncate: 49 })).toBe("<div hidden id=\"foo\"><pre>…(1)</pre></div>");
        });

        it("truncates arguments values longer than truncate (26)", () => {
            expect.assertions(1);

            expect(inspect(template, { truncate: 26 })).toBe("<div hidden id=\"foo\">…(1)</div>");
        });

        it("truncates arguments values longer than truncate (25)", () => {
            expect.assertions(1);

            expect(inspect(template, { truncate: 25 })).toBe("<div hidden …(1)>…(1)</div>");
        });

        it("truncates arguments values longer than truncate (24)", () => {
            expect.assertions(1);

            expect(inspect(template, { truncate: 24 })).toBe("<div hidden …(1)>…(1)</div>");
        });

        it("disregards truncate when it cannot truncate further (18)", () => {
            expect.assertions(1);

            expect(inspect(template, { truncate: 18 })).toBe("<div …(2)>…(1)</div>");
        });

        it("disregards truncate when it cannot truncate further (1)", () => {
            expect.assertions(1);

            expect(inspect(template, { truncate: 1 })).toBe("<div …(2)>…(1)</div>");
        });
    });

    describe("hTMLCollection", () => {
        it("returns html representation of items", () => {
            expect.assertions(1);

            const nodes = [h("span"), h("h1")];

            (nodes as unknown as Record<symbol, string>)[Symbol.toStringTag] = "HTMLCollection";

            expect(inspect(nodes)).to.equal("<span></span>\n<h1></h1>");
        });
    });

    describe("nodeList", () => {
        it("returns html representation of items", () => {
            expect.assertions(1);

            const nodes = [h("h1"), document.createTextNode("bar")];

            // Becuase we can't create a `NodeList in node
            (nodes as unknown as Record<symbol, string>)[Symbol.toStringTag] = "NodeList";

            expect(inspect(nodes)).to.equal("<h1></h1>\n'bar'");
        });
    });
});
