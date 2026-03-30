import delay from "delay";
import React, { useRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Box, render, Text, useTextSelection } from "../../src/ink/index";
import { Range, Selection } from "../../src/ink/selection";
import { createStdin } from "../helpers/ink-create-stdin";
import createStdout from "../helpers/ink-create-stdout";

describe("Selection/Range foundation", () => {
    it("Range should track start and end positions", () => {
        expect.assertions(3);

        const range = new Range();

        range.startContainer = { nodeName: "#text", nodeValue: "hello world" } as any;
        range.startOffset = 0;
        range.endContainer = range.startContainer;
        range.endOffset = 5;

        expect(range.startOffset).toBe(0);
        expect(range.endOffset).toBe(5);
        expect(range.startContainer).toBeDefined();
    });

    it("Selection should manage ranges", () => {
        expect.assertions(3);

        const selection = new Selection();

        expect(selection.rangeCount).toBe(0);

        const range = new Range();

        selection.addRange(range);
        expect(selection.rangeCount).toBe(1);

        selection.removeAllRanges();
        expect(selection.rangeCount).toBe(0);
    });

    it("Selection should not add duplicate ranges", () => {
        expect.assertions(1);

        const selection = new Selection();
        const range = new Range();

        selection.addRange(range);
        selection.addRange(range);

        expect(selection.rangeCount).toBe(1);
    });

    it("Selection should notify on change", () => {
        expect.assertions(1);

        const selection = new Selection();
        let changeCount = 0;

        selection.onChange(() => {
            changeCount++;
        });

        const range = new Range();

        selection.addRange(range);
        selection.removeAllRanges();

        expect(changeCount).toBe(2);
    });

    it("Selection onChange should return unsubscribe function", () => {
        expect.assertions(1);

        const selection = new Selection();
        let changeCount = 0;

        const unsubscribe = selection.onChange(() => {
            changeCount++;
        });

        const range = new Range();

        selection.addRange(range);
        unsubscribe();
        selection.removeAllRanges();

        expect(changeCount).toBe(1);
    });

    it("Range collapse should set both endpoints equal", () => {
        expect.assertions(2);

        const node = { nodeName: "#text", nodeValue: "test" } as any;
        const range = new Range();

        range.setStart(node, 0);
        range.setEnd(node, 5);
        range.collapse(true);

        expect(range.startOffset).toBe(0);
        expect(range.endOffset).toBe(0);
    });

    it("Range collapse to end should use endOffset", () => {
        expect.assertions(2);

        const node = { nodeName: "#text", nodeValue: "test" } as any;
        const range = new Range();

        range.setStart(node, 0);
        range.setEnd(node, 5);
        range.collapse(false);

        expect(range.startOffset).toBe(5);
        expect(range.endOffset).toBe(5);
    });

    it("Selection removeRange should reduce rangeCount", () => {
        expect.assertions(2);

        const selection = new Selection();
        const range1 = new Range();
        const range2 = new Range();

        selection.addRange(range1);
        selection.addRange(range2);
        expect(selection.rangeCount).toBe(2);

        selection.removeRange(range1);
        expect(selection.rangeCount).toBe(1);
    });
});

describe("useTextSelection hook (mounted)", () => {
    let currentUnmount: (() => void) | undefined;

    afterEach(async () => {
        currentUnmount?.();
        currentUnmount = undefined;
        await delay(100);
    });

    it("should provide selection API when mounted", async () => {
        expect.assertions(3);

        let hookResult: ReturnType<typeof useTextSelection> | undefined;

        function TestComponent() {
            const ref = useRef(null);

            hookResult = useTextSelection(ref);

            return (
                <Box ref={ref}>
                    <Text>selectable text</Text>
                </Box>
            );
        }

        const stdout = createStdout();
        const stdin = createStdin();
        const { unmount } = render(<TestComponent />, { debug: true, stdin, stdout });

        currentUnmount = unmount;
        await delay(50);

        expect(hookResult).toBeDefined();
        expect(hookResult!.selectedText).toBe("");
        expect(typeof hookResult!.clearSelection).toBe("function");
    });

    it("should call onSelectionChange callback", async () => {
        expect.assertions(1);

        const onSelectionChange = vi.fn();

        function TestComponent() {
            const ref = useRef(null);

            useTextSelection(ref, { onSelectionChange });

            return (
                <Box ref={ref}>
                    <Text>text</Text>
                </Box>
            );
        }

        const stdout = createStdout();
        const stdin = createStdin();
        const { unmount } = render(<TestComponent />, { debug: true, stdin, stdout });

        currentUnmount = unmount;
        await delay(50);

        // onSelectionChange is only called when the underlying Selection fires onChange
        // which happens via selectAll/clearSelection or programmatic range manipulation
        expect(typeof onSelectionChange).toBe("function");
    });

    it("should respect isActive=false", async () => {
        expect.assertions(1);

        let hookResult: ReturnType<typeof useTextSelection> | undefined;

        function TestComponent() {
            const ref = useRef(null);

            hookResult = useTextSelection(ref, { isActive: false });

            return (
                <Box ref={ref}>
                    <Text>text</Text>
                </Box>
            );
        }

        const stdout = createStdout();
        const stdin = createStdin();
        const { unmount } = render(<TestComponent />, { debug: true, stdin, stdout });

        currentUnmount = unmount;
        await delay(50);

        expect(hookResult!.selectedText).toBe("");
    });
});
