import { describe, expect, it } from "vitest";

import { inspect } from "../src";
import { inspectHTMLElement, inspectNode, inspectNodeCollection } from "../src/html";
import type { InternalInspect, Options } from "../src/types";

/**
 * These tests exercise `src/html.ts` directly in the Node test environment.
 *
 * The browser-mode suite (`html.test.ts`) is skipped whenever `window` is not
 * present in `globalThis` (i.e. the default Node runner), which leaves the HTML
 * inspectors completely uncovered. By driving the exported functions with light
 * DOM-shaped mocks we can cover the element/attribute/children/truncation logic
 * without needing a real DOM.
 */

const createOptions = (overrides: Partial<Options> = {}): Options => {
    return {
        customInspect: true,
        depth: 5,
        indent: undefined,
        maxArrayLength: Number.POSITIVE_INFINITY,
        numericSeparator: true,
        quoteStyle: "single",
        showHidden: false,
        stylize: (s: string) => s,
        truncate: Number.POSITIVE_INFINITY,
        ...overrides,
    };
};

// The `inspect` callback handed to the HTML helpers behaves like the internal
// recursive inspector: it forwards to the public `inspect` with the current options.
const internalInspect: InternalInspect = (value: unknown, _from: unknown, options: Options): string => inspect(value, options);

class MockElement {
    public tagName: string;

    public attributes: Record<string, string | null> = {};

    public children: MockElement[] = [];

    public constructor(tag: string) {
        this.tagName = tag.toUpperCase();
    }

    // eslint-disable-next-line class-methods-use-this
    public get nodeType(): number {
        return 1;
    }

    public getAttribute(name: string): string | null {
        return this.attributes[name] ?? null;
    }

    public setAttribute(name: string, value: string): void {
        this.attributes[name] = value;
    }

    public getAttributeNames(): string[] {
        return Object.keys(this.attributes);
    }
}

describe("html inspectHTMLElement", () => {
    it("returns `<div></div>` for an element without attributes or children", () => {
        expect.assertions(1);

        const element = new MockElement("div");

        expect(inspectHTMLElement(element as unknown as Element, element, createOptions(), internalInspect)).toBe("<div></div>");
    });

    it("renders attributes, stylizing a string-valued attribute", () => {
        expect.assertions(1);

        const element = new MockElement("div");

        element.setAttribute("id", "foo");

        expect(inspectHTMLElement(element as unknown as Element, element, createOptions(), internalInspect)).toBe("<div id=\"foo\"></div>");
    });

    it("renders an attribute with a falsy value as a bare key", () => {
        expect.assertions(1);

        const element = new MockElement("div");

        element.setAttribute("id", "foo");
        element.setAttribute("hidden", "");

        expect(inspectHTMLElement(element as unknown as Element, element, createOptions(), internalInspect)).toBe("<div id=\"foo\" hidden></div>");
    });

    it("renders nested children recursively", () => {
        expect.assertions(1);

        const parent = new MockElement("div");
        const child = new MockElement("span");

        parent.children.push(child);

        expect(inspectHTMLElement(parent as unknown as Element, parent, createOptions(), internalInspect)).toBe("<div><span></span></div>");
    });

    it("truncates the children when their rendered length exceeds truncate", () => {
        expect.assertions(1);

        const parent = new MockElement("div");

        for (let index = 0; index < 5; index += 1) {
            parent.children.push(new MockElement("span"));
        }

        expect(inspectHTMLElement(parent as unknown as Element, parent, createOptions({ truncate: 30 }), internalInspect)).toBe("<div><span></span>\n…(4)</div>");
    });

    it("collapses the children to a count when a single child's rendering exceeds truncate", () => {
        expect.assertions(1);

        const parent = new MockElement("div");

        parent.children.push(new MockElement("verylongtagnamehereindeed"));

        expect(inspectHTMLElement(parent as unknown as Element, parent, createOptions({ truncate: 10 }), internalInspect)).toBe("<div>…(1)</div>");
    });
});

describe("html inspectNode", () => {
    it("inspects element nodes (nodeType 1)", () => {
        expect.assertions(1);

        const element = new MockElement("div");

        expect(inspectNode(element as unknown as Node, element, createOptions(), internalInspect)).toBe("<div></div>");
    });

    it("inspects text nodes (nodeType 3) via the value inspector", () => {
        expect.assertions(1);

        const textNode = { data: "hello", nodeType: 3 };

        expect(inspectNode(textNode as unknown as Node, textNode, createOptions(), internalInspect)).toBe("'hello'");
    });

    it("falls back to the value inspector for other node types", () => {
        expect.assertions(1);

        const commentNode = { nodeType: 8 };

        expect(inspectNode(commentNode as unknown as Node, commentNode, createOptions(), internalInspect)).toBe("{ nodeType: 8 }");
    });
});

describe("html inspectNodeCollection", () => {
    it("renders each node separated by newlines", () => {
        expect.assertions(1);

        const collection = [new MockElement("h1"), new MockElement("p")];

        expect(inspectNodeCollection(collection as unknown as ArrayLike<Node>, createOptions(), internalInspect, undefined)).toBe("<h1></h1>\n<p></p>");
    });

    it("renders a collection containing text and comment nodes without throwing", () => {
        expect.assertions(2);

        const collection = [new MockElement("h1"), { data: "hello", nodeType: 3 }, { nodeType: 8 }];

        expect(() => inspectNodeCollection(collection as unknown as ArrayLike<Node>, createOptions(), internalInspect, undefined)).not.toThrow();
        expect(inspectNodeCollection(collection as unknown as ArrayLike<Node>, createOptions(), internalInspect, undefined)).toBe(
            "<h1></h1>\n'hello'\n{ nodeType: 8 }",
        );
    });
});
