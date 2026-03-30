import { useRef, useState, useEffect } from "react";
import { Box, render, Text } from "../../../src/ink/index";
import { describe, it, expect, vi } from "vitest";
import { ScrollView } from "../../../src/ink/index";
import type { ScrollViewRef } from "../../../src/ink/index";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Tests for item-level callbacks and positioning logic.
 *
 * @remarks
 * Focuses on `onItemHeightChange`, `getItemPosition`, and interactions with `remeasureItem`.
 */
describe("CallbacksAndPosition", () => {
    /**
     * Verifies that `onItemHeightChange` is triggered when an item resizes due to responsive layout changes.
     *
     * @remarks
     * When parent width changes, children wrapping text should resize, triggering the callback.
     * Also verifies that `getItemHeight` reflects the new size immediately.
     */
    it("should trigger onItemHeightChange when ScrollView width changes", async () => {
        let scrollViewRef: ScrollViewRef | null = null;
        let setWidthFn: any;
        const onItemHeightChange = vi.fn();

        const TestComponent = () => {
            const ref = useRef<ScrollViewRef>(null);
            const [width, setWidth] = useState(10);
            useEffect(() => {
                scrollViewRef = ref.current;
                setWidthFn = setWidth;
            }, []);

            return (
                <ScrollView ref={ref} height={5} width={width} onItemHeightChange={onItemHeightChange}>
                    {/*
            With width 10, "123456789012345" (15 chars) wraps to 2 lines.
            Height: 2
          */}
                    <Box flexShrink={0}>
                        <Text>123456789012345</Text>
                    </Box>
                </ScrollView>
            );
        };

        const { unmount } = render(<TestComponent />);
        await delay(100);

        // Initial measure
        expect(onItemHeightChange).toHaveBeenCalled();
        const initialCalls = onItemHeightChange.mock.calls.length;
        // Assuming height is 2
        expect(scrollViewRef!.getItemHeight(0)).toBeGreaterThanOrEqual(2);

        // Increase width to 20 -> should fit on 1 line -> height becomes 1
        onItemHeightChange.mockClear();
        setWidthFn(20);
        await delay(100);

        // Should have been called
        expect(onItemHeightChange).toHaveBeenCalledTimes(1);
        expect(onItemHeightChange).toHaveBeenCalledWith(0, 1, expect.any(Number));
        expect(scrollViewRef!.getItemHeight(0)).toBe(1);

        unmount();
    });

    /**
     * Verifies that `onItemHeightChange` is triggered by `remeasureItem` only when the height actually changes.
     *
     * @remarks
     * 1. Calling `remeasureItem` on unchanged content -> NO callback.
     * 2. Calling `remeasureItem` after internal content change -> Callback FIRES.
     * 3. Calling `remeasureItem` again -> NO callback.
     */
    it("should trigger onItemHeightChange when remeasureItem detects a change, but NOT when there is no change", async () => {
        let scrollViewRef: ScrollViewRef | null = null;
        const onItemHeightChange = vi.fn();

        // Mock global window property for dynamic sizing simulation
        const globalStore: any = {};
        (global as any).window = globalStore;

        const DynamicItem = ({ index }: { index: number }) => {
            const [lines, setLines] = useState(1);
            useEffect(() => {
                globalStore[`setLines_${index}`] = setLines;
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
            const ref = useRef<ScrollViewRef>(null);
            useEffect(() => {
                scrollViewRef = ref.current;
            }, []);
            return (
                <ScrollView ref={ref} height={10} onItemHeightChange={onItemHeightChange}>
                    <DynamicItem index={0} />
                </ScrollView>
            );
        };

        const { unmount } = render(<TestComponent />);
        await delay(100);
        onItemHeightChange.mockClear();

        // 1. Force check without change
        scrollViewRef!.remeasureItem(0);
        await delay(100);
        expect(onItemHeightChange).not.toHaveBeenCalled();

        // 2. Change internal lines
        if (globalStore["setLines_0"]) globalStore["setLines_0"](3);
        await delay(100);

        // Changing internal state of a child does NOT re-render ScrollView or MeasurableItem automatically
        // so the callback should NOT have fired yet.
        expect(onItemHeightChange).not.toHaveBeenCalled();

        // Now force remeasure
        scrollViewRef!.remeasureItem(0);
        await delay(100);

        // NOW it should fire because height changed from 1 to 3
        expect(onItemHeightChange).toHaveBeenCalledTimes(1);
        expect(onItemHeightChange).toHaveBeenCalledWith(0, 3, 1);

        onItemHeightChange.mockClear();

        // 3. Remeasure again without change -> no callback
        scrollViewRef!.remeasureItem(0);
        await delay(100);
        expect(onItemHeightChange).not.toHaveBeenCalled();

        unmount();
    });

    /**
     * Verifies that `getItemPosition` returns correct values after items are added or removed.
     *
     * @remarks
     * Item offsets (top position) should be recalculated correctly when previous items are removed or new items are inserted.
     */
    it("should return correct getItemPosition values after mutations", async () => {
        let scrollViewRef: ScrollViewRef | null = null;
        let setItemsFn: any;

        const TestComponent = () => {
            const ref = useRef<ScrollViewRef>(null);
            const [items, setItems] = useState([
                { id: "a", h: 2 },
                { id: "b", h: 3 },
                { id: "c", h: 1 },
            ]);
            useEffect(() => {
                scrollViewRef = ref.current;
                setItemsFn = setItems;
            }, []);

            return (
                <ScrollView ref={ref} height={10}>
                    {items.map((item) => (
                        <Box key={item.id} height={item.h} flexShrink={0}>
                            <Text>{item.id}</Text>
                        </Box>
                    ))}
                </ScrollView>
            );
        };

        const { unmount } = render(<TestComponent />);
        await delay(100);
        const scrollView = scrollViewRef!;

        // Initial state:
        // 0: h=2, top=0
        // 1: h=3, top=2
        // 2: h=1, top=5
        // Total: 6

        expect(scrollView.getItemPosition(0)).toEqual({ top: 0, height: 2 });
        expect(scrollView.getItemPosition(1)).toEqual({ top: 2, height: 3 });
        expect(scrollView.getItemPosition(2)).toEqual({ top: 5, height: 1 });
        expect(scrollView.getItemPosition(3)).toBeNull(); // Out of bounds

        // Remove middle item
        setItemsFn([
            { id: "a", h: 2 },
            { id: "c", h: 1 },
        ]);
        await delay(100);

        // 0: h=2, top=0
        // 1: h=1, top=2
        expect(scrollView.getItemPosition(0)).toEqual({ top: 0, height: 2 });
        expect(scrollView.getItemPosition(1)).toEqual({ top: 2, height: 1 });

        // Insert at beginning
        setItemsFn([
            { id: "new", h: 4 },
            { id: "a", h: 2 },
            { id: "c", h: 1 },
        ]);
        await delay(100);

        // 0: h=4, top=0
        // 1: h=2, top=4
        // 2: h=1, top=6
        expect(scrollView.getItemPosition(0)).toEqual({ top: 0, height: 4 });
        expect(scrollView.getItemPosition(1)).toEqual({ top: 4, height: 2 });
        expect(scrollView.getItemPosition(2)).toEqual({ top: 6, height: 1 });

        unmount();
    });

    /**
     * Verifies that `getItemPosition` returns correct values when dimensions or content sizes change.
     *
     * @remarks
     * 1. Width change -> Text wraps/unwraps -> Height changes -> Subsequent items shift up/down.
     * 2. Height prop change on an item -> Subsequent items shift down.
     */
    it("should return correct getItemPosition values when dimensions or content size changes", async () => {
        let scrollViewRef: ScrollViewRef | null = null;
        let setWidthFn: any;
        let setItemHeightFn: any;

        const TestComponent = () => {
            const ref = useRef<ScrollViewRef>(null);
            const [width, setWidth] = useState(10);
            const [h1, setH1] = useState(1);

            useEffect(() => {
                scrollViewRef = ref.current;
                setWidthFn = setWidth;
                setItemHeightFn = setH1;
            }, []);

            return (
                <ScrollView ref={ref} height={10} width={width}>
                    <Box flexShrink={0} height={h1}>
                        <Text>Item 1</Text>
                    </Box>
                    <Box flexShrink={0}>
                        {/* 15 chars. Width 10 -> 2 lines. Width 20 -> 1 line. */}
                        <Text>123456789012345</Text>
                    </Box>
                    <Box flexShrink={0} height={1}>
                        <Text>Item 3</Text>
                    </Box>
                </ScrollView>
            );
        };

        const { unmount } = render(<TestComponent />);
        await delay(100);
        const scrollView = scrollViewRef!;

        // Initial:
        // Item 1: h=1. Top=0.
        // Item 2: text wraps (15 chars in width 10). Height ~2. Top=1.
        // Item 3: h=1. Top=1+2=3.

        // Note: checking approx height for wrapped text
        const pos1 = scrollView.getItemPosition(0);
        const pos2 = scrollView.getItemPosition(1);
        const pos3 = scrollView.getItemPosition(2);

        expect(pos1).toEqual({ top: 0, height: 1 });
        expect(pos2?.top).toBe(1);
        expect(pos2?.height).toBeGreaterThanOrEqual(2);
        expect(pos3?.top).toBe(1 + (pos2?.height || 0));

        // Change Width -> Item 2 becomes 1 line
        setWidthFn(20);
        await delay(100);

        const pos2_new = scrollView.getItemPosition(1);
        expect(pos2_new?.height).toBe(1); // Now fits
        expect(scrollView.getItemPosition(2)).toEqual({ top: 2, height: 1 }); // 1 + 1

        // Change Item 1 Height -> Push everything down
        setItemHeightFn(5);
        await delay(100);

        expect(scrollView.getItemPosition(0)).toEqual({ top: 0, height: 5 });
        expect(scrollView.getItemPosition(1)).toEqual({ top: 5, height: 1 });
        expect(scrollView.getItemPosition(2)).toEqual({ top: 6, height: 1 });

        unmount();
    });
});
