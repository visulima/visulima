import { describe, expect, it } from "vitest";

import { createNode, createTextNode } from "../../src/ink/dom";
import { applySelectionToStyledLine, comparePoints, Range, Selection } from "../../src/ink/selection";
import { INVERSE_MASK } from "../../src/ink/style-flags";
import { plainTextToStyledLine } from "../../src/ink/styled-line-factory";

describe("selection", () => {
    describe(comparePoints, () => {
        it("should return 0 for same node and offset", () => {
            expect.assertions(1);

            const node = createTextNode("hello");

            expect(comparePoints(node, 0, node, 0)).toBe(0);
        });

        it("should compare offsets within the same node", () => {
            expect.assertions(2);

            const node = createTextNode("hello");

            expect(comparePoints(node, 0, node, 3)).toBe(-1);
            expect(comparePoints(node, 3, node, 0)).toBe(1);
        });

        it("should compare sibling nodes", () => {
            expect.assertions(2);

            const parent = createNode("ink-box");
            const child1 = createTextNode("a");
            const child2 = createTextNode("b");

            child1.parentNode = parent;
            child2.parentNode = parent;
            parent.childNodes.push(child1, child2);

            expect(comparePoints(child1, 0, child2, 0)).toBe(-1);
            expect(comparePoints(child2, 0, child1, 0)).toBe(1);
        });

        it("should return 0 when the two nodes share no common ancestor", () => {
            expect.assertions(1);

            const orphanA = createTextNode("a");
            const orphanB = createTextNode("b");

            expect(comparePoints(orphanA, 0, orphanB, 0)).toBe(0);
        });

        it("should order an ancestor offset against a descendant on side A", () => {
            expect.assertions(2);

            const parent = createNode("ink-box");
            const child = createTextNode("child");

            child.parentNode = parent;
            parent.childNodes.push(child);

            // A is the parent (ancestor of B's path). Offset 0 is before child index 0.
            expect(comparePoints(parent, 0, child, 0)).toBe(-1);
            // Offset 1 is after child index 0.
            expect(comparePoints(parent, 1, child, 0)).toBe(1);
        });

        it("should order a descendant on side A against its ancestor on side B", () => {
            expect.assertions(2);

            const parent = createNode("ink-box");
            const child = createTextNode("child");

            child.parentNode = parent;
            parent.childNodes.push(child);

            // B is the parent (ancestor of A's path).
            expect(comparePoints(child, 0, parent, 1)).toBe(-1);
            expect(comparePoints(child, 0, parent, 0)).toBe(1);
        });

        it("should compare descendants living under different branches of a shared ancestor", () => {
            expect.assertions(2);

            const root = createNode("ink-box");
            const branchA = createNode("ink-box");
            const branchB = createNode("ink-box");
            const leafA = createTextNode("a");
            const leafB = createTextNode("b");

            branchA.parentNode = root;
            branchB.parentNode = root;
            leafA.parentNode = branchA;
            leafB.parentNode = branchB;
            root.childNodes.push(branchA, branchB);
            branchA.childNodes.push(leafA);
            branchB.childNodes.push(leafB);

            expect(comparePoints(leafA, 0, leafB, 0)).toBe(-1);
            expect(comparePoints(leafB, 0, leafA, 0)).toBe(1);
        });
    });

    describe(Range, () => {
        it("should start collapsed", () => {
            expect.assertions(1);

            const range = new Range();

            expect(range.collapsed).toBe(true);
        });

        it("should set start and end", () => {
            expect.assertions(5);

            const range = new Range();
            const node = createTextNode("hello");

            range.setStart(node, 0);
            range.setEnd(node, 5);

            expect(range.startContainer).toBe(node);
            expect(range.startOffset).toBe(0);
            expect(range.endContainer).toBe(node);
            expect(range.endOffset).toBe(5);
            expect(range.collapsed).toBe(false);
        });

        it("should collapse to start", () => {
            expect.assertions(3);

            const range = new Range();
            const node = createTextNode("hello");

            range.setStart(node, 0);
            range.setEnd(node, 5);
            range.collapse(true);

            expect(range.startOffset).toBe(0);
            expect(range.endOffset).toBe(0);
            expect(range.collapsed).toBe(true);
        });

        it("should collapse to end", () => {
            expect.assertions(3);

            const range = new Range();
            const node = createTextNode("hello");

            range.setStart(node, 0);
            range.setEnd(node, 5);
            range.collapse(false);

            expect(range.startOffset).toBe(5);
            expect(range.endOffset).toBe(5);
            expect(range.collapsed).toBe(true);
        });

        it("should select a node", () => {
            expect.assertions(3);

            const parent = createNode("ink-box");
            const child = createTextNode("hello");

            child.parentNode = parent;
            parent.childNodes.push(child);

            const range = new Range();

            range.selectNode(child);

            expect(range.startContainer).toBe(parent);
            expect(range.endContainer).toBe(parent);
            expect(range.collapsed).toBe(false);
        });

        it("should select node contents", () => {
            expect.assertions(2);

            const node = createTextNode("hello");

            const range = new Range();

            range.selectNodeContents(node);

            expect(range.startOffset).toBe(0);
            expect(range.endOffset).toBe(5);
        });

        it("should compute common ancestor for same node", () => {
            expect.assertions(1);

            const node = createTextNode("hello");

            const range = new Range();

            range.setStart(node, 0);
            range.setEnd(node, 5);

            expect(range.commonAncestorContainer).toBe(node);
        });

        it("should compute common ancestor for sibling nodes", () => {
            expect.assertions(1);

            const parent = createNode("ink-box");
            const child1 = createTextNode("a");
            const child2 = createTextNode("b");

            child1.parentNode = parent;
            child2.parentNode = parent;
            parent.childNodes.push(child1, child2);

            const range = new Range();

            range.setStart(child1, 0);
            range.setEnd(child2, 0);

            expect(range.commonAncestorContainer).toBe(parent);
        });

        it("should return an empty string when collapsed", () => {
            expect.assertions(1);

            const range = new Range();
            const node = createTextNode("hello");

            range.setStart(node, 2);
            range.setEnd(node, 2);

            expect(range.toString()).toBe("");
        });

        it("should return the selected substring of a single text node", () => {
            expect.assertions(1);

            const node = createTextNode("hello world");

            const range = new Range();

            range.setStart(node, 0);
            range.setEnd(node, 5);

            expect(range.toString()).toBe("hello");
        });

        it("should extract text spanning multiple child text nodes", () => {
            expect.assertions(1);

            const parent = createNode("ink-text");
            const child1 = createTextNode("foo");
            const child2 = createTextNode("bar");

            child1.parentNode = parent;
            child2.parentNode = parent;
            parent.childNodes.push(child1, child2);

            const range = new Range();

            // From the start of the first child to the end of the second.
            range.setStart(child1, 0);
            range.setEnd(child2, 3);

            expect(range.toString()).toBe("foobar");
        });
    });

    describe(Selection, () => {
        it("should start with no ranges", () => {
            expect.assertions(2);

            const selection = new Selection();

            expect(selection.rangeCount).toBe(0);
            expect(selection.isCollapsed).toBe(true);
        });

        it("should add a range", () => {
            expect.assertions(3);

            const selection = new Selection();
            const range = new Range();
            const node = createTextNode("hello");

            range.setStart(node, 0);
            range.setEnd(node, 5);
            selection.addRange(range);

            expect(selection.rangeCount).toBe(1);
            expect(selection.anchorNode).toBe(node);
            expect(selection.focusNode).toBe(node);
        });

        it("should not add duplicate ranges", () => {
            expect.assertions(1);

            const selection = new Selection();
            const range = new Range();

            selection.addRange(range);
            selection.addRange(range);

            expect(selection.rangeCount).toBe(1);
        });

        it("should remove a range", () => {
            expect.assertions(1);

            const selection = new Selection();
            const range = new Range();

            selection.addRange(range);
            selection.removeRange(range);

            expect(selection.rangeCount).toBe(0);
        });

        it("should remove all ranges", () => {
            expect.assertions(2);

            const selection = new Selection();

            selection.addRange(new Range());
            selection.addRange(new Range());
            selection.removeAllRanges();

            expect(selection.rangeCount).toBe(0);
            expect(selection.isCollapsed).toBe(true);
        });

        it("should fire onChange listeners", () => {
            expect.assertions(1);

            const selection = new Selection();
            let called = 0;

            selection.onChange(() => called++);
            selection.addRange(new Range());

            expect(called).toBe(1);
        });

        it("should collapse to a point", () => {
            expect.assertions(2);

            const selection = new Selection();
            const node = createTextNode("hello");

            selection.collapse(node, 3);

            expect(selection.rangeCount).toBe(1);
            expect(selection.isCollapsed).toBe(true);
        });

        it("should check containsNode", () => {
            expect.assertions(3);

            const parent = createNode("ink-box");
            const child1 = createTextNode("a");
            const child2 = createTextNode("b");
            const child3 = createTextNode("c");

            child1.parentNode = parent;
            child2.parentNode = parent;
            child3.parentNode = parent;
            parent.childNodes.push(child1, child2, child3);

            const selection = new Selection();
            const range = new Range();

            range.setStart(parent, 0);
            range.setEnd(parent, 2);
            selection.addRange(range);

            expect(selection.containsNode(child1)).toBe(true);
            expect(selection.containsNode(child2)).toBe(true);
            expect(selection.containsNode(child3)).toBe(false);
        });

        it("should return the range stored at the given index", () => {
            expect.assertions(1);

            const selection = new Selection();
            const range = new Range();

            selection.addRange(range);

            expect(selection.getRangeAt(0)).toBe(range);
        });

        it("should concatenate the text of all contained ranges", () => {
            expect.assertions(1);

            const selection = new Selection();
            const nodeA = createTextNode("foo");
            const nodeB = createTextNode("bar");

            const rangeA = new Range();

            rangeA.setStart(nodeA, 0);
            rangeA.setEnd(nodeA, 3);

            const rangeB = new Range();

            rangeB.setStart(nodeB, 0);
            rangeB.setEnd(nodeB, 3);

            selection.addRange(rangeA);
            selection.addRange(rangeB);

            expect(selection.toString()).toBe("foobar");
        });

        it("should return false from containsNode for a parentless node", () => {
            expect.assertions(1);

            const selection = new Selection();
            const orphan = createTextNode("orphan");

            selection.addRange(new Range());

            expect(selection.containsNode(orphan)).toBe(false);
        });

        it("should ignore ranges with unset containers in containsNode", () => {
            expect.assertions(1);

            const parent = createNode("ink-box");
            const child = createTextNode("a");

            child.parentNode = parent;
            parent.childNodes.push(child);

            const selection = new Selection();

            // An empty (unset) range must not match any node.
            selection.addRange(new Range());

            expect(selection.containsNode(child)).toBe(false);
        });

        it("should honor allowPartialContainment", () => {
            expect.assertions(2);

            const parent = createNode("ink-box");
            const child1 = createTextNode("a");
            const child2 = createTextNode("b");
            const child3 = createTextNode("c");

            child1.parentNode = parent;
            child2.parentNode = parent;
            child3.parentNode = parent;
            parent.childNodes.push(child1, child2, child3);

            const selection = new Selection();
            const range = new Range();

            // Selection strictly inside [child1 .. child3): child2 is partially within.
            range.setStart(parent, 1);
            range.setEnd(parent, 2);
            selection.addRange(range);

            expect(selection.containsNode(child2, true)).toBe(true);
            expect(selection.containsNode(child1, true)).toBe(false);
        });
    });

    describe(applySelectionToStyledLine, () => {
        it("should apply INVERSE style to characters in range", () => {
            expect.assertions(4);

            const line = plainTextToStyledLine("hello");

            const result = applySelectionToStyledLine(line, { end: 3, start: 1 });

            // Characters at index 1 and 2 should have INVERSE applied
            expect(result.getFormatFlags(0) & INVERSE_MASK).toBe(0); // 'h' - not selected
            expect(result.getFormatFlags(1) & INVERSE_MASK).toBe(INVERSE_MASK); // 'e' - selected
            expect(result.getFormatFlags(2) & INVERSE_MASK).toBe(INVERSE_MASK); // 'l' - selected
            expect(result.getFormatFlags(3) & INVERSE_MASK).toBe(0); // 'l' - not selected
        });

        it("should not modify when range is empty", () => {
            expect.assertions(1);

            const line = plainTextToStyledLine("hel");

            const result = applySelectionToStyledLine(line, { end: 0, start: 0 });

            // Should return the same line (no mutation needed)
            expect(result).toBe(line);
        });

        it("should not modify empty line", () => {
            expect.assertions(1);

            const line = plainTextToStyledLine("");

            const result = applySelectionToStyledLine(line, { end: 3, start: 1 });

            expect(result).toBe(line);
        });

        it("should clamp range to line bounds", () => {
            expect.assertions(3);

            const line = plainTextToStyledLine("abc");

            const result = applySelectionToStyledLine(line, { end: 10, start: 1 });

            expect(result.getFormatFlags(0) & INVERSE_MASK).toBe(0); // 'a' - not selected
            expect(result.getFormatFlags(1) & INVERSE_MASK).toBe(INVERSE_MASK); // 'b' - selected
            expect(result.getFormatFlags(2) & INVERSE_MASK).toBe(INVERSE_MASK); // 'c' - selected
        });

        it("should not mutate the original line", () => {
            expect.assertions(1);

            const line = plainTextToStyledLine("hello");

            applySelectionToStyledLine(line, { end: 3, start: 1 });

            // Original should be unchanged
            expect(line.getFormatFlags(1) & INVERSE_MASK).toBe(0);
        });
    });
});
