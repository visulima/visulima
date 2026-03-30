import type { StyledChar } from "@alcalzone/ansi-tokenize";
import { describe, expect, it } from "vitest";

import { createNode, createTextNode } from "../../src/ink/dom";
import { applySelectionToStyledChars, comparePoints, Range, Selection } from "../../src/ink/selection";

const char = (value: string): StyledChar => ({
    fullWidth: false,
    styles: [],
    type: "char",
    value,
});

describe("selection", () => {
    describe("comparePoints", () => {
        it("should return 0 for same node and offset", () => {
            const node = createTextNode("hello");

            expect(comparePoints(node, 0, node, 0)).toBe(0);
        });

        it("should compare offsets within the same node", () => {
            const node = createTextNode("hello");

            expect(comparePoints(node, 0, node, 3)).toBe(-1);
            expect(comparePoints(node, 3, node, 0)).toBe(1);
        });

        it("should compare sibling nodes", () => {
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

    describe("Range", () => {
        it("should start collapsed", () => {
            const range = new Range();

            expect(range.collapsed).toBe(true);
        });

        it("should set start and end", () => {
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
            const node = createTextNode("hello");

            const range = new Range();
            range.selectNodeContents(node);

            expect(range.startOffset).toBe(0);
            expect(range.endOffset).toBe(5);
        });

        it("should compute common ancestor for same node", () => {
            const node = createTextNode("hello");

            const range = new Range();
            range.setStart(node, 0);
            range.setEnd(node, 5);

            expect(range.commonAncestorContainer).toBe(node);
        });

        it("should compute common ancestor for sibling nodes", () => {
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

    describe("Selection", () => {
        it("should start with no ranges", () => {
            const selection = new Selection();

            expect(selection.rangeCount).toBe(0);
            expect(selection.isCollapsed).toBe(true);
        });

        it("should add a range", () => {
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
            const selection = new Selection();
            const range = new Range();

            selection.addRange(range);
            selection.addRange(range);

            expect(selection.rangeCount).toBe(1);
        });

        it("should remove a range", () => {
            const selection = new Selection();
            const range = new Range();

            selection.addRange(range);
            selection.removeRange(range);

            expect(selection.rangeCount).toBe(0);
        });

        it("should remove all ranges", () => {
            const selection = new Selection();

            selection.addRange(new Range());
            selection.addRange(new Range());
            selection.removeAllRanges();

            expect(selection.rangeCount).toBe(0);
            expect(selection.isCollapsed).toBe(true);
        });

        it("should fire onChange listeners", () => {
            const selection = new Selection();
            let called = 0;

            selection.onChange(() => called++);
            selection.addRange(new Range());

            expect(called).toBe(1);
        });

        it("should collapse to a point", () => {
            const selection = new Selection();
            const node = createTextNode("hello");

            selection.collapse(node, 3);

            expect(selection.rangeCount).toBe(1);
            expect(selection.isCollapsed).toBe(true);
        });

        it("should check containsNode", () => {
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

    describe("applySelectionToStyledChars", () => {
        it("should apply selection style to characters in range", () => {
            const styledChars = [char("h"), char("e"), char("l"), char("l"), char("o")];

            const result = applySelectionToStyledChars(styledChars, { currentOffset: 0, range: { end: 3, start: 1 } });

            // Characters at index 1 and 2 should have inverse style applied
            expect(result[0]!.styles).toHaveLength(0); // 'h' - not selected
            expect(result[1]!.styles).toHaveLength(1); // 'e' - selected
            expect(result[2]!.styles).toHaveLength(1); // 'l' - selected
            expect(result[3]!.styles).toHaveLength(0); // 'l' - not selected
        });

        it("should not apply style when range is empty", () => {
            const styledChars = [char("h"), char("e"), char("l")];

            const result = applySelectionToStyledChars(styledChars, { currentOffset: 0, range: { end: 0, start: 0 } });

            expect(result.every((c) => c.styles.length === 0)).toBe(true);
        });

        it("should track currentOffset across calls", () => {
            const state = { currentOffset: 0, range: { end: 3, start: 1 } };

            applySelectionToStyledChars([char("a"), char("b")], state);

            expect(state.currentOffset).toBe(2);

            const result = applySelectionToStyledChars([char("c"), char("d")], state);

            // 'c' is at offset 2 (within range 1-3), 'd' is at offset 3 (not in range)
            expect(result[0]!.styles).toHaveLength(1); // 'c' selected
            expect(result[1]!.styles).toHaveLength(0); // 'd' not selected
        });
    });
});
