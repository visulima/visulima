import { describe, expect, it } from "vitest";
import Yoga from "yoga-layout";

import { createNode, createTextNode } from "../../src/ink/dom";
import {
    collectSortedFragments,
    getBoundingBox,
    getHorizontalScrollbarBoundingBox,
    getRelativeLeft,
    getRelativeTop,
    getText,
    getVerticalScrollbarBoundingBox,
} from "../../src/ink/measure-element";
import type { ScrollState } from "../../src/ink/scroll";

const scrollState = (overrides: Partial<ScrollState>): ScrollState => {
    return {
        actualScrollHeight: 0,
        clientHeight: 0,
        clientWidth: 0,
        scrollHeight: 0,
        scrollLeft: 0,
        scrollTop: 0,
        scrollWidth: 0,
        ...overrides,
    };
};

describe("measure-element scroll-aware bounding box", () => {
    describe(getBoundingBox, () => {
        it("subtracts the parent scroll offsets when a parent has overflow scroll", () => {
            expect.assertions(2);

            const parent = createNode("ink-box");
            const child = createNode("ink-box");

            parent.style.overflow = "scroll";
            parent.internal_scrollState = scrollState({ scrollLeft: 3, scrollTop: 5 });

            parent.yogaNode!.setWidth(40);
            parent.yogaNode!.setHeight(20);
            child.yogaNode!.setWidth(10);
            child.yogaNode!.setHeight(4);

            parent.yogaNode!.insertChild(child.yogaNode!, 0);
            parent.yogaNode!.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);
            child.parentNode = parent;

            const box = getBoundingBox(child);

            // Child at (0,0) within parent, minus scroll offsets (3,5).
            expect(box.x).toBe(-3);
            expect(box.y).toBe(-5);
        });
    });

    describe(getVerticalScrollbarBoundingBox, () => {
        it("returns undefined for a node without a yoga node", () => {
            expect.assertions(1);

            expect(getVerticalScrollbarBoundingBox(createNode("ink-virtual-text"))).toBeUndefined();
        });

        it("returns undefined when overflowY is not scroll", () => {
            expect.assertions(1);

            const node = createNode("ink-box");

            node.yogaNode!.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);

            expect(getVerticalScrollbarBoundingBox(node)).toBeUndefined();
        });

        it("returns undefined when content fits within the client area", () => {
            expect.assertions(1);

            const node = createNode("ink-box");

            node.style.overflowY = "scroll";
            node.internal_scrollState = scrollState({ clientHeight: 10, scrollHeight: 5 });
            node.yogaNode!.setHeight(10);
            node.yogaNode!.setWidth(10);
            node.yogaNode!.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);

            expect(getVerticalScrollbarBoundingBox(node)).toBeUndefined();
        });

        it("returns a scrollbar layout when content overflows vertically", () => {
            expect.assertions(2);

            const node = createNode("ink-box");

            node.style.overflowY = "scroll";
            node.internal_scrollState = scrollState({ clientHeight: 10, scrollHeight: 50, scrollTop: 0 });
            node.yogaNode!.setHeight(10);
            node.yogaNode!.setWidth(20);
            node.yogaNode!.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);

            const box = getVerticalScrollbarBoundingBox(node);

            expect(box).toBeDefined();
            expect(box!.height).toBe(10);
        });

        it("honors an explicit offset argument", () => {
            expect.assertions(1);

            const node = createNode("ink-box");

            node.style.overflowY = "scroll";
            node.internal_scrollState = scrollState({ clientHeight: 10, scrollHeight: 50 });
            node.yogaNode!.setHeight(10);
            node.yogaNode!.setWidth(20);
            node.yogaNode!.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);

            const box = getVerticalScrollbarBoundingBox(node, { x: 100, y: 200 });

            expect(box!.y).toBe(200);
        });
    });

    describe(getHorizontalScrollbarBoundingBox, () => {
        it("returns undefined for a node without a yoga node", () => {
            expect.assertions(1);

            expect(getHorizontalScrollbarBoundingBox(createNode("ink-virtual-text"))).toBeUndefined();
        });

        it("returns undefined when overflowX is not scroll", () => {
            expect.assertions(1);

            const node = createNode("ink-box");

            node.yogaNode!.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);

            expect(getHorizontalScrollbarBoundingBox(node)).toBeUndefined();
        });

        it("returns undefined when content fits horizontally", () => {
            expect.assertions(1);

            const node = createNode("ink-box");

            node.style.overflowX = "scroll";
            node.internal_scrollState = scrollState({ clientWidth: 20, scrollWidth: 10 });
            node.yogaNode!.setHeight(10);
            node.yogaNode!.setWidth(20);
            node.yogaNode!.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);

            expect(getHorizontalScrollbarBoundingBox(node)).toBeUndefined();
        });

        it("returns a scrollbar layout when content overflows horizontally and a vertical scrollbar is present", () => {
            expect.assertions(2);

            const node = createNode("ink-box");

            node.style.overflow = "scroll";
            node.internal_scrollState = scrollState({
                clientHeight: 10,
                clientWidth: 20,
                scrollHeight: 50,
                scrollWidth: 80,
            });
            node.yogaNode!.setHeight(10);
            node.yogaNode!.setWidth(20);
            node.yogaNode!.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);

            const box = getHorizontalScrollbarBoundingBox(node);

            expect(box).toBeDefined();
            expect(box!.height).toBe(1);
        });
    });
});

