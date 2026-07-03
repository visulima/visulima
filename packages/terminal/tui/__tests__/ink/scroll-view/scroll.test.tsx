import { useEffect, useRef, useState } from "react";
import { describe, expect, it } from "vitest";

import type { ScrollViewRef } from "../../../src/components/index";
import { Box, ScrollView, Text } from "../../../src/components/index";
import { render } from "../../../src/ink/index";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Tests for scrolling functionality.
 * @remarks
 * Covers basic scrolling, bounds clamping, and scroll offset maintenance during content changes.
 */
describe("scrollOffset", () => {
    /**
     * Verifies basic API methods `scrollTo`, `scrollBy`, `scrollToBottom`.
     * @remarks
     * Scroll offset should update correctly according to the requested operation.
     */
    it("should handle basic scrolling", async () => {
        expect.assertions(4);

        let scrollViewRef: ScrollViewRef | null = null;

        const TestComponent = () => {
            const ref = useRef<ScrollViewRef>(null);

            useEffect(() => {
                scrollViewRef = ref.current;
            }, []);

            return (
                <ScrollView height={5} ref={ref}>
                    {Array.from({ length: 10 }).map((_, i) => (
                        <Box flexShrink={0} height={1} key={i}>
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

        // Initial
        expect(scrollView.getScrollOffset()).toBe(0);

        // Scroll To
        scrollView.scrollTo(3);
        await delay(50);

        expect(scrollView.getScrollOffset()).toBe(3);

        // Scroll By
        scrollView.scrollBy(2); // 3 + 2 = 5
        await delay(50);

        expect(scrollView.getScrollOffset()).toBe(5);

        // Scroll To Bottom
        scrollView.scrollToBottom();
        // 10 - 5 = 5. Wait, current is 5.
        await delay(50);

        expect(scrollView.getScrollOffset()).toBe(5);

        unmount();
    });

    /**
     * Verifies that scrolling to invalid positions (negative or beyond content height) is clamped.
     * @remarks
     * Scroll offset should be clamped between 0 and (contentHeight - viewportHeight).
     */
    it("should clamp illegal positions", async () => {
        expect.assertions(2);

        let scrollViewRef: ScrollViewRef | null = null;

        const TestComponent = () => {
            const ref = useRef<ScrollViewRef>(null);

            useEffect(() => {
                scrollViewRef = ref.current;
            }, []);

            return (
                <ScrollView height={5} ref={ref}>
                    {Array.from({ length: 10 }).map((_, i) => (
                        <Box flexShrink={0} height={1} key={i}>
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

        // Negative
        scrollView.scrollTo(-5);
        await delay(50);

        expect(scrollView.getScrollOffset()).toBe(0);

        // Too large — clamps to contentHeight - viewportHeight (bottom of content visible)
        scrollView.scrollTo(100);
        await delay(50);

        expect(scrollView.getScrollOffset()).toBe(5);

        unmount();
    });

    /**
     * Verifies that scroll offset is adjusted when content height decreases.
     * @remarks
     * If the user is scrolled past the new maximum offset, the scroll position should automatically snap back to the new bottom.
     */
    it("should adjust ScrollOffset when ContentHeight decreases", async () => {
        expect.assertions(5);

        let scrollViewRef: ScrollViewRef | null = null;
        let setItemsFunction: any;

        const TestComponent = () => {
            const ref = useRef<ScrollViewRef>(null);
            const [items, setItems] = useState(Array.from({ length: 10 }).map((_, i) => i));

            useEffect(() => {
                scrollViewRef = ref.current;
                setItemsFunction = setItems;
            }, []);

            return (
                <ScrollView height={5} ref={ref}>
                    {items.map((i) => (
                        <Box flexShrink={0} height={1} key={i}>
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

        // Scroll to end — clamps to contentHeight(10) - viewportHeight(5) = 5
        scrollView.scrollTo(10);
        await delay(50);

        expect(scrollView.getScrollOffset()).toBe(5);

        // Reduce items to 5
        setItemsFunction([0, 1, 2, 3, 4]);
        await delay(100);

        // ContentHeight is now 5, viewportHeight is 5 — all content visible, no scroll needed.
        // ScrollOffset should clamp to max(0, 5-5) = 0.
        expect(scrollView.getContentHeight()).toBe(5);
        expect(scrollView.getScrollOffset()).toBe(0);

        // Reduce items to 2
        setItemsFunction([0, 1]);
        await delay(100);

        // ContentHeight is 2, viewportHeight is 5 — all content visible.
        // ScrollOffset should be max(0, 2-5) = 0.
        expect(scrollView.getContentHeight()).toBe(2);
        expect(scrollView.getScrollOffset()).toBe(0);

        unmount();
    });

    /**
     * Verifies scrolling logic with a single child larger than the viewport.
     * @remarks
     * Scroll logic should work identically whether content is many small items or one large item.
     */
    it("should scroll correctly with a single child larger than viewport", async () => {
        expect.assertions(3);

        let scrollViewRef: ScrollViewRef | null = null;

        const TestComponent = () => {
            const ref = useRef<ScrollViewRef>(null);

            useEffect(() => {
                scrollViewRef = ref.current;
            }, []);

            return (
                <ScrollView height={3} ref={ref}>
                    <Box flexShrink={0} height={10}>
                        <Text>Tall Item</Text>
                    </Box>
                </ScrollView>
            );
        };

        const { unmount } = render(<TestComponent />);

        await delay(100);

        const scrollView = scrollViewRef!;

        expect(scrollView.getContentHeight()).toBe(10);

        // Scroll halfway
        scrollView.scrollTo(5);
        await delay(50);

        expect(scrollView.getScrollOffset()).toBe(5);

        // Scroll to bottom
        scrollView.scrollToBottom();
        // 10 - 3 = 7
        await delay(50);

        expect(scrollView.getScrollOffset()).toBe(7);

        unmount();
    });

    /**
     * Verifies behavior when content height fits exactly in the viewport.
     * @remarks
     * Max scroll offset should be 0.
     */
    it("should behave correctly when content fits exactly in viewport", async () => {
        expect.assertions(3);

        let scrollViewRef: ScrollViewRef | null = null;

        const TestComponent = () => {
            const ref = useRef<ScrollViewRef>(null);

            useEffect(() => {
                scrollViewRef = ref.current;
            }, []);

            return (
                <ScrollView height={5} ref={ref}>
                    <Box flexShrink={0} height={1}>
                        <Text>1</Text>
                    </Box>
                    <Box flexShrink={0} height={1}>
                        <Text>2</Text>
                    </Box>
                    <Box flexShrink={0} height={1}>
                        <Text>3</Text>
                    </Box>
                    <Box flexShrink={0} height={1}>
                        <Text>4</Text>
                    </Box>
                    <Box flexShrink={0} height={1}>
                        <Text>5</Text>
                    </Box>
                </ScrollView>
            );
        };

        const { unmount } = render(<TestComponent />);

        await delay(100);

        const scrollView = scrollViewRef!;

        expect(scrollView.getContentHeight()).toBe(5);
        expect(scrollView.getBottomOffset()).toBe(0); // 5 - 5 = 0

        scrollView.scrollToBottom();
        await delay(50);

        expect(scrollView.getScrollOffset()).toBe(0);

        unmount();
    });

    /**
     * Verifies that invalid scroll destinations (NaN) are handled safely.
     * @remarks
     * Should gracefully ignore NaN values and not change the offset.
     */
    it("should handle invalid scroll destinations safely (NaN)", async () => {
        expect.assertions(1);

        let scrollViewRef: ScrollViewRef | null = null;

        const TestComponent = () => {
            const ref = useRef<ScrollViewRef>(null);

            useEffect(() => {
                scrollViewRef = ref.current;
            }, []);

            return (
                <ScrollView height={5} ref={ref}>
                    <Box flexShrink={0} height={10}>
                        <Text>Long</Text>
                    </Box>
                </ScrollView>
            );
        };

        const { unmount } = render(<TestComponent />);

        await delay(100);

        const scrollView = scrollViewRef!;

        // NaN
        scrollView.scrollTo(Number.NaN);
        await delay(50);

        // Should stay 0
        expect(scrollView.getScrollOffset()).toBe(0);

        unmount();
    });
});
