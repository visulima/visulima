/**
 * @file Selection.test.tsx
 * @description Tests for externally controlled selection behavior in ScrollList.
 *
 * This test suite validates that ScrollList correctly handles the `selectedIndex` prop
 * as a fully controlled component. The component should automatically scroll to make
 * the selected item visible whenever the prop changes.
 *
 * ## Test Coverage
 * - Basic selection changes and auto-scrolling
 * - Edge cases: out-of-bounds indices, negative indices, undefined
 * - Dynamic navigation through the list
 * - Empty and single-item lists
 *
 * ## Component Behavior Under Test
 * ScrollList is a controlled component, meaning:
 * - It does NOT maintain internal selection state
 * - It does NOT clamp or validate the selectedIndex prop
 * - It DOES scroll to make the selected item visible (when index is valid)
 * - Invalid indices are handled gracefully (no crash, no scroll)
 */

import { useEffect, useRef, useState } from "react";
import { describe, expect, it } from "vitest";

import type { ScrollListRef } from "../../../src/components/index";
import { Box, ScrollList, Text } from "../../../src/components/index";
import { render } from "../../../src/ink/index";
import waitFor from "../../helpers/wait-for";

describe("selection", () => {
    /**
     * Test: Basic auto-scroll behavior when selectedIndex changes.
     *
     * Scenario:
     * - List with 10 items, each 1 line tall
     * - Viewport height of 5 lines
     * - Initial selection at index 0
     * - Change selection to index 8, then to index 2
     *
     * Expected Behavior:
     * - Selecting index 8: Should scroll down so item 8 is visible at bottom
     *   - Item 8 is at y=8..9, viewport is 5, so offset = 9 - 5 = 4
     * - Selecting index 2: Should scroll up so item 2 is visible at top
     *   - Item 2 is at y=2..3, current viewport shows 4..9, so offset = 2
     */
    it("should scroll to selected item when selectedIndex prop changes", async () => {
        expect.assertions(3);

        let scrollListRef: ScrollListRef | null = null;
        let setIndexFunction: (i: number) => void;

        const TestComponent = () => {
            const ref = useRef<ScrollListRef>(null);
            const [index, setIndex] = useState(0);

            useEffect(() => {
                scrollListRef = ref.current;
                setIndexFunction = setIndex;
            }, []);

            return (
                <ScrollList height={5} ref={ref} selectedIndex={index}>
                    {Array.from({ length: 10 }).map((_, i) => (
                        <Box height={1} key={i}>
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

        // Initially at index 0, should be at offset 0 (no scroll needed)
        expect(scrollList.getScrollOffset()).toBe(0);

        // Change to index 8, should scroll to show it (auto alignment)
        // Item 8 spans lines 8-9. To show line 9 in viewport of 5, offset = 9 - 5 = 4
        setIndexFunction!(8);
        await waitFor(() => scrollList.getScrollOffset() === 4);

        expect(scrollList.getScrollOffset()).toBe(4);

        // Change to index 2, should scroll back up
        // Item 2 is at line 2. Current viewport shows 4-9.
        // Since 2 < 4, scroll to show item at top: offset = 2
        setIndexFunction!(2);
        await waitFor(() => scrollList.getScrollOffset() === 2);

        expect(scrollList.getScrollOffset()).toBe(2);

        unmount();
    });

    /**
     * Test: Graceful handling of selectedIndex larger than item count.
     *
     * Scenario:
     * - List with 5 items
     * - selectedIndex set to 100 (way out of bounds)
     *
     * Expected Behavior:
     * - Component should NOT crash
     * - No scrolling should occur (getItemPosition returns null for invalid index)
     * - Scroll offset remains at 0
     *
     * Note: The parent is responsible for bounds-checking. The component
     * gracefully handles invalid indices without throwing errors.
     */
    it("should handle selectedIndex larger than item count gracefully", async () => {
        expect.assertions(1);

        let scrollListRef: ScrollListRef | null = null;

        const TestComponent = () => {
            const ref = useRef<ScrollListRef>(null);

            useEffect(() => {
                scrollListRef = ref.current;
            }, []);

            return (
                <ScrollList height={5} ref={ref} selectedIndex={100}>
                    {Array.from({ length: 5 }).map((_, i) => (
                        <Box height={1} key={i}>
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

        // Index 100 is out of bounds - scrollToIndex silently fails
        // Scroll offset should remain at default (0)
        expect(scrollList.getScrollOffset()).toBe(0);

        unmount();
    });

    /**
     * Test: Graceful handling of negative selectedIndex.
     *
     * Scenario:
     * - List with 5 items
     * - selectedIndex set to -1
     *
     * Expected Behavior:
     * - Component should NOT crash
     * - No auto-scrolling should occur (negative indices are ignored)
     * - Scroll offset remains at 0
     *
     * Note: The component has an explicit check for selectedIndex >= 0
     * before triggering auto-scroll.
     */
    it("should handle negative selectedIndex gracefully", async () => {
        expect.assertions(1);

        let scrollListRef: ScrollListRef | null = null;

        const TestComponent = () => {
            const ref = useRef<ScrollListRef>(null);

            useEffect(() => {
                scrollListRef = ref.current;
            }, []);

            return (
                <ScrollList height={5} ref={ref} selectedIndex={-1}>
                    {Array.from({ length: 5 }).map((_, i) => (
                        <Box height={1} key={i}>
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

        // Negative index is ignored due to selectedIndex >= 0 check
        expect(scrollList.getScrollOffset()).toBe(0);

        unmount();
    });

    /**
     * Test: Behavior when selectedIndex is undefined.
     *
     * Scenario:
     * - List with 10 items
     * - selectedIndex is undefined (not provided)
     * - Manually scroll to position 5
     *
     * Expected Behavior:
     * - No auto-scrolling should occur
     * - Manual scrolling via ref methods should work normally
     * - This mode allows pure scroll control without selection tracking
     */
    it("should handle undefined selectedIndex (no auto-scroll)", async () => {
        expect.assertions(1);

        let scrollListRef: ScrollListRef | null = null;

        const TestComponent = () => {
            const ref = useRef<ScrollListRef>(null);

            useEffect(() => {
                scrollListRef = ref.current;
            }, []);

            return (
                <ScrollList height={5} ref={ref}>
                    {Array.from({ length: 10 }).map((_, i) => (
                        <Box height={1} key={i}>
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

        // Manual scroll should work even without selectedIndex
        scrollList.scrollTo(5);
        await waitFor(() => scrollList.getScrollOffset() === 5);

        expect(scrollList.getScrollOffset()).toBe(5);

        unmount();
    });

    /**
     * Test: Rapid sequential selectedIndex changes (keyboard navigation simulation).
     *
     * Scenario:
     * - List with 20 items
     * - Viewport height of 3 lines
     * - Rapidly change selectedIndex from 0 to 15
     *
     * Expected Behavior:
     * - Final scroll position should show item 15 visible
     * - Item 15 is at lines 15-16, viewport is 3, so offset = 16 - 3 = 13
     * - All intermediate scroll animations should be handled correctly
     */
    it("should handle dynamic selectedIndex changes", async () => {
        expect.assertions(1);

        let scrollListRef: ScrollListRef | null = null;
        let setIndexFunction: (i: number) => void;

        const TestComponent = () => {
            const ref = useRef<ScrollListRef>(null);
            const [index, setIndex] = useState(0);

            useEffect(() => {
                scrollListRef = ref.current;
                setIndexFunction = setIndex;
            }, []);

            return (
                <ScrollList height={3} ref={ref} selectedIndex={index}>
                    {Array.from({ length: 20 }).map((_, i) => (
                        <Box height={1} key={i}>
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

        // Simulate rapid keyboard navigation
        for (let i = 0; i <= 15; i++) {
            setIndexFunction!(i);
            // Wait for each scroll to settle before moving to the next
            const expectedOffset = Math.max(0, i + 1 - 3);

            await waitFor(() => scrollList.getScrollOffset() === expectedOffset);
        }

        // After selecting 15, it should be visible at bottom of viewport
        // Item 15 at lines 15-16. Viewport 3. Offset = 16 - 3 = 13
        expect(scrollList.getScrollOffset()).toBe(13);

        unmount();
    });

    /**
     * Tests for edge case: empty list.
     */
    describe("with Empty List", () => {
        /**
         * Test: Empty list with selectedIndex=0.
         *
         * Scenario:
         * - ScrollList with no children
         * - selectedIndex set to 0
         *
         * Expected Behavior:
         * - Component should NOT crash
         * - Scroll offset should be 0
         * - Content height should be 0
         */
        it("should handle empty list gracefully", async () => {
            expect.assertions(2);

            let scrollListRef: ScrollListRef | null = null;

            const TestComponent = () => {
                const ref = useRef<ScrollListRef>(null);

                useEffect(() => {
                    scrollListRef = ref.current;
                }, []);

                return (
                    <ScrollList height={5} ref={ref} selectedIndex={0}>
                        {/* Empty list - no children */}
                    </ScrollList>
                );
            };

            const { unmount } = render(<TestComponent />);

            await waitFor(() => scrollListRef != null);
            const scrollList = scrollListRef!;

            // Empty list should have zero metrics and no crashes
            expect(scrollList.getScrollOffset()).toBe(0);
            expect(scrollList.getContentHeight()).toBe(0);

            unmount();
        });
    });

    /**
     * Tests for edge case: single item list.
     */
    describe("with Single Item", () => {
        /**
         * Test: Single item list.
         *
         * Scenario:
         * - ScrollList with exactly one child
         * - selectedIndex set to 0
         *
         * Expected Behavior:
         * - Component should work normally
         * - Scroll offset should be 0 (item fits in viewport)
         * - Content height should be 1
         */
        it("should handle single-item list", async () => {
            expect.assertions(2);

            let scrollListRef: ScrollListRef | null = null;

            const TestComponent = () => {
                const ref = useRef<ScrollListRef>(null);

                useEffect(() => {
                    scrollListRef = ref.current;
                }, []);

                return (
                    <ScrollList height={5} ref={ref} selectedIndex={0}>
                        <Box height={1}>
                            <Text>Only Item</Text>
                        </Box>
                    </ScrollList>
                );
            };

            const { unmount } = render(<TestComponent />);

            await waitFor(() => scrollListRef != null);
            const scrollList = scrollListRef!;

            // Single item should work correctly
            await waitFor(() => scrollList.getContentHeight() === 1);

            expect(scrollList.getScrollOffset()).toBe(0);
            expect(scrollList.getContentHeight()).toBe(1);

            unmount();
        });
    });

    /**
     * Tests for scroll constraint behavior.
     *
     * When a selected item exists, scroll methods (scrollTo, scrollBy, scrollToTop,
     * scrollToBottom) are constrained to keep the selected item visible in the viewport.
     */
    describe("scroll Constraints", () => {
        /**
         * Test: scrollTo is constrained to keep selected item visible.
         *
         * Scenario:
         * - 20 items, viewport 5, selectedIndex = 10
         * - Item 10 is at line 10. Visible bounds: [10+1-5, 10] = [6, 10]
         * - Try to scroll outside these bounds
         *
         * Expected:
         * - scrollTo(0) should clamp to 6 (min offset to keep item 10 visible)
         * - scrollTo(15) should clamp to 10 (max offset to keep item 10 visible)
         * - scrollTo(8) should work (within bounds)
         */
        it("should constrain scrollTo to keep selected item visible", async () => {
            expect.assertions(3);

            let scrollListRef: ScrollListRef | null = null;

            const TestComponent = () => {
                const ref = useRef<ScrollListRef>(null);

                useEffect(() => {
                    scrollListRef = ref.current;
                }, []);

                return (
                    <ScrollList height={5} ref={ref} selectedIndex={10}>
                        {Array.from({ length: 20 }).map((_, i) => (
                            <Box height={1} key={i}>
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

            // Item 10: top=10, height=1. Visible bounds: [6, 10]
            // Wait for initial auto-scroll to settle for selectedIndex=10
            await waitFor(() => scrollList.getScrollOffset() >= 6);

            // Try to scroll to 0 - should clamp to 6
            scrollList.scrollTo(0);
            await waitFor(() => scrollList.getScrollOffset() === 6);

            expect(scrollList.getScrollOffset()).toBe(6);

            // Try to scroll to 15 - should clamp to 10
            scrollList.scrollTo(15);
            await waitFor(() => scrollList.getScrollOffset() === 10);

            expect(scrollList.getScrollOffset()).toBe(10);

            // Scroll to 8 - within bounds, should work
            scrollList.scrollTo(8);
            await waitFor(() => scrollList.getScrollOffset() === 8);

            expect(scrollList.getScrollOffset()).toBe(8);

            unmount();
        });

        /**
         * Test: scrollToTop is constrained to keep selected item visible.
         *
         * Scenario:
         * - 20 items, viewport 5, selectedIndex = 10
         * - scrollToTop should scroll to min offset that keeps item 10 visible
         *
         * Expected: Offset = 6 (item 10 at bottom of viewport)
         */
        it("should constrain scrollToTop to keep selected item visible", async () => {
            expect.assertions(1);

            let scrollListRef: ScrollListRef | null = null;

            const TestComponent = () => {
                const ref = useRef<ScrollListRef>(null);

                useEffect(() => {
                    scrollListRef = ref.current;
                }, []);

                return (
                    <ScrollList height={5} ref={ref} selectedIndex={10}>
                        {Array.from({ length: 20 }).map((_, i) => (
                            <Box height={1} key={i}>
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

            // Wait for initial auto-scroll to settle for selectedIndex=10
            await waitFor(() => scrollList.getScrollOffset() >= 6);

            // scrollToTop with item 10 selected should go to min offset = 6
            scrollList.scrollToTop();
            await waitFor(() => scrollList.getScrollOffset() === 6);

            expect(scrollList.getScrollOffset()).toBe(6);

            unmount();
        });

        /**
         * Test: scrollToBottom is constrained to keep selected item visible.
         *
         * Scenario:
         * - 20 items, viewport 5, selectedIndex = 5
         * - Max scroll = 20 - 5 = 15
         * - Item 5 visible bounds: [1, 5]
         * - scrollToBottom should scroll to max offset that keeps item 5 visible
         *
         * Expected: Offset = 5 (item 5 at top of viewport)
         */
        it("should constrain scrollToBottom to keep selected item visible", async () => {
            expect.assertions(1);

            let scrollListRef: ScrollListRef | null = null;

            const TestComponent = () => {
                const ref = useRef<ScrollListRef>(null);

                useEffect(() => {
                    scrollListRef = ref.current;
                }, []);

                return (
                    <ScrollList height={5} ref={ref} selectedIndex={5}>
                        {Array.from({ length: 20 }).map((_, i) => (
                            <Box height={1} key={i}>
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

            // Wait for initial auto-scroll to settle for selectedIndex=5
            await waitFor(() => scrollList.getScrollOffset() >= 1);

            // scrollToBottom with item 5 selected should go to max offset = 5
            // (because item 5 visible range is [1, 5])
            scrollList.scrollToBottom();
            await waitFor(() => scrollList.getScrollOffset() === 5);

            expect(scrollList.getScrollOffset()).toBe(5);

            unmount();
        });

        /**
         * Test: scrollBy is constrained to keep selected item visible.
         *
         * Scenario:
         * - 20 items, viewport 5, selectedIndex = 10
         * - Start at offset 8 (within valid range [6, 10])
         * - scrollBy(-5) should clamp to 6, not 3
         * - scrollBy(+5) should clamp to 10, not 13
         */
        it("should constrain scrollBy to keep selected item visible", async () => {
            expect.assertions(3);

            let scrollListRef: ScrollListRef | null = null;

            const TestComponent = () => {
                const ref = useRef<ScrollListRef>(null);

                useEffect(() => {
                    scrollListRef = ref.current;
                }, []);

                return (
                    <ScrollList height={5} ref={ref} selectedIndex={10}>
                        {Array.from({ length: 20 }).map((_, i) => (
                            <Box height={1} key={i}>
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

            // Wait for initial auto-scroll to settle for selectedIndex=10
            await waitFor(() => scrollList.getScrollOffset() >= 6);

            // Start at offset 8 (within [6, 10])
            scrollList.scrollTo(8);
            await waitFor(() => scrollList.getScrollOffset() === 8);

            expect(scrollList.getScrollOffset()).toBe(8);

            // scrollBy(-5): 8 - 5 = 3, but min is 6, so should be 6
            scrollList.scrollBy(-5);
            await waitFor(() => scrollList.getScrollOffset() === 6);

            expect(scrollList.getScrollOffset()).toBe(6);

            // scrollBy(+10): 6 + 10 = 16, but max is 10, so should be 10
            scrollList.scrollBy(10);
            await waitFor(() => scrollList.getScrollOffset() === 10);

            expect(scrollList.getScrollOffset()).toBe(10);

            unmount();
        });

        /**
         * Test: No scroll constraint when selectedIndex is undefined.
         *
         * Scenario:
         * - 10 items, viewport 5, no selectedIndex
         * - scrollTo should only be constrained by global bounds [0, 5]
         */
        it("should not constrain scroll when no selectedIndex", async () => {
            expect.assertions(3);

            let scrollListRef: ScrollListRef | null = null;

            const TestComponent = () => {
                const ref = useRef<ScrollListRef>(null);

                useEffect(() => {
                    scrollListRef = ref.current;
                }, []);

                return (
                    <ScrollList height={5} ref={ref}>
                        {Array.from({ length: 10 }).map((_, i) => (
                            <Box height={1} key={i}>
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

            // Global max scroll = 10 - 5 = 5
            // Without selectedIndex, we can scroll freely within [0, 5]
            scrollList.scrollTo(5);
            await waitFor(() => scrollList.getScrollOffset() === 5);

            expect(scrollList.getScrollOffset()).toBe(5);

            scrollList.scrollToTop();
            await waitFor(() => scrollList.getScrollOffset() === 0);

            expect(scrollList.getScrollOffset()).toBe(0);

            scrollList.scrollToBottom();
            await waitFor(() => scrollList.getScrollOffset() === 5);

            expect(scrollList.getScrollOffset()).toBe(5);

            unmount();
        });

        /**
         * Test: Scroll constraints for items larger than the viewport.
         *
         * Scenario:
         * - 3 items: small (1), large (10), small (1)
         * - Viewport 5, select the large item (index 1)
         * - Large item at top=1, height=10, bottom=11
         *
         * When item > viewport, the constraint is swapped:
         * - calculated min = 1 + 10 - 5 = 6 (item bottom at viewport bottom)
         * - calculated max = 1 (item top at viewport top)
         * - Since min > max, swap them: min=1, max=6
         * - This allows scrolling within the item to see different parts
         *
         * Expected:
         * - scrollToTop should go to 1 (item top visible)
         * - scrollToBottom should go to 6 (item bottom visible)
         * - scrollTo(3) should work (within [1, 6])
         * - scrollTo(0) should clamp to 1
         * - scrollTo(10) should clamp to 6
         */
        it("should allow scrolling within large items (item > viewport)", async () => {
            expect.assertions(5);

            let scrollListRef: ScrollListRef | null = null;

            const TestComponent = () => {
                const ref = useRef<ScrollListRef>(null);

                useEffect(() => {
                    scrollListRef = ref.current;
                }, []);

                return (
                    <ScrollList height={5} ref={ref} selectedIndex={1}>
                        <Box height={1}>
                            <Text>Small 0</Text>
                        </Box>
                        <Box height={10}>
                            <Text>Large Item (height 10)</Text>
                        </Box>
                        <Box height={1}>
                            <Text>Small 2</Text>
                        </Box>
                    </ScrollList>
                );
            };

            const { unmount } = render(<TestComponent />);

            await waitFor(() => scrollListRef != null);

            const scrollList = scrollListRef!;

            // Large item: top=1, height=10, bottom=11
            // Total content height = 1 + 10 + 1 = 12
            // Global max scroll = 12 - 5 = 7
            // Item visible bounds (before swap): min=6, max=1
            // After swap: min=1, max=6

            // Wait for initial auto-scroll to settle for selectedIndex=1
            await waitFor(() => scrollList.getScrollOffset() >= 1);

            // Try scrollTo(0) - should clamp to min=1
            scrollList.scrollTo(0);
            await waitFor(() => scrollList.getScrollOffset() === 1);

            expect(scrollList.getScrollOffset()).toBe(1);

            // scrollToTop should go to min=1
            scrollList.scrollToTop();
            await waitFor(() => scrollList.getScrollOffset() === 1);

            expect(scrollList.getScrollOffset()).toBe(1);

            // scrollTo(3) should work (within [1, 6])
            scrollList.scrollTo(3);
            await waitFor(() => scrollList.getScrollOffset() === 3);

            expect(scrollList.getScrollOffset()).toBe(3);

            // scrollTo(10) should clamp to max=6
            scrollList.scrollTo(10);
            await waitFor(() => scrollList.getScrollOffset() === 6);

            expect(scrollList.getScrollOffset()).toBe(6);

            // scrollToBottom should go to max=6
            scrollList.scrollToBottom();
            await waitFor(() => scrollList.getScrollOffset() === 6);

            expect(scrollList.getScrollOffset()).toBe(6);

            unmount();
        });
    });
});