describe("measure-element relative positions", () => {
    describe(getRelativeTop, () => {
        it("returns 0 for a node without a yoga node", () => {
            expect.assertions(1);

            expect(getRelativeTop(createNode("ink-virtual-text"))).toBe(0);
        });

        it("returns 0 when the node is the ancestor itself", () => {
            expect.assertions(1);

            const node = createNode("ink-box");

            expect(getRelativeTop(node, node)).toBe(0);
        });

        it("accumulates the top offset up to the given ancestor", () => {
            expect.assertions(1);

            const root = createNode("ink-box");
            const child = createNode("ink-box");

            root.yogaNode!.setHeight(40);
            root.yogaNode!.setWidth(20);
            child.yogaNode!.setHeight(5);
            child.yogaNode!.setWidth(20);
            child.yogaNode!.setMargin(Yoga.EDGE_TOP, 7);

            root.yogaNode!.insertChild(child.yogaNode!, 0);
            root.yogaNode!.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);
            child.parentNode = root;

            expect(getRelativeTop(child, root)).toBe(7);
        });

        it("returns undefined when the ancestor is not in the parent chain", () => {
            expect.assertions(1);

            const root = createNode("ink-box");
            const child = createNode("ink-box");
            const stranger = createNode("ink-box");

            root.yogaNode!.insertChild(child.yogaNode!, 0);
            root.yogaNode!.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);
            child.parentNode = root;

            expect(getRelativeTop(child, stranger)).toBeUndefined();
        });
    });

    describe(getRelativeLeft, () => {
        it("returns 0 for a node without a yoga node", () => {
            expect.assertions(1);

            expect(getRelativeLeft(createNode("ink-virtual-text"))).toBe(0);
        });

        it("accumulates the left offset up to the root when no ancestor is given", () => {
            expect.assertions(1);

            const root = createNode("ink-box");
            const child = createNode("ink-box");

            root.yogaNode!.setHeight(10);
            root.yogaNode!.setWidth(40);
            child.yogaNode!.setHeight(10);
            child.yogaNode!.setWidth(5);
            child.yogaNode!.setMargin(Yoga.EDGE_LEFT, 4);

            root.yogaNode!.insertChild(child.yogaNode!, 0);
            root.yogaNode!.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);
            child.parentNode = root;

            expect(getRelativeLeft(child)).toBe(4);
        });

        it("returns undefined when the ancestor is not in the parent chain", () => {
            expect.assertions(1);

            const root = createNode("ink-box");
            const child = createNode("ink-box");
            const stranger = createNode("ink-box");

            root.yogaNode!.insertChild(child.yogaNode!, 0);
            root.yogaNode!.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);
            child.parentNode = root;

            expect(getRelativeLeft(child, stranger)).toBeUndefined();
        });
    });
});

describe("measure-element text extraction", () => {
    describe(getText, () => {
        it("returns the value of a text node", () => {
            expect.assertions(1);

            expect(getText(createTextNode("hi there"))).toBe("hi there");
        });

        it("squashes the children of an ink-text node", () => {
            expect.assertions(1);

            const textNode = createNode("ink-text");
            const a = createTextNode("foo");
            const b = createTextNode("bar");

            a.parentNode = textNode;
            b.parentNode = textNode;
            textNode.childNodes.push(a, b);

            expect(getText(textNode)).toBe("foobar");
        });

        it("returns an empty string for box nodes", () => {
            expect.assertions(1);

            expect(getText(createNode("ink-box"))).toBe("");
        });
    });

    describe(collectSortedFragments, () => {
        it("collects text fragments from a laid-out tree", () => {
            expect.assertions(2);

            const root = createNode("ink-root");
            const textNode = createNode("ink-text");
            const inner = createTextNode("hello");

            // Wire the #text leaf under an ink-text (it carries the yogaNode).
            inner.parentNode = textNode;
            textNode.childNodes.push(inner);
            textNode.parentNode = root;
            root.childNodes.push(textNode);

            root.yogaNode!.insertChild(textNode.yogaNode!, 0);
            root.yogaNode!.setWidth(20);
            root.yogaNode!.setHeight(5);
            root.yogaNode!.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);

            const { fragments } = collectSortedFragments(root);

            expect(fragments).toHaveLength(1);
            expect(fragments[0]?.text).toBe("hello");
        });

        it("skips subtrees marked userSelect none", () => {
            expect.assertions(1);

            const root = createNode("ink-root");
            const textNode = createNode("ink-text");
            const inner = createTextNode("secret");

            textNode.style.userSelect = "none";
            inner.parentNode = textNode;
            textNode.childNodes.push(inner);
            textNode.parentNode = root;
            root.childNodes.push(textNode);

            root.yogaNode!.insertChild(textNode.yogaNode!, 0);
            root.yogaNode!.setWidth(20);
            root.yogaNode!.setHeight(5);
            root.yogaNode!.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);

            const { fragments } = collectSortedFragments(root);

            expect(fragments).toHaveLength(0);
        });

        it("returns no fragments for a display none box", () => {
            expect.assertions(1);

            const root = createNode("ink-box");

            root.yogaNode!.setDisplay(Yoga.DISPLAY_NONE);
            root.yogaNode!.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);

            const { fragments } = collectSortedFragments(root);

            expect(fragments).toHaveLength(0);
        });
    });
});
