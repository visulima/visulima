import { beforeEach, describe, expect, it } from "vitest";

import { inspect } from "../src";

const h = (name, attributes, ...children) => {
    const container = document.createElement(name);

    for (const key in attributes) {
        container.setAttribute(key, attributes[key]);
    }

    for (const index in children) {
        container.append(children[index]);
    }
    return container;
};

describe("hTMLElement", () => {
    beforeEach(() => {
        if (typeof HTMLElement !== "function") {
            class HTMLElement {
                constructor(tagName) {
                    this.tagName = tagName.toUpperCase();
                    this.attributes = {};
                    this.children = [];
                }

                appendChild(element) {
                    this.children.push(element);
                }

                getAttribute(name) {
                    return this.attributes[name];
                }

                setAttribute(name, value) {
                    this.attributes[name] = value;
                }

                getAttributeNames() {
                    return Object.keys(this.attributes);
                }
            }
            if (typeof global === "undefined") {
                window.document.createElement = (tagName) => new HTMLElement(tagName);
                window.HTMLElement = HTMLElement;
            } else {
                global.document = {};
                global.document.createElement = (tagName) => new HTMLElement(tagName);
                global.HTMLElement = HTMLElement;
            }
        }
    });

    it("returns `<div></div>` for an empty div", () => {
        expect.assertions(1);

        expect(inspect(h("div"))).toBe("<div></div>");
    });

    it('returns `<div id="foo"></div>` for a div with an id', () => {
        expect.assertions(1);

        expect(inspect(h("div", { id: "foo" }))).toBe('<div id="foo"></div>');
    });

    it('returns `<div id="foo" aria-live="foo" hidden></div>` for a div with an id', () => {
        expect.assertions(1);

        expect(inspect(h("div", { "aria-live": "bar", hidden: "", id: "foo" }))).toBe('<div id="foo" aria-live="bar" hidden></div>');
    });

    it("returns output including children", () => {
        expect.assertions(1);

        expect(inspect(h("div", { hidden: "", id: "foo" }, h("pre", {}, h("code", {}, h("span", { style: "color:red" })))))).toBe(
            '<div id="foo" hidden><pre><code><span style="color:red"></span></code></pre></div>',
        );
    });

    describe("truncate", () => {
        let template = null;

        beforeEach(() => {
            template = h("div", { hidden: "", id: "foo" }, h("pre", {}, h("code", {}, h("span", { style: "color:red" }))));
        });

        it("returns the full representation when truncate is over string length", () => {
            expect.assertions(1);

            expect(inspect(template, { truncate: 100 })).toBe('<div id="foo" hidden><pre><code><span style="color:red"></span></code></pre></div>');
        });

        it("truncates arguments values longer than truncate (81)", () => {
            expect.assertions(1);

            expect(inspect(template, { truncate: 81 })).toBe('<div id="foo" hidden><pre><code><span …(1)></span></code></pre></div>');
        });

        it("truncates arguments values longer than truncate (78)", () => {
            expect.assertions(1);

            expect(inspect(template, { truncate: 78 })).toBe('<div id="foo" hidden><pre><code><span …(1)></span></code></pre></div>');
        });

        it("truncates arguments values longer than truncate (77)", () => {
            expect.assertions(1);

            expect(inspect(template, { truncate: 77 })).toBe('<div id="foo" hidden><pre><code>…(1)</code></pre></div>');
        });

        it("truncates arguments values longer than truncate (64)", () => {
            expect.assertions(1);

            expect(inspect(template, { truncate: 64 })).toBe('<div id="foo" hidden><pre><code>…(1)</code></pre></div>');
        });

        it("truncates arguments values longer than truncate (63)", () => {
            expect.assertions(1);

            expect(inspect(template, { truncate: 63 })).toBe('<div id="foo" hidden><pre>…(1)</pre></div>');
        });

        it("truncates arguments values longer than truncate (51)", () => {
            expect.assertions(1);

            expect(inspect(template, { truncate: 51 })).toBe('<div id="foo" hidden><pre>…(1)</pre></div>');
        });

        it("truncates arguments values longer than truncate (49)", () => {
            expect.assertions(1);

            expect(inspect(template, { truncate: 49 })).toBe('<div id="foo" hidden>…(1)</div>');
        });

        it("truncates arguments values longer than truncate (26)", () => {
            expect.assertions(1);

            expect(inspect(template, { truncate: 26 })).toBe('<div id="foo" hidden>…(1)</div>');
        });

        it("truncates arguments values longer than truncate (25)", () => {
            expect.assertions(1);

            expect(inspect(template, { truncate: 25 })).toBe('<div id="foo" …(1)>…(1)</div>');
        });

        it("truncates arguments values longer than truncate (24)", () => {
            expect.assertions(1);

            expect(inspect(template, { truncate: 24 })).toBe('<div id="foo" …(1)>…(1)</div>');
        });

        it("truncates arguments values longer than truncate (23)", () => {
            expect.assertions(1);

            expect(inspect(template, { truncate: 23 })).toBe("<div …(2)>…(1)</div>");
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

    describe("colors", () => {
        it("returns element as cyan, with attribute names in yellow and values as string colour", () => {
            expect.assertions(1);

            expect(inspect(h("div", { id: "foo" }), { colors: true })).toBe(
                "\u001B[36m<div\u001B[39m \u001B[33mid\u001B[39m=\u001B[32m" + '"foo"\u001B[39m\u001B[36m>\u001B[39m\u001B[36m</div>\u001B[39m',
            );
        });
    });
});
