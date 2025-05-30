/* eslint-disable max-classes-per-file */
import { beforeEach, describe, expect, it } from "vitest";

import { inspect } from "../src";
import h from "./utils/h";

describe.skipIf(globalThis.window === undefined)("hTMLElement", () => {
    beforeEach(() => {
        if (typeof HTMLElement !== "function") {
            class Text {
                public constructor(data) {
                    this.wholeText = data;
                    this.data = data;
                }

                // eslint-disable-next-line class-methods-use-this
                public get nodeType() {
                    return 3;
                }

                public get length() {
                    return this.data.length;
                }
            }

            class HTMLElement {
                public constructor(tagName: string) {
                    this.tagName = tagName.toUpperCase();
                    this.attributes = {};
                    this.children = [];
                }

                // eslint-disable-next-line class-methods-use-this
                public get nodeType() {
                    return 1;
                }

                public appendChild(element) {
                    this.children.push(element);
                }

                public getAttribute(name: string) {
                    return this.attributes[name];
                }

                public setAttribute(name: string, value: any) {
                    this.attributes[name] = value;
                }

                public getAttributeNames(): string[] {
                    return Object.keys(this.attributes);
                }
            }

            if (globalThis.document === undefined) {
                globalThis.document = {};
            }

            globalThis.document.createElement = (tagName) => new HTMLElement(tagName);
            globalThis.document.createTextNode = (data) => new Text(data);
            globalThis.HTMLElement = HTMLElement;
            globalThis.Text = Text;
        }
    });

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

            nodes[Symbol.toStringTag] = "HTMLCollection";

            expect(inspect(nodes)).to.equal("<span></span>\n<h1></h1>");
        });
    });

    describe("nodeList", () => {
        it("returns html representation of items", () => {
            expect.assertions(1);

            const nodes = [h("h1"), document.createTextNode("bar")];

            // Becuase we can't create a `NodeList in node
            nodes[Symbol.toStringTag] = "NodeList";

            expect(inspect(nodes)).to.equal("<h1></h1>\n'bar'");
        });
    });
});
