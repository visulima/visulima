import { describe, expect, it } from "vitest";
import Yoga from "yoga-layout";

import { createNode } from "../../src/ink/dom";
import { getStickyDescendants, identifyActiveStickyNodes } from "../../src/ink/render-sticky";
import { calculateScroll } from "../../src/ink/scroll";

const setupScrollableContainer = () => {
    const container = createNode("ink-box");

    container.style = { overflow: "scroll", scrollTop: 0 };
    container.yogaNode!.setWidth(40);
    container.yogaNode!.setHeight(10);
    container.yogaNode!.setOverflow(Yoga.OVERFLOW_SCROLL);

    return container;
};

const addChild = (parent: ReturnType<typeof createNode>, height: number, sticky?: boolean | "top" | "bottom") => {
    const child = createNode("ink-box");

    child.yogaNode!.setWidth(40);
    child.yogaNode!.setHeight(height);
    child.parentNode = parent;
    parent.childNodes.push(child);
    parent.yogaNode!.insertChild(child.yogaNode!, parent.yogaNode!.getChildCount());

    if (sticky) {
        child.internal_sticky = sticky;
    }

    return child;
};

describe("render-sticky", () => {
    describe(getStickyDescendants, () => {
        it("should find sticky children", () => {
            expect.assertions(3);

            const container = setupScrollableContainer();

            addChild(container, 3, true);
            addChild(container, 20);
            addChild(container, 3, "bottom");

            container.yogaNode!.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);

            const stickyNodes = getStickyDescendants(container);

            expect(stickyNodes).toHaveLength(2);
            expect(stickyNodes[0]!.type).toBe("top");
            expect(stickyNodes[1]!.type).toBe("bottom");
        });

        it("should return empty array when no sticky nodes", () => {
            expect.assertions(1);

            const container = setupScrollableContainer();

            addChild(container, 20);

            container.yogaNode!.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);

            const stickyNodes = getStickyDescendants(container);

            expect(stickyNodes).toHaveLength(0);
        });

        it("should not recurse into nested scroll containers", () => {
            expect.assertions(1);

            const container = setupScrollableContainer();
            const nestedScroll = addChild(container, 20);

            nestedScroll.style = { overflow: "scroll" };

            // Sticky child inside nested scroll container should NOT be found
            const stickyChild = createNode("ink-box");

            stickyChild.internal_sticky = true;
            stickyChild.yogaNode!.setWidth(40);
            stickyChild.yogaNode!.setHeight(3);
            stickyChild.parentNode = nestedScroll;
            nestedScroll.childNodes.push(stickyChild);
            nestedScroll.yogaNode!.insertChild(stickyChild.yogaNode!, 0);

            container.yogaNode!.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);

            const stickyNodes = getStickyDescendants(container);

            expect(stickyNodes).toHaveLength(0);
        });

        it("should skip stickyAlternate nodes", () => {
            expect.assertions(2);

            const container = setupScrollableContainer();
            const stickyNode = addChild(container, 3, true);

            // Add alternate sticky version inside the sticky node
            const alternate = createNode("ink-box");

            alternate.internal_stickyAlternate = true;
            alternate.yogaNode!.setWidth(40);
            alternate.yogaNode!.setHeight(3);
            alternate.parentNode = stickyNode;
            stickyNode.childNodes.push(alternate);
            stickyNode.yogaNode!.insertChild(alternate.yogaNode!, 0);

            addChild(container, 20);

            container.yogaNode!.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);

            // The alternate should not be found as a separate sticky node
            const stickyNodes = getStickyDescendants(container);

            expect(stickyNodes).toHaveLength(1);
            expect(stickyNodes[0]!.type).toBe("top");
        });

        it("should find sticky nodes in non-scrollable nested containers", () => {
            expect.assertions(1);

            const container = setupScrollableContainer();
            const wrapper = addChild(container, 25);

            // Sticky child inside a non-scrollable wrapper SHOULD be found
            const stickyChild = createNode("ink-box");

            stickyChild.internal_sticky = true;
            stickyChild.yogaNode!.setWidth(40);
            stickyChild.yogaNode!.setHeight(3);
            stickyChild.parentNode = wrapper;
            wrapper.childNodes.push(stickyChild);
            wrapper.yogaNode!.insertChild(stickyChild.yogaNode!, 0);

            container.yogaNode!.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);

            const stickyNodes = getStickyDescendants(container);

            expect(stickyNodes).toHaveLength(1);
        });
    });

    describe(identifyActiveStickyNodes, () => {
        it("should identify top-sticky as active when scrolled past it", () => {
            expect.assertions(3);

            const container = setupScrollableContainer();
            const stickyNode = addChild(container, 3, true);

            addChild(container, 30);

            container.yogaNode!.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);
            container.style = { overflow: "scroll", scrollTop: 5 };
            calculateScroll(container);

            const stickyNodes = getStickyDescendants(container);
            const scrollTop = 5;
            const viewportBottom = scrollTop + 10;

            const active = identifyActiveStickyNodes(stickyNodes, container, scrollTop, viewportBottom);

            expect(active).toHaveLength(1);
            expect(active[0]!.type).toBe("top");
            expect(active[0]!.stickyNode).toBe(stickyNode);
        });

        it("should not identify top-sticky as active when it is visible", () => {
            expect.assertions(1);

            const container = setupScrollableContainer();

            addChild(container, 3, true);
            addChild(container, 30);

            container.yogaNode!.calculateLayout(undefined, undefined, Yoga.DIRECTION_LTR);
            container.style = { overflow: "scroll", scrollTop: 0 };
            calculateScroll(container);

            const stickyNodes = getStickyDescendants(container);
            const scrollTop = 0;
            const viewportBottom = scrollTop + 10;

            const active = identifyActiveStickyNodes(stickyNodes, container, scrollTop, viewportBottom);

            expect(active).toHaveLength(0);
        });
    });
});
