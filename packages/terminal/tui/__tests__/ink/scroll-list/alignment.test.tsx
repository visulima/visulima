/**
 * @file Alignment.test.tsx
 * @description Tests for scroll alignment modes in ScrollList.
 *
 * This test suite validates the four scroll alignment modes:
 * - `'auto'`: Minimal scrolling to bring item into view (default)
 * - `'top'`: Align selected item to top of viewport
 * - `'bottom'`: Align selected item to bottom of viewport
 * - `'center'`: Align selected item to center of viewport
 *
 * ## Test Coverage
 * - Auto mode: scroll up, scroll down, no scroll when visible
 * - Explicit modes: top, bottom, center alignment
 * - Clamping: alignment near list boundaries
 * - Boundary cases: large items, first item with bottom alignment
 *
 * ## Alignment Calculation Reference
 * Given an item at position `top` with `height`, and viewport of `viewportHeight`:
 * - Top alignment: `offset = top`
 * - Bottom alignment: `offset = top + height - viewportHeight`
 * - Center alignment: `offset = top + height/2 - viewportHeight/2`
 * - Auto alignment: minimal scroll to bring item fully into view
 */

import { useEffect, useRef, useState } from "react";
import { describe, expect, it } from "vitest";

import type { ScrollListRef } from "../../../src/components/index";
import { Box, ScrollList, Text } from "../../../src/components/index";
import { render } from "../../../src/ink/index";
import waitFor from "../../helpers/wait-for";

