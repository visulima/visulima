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
