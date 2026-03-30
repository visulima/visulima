/**
 * @file Content.test.tsx
 * @description Tests for content height calculation and management in ScrollList.
 *
 * This test suite validates that ScrollList correctly tracks and reports content
 * height as items are added, removed, resized, or replaced. Since ScrollList wraps
 * ink-scroll-view's ScrollView, these tests verify proper delegation and callback handling.
 *
 * ## Test Coverage
 * - Content height updates when items are added or removed
 * - Content height updates when individual item heights change
 * - Manual remeasurement via `remeasureItem()` for internal content changes
 * - Accurate triggering of `onContentHeightChange` callback
 *
 * ## Dependencies
 * - Uses ink-scroll-view's measurement system under the hood
 * - Items must use explicit height or flex behavior for accurate measurement
 */

import { useRef, useState, useEffect } from "react";
import { Box, render, ScrollList, Text } from "../../../src/ink/index";
import type { ScrollListRef } from "../../../src/ink/index";
import { describe, it, expect, vi } from "vitest";

/**
 * Helper function to introduce artificial delays in tests.
 * Necessary because Ink rendering is asynchronous.
 */
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("ContentHeight", () => {
    /**
     * Test: Content height updates when elements are added or removed.
     *
     * Scenario:
     * - Start with 2 items (total height 2)
     * - Add 2 more items (total height 4)
     * - Remove 3 items (total height 1)
     *
     * Expected: `getContentHeight()` returns the accurate sum of all item heights
     */
    it("should update ContentHeight when adding/removing elements", async () => {
        let scrollListRef: ScrollListRef | null = null;
        let setItemsFn: any;

        const TestComponent = () => {
            const ref = useRef<ScrollListRef>(null);
            const [items, setItems] = useState([1, 2]); // Initial height 2
            useEffect(() => {
                scrollListRef = ref.current;
                setItemsFn = setItems;
            }, []);

            return (
                <ScrollList ref={ref} height={5}>
                    {items.map((i) => (
                        <Box key={i} height={1} flexShrink={0}>
                            <Text>Item {i}</Text>
                        </Box>
                    ))}
                </ScrollList>
            );
        };

        const { unmount } = render(<TestComponent />);
        await delay(100);

        const scrollList = scrollListRef!;
        expect(scrollList.getContentHeight()).toBe(2);

        // Add items
        setItemsFn([1, 2, 3, 4]);
        await delay(100);
        expect(scrollList.getContentHeight()).toBe(4);

        // Remove items
        setItemsFn([1]);
        await delay(100);
        expect(scrollList.getContentHeight()).toBe(1);

        unmount();
    });

    /**
     * Verifies that ContentHeight updates when an individual child element resizes.
     */
    it("should update ContentHeight when element size changes", async () => {
        let scrollListRef: ScrollListRef | null = null;
        let setHeightFn: any;

        const Wrapper = ({ children, height }: { children: React.ReactNode; height: number }) => {
            return (
                <Box height={height} flexShrink={0}>
                    {children}
                </Box>
            );
        };

        const TestComponent = () => {
            const ref = useRef<ScrollListRef>(null);
            const [height, setHeight] = useState(1);

            useEffect(() => {
                scrollListRef = ref.current;
                setHeightFn = setHeight;
            }, []);

            return (
                <ScrollList ref={ref} height={5}>
                    <Wrapper height={height}>
                        <Text>Item 1</Text>
                    </Wrapper>
                    <Box height={1} flexShrink={0}>
                        <Text>Item 2</Text>
                    </Box>
                </ScrollList>
            );
        };

        const { unmount } = render(<TestComponent />);
        await delay(100);

        const scrollList = scrollListRef!;
        expect(scrollList.getContentHeight()).toBe(2); // 1 + 1

        // Change height of first item
        setHeightFn(3);
        await delay(100);

        // Check if height updated
        expect(scrollList.getContentHeight()).toBe(4); // 3 + 1

        unmount();
    });

    /**
     * Verifies that `remeasureItem` triggers a height update when internal content size changes.
     */
    it("should trigger remeasureItem correctly when internal content changes size without prop change", async () => {
        let scrollListRef: ScrollListRef | null = null;
        const DynamicItem = ({ index }: { index: number }) => {
            const [lines, setLines] = useState(1);
            useEffect(() => {
                (global as any).window[`setLines_${index}`] = setLines;
            }, [index]);

            return (
                <Box flexDirection="column">
                    {Array.from({ length: lines }).map((_, i) => (
                        <Text key={i}>Line</Text>
                    ))}
                </Box>
            );
        };

        const TestComponent = () => {
            const ref = useRef<ScrollListRef>(null);
            useEffect(() => {
                scrollListRef = ref.current;
            }, []);

            return (
                <ScrollList ref={ref} height={10}>
                    <DynamicItem index={0} />
                    <Box height={1}>
                        <Text>Fixed</Text>
                    </Box>
                </ScrollList>
            );
        };

        const globalStore: any = {};
        (global as any).window = globalStore;

        const { unmount } = render(<TestComponent />);
        await delay(100);

        const scrollList = scrollListRef!;
        expect(scrollList.getContentHeight()).toBe(2);

        if (globalStore["setLines_0"]) {
            globalStore["setLines_0"](5);
        }
        await delay(100);
        expect(scrollList.getContentHeight()).toBe(2); // Still thinks it is 2

        scrollList.remeasureItem(0);
        await delay(100);
        expect(scrollList.getContentHeight()).toBe(6);

        unmount();
    });

    /**
     * Verifies that the `onContentHeightChange` callback is triggered accurately.
     */
    it("should trigger onContentHeightChange callback accurately", async () => {
        const onHeightChange = vi.fn();
        let setItemsFn: any;

        const TestComponent = () => {
            const [items, setItems] = useState([1]);
            useEffect(() => {
                setItemsFn = setItems;
            }, []);

            return (
                <ScrollList height={5} onContentHeightChange={onHeightChange}>
                    {items.map((i) => (
                        <Box key={i} height={1} flexShrink={0}>
                            <Text>{i}</Text>
                        </Box>
                    ))}
                </ScrollList>
            );
        };

        const { unmount } = render(<TestComponent />);
        await delay(100);

        expect(onHeightChange).toHaveBeenCalled();
        // Usually called with (1, 0) initially or just (1, undefined)
        const initialCall = onHeightChange.mock.calls[0];
        expect(initialCall?.[0]).toBe(1);

        // Add Items
        onHeightChange.mockClear();
        setItemsFn([1, 2, 3]);
        await delay(100);
        expect(onHeightChange).toHaveBeenCalledWith(3, 1);

        // Remove Items
        onHeightChange.mockClear();
        setItemsFn([1]);
        await delay(100);
        expect(onHeightChange).toHaveBeenCalledWith(1, 3);

        unmount();
    });
});
