import { describe, expect, it } from "vitest";

import { LayoutNode } from "../../src/react/layout";

describe(LayoutNode, () => {
    describe("remove", () => {
        it("should remove itself from its parent", () => {
            expect.assertions(4);

            const parent = new LayoutNode();
            const child = new LayoutNode();

            parent.insertChild(child, 0);

            expect(parent.children).toContain(child);
            expect(child.parent).toBe(parent);

            child.remove();

            expect(parent.children).not.toContain(child);
            expect(child.parent).toBeNull();
        });

        it("should be a no-op when node has no parent", () => {
            expect.assertions(1);

            const node = new LayoutNode();

            // Should not throw
            expect(() => {
                node.remove();
            }).not.toThrow();
        });

        it("should also detach the yoga node from its parent", () => {
            expect.assertions(2);

            const parent = new LayoutNode();
            const child = new LayoutNode();

            parent.insertChild(child, 0);

            expect(parent.yogaNode.getChildCount()).toBe(1);

            child.remove();

            expect(parent.yogaNode.getChildCount()).toBe(0);
        });

        it("should allow re-insertion after removal", () => {
            expect.assertions(3);

            const parentA = new LayoutNode();
            const parentB = new LayoutNode();
            const child = new LayoutNode();

            parentA.insertChild(child, 0);
            child.remove();
            parentB.insertChild(child, 0);

            expect(parentA.children).toHaveLength(0);
            expect(parentB.children).toContain(child);
            expect(child.parent).toBe(parentB);
        });

        it("should remove the correct child when parent has multiple children", () => {
            expect.assertions(4);

            const parent = new LayoutNode();
            const childA = new LayoutNode();
            const childB = new LayoutNode();
            const childC = new LayoutNode();

            parent.insertChild(childA, 0);
            parent.insertChild(childB, 1);
            parent.insertChild(childC, 2);

            childB.remove();

            expect(parent.children).toHaveLength(2);
            expect(parent.children[0]).toBe(childA);
            expect(parent.children[1]).toBe(childC);
            expect(parent.yogaNode.getChildCount()).toBe(2);
        });
    });
});
