/**
 * @file Item.test.tsx
 * @description Tests for item-related behaviors in ScrollList.
 *
 * This test suite validates how ScrollList handles dynamic changes to its items
 * when using externally controlled selection. As a controlled component, ScrollList
 * relies on the parent to manage the `selectedIndex` value, including when items
 * are added or removed.
 *
 * ## Test Coverage
 * - Adding items to the list
 * - Removing items from the list
 * - Empty list handling
 * - Item height changes (accordion/expand behavior)
 *
 * ## Important Notes
 * - The parent is responsible for updating `selectedIndex` when items are added/removed
 * - ScrollList does NOT automatically adjust selection when items change
 * - Item height changes trigger `handleItemHeightChange` which adjusts scroll position
 */

import { render } from "@visulima/tui";
import { Box } from "@visulima/tui/components/box";
import { Text } from "@visulima/tui/components/text";
import { useEffect, useRef, useState } from "react";
import { describe, expect, it } from "vitest";

import type { ScrollListRef } from "../../../src/index";
import { ScrollList } from "../../../src/index";

/**
 * Helper function to introduce artificial delays in tests.
 */
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("item", () => {
    /**
     * Test: Scroll behavior when items are added to the list.
     *
     * Scenario:
     * - Start with 3 items, selectedIndex = 2
     * - Add 7 more items at the end (total 10)
     * - Verify selected item (index 2) is still visible
     *
     * Expected Behavior:
     * - Adding items at the end shouldn't affect the scroll position
     * - Item 2 remains at the same position and visible
     * - Scroll offset should remain 0 (items 0-2 fit in viewport)
     *
     * Note: When adding items at the BEGINNING, the parent must adjust selectedIndex
     * to continue pointing to the same logical item (selectedIndex += addedCount).
     */
    it("should scroll to selected item when items are added", async () => {
        expect.assertions(2);

        let scrollListRef: ScrollListRef | null = null;
        let setItemsFunction: (items: number[]) => void;

        const TestComponent = () => {
            const ref = useRef<ScrollListRef>(null);
            const [items, setItems] = useState([1, 2, 3]);

            useEffect(() => {
                scrollListRef = ref.current;
            });

            useEffect(() => {
                setItemsFunction = setItems;
            }, []);

            return (
                <ScrollList height={5} ref={ref} selectedIndex={2}>
                    {items.map((i) => (
                        <Box height={1} key={i}>
                            <Text>{i}</Text>
                        </Box>
                    ))}
                </ScrollList>
            );
        };

        const { unmount } = render(<TestComponent />);

        await delay(100);

        const scrollList = scrollListRef!;

        // Initially 3 items (height 3), viewport 5. Item 2 at line 2. No scroll needed.
        expect(scrollList.getScrollOffset()).toBe(0);

        // Add items at end. Total now 10 items.
        // selectedIndex 2 still points to what was originally item 3.
        // Item 2 is still at line 2, still visible. No scroll change.
        setItemsFunction!([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
        await delay(100);

        expect(scrollList.getScrollOffset()).toBe(0);

        unmount();
    });

    /**
     * Test: Parent responsibility to update selectedIndex when items are removed.
     *
     * Scenario:
     * - Start with 5 items, selectedIndex = 4 (last item)
     * - Remove 3 items, leaving only 2 items
     * - Parent clamps selectedIndex to 1 (new last valid index)
     *
     * Expected Behavior:
     * - After removal, selectedIndex 4 would be invalid (out of bounds)
     * - Parent must update selectedIndex to a valid value
     * - Component scrolls to show the new selected item
     *
     * Note: This test demonstrates the controlled component pattern - the parent
     * is responsible for keeping selectedIndex within valid bounds.
     */
    it("should handle selectedIndex when items are removed", async () => {
        expect.assertions(1);

        let scrollListRef: ScrollListRef | null = null;
        let setItemsFunction: (items: number[]) => void;
        let setIndexFunction: (index: number) => void;

        const TestComponent = () => {
            const ref = useRef<ScrollListRef>(null);
            const [items, setItems] = useState([1, 2, 3, 4, 5]);
            const [index, setIndex] = useState(4); // Select last item

            useEffect(() => {
                scrollListRef = ref.current;
            });

            useEffect(() => {
                setItemsFunction = setItems;
                setIndexFunction = setIndex;
            }, []);

            return (
                <ScrollList height={5} ref={ref} selectedIndex={index}>
                    {items.map((i) => (
                        <Box height={1} key={i}>
                            <Text>{i}</Text>
                        </Box>
                    ))}
                </ScrollList>
            );
        };

        const { unmount } = render(<TestComponent />);

        await delay(100);

        // Remove items to leave only 2 items
        setItemsFunction!([1, 2]);
        // Parent MUST clamp selectedIndex - component doesn't do this
        setIndexFunction!(1); // Clamp to last valid index
        await delay(100);

        const scrollList = scrollListRef!;

        // With only 2 items and height 5, no scrolling needed
        expect(scrollList.getScrollOffset()).toBe(0);

        unmount();
    });

    /**
     * Test: Empty list handling.
     *
     * Scenario:
     * - ScrollList with no children
     * - selectedIndex = 0 (pointing to non-existent item)
     *
     * Expected Behavior:
     * - Component should NOT crash
     * - Scroll offset should be 0
     * - Content height should be 0
     * - No scrolling occurs (getItemPosition returns null for invalid index)
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
                    {/* Empty list */}
                </ScrollList>
            );
        };

        const { unmount } = render(<TestComponent />);

        await delay(100);
        const scrollList = scrollListRef!;

        // Empty list should work without errors
        expect(scrollList.getScrollOffset()).toBe(0);
        expect(scrollList.getContentHeight()).toBe(0);

        unmount();
    });

    /**
     * Test: Item height changes (accordion/expand behavior).
     *
     * Scenario:
     * - 4 items, selectedIndex = 2
     * - Item 1 (above selected) expands from height 1 to height 3
     *
     * Expected Behavior:
     * - When an item ABOVE the selected item changes height, the scroll
     *   position should be adjusted to keep the selected item at the
     *   same visual position
     * - The handleItemHeightChange callback handles this by calling
     *   scrollBy(heightDelta) for items above the selection
     *
     * Layout Changes:
     * - Before: items at lines [0], [1], [2], [3] - selected at line 2
     * - After:  items at lines [0], [1-3], [4], [5] - selected at line 4
     * - Scroll should adjust to keep item visible
     */
    it("should handle item height changes correctly", async () => {
        expect.assertions(1);

        let scrollListRef: ScrollListRef | null = null;
        let setExpandedFunction: (expanded: boolean) => void;

        const TestComponent = () => {
            const ref = useRef<ScrollListRef>(null);
            const [expanded, setExpanded] = useState(false);

            useEffect(() => {
                scrollListRef = ref.current;
                setExpandedFunction = setExpanded;
            }, []);

            return (
                <ScrollList height={3} ref={ref} selectedIndex={2}>
                    {/* Item 0: fixed height 1 */}
                    <Box height={1}>
                        <Text>Item 0</Text>
                    </Box>
                    {/* Item 1: expandable from 1 to 3 lines */}
                    <Box height={expanded ? 3 : 1}>
                        <Text>Item 1 (expandable)</Text>
                    </Box>
                    {/* Item 2: selected item, fixed height 1 */}
                    <Box height={1}>
                        <Text>Item 2</Text>
                    </Box>
                    {/* Item 3: fixed height 1 */}
                    <Box height={1}>
                        <Text>Item 3</Text>
                    </Box>
                </ScrollList>
            );
        };

        const { unmount } = render(<TestComponent />);

        await delay(100);

        const scrollList = scrollListRef!;
        const initialOffset = scrollList.getScrollOffset();

        // Expand item 1 (which is before selected item 2)
        // This triggers handleItemHeightChange which should adjust scroll
        setExpandedFunction!(true);
        await delay(100);

        // The scroll position should have adjusted to keep item 2 visible
        // Before expansion: items at 0, 1, 2, 3. Total height 4. Selected at line 2.
        // After expansion: items at 0, 1-3, 4, 5. Total height 6. Selected at line 4.
        // With viewport 3, scroll should increase to show line 4.
        const newOffset = scrollList.getScrollOffset();

        expect(newOffset).toBeGreaterThanOrEqual(initialOffset);

        unmount();
    });
});