/**
 * Helper function to introduce artificial delays in tests.
 * Necessary because Ink rendering is asynchronous.
 */
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("scrollAlignment", () => {
    /**
     * Tests for 'auto' alignment mode (default behavior).
     *
     * Auto mode performs minimal scrolling:
     * - If item is above viewport: scroll up to show item's top
     * - If item is below viewport: scroll down to show item's bottom
     * - If item is already visible: don't scroll at all
     */
    describe("auto", () => {
        /**
         * Test: Scroll up when selecting an item above the current viewport.
         *
         * Scenario:
         * - 20 items, viewport of 5 lines
         * - Manually scroll to offset 10 (viewport shows items 10-15)
         * - Select item 5 (which is above the viewport)
         *
         * Expected: Scroll offset becomes 5 (item 5 at top of viewport)
         */
        it("should scroll to top if item is above current viewport", async () => {
            expect.assertions(2);

            let scrollListRef: ScrollListRef | null = null;
            let setIndexFunction: (i: number) => void;

            const TestComponent = () => {
                const ref = useRef<ScrollListRef>(null);
                const [index, setIndex] = useState<number | undefined>(undefined);

                useEffect(() => {
                    scrollListRef = ref.current;
                    setIndexFunction = setIndex;
                }, []);

                return (
                    <ScrollList height={5} ref={ref} scrollAlignment="auto" selectedIndex={index}>
                        {Array.from({ length: 20 }).map((_, i) => (
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

            // Manually scroll to offset 10 (viewport shows lines 10-14)
            scrollList.scrollTo(10);
            await waitFor(() => scrollList.getScrollOffset() === 10);

            expect(scrollList.getScrollOffset()).toBe(10);

            // Select item 5, which is above the viewport
            // Item 5 is at line 5. Since 5 < 10 (current offset), scroll up.
            // Auto mode: new offset = item top = 5
            setIndexFunction!(5);
            await waitFor(() => scrollList.getScrollOffset() === 5);

            expect(scrollList.getScrollOffset()).toBe(5);

            unmount();
        });

        /**
         * Test: Scroll down when selecting an item below the current viewport.
         *
         * Scenario:
         * - 20 items, viewport of 5 lines
         * - Start at offset 0 (viewport shows items 0-4)
         * - Select item 8 (which is below the viewport)
         *
         * Expected: Scroll offset becomes 4 (item 8's bottom at viewport bottom)
         * Calculation: item 8 spans lines 8-9, viewport 5, offset = 9 - 5 = 4
         */
        it("should scroll to bottom if item is below current viewport", async () => {
            expect.assertions(1);

            let scrollListRef: ScrollListRef | null = null;
            let setIndexFunction: (i: number) => void;

            const TestComponent = () => {
                const ref = useRef<ScrollListRef>(null);
                const [index, setIndex] = useState<number | undefined>(undefined);

                useEffect(() => {
                    scrollListRef = ref.current;
                    setIndexFunction = setIndex;
                }, []);

                return (
                    <ScrollList height={5} ref={ref} scrollAlignment="auto" selectedIndex={index}>
                        {Array.from({ length: 20 }).map((_, i) => (
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

            // Initially at offset 0. Viewport shows lines 0-4.
            // Select item 8 (at lines 8-9), which is below viewport.
            // Auto mode: scroll to show bottom. offset = itemBottom - viewport = 9 - 5 = 4
            setIndexFunction!(8);
            await waitFor(() => scrollList.getScrollOffset() === 4);

            expect(scrollList.getScrollOffset()).toBe(4);

            unmount();
        });

        /**
         * Test: No scroll when selected item is already visible.
         *
         * Scenario:
         * - 20 items, viewport of 5 lines
         * - Start at offset 0, select item 2 (visible)
         * - Scroll to offset 5, select item 7 (visible in that viewport)
         *
         * Expected: Scroll offset doesn't change when item is already visible
         */
        it("should not scroll if item is already visible", async () => {
            expect.assertions(3);

            let scrollListRef: ScrollListRef | null = null;
            let setIndexFunction: (i: number) => void;

            const TestComponent = () => {
                const ref = useRef<ScrollListRef>(null);
                const [index, setIndex] = useState<number | undefined>(undefined);

                useEffect(() => {
                    scrollListRef = ref.current;
                    setIndexFunction = setIndex;
                }, []);

                return (
                    <ScrollList height={5} ref={ref} scrollAlignment="auto" selectedIndex={index}>
                        {Array.from({ length: 20 }).map((_, i) => (
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

            // Viewport at offset 0 shows lines 0-4.
            // Item 2 (lines 2-3) is fully visible. No scroll needed.
            setIndexFunction!(2);
            // Item is already visible, offset stays 0. Give a brief delay then check.
            await delay(50);

            expect(scrollList.getScrollOffset()).toBe(0);

            // Now select item 7.
            // Item 7 is at line 7-8. From offset 0, it's below viewport (0-4).
            // Auto mode should scroll to show it: offset = 8 - 5 = 3.
            setIndexFunction!(7);
            await waitFor(() => scrollList.getScrollOffset() === 3);

            expect(scrollList.getScrollOffset()).toBe(3);

            // Now item 7 is visible (viewport shows 3-7).
            // Try to scroll to 5 - but with item 7 selected, scroll is constrained.
            // Item 7 visible bounds: min = 7 + 1 - 5 = 3, max = 7.
            // So scrollTo(5) should result in offset 5 (within [3, 7]).
            scrollList.scrollTo(5);
            await waitFor(() => scrollList.getScrollOffset() === 5);

            expect(scrollList.getScrollOffset()).toBe(5);

            unmount();
        });
    });

    /**
     * Tests for explicit alignment modes: top, bottom, center.
     */
    describe("explicit Modes", () => {
        /**
         * Test: Top alignment - selected item at top of viewport.
         *
         * Scenario: Select item 10 with scrollAlignment="top"
         * Expected: Scroll offset = 10 (item 10's top at viewport top)
         */
        it("should align to top", async () => {
            expect.assertions(1);

            let scrollListRef: ScrollListRef | null = null;
            let setIndexFunction: (i: number) => void;

            const TestComponent = () => {
                const ref = useRef<ScrollListRef>(null);
                const [index, setIndex] = useState<number | undefined>(undefined);

                useEffect(() => {
                    scrollListRef = ref.current;
                    setIndexFunction = setIndex;
                }, []);

                return (
                    <ScrollList height={5} ref={ref} scrollAlignment="top" selectedIndex={index}>
                        {Array.from({ length: 20 }).map((_, i) => (
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

            // Top alignment: offset = item top = 10
            setIndexFunction!(10);
            await waitFor(() => scrollList.getScrollOffset() === 10);

            expect(scrollList.getScrollOffset()).toBe(10);

            unmount();
        });

        /**
         * Test: Bottom alignment - selected item at bottom of viewport.
         *
         * Scenario: Select item 10 with scrollAlignment="bottom"
         * Calculation: Item 10 spans lines 10-11. Viewport 5.
         *              offset = itemTop + itemHeight - viewport = 10 + 1 - 5 = 6
         * Expected: Scroll offset = 6
         */
        it("should align to bottom", async () => {
            expect.assertions(1);

            let scrollListRef: ScrollListRef | null = null;
            let setIndexFunction: (i: number) => void;

            const TestComponent = () => {
                const ref = useRef<ScrollListRef>(null);
                const [index, setIndex] = useState<number | undefined>(undefined);

                useEffect(() => {
                    scrollListRef = ref.current;
                    setIndexFunction = setIndex;
                }, []);

                return (
                    <ScrollList height={5} ref={ref} scrollAlignment="bottom" selectedIndex={index}>
                        {Array.from({ length: 20 }).map((_, i) => (
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

            // Bottom alignment: offset = itemTop + itemHeight - viewport = 10 + 1 - 5 = 6
            setIndexFunction!(10);
            await waitFor(() => scrollList.getScrollOffset() === 6);

            expect(scrollList.getScrollOffset()).toBe(6);

            unmount();
        });

        /**
         * Test: Center alignment - selected item at center of viewport.
         *
         * Scenario: Select item 10 with scrollAlignment="center"
         * Calculation: Item 10 center is at 10.5. Viewport center offset = 2.5.
         *              offset = itemCenter - viewportCenter = 10.5 - 2.5 = 8
         * Expected: Scroll offset = 8
         */
        it("should align to center", async () => {
            expect.assertions(1);

            let scrollListRef: ScrollListRef | null = null;
            let setIndexFunction: (i: number) => void;

            const TestComponent = () => {
                const ref = useRef<ScrollListRef>(null);
                const [index, setIndex] = useState<number | undefined>(undefined);

                useEffect(() => {
                    scrollListRef = ref.current;
                    setIndexFunction = setIndex;
                }, []);

                return (
                    <ScrollList height={5} ref={ref} scrollAlignment="center" selectedIndex={index}>
                        {Array.from({ length: 20 }).map((_, i) => (
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

            // Center alignment: offset = itemCenter - viewportCenter = 10.5 - 2.5 = 8
            setIndexFunction!(10);
            await waitFor(() => scrollList.getScrollOffset() === 8);

            expect(scrollList.getScrollOffset()).toBe(8);

            unmount();
        });
    });

    /**
     * Tests for scroll offset clamping at list boundaries.
     */
    describe("clamping", () => {
        /**
         * Test: Scroll offset is clamped when alignment would go out of bounds.
         *
         * Scenario 1: Select item 1 with center alignment
         * - Item 1 center is at 1.5. Viewport center at 2.5.
         * - Target offset = 1.5 - 2.5 = -1 (negative!)
         * - Should clamp to 0
         *
         * Scenario 2: Select item 8 with center alignment
         * - Total content 10, viewport 5, max scroll = 5
         * - Item 8 center at 8.5. Target offset = 8.5 - 2.5 = 6
         * - Should clamp to 5 (max scroll)
         */
        it("should clamp to bounds when aligning would go out of bounds", async () => {
            expect.assertions(2);

            let scrollListRef: ScrollListRef | null = null;
            let setIndexFunction: (i: number) => void;

            const TestComponent = () => {
                const ref = useRef<ScrollListRef>(null);
                const [index, setIndex] = useState<number | undefined>(undefined);

                useEffect(() => {
                    scrollListRef = ref.current;
                    setIndexFunction = setIndex;
                }, []);

                return (
                    <ScrollList height={5} ref={ref} scrollAlignment="center" selectedIndex={index}>
                        {Array.from({ length: 10 }).map((_, i) => (
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
            // Total height 10. Viewport 5. Max scroll = 10 - 5 = 5.

            // Select item 1. Center of 1 is 1.5.
            // Target offset = 1.5 - 2.5 = -1. Clamp to 0.
            setIndexFunction!(1);
            // Offset stays 0 (clamped from negative). Give a brief delay then check.
            await delay(50);

            expect(scrollList.getScrollOffset()).toBe(0);

            // Select item 8. Center of 8 is 8.5.
            // Target offset = 8.5 - 2.5 = 6. Max is 5. Clamp to 5.
            setIndexFunction!(8);
            await waitFor(() => scrollList.getScrollOffset() === 5);

            expect(scrollList.getScrollOffset()).toBe(5);

            unmount();
        });
    });

    /**
     * Tests for boundary and edge cases.
     */
    describe("boundary Cases", () => {
        /**
         * Test: Aligning items larger than the viewport.
         *
         * Scenario:
         * - Three items: small (1 line), large (10 lines), small (1 line)
         * - Viewport of 5 lines
         * - Select the large item (index 1)
         *
         * Expected (auto mode): Scroll to show the bottom of the large item
         * - Large item spans lines 1-11. Viewport 5.
         * - Bottom 11 > viewport end (0+5=5), so offset = 11 - 5 = 6
         */
        it("should handle aligning items larger than the viewport", async () => {
            expect.assertions(1);

            let scrollListRef: ScrollListRef | null = null;
            let setIndexFunction: (i: number) => void;

            const TestComponent = () => {
                const ref = useRef<ScrollListRef>(null);
                const [index, setIndex] = useState<number | undefined>(undefined);

                useEffect(() => {
                    scrollListRef = ref.current;
                    setIndexFunction = setIndex;
                }, []);

                return (
                    <ScrollList height={5} ref={ref} scrollAlignment="auto" selectedIndex={index}>
                        <Box height={1}>
                            <Text>Small</Text>
                        </Box>
                        <Box height={10}>
                            <Text>Large</Text>
                        </Box>
                        <Box height={1}>
                            <Text>Small</Text>
                        </Box>
                    </ScrollList>
                );
            };

            const { unmount } = render(<TestComponent />);

            await waitFor(() => scrollListRef != null);
            const scrollList = scrollListRef!;

            // Select large item (index 1). Top: 1. Height: 10. Bottom: 11.
            // Auto mode: bottom 11 > viewport end 5, so offset = 11 - 5 = 6
            setIndexFunction!(1);
            await waitFor(() => scrollList.getScrollOffset() === 6);

            expect(scrollList.getScrollOffset()).toBe(6);

            unmount();
        });

        /**
         * Test: First item with bottom alignment (should clamp to 0).
         *
         * Scenario:
         * - 20 items
         * - Select item 0 with bottom alignment
         *
         * Calculation:
         * - Item 0: top=0, height=1, bottom=1
         * - Bottom alignment: offset = 0 + 1 - 5 = -4 (negative!)
         * - Should clamp to 0
         */
        it("should handle aligning the first item with bottom alignment (clamped)", async () => {
            expect.assertions(1);

            let scrollListRef: ScrollListRef | null = null;
            let setIndexFunction: (i: number) => void;

            const TestComponent = () => {
                const ref = useRef<ScrollListRef>(null);
                const [index, setIndex] = useState<number | undefined>(undefined);

                useEffect(() => {
                    scrollListRef = ref.current;
                    setIndexFunction = setIndex;
                }, []);

                return (
                    <ScrollList height={5} ref={ref} scrollAlignment="bottom" selectedIndex={index}>
                        {Array.from({ length: 20 }).map((_, i) => (
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

            // Bottom alignment for item 0:
            // offset = top + height - viewport = 0 + 1 - 5 = -4
            // Clamp to 0
            setIndexFunction!(0);
            // Offset stays 0 (clamped from negative). Give a brief delay then check.
            await delay(50);

            expect(scrollList.getScrollOffset()).toBe(0);

            unmount();
        });
    });
});
