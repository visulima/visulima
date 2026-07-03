import { useEffect, useRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";

import type { ScrollViewRef } from "../../../src/components/index";
import { Box, ScrollView, Text } from "../../../src/components/index";
import { render } from "../../../src/ink/index";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Tests for viewport dimension management.
 * @remarks
 * Verifies handling of width/height props, terminal resizing, and viewport callbacks.
 */
describe("dimensions", () => {
    /**
     * Verifies that content height updates when ScrollView width changes (due to text wrapping).
     * @remarks
     * When width decreases, text should wrap more, increasing content height. When width increases, height should decrease.
     */
    it("should update ContentHeight when ScrollView width changes (text wrapping)", async () => {
        expect.assertions(3);

        let scrollViewRef: ScrollViewRef | null = null;
        let setWidthFunction: any;

        const TestComponent = () => {
            const ref = useRef<ScrollViewRef>(null);
            const [width, setWidth] = useState(10);

            useEffect(() => {
                scrollViewRef = ref.current;
                setWidthFunction = setWidth;
            }, []);

            return (
                <ScrollView height={5} ref={ref} width={width}>
                    {/* 20 chars. Width 10 -> 2 lines. Width 21 -> 1 line. */}
                    <Box flexShrink={0}>
                        <Text>12345678901234567890</Text>
                    </Box>
                    <Box flexShrink={0}>
                        <Text>Item 2</Text>
                    </Box>
                </ScrollView>
            );
        };

        const { unmount } = render(<TestComponent />);

        await delay(100);

        const scrollView = scrollViewRef!;

        // Initial width 10.
        // Item 1: 20 chars -> wraps to 2 lines?
        // Ink's Text wraps.
        // So height should be 2 for Item 1 (roughly), + 1 for Item 2 = 3.
        const h1 = scrollView.getContentHeight();

        expect(h1).toBeGreaterThanOrEqual(1);

        // Increase width to 25.
        setWidthFunction(25);
        await delay(100);

        const h2 = scrollView.getContentHeight();

        // Should decrease (less wrapping)
        if (h1 > 2) {
            expect(h2).toBeLessThan(h1);
        }

        expect(h2).toBe(2); // 1 for Item 1 (now fits), 1 for Item 2

        unmount();
    });

    /**
     * Verifies that the `onViewportSizeChange` callback is triggered when dimensions change.
     * @remarks
     * Should be called whenever the ScrollView's own `width` or `height` props change (or terminal resizes).
     */
    it("should trigger onViewportSizeChange when dimensions change", async () => {
        expect.assertions(4);

        let setSizeFunction: any;
        const onViewportSizeChange = vi.fn();

        const TestComponent = () => {
            const [size, setSize] = useState({ h: 5, w: 10 });

            useEffect(() => {
                setSizeFunction = setSize;
            }, []);

            return (
                <ScrollView height={size.h} onViewportSizeChange={onViewportSizeChange} width={size.w}>
                    <Text>Content</Text>
                </ScrollView>
            );
        };

        const { unmount } = render(<TestComponent />);

        await delay(100);

        // Initial call
        expect(onViewportSizeChange).toHaveBeenCalledWith({ height: 5, width: 10 }, expect.any(Object));

        const initialCall = onViewportSizeChange.mock.calls[0];

        expect(initialCall[0]).toEqual({ height: 5, width: 10 });

        // Change size
        onViewportSizeChange.mockClear();
        setSizeFunction({ h: 8, w: 15 });
        await delay(100);

        expect(onViewportSizeChange).toHaveBeenCalledWith({ height: 8, width: 15 }, expect.any(Object));

        const lastCall = onViewportSizeChange.mock.calls[0];

        expect(lastCall[0]).toEqual({ height: 8, width: 15 });

        unmount();
    });

    /**
     * Verifies that scroll offset remains valid when viewport height changes.
     * @remarks
     * Resizing the viewport height should generally preserve the scroll offset, unless the viewport grows so large that the offset is no longer valid.
     * More importantly: Expanding height reduces max scrollable range, but if we are at top (0), we stay at top.
     */
    it("should maintain valid ScrollOffset when height changes", async () => {
        expect.assertions(3);

        let scrollViewRef: ScrollViewRef | null = null;
        let setHeightFunction: any;

        const TestComponent = () => {
            const ref = useRef<ScrollViewRef>(null);
            const [height, setHeight] = useState(5);

            useEffect(() => {
                scrollViewRef = ref.current;
                setHeightFunction = setHeight;
            }, []);

            return (
                <ScrollView height={height} ref={ref}>
                    {Array.from({ length: 20 }).map((_, i) => (
                        <Box key={i}>
                            <Text>
                                Item
                                {i}
                            </Text>
                        </Box>
                    ))}
                </ScrollView>
            );
        };

        const { unmount } = render(<TestComponent />);

        await delay(100);

        const scrollView = scrollViewRef!;

        // Initial height 5. Content 20.
        // Scroll to 10.
        scrollView.scrollTo(10);
        await delay(50);

        expect(scrollView.getScrollOffset()).toBe(10);

        // Increase height to 15.
        setHeightFunction(15);
        await delay(100);

        // Viewport height 15. Content 20.
        // Scroll offset 10 is still valid (<= 20).
        expect(scrollView.getScrollOffset()).toBe(10);

        // Now shrink height to 2.
        // Viewport 2.
        setHeightFunction(2);
        await delay(100);

        expect(scrollView.getScrollOffset()).toBe(10); // Still valid.

        unmount();
    });

    /**
     * Verifies that ScrollView handles zero height gracefully.
     * @remarks
     * Should report 0 content height and 0 viewport height without error.
     */
    it("should handle ScrollView with zero height", async () => {
        // While rare, user might hide the view by setting height 0
        expect.assertions(6);

        let scrollViewRef: ScrollViewRef | null = null;
        let setHeightFunction: any;

        const TestComponent = () => {
            const ref = useRef<ScrollViewRef>(null);
            const [h, setH] = useState(0);

            useEffect(() => {
                scrollViewRef = ref.current;
                setHeightFunction = setH;
            }, []);

            return (
                <ScrollView height={h} ref={ref}>
                    <Box flexShrink={0} height={5}>
                        <Text>Content</Text>
                    </Box>
                </ScrollView>
            );
        };

        const { unmount } = render(<TestComponent />);

        await delay(100);

        const scrollView = scrollViewRef!;

        // Content height is 0 because viewport is 0
        expect(scrollView.getContentHeight()).toBe(0);
        // Viewport height is 0
        expect(scrollView.getViewportHeight()).toBe(0);

        // Bottom offset: 0 - 0 = 0.
        expect(scrollView.getBottomOffset()).toBe(0);

        scrollView.scrollTo(2);
        await delay(50);

        expect(scrollView.getScrollOffset()).toBe(0);

        // Now expand to 5
        setHeightFunction(5);
        await delay(100);

        expect(scrollView.getContentHeight()).toBe(5);
        expect(scrollView.getViewportHeight()).toBe(5);

        unmount();
    });
});
