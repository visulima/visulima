import { describe, expect, it } from "vitest";
import Yoga from "yoga-layout";

import { createNode } from "../../src/ink/dom";
import { calculateScroll, getScrollHeight, getScrollLeft, getScrollTop, getScrollWidth } from "../../src/ink/scroll";

describe("scroll", () => {
    describe(calculateScroll, () => {
        it("should calculate scroll state for a scrollable node", () => {
            expect.assertions(4);

            const node = createNode("ink-box");

            node.style = { overflow: "scroll", scrollTop: 0 };

            // Set up parent dimensions
            node.yogaNode!.setWidth(20);
            node.yogaNode!.setHeight(10);

            // Add a child that is taller than the parent
            const child = Yoga.Node.create();

            child.setWidth(20);
            child.setHeight(30);
            node.yogaNode!.insertChild(child, 0);

            // Calculate layout
            node.yogaNode!.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);

            calculateScroll(node);

            expect(node.internal_scrollState).toBeDefined();
            expect(node.internal_scrollState!.scrollHeight).toBeGreaterThan(10);
            expect(node.internal_scrollState!.clientHeight).toBe(10);
            expect(node.internal_scrollState!.scrollTop).toBe(0);

            child.free();
        });

        it("should clamp scrollTop to valid range", () => {
            expect.assertions(1);

            const node = createNode("ink-box");

            node.style = { overflow: "scroll", scrollTop: 999 };

            node.yogaNode!.setWidth(20);
            node.yogaNode!.setHeight(10);

            const child = Yoga.Node.create();

            child.setWidth(20);
            child.setHeight(30);
            node.yogaNode!.insertChild(child, 0);

            node.yogaNode!.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);

            calculateScroll(node);

            // scrollTop should be clamped to scrollHeight - clientHeight
            expect(node.internal_scrollState!.scrollTop).toBeLessThanOrEqual(node.internal_scrollState!.scrollHeight - node.internal_scrollState!.clientHeight);

            child.free();
        });

        it("should handle node without yoga node", () => {
            expect.assertions(1);

            const node = createNode("ink-virtual-text");

            node.style = { overflow: "scroll" };

            calculateScroll(node);

            expect(node.internal_scrollState).toBeUndefined();
        });

        it("should ensure clientHeight and clientWidth are non-negative", () => {
            expect.assertions(3);

            const node = createNode("ink-box");

            node.style = { borderStyle: "single", overflow: "scroll", scrollTop: 0 };

            // Very small node with borders
            node.yogaNode!.setWidth(2);
            node.yogaNode!.setHeight(2);
            node.yogaNode!.setBorder(Yoga.EDGE_ALL, 1);

            node.yogaNode!.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);

            calculateScroll(node);

            expect(node.internal_scrollState).toBeDefined();
            expect(node.internal_scrollState!.clientHeight).toBeGreaterThanOrEqual(0);
            expect(node.internal_scrollState!.clientWidth).toBeGreaterThanOrEqual(0);
        });
    });

    describe("getScrollHeight/getScrollWidth", () => {
        it("should return 0 for nodes without scroll state", () => {
            expect.assertions(2);

            const node = createNode("ink-box");

            expect(getScrollHeight(node)).toBe(0);
            expect(getScrollWidth(node)).toBe(0);
        });
    });

    describe("getScrollTop/getScrollLeft", () => {
        it("should return 0 for nodes without scroll state", () => {
            expect.assertions(2);

            const node = createNode("ink-box");

            expect(getScrollTop(node)).toBe(0);
            expect(getScrollLeft(node)).toBe(0);
        });

        it("should return computed scroll position", () => {
            expect.assertions(1);

            const node = createNode("ink-box");

            node.style = { overflow: "scroll", scrollTop: 5 };

            node.yogaNode!.setWidth(20);
            node.yogaNode!.setHeight(10);

            const child = Yoga.Node.create();

            child.setWidth(20);
            child.setHeight(30);
            node.yogaNode!.insertChild(child, 0);

            node.yogaNode!.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);

            calculateScroll(node);

            expect(getScrollTop(node)).toBe(5);

            child.free();
        });
    });
});
