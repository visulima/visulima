/* eslint-disable max-classes-per-file */
import { beforeEach, describe, expect, it } from "vitest";

import { inspect } from "../src";
import h from "./utils/h";

describe.skipIf(globalThis.window === undefined)("inspect with HTMLElements", () => {
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

    it("should correctly inspect an empty div element", () => {
        expect.assertions(1);

        expect(inspect(h("div"))).toBe("<div></div>");
    });

    it("should correctly inspect a div element with an id attribute", () => {
        expect.assertions(1);

        expect(inspect(h("div", { id: "foo" }))).toBe("<div id=\"foo\"></div>");
    });

    it("should correctly inspect a div with multiple attributes, including a boolean attribute", () => {
        expect.assertions(1);

        expect(inspect(h("div", { "aria-live": "bar", hidden: "", id: "foo" }))).toBe("<div aria-live=\"bar\" hidden id=\"foo\"></div>");
    });

    it("should correctly inspect an element with nested children", () => {
        expect.assertions(1);

        expect(inspect(h("div", { hidden: "", id: "foo" }, h("pre", {}, h("code", {}, h("span", { style: "color:red" })))))).toBe(
            "<div hidden id=\"foo\"><pre><code><span style=\"color:red\"></span></code></pre></div>",
        );
    });

    describe("with maxStringLength option", () => {
        let template: object | null = null;

        beforeEach(() => {
            template = h("div", { hidden: "", id: "foo" }, h("pre", {}, h("code", {}, h("span", { style: "color:red" }))));
        });

        it("should return the full string representation when maxStringLength is greater than the actual length", () => {
            expect.assertions(1);

            expect(inspect(template, { maxStringLength: 100 })).toBe("<div hidden id=\"foo\"><pre><code><span style=\"color:red\"></span></code></pre></div>");
        });

        it("should truncate the string representation when maxStringLength is 81", () => {
            expect.assertions(1);

            expect(inspect(template, { maxStringLength: 81 })).toBe("<div hidden id=\"foo\"><pre><code><span …(1)></span></code></pre></div>");
        });

        it("should truncate the string representation when maxStringLength is 78", () => {
            expect.assertions(1);

            expect(inspect(template, { maxStringLength: 78 })).toBe("<div hidden id=\"foo\"><pre><code><span …(1)></span></code></pre></div>");
        });

        it("should truncate the string representation when maxStringLength is 64", () => {
            expect.assertions(1);

            expect(inspect(template, { maxStringLength: 64 })).toBe("<div hidden id=\"foo\"><pre><code>…(1)</code></pre></div>");
        });

        it("should truncate the string representation when maxStringLength is 63", () => {
            expect.assertions(1);

            expect(inspect(template, { maxStringLength: 63 })).toBe("<div hidden id=\"foo\"><pre><code>…(1)</code></pre></div>");
        });

        it("should truncate the string representation when maxStringLength is 51", () => {
            expect.assertions(1);

            expect(inspect(template, { maxStringLength: 51 })).toBe("<div hidden id=\"foo\"><pre>…(1)</pre></div>");
        });

        it("should truncate the string representation when maxStringLength is 49", () => {
            expect.assertions(1);

            expect(inspect(template, { maxStringLength: 49 })).toBe("<div hidden id=\"foo\"><pre>…(1)</pre></div>");
        });

        it("should truncate the string representation when maxStringLength is 26", () => {
            expect.assertions(1);

            expect(inspect(template, { maxStringLength: 26 })).toBe("<div hidden id=\"foo\">…(1)</div>");
        });

        it("should truncate the string representation when maxStringLength is 25", () => {
            expect.assertions(1);

            expect(inspect(template, { maxStringLength: 25 })).toBe("<div hidden …(1)>…(1)</div>");
        });

        it("should truncate the string representation when maxStringLength is 24", () => {
            expect.assertions(1);

            expect(inspect(template, { maxStringLength: 24 })).toBe("<div hidden …(1)>…(1)</div>");
        });

        it("should not truncate further when maxStringLength is 18, as it has reached the minimum length", () => {
            expect.assertions(1);

            expect(inspect(template, { maxStringLength: 18 })).toBe("<div …(2)>…(1)</div>");
        });

        it("should not truncate further when maxStringLength is 1, as it has reached the minimum length", () => {
            expect.assertions(1);

            expect(inspect(template, { maxStringLength: 1 })).toBe("<div …(2)>…(1)</div>");
        });
    });

    describe("inspect with HTMLCollection", () => {
        it("should correctly inspect an HTMLCollection, showing each element on a new line", () => {
            expect.assertions(1);

            const nodes = [h("span"), h("h1")];

            nodes[Symbol.toStringTag] = "HTMLCollection";

            expect(inspect(nodes)).to.equal("<span></span>\n<h1></h1>");
        });
    });

    describe("inspect with NodeList", () => {
        it("should correctly inspect a NodeList, showing each node on a new line", () => {
            expect.assertions(1);

            const nodes = [h("h1"), document.createTextNode("bar")];

            // Becuase we can't create a `NodeList in node
            nodes[Symbol.toStringTag] = "NodeList";

            expect(inspect(nodes)).to.equal("<h1></h1>\n'bar'");
        });
    });
});
