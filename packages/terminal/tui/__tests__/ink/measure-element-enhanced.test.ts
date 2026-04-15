import { describe, expect, it } from "vitest";
import Yoga from "yoga-layout";

import { createNode } from "../../src/ink/dom";
import {
    calculateScrollbarLayout,
    calculateScrollbarThumb,
    getAddedScrollHeight,
    getBoundingBox,
    getInnerHeight,
    getInnerWidth,
} from "../../src/ink/measure-element";

describe("measure-element enhanced", () => {
    describe(getInnerWidth, () => {
        it("should return width minus borders", () => {
            expect.assertions(1);

            const node = createNode("ink-box");

            node.yogaNode!.setWidth(20);
            node.yogaNode!.setBorder(Yoga.EDGE_LEFT, 1);
            node.yogaNode!.setBorder(Yoga.EDGE_RIGHT, 1);
            node.yogaNode!.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);

            expect(getInnerWidth(node)).toBe(18);
        });

        it("should return 0 for nodes without yoga node", () => {
            expect.assertions(1);

            const node = createNode("ink-virtual-text");

            expect(getInnerWidth(node)).toBe(0);
        });
    });

    describe(getInnerHeight, () => {
        it("should return height minus borders", () => {
            expect.assertions(1);

            const node = createNode("ink-box");

            node.yogaNode!.setWidth(20);
            node.yogaNode!.setHeight(10);
            node.yogaNode!.setBorder(Yoga.EDGE_TOP, 1);
            node.yogaNode!.setBorder(Yoga.EDGE_BOTTOM, 1);
            node.yogaNode!.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);

            expect(getInnerHeight(node)).toBe(8);
        });
    });

    describe(getBoundingBox, () => {
        it("should return position and dimensions", () => {
            expect.assertions(4);

            const root = createNode("ink-root");
            const child = createNode("ink-box");

            root.yogaNode!.setWidth(100);
            root.yogaNode!.setHeight(50);

            child.yogaNode!.setWidth(20);
            child.yogaNode!.setHeight(10);

            root.yogaNode!.insertChild(child.yogaNode!, 0);
            root.yogaNode!.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);

            child.parentNode = root;

            const box = getBoundingBox(child);

            expect(box.width).toBe(20);
            expect(box.height).toBe(10);
            expect(box.x).toBeGreaterThanOrEqual(0);
            expect(box.y).toBeGreaterThanOrEqual(0);
        });

        it("should return zeros for nodes without yoga node", () => {
            expect.assertions(1);

            const node = createNode("ink-virtual-text");
            const box = getBoundingBox(node);

            expect(box).toStrictEqual({ height: 0, width: 0, x: 0, y: 0 });
        });
    });

    describe(getAddedScrollHeight, () => {
        it("should return 0 when no scroll state", () => {
            expect.assertions(1);

            const node = createNode("ink-box");

            expect(getAddedScrollHeight(node)).toBe(0);
        });

        it("should return difference between scroll height and actual scroll height", () => {
            expect.assertions(1);

            const node = createNode("ink-box");

            node.internal_scrollState = {
                actualScrollHeight: 50,
                clientHeight: 10,
                clientWidth: 20,
                scrollHeight: 80,
                scrollLeft: 0,
                scrollTop: 0,
                scrollWidth: 20,
            };

            expect(getAddedScrollHeight(node)).toBe(30);
        });
    });

    describe(calculateScrollbarThumb, () => {
        it("should calculate thumb position for vertical scrollbar", () => {
            expect.assertions(3);

            const result = calculateScrollbarThumb({
                axis: "vertical",
                clientDimension: 10,
                scrollbarDimension: 10,
                scrollDimension: 100,
                scrollPosition: 0,
            });

            expect(result.startIndex).toBeGreaterThanOrEqual(0);
            expect(result.endIndex).toBeLessThanOrEqual(10);
            expect(result.endIndex).toBeGreaterThan(result.startIndex);
        });

        it("should position thumb at end when scrolled to bottom", () => {
            expect.assertions(1);

            const result = calculateScrollbarThumb({
                axis: "vertical",
                clientDimension: 10,
                scrollbarDimension: 10,
                scrollDimension: 100,
                scrollPosition: 90,
            });

            expect(result.endIndex).toBe(10);
        });

        it("should handle zero max scroll position", () => {
            expect.assertions(1);

            const result = calculateScrollbarThumb({
                axis: "vertical",
                clientDimension: 10,
                scrollbarDimension: 10,
                scrollDimension: 10,
                scrollPosition: 0,
            });

            expect(result.startIndex).toBe(0);
        });
    });

    describe(calculateScrollbarLayout, () => {
        it("should return undefined when content fits", () => {
            expect.assertions(1);

            const result = calculateScrollbarLayout({
                axis: "vertical",
                clientDimension: 10,
                hasOppositeScrollbar: false,
                height: 10,
                marginBottom: 0,
                marginRight: 0,
                scrollDimension: 5,
                scrollPosition: 0,
                width: 20,
                x: 0,
                y: 0,
            });

            expect(result).toBeUndefined();
        });

        it("should return layout for vertical scrollbar", () => {
            expect.assertions(4);

            const result = calculateScrollbarLayout({
                axis: "vertical",
                clientDimension: 10,
                hasOppositeScrollbar: false,
                height: 10,
                marginBottom: 0,
                marginRight: 0,
                scrollDimension: 50,
                scrollPosition: 0,
                width: 20,
                x: 0,
                y: 0,
            });

            expect(result).toBeDefined();
            expect(result!.width).toBe(1);
            expect(result!.height).toBe(10);
            expect(result!.thumb.height).toBeGreaterThan(0);
        });

        it("should return layout for horizontal scrollbar", () => {
            expect.assertions(3);

            const result = calculateScrollbarLayout({
                axis: "horizontal",
                clientDimension: 20,
                hasOppositeScrollbar: false,
                height: 10,
                marginBottom: 0,
                marginRight: 0,
                scrollDimension: 50,
                scrollPosition: 0,
                width: 20,
                x: 0,
                y: 0,
            });

            expect(result).toBeDefined();
            expect(result!.height).toBe(1);
            expect(result!.thumb.width).toBeGreaterThan(0);
        });
    });
});
