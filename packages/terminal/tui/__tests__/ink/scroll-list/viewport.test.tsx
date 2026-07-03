/**
 * @file Viewport.test.tsx
 * @description Tests for viewport dimension management in ScrollList.
 *
 * This test suite validates how ScrollList responds to viewport size changes,
 * which can occur when:
 * - The terminal window is resized
 * - The component's width/height props change
 * - Content causes text to wrap differently at different widths
 *
 * ## Test Coverage
 * - Content height updates on width change (text wrapping)
 * - onViewportSizeChange callback triggering
 * - Maintaining selected item visibility when viewport shrinks/grows
 * - Edge cases: viewport larger than content, viewport size 1
 *
 * ## Key Behaviors
 * - ScrollList automatically re-scrolls when viewport changes to keep selection visible
 * - Scroll offset is clamped to valid bounds after resize
 * - Width changes can cause text to rewrap, affecting content height
 */

import { useEffect, useRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";

import type { ScrollListRef } from "../../../src/components/index";
import { Box, ScrollList, Text } from "../../../src/components/index";
import { render } from "../../../src/ink/index";
import waitFor from "../../helpers/wait-for";

/**
 * Helper function to introduce artificial delays in tests.
 */
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("viewport", () => {
    /**
     * Test: Content height updates when width changes (text wrapping).
     *
     * Scenario:
     * - Initial width 10 with 20-character text (should wrap to 2 lines)
     * - Increase width to 25 (text fits on 1 line)
     *
     * Expected Behavior:
     * - Content height should decrease as text no longer wraps
     * - At width 10: "12345678901234567890" wraps to 2 lines
     * - At width 25: same text fits on 1 line
     *
     * Note: This tests the integration with ink-scroll-view's content
     * measurement system.
     */
    it("should update ContentHeight when ScrollList width changes (text wrapping)", async () => {
        expect.assertions(3);

        let scrollListRef: ScrollListRef | null = null;
        let setWidthFunction: (w: number) => void;

        const TestComponent = () => {
            const ref = useRef<ScrollListRef>(null);
            const [width, setWidth] = useState(10);

            useEffect(() => {
                scrollListRef = ref.current;
                setWidthFunction = setWidth;
            }, []);

            return (
                <ScrollList height={5} ref={ref} width={width}>
                    {/* 20 characters of text. Width 10 -> 2 lines. Width 25 -> 1 line. */}
                    <Box flexShrink={0}>
                        <Text>12345678901234567890</Text>
                    </Box>
                    <Box flexShrink={0}>
                        <Text>Item 2</Text>
                    </Box>
                </ScrollList>
            );
        };

        const { unmount } = render(<TestComponent />);

        await waitFor(() => scrollListRef != null);

        const scrollList = scrollListRef!;

        // Initial width 10. Long text wraps.
        await waitFor(() => scrollList.getContentHeight() >= 1);
        const h1 = scrollList.getContentHeight();

        expect(h1).toBeGreaterThanOrEqual(1);

        // Increase width to 25 - text should fit without wrapping
        setWidthFunction!(25);
        await waitFor(() => scrollList.getContentHeight() === 2);

        const h2 = scrollList.getContentHeight();

        // Height should decrease (less wrapping)
        if (h1 > 2) {
            expect(h2).toBeLessThan(h1);
        }

        // With width 25, each item is 1 line: total 2
        expect(h2).toBe(2);

        unmount();
    });

    /**
     * Test: onViewportSizeChange callback is triggered correctly.
     *
     * Scenario:
     * - Initial size: 10x5
     * - Change to: 15x8
     *
     * Expected Behavior:
     * - Callback is called on initial mount with {width: 10, height: 5}
     * - Callback is called again when size changes to {width: 15, height: 8}
     *
     * Note: This callback allows the parent to respond to viewport changes,
     * e.g., to update a scroll indicator or status display.
     */
    it("should trigger onViewportSizeChange when dimensions change", async () => {
        expect.assertions(4);

        let setSizeFunction: (size: { h: number; w: number }) => void;
        const onViewportSizeChange = vi.fn();

        const TestComponent = () => {
            const [size, setSize] = useState({ h: 5, w: 10 });

            useEffect(() => {
                setSizeFunction = setSize;
            }, []);

            return (
                <ScrollList height={size.h} onViewportSizeChange={onViewportSizeChange} width={size.w}>
                    <Text>Content</Text>
                </ScrollList>
            );
        };

        const { unmount } = render(<TestComponent />);

        await waitFor(() => onViewportSizeChange.mock.calls.length > 0);

        // Initial call on mount
        expect(onViewportSizeChange).toHaveBeenCalledWith({ height: 5, width: 10 }, expect.any(Object));

        const initialCall = onViewportSizeChange.mock.calls[0];

        expect(initialCall?.[0]).toEqual({ height: 5, width: 10 });

        // Change size
        onViewportSizeChange.mockClear();
        setSizeFunction!({ h: 8, w: 15 });
        await waitFor(() => onViewportSizeChange.mock.calls.length > 0);

        // Should be called again with new dimensions
        expect(onViewportSizeChange).toHaveBeenCalledWith({ height: 8, width: 15 }, expect.any(Object));

        const lastCall = onViewportSizeChange.mock.calls[0];

        expect(lastCall?.[0]).toEqual({ height: 8, width: 15 });

        unmount();
    });

    /**
     * Test: Selected item remains visible when viewport height changes.
     *
     * Scenario:
     * - 20 items, initial height 5, selectedIndex = 10
     * - Increase height to 15
     * - Decrease height to 2
     *
     * Expected Behavior:
     * - Initial: Item 10 is visible, scroll offset > 0
     * - After increase to 15: More items visible, scroll offset may decrease
     * - After decrease to 2: Item 10 must still be visible, offset adjusts
     *
     * This tests the handleViewportSizeChange callback which re-scrolls
     * to keep the selected item visible after resize.
     */
    it("should maintain valid ScrollOffset when height changes with selected item", async () => {
        expect.assertions(4);

        let scrollListRef: ScrollListRef | null = null;
        let setHeightFunction: (h: number) => void;
        let setIndexFunction: (i: number) => void;

        const TestComponent = () => {
            const ref = useRef<ScrollListRef>(null);
            const [height, setHeight] = useState(5);
            const [index, setIndex] = useState(10);

            useEffect(() => {
                scrollListRef = ref.current;
                setHeightFunction = setHeight;
                setIndexFunction = setIndex;
            }, []);

            return (
                <ScrollList height={height} ref={ref} selectedIndex={index}>
                    {Array.from({ length: 20 }).map((_, i) => (
                        <Box key={i}>
                            <Text>
                                Item
                                {i}
                            </Text>
                        </Box>
                    ))}
                </ScrollList>
            );
        };

        const { unmount } = render(<TestComponent />);

        await waitFor(() => scrollListRef != null);

        const scrollList = scrollListRef!;

        // Initial: height 5, content 20, selectedIndex 10
        // Item 10 should be visible. With auto alignment, offset should be around 6.
        await waitFor(() => scrollList.getScrollOffset() > 0);
        const offsetBefore = scrollList.getScrollOffset();

        expect(offsetBefore).toBeGreaterThan(0);

        // Increase height to 15. More content visible.
        // Max scroll = 20 - 15 = 5. Current offset may need clamping.
        setHeightFunction!(15);
        await waitFor(() => scrollList.getScrollOffset() <= 5);

        // If previous offset was 6, it should clamp to max (5)
        expect(scrollList.getScrollOffset()).toBeLessThanOrEqual(5);

        // Shrink height to 2. Only 2 items visible at once.
        // Item 10 must still be visible -> offset should be 9 or 10.
        // handleViewportSizeChange auto-scrolls to keep selection visible.
        setHeightFunction!(2);
        await waitFor(() => scrollList.getScrollOffset() >= 9);

        const offsetAfter = scrollList.getScrollOffset();

        // Item 10 is at line 10. Viewport 2 shows [offset, offset+2).
        // For item 10 to be visible: offset <= 10 < offset + 2
        // So offset should be 9 or 10.
        expect(offsetAfter).toBeGreaterThanOrEqual(9);
        expect(offsetAfter).toBeLessThanOrEqual(10);

        unmount();
    });

    /**
     * Tests for boundary conditions.
     */
    describe("boundary Cases", () => {
        /**
         * Test: Scroll offset clamped when viewport is larger than content.
         *
         * Scenario:
         * - 3 items (total height 3), viewport height 10
         * - Try to scroll to offset 5
         *
         * Expected Behavior:
         * - Max scroll = 3 - 10 = -7 -> clamped to 0
         * - Any scroll attempt should result in offset 0
         *
         * This prevents showing empty space at the bottom of the list.
         */
        it("should clamp scroll offset to 0 when viewport is larger than content", async () => {
            expect.assertions(1);

            let scrollListRef: ScrollListRef | null = null;
            const TestComponent = () => {
                const ref = useRef<ScrollListRef>(null);

                useEffect(() => {
                    scrollListRef = ref.current;
                }, []);

                return (
                    <ScrollList height={10} ref={ref}>
                        {Array.from({ length: 3 }).map((_, i) => (
                            <Box height={1} key={i}>
                                <Text>{i}</Text>
                            </Box>
                        ))}
                    </ScrollList>
                );
            };

            const { unmount } = render(<TestComponent />);

            await waitFor(() => scrollListRef != null);
            const scrollList = scrollListRef!;

            // Content height 3. Viewport 10. Max scroll = max(0, 3-10) = 0.
            // Any scroll attempt should clamp to 0.
            scrollList.scrollTo(5);
            // Offset stays 0 (clamped). Give a brief delay then check.
            await delay(50);

            expect(scrollList.getScrollOffset()).toBe(0);

            unmount();
        });

        /**
         * Test: Viewport size 1 (minimum usable viewport).
         *
         * Scenario:
         * - 5 items, viewport height 1
         * - Try to scroll to offset 10
         *
         * Expected Behavior:
         * - Max scroll = 5 - 1 = 4
         * - Scroll to 10 should clamp to 4
         *
         * This tests the minimum viewport size where only one item is visible.
         */
        it("should handle viewport size 1", async () => {
            expect.assertions(1);

            let scrollListRef: ScrollListRef | null = null;
            const TestComponent = () => {
                const ref = useRef<ScrollListRef>(null);

                useEffect(() => {
                    scrollListRef = ref.current;
                }, []);

                return (
                    <ScrollList height={1} ref={ref}>
                        {Array.from({ length: 5 }).map((_, i) => (
                            <Box height={1} key={i}>
                                <Text>{i}</Text>
                            </Box>
                        ))}
                    </ScrollList>
                );
            };

            const { unmount } = render(<TestComponent />);

            await waitFor(() => scrollListRef != null);
            const scrollList = scrollListRef!;

            // Content 5. Viewport 1. Max scroll = 5 - 1 = 4.
            scrollList.scrollTo(10);
            await waitFor(() => scrollList.getScrollOffset() === 4);

            expect(scrollList.getScrollOffset()).toBe(4);

            unmount();
        });
    });
});
