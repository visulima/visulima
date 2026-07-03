import { useEffect, useRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";

import type { ScrollViewRef } from "../../../src/components/index";
import { Box, ScrollView, Text } from "../../../src/components/index";
import { render } from "../../../src/ink/index";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Tests for content height calculation logic in ScrollView.
 * @remarks
 * Verifies that the component accurately tracks total height as children are added, removed, resized, or replaced.
 */
describe("contentHeight", () => {
    /**
     * Verifies that ContentHeight updates correctly when elements are added or removed.
     * @remarks
     * The content height should exactly match the number of visible items (assuming height 1 per item).
     */
    it("should update ContentHeight when adding/removing elements", async () => {
        expect.assertions(3);

        let scrollViewRef: ScrollViewRef | null = null;
        let setItemsFunction: any;

        const TestComponent = () => {
            const ref = useRef<ScrollViewRef>(null);
            const [items, setItems] = useState([1, 2]); // Initial height 2

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

        expect(scrollView.getContentHeight()).toBe(2);

        // Add items
        setItemsFunction([1, 2, 3, 4]);
        await delay(100);

        expect(scrollView.getContentHeight()).toBe(4);

        // Remove items
        setItemsFunction([1]);
        await delay(100);

        expect(scrollView.getContentHeight()).toBe(1);

        unmount();
    });

    /**
     * Verifies that ContentHeight updates when an individual child element resizes.
     * @remarks
     * The total content height should reflect the new size of the child.
     */
    it("should update ContentHeight when element size changes", async () => {
        expect.assertions(2);

        let scrollViewRef: ScrollViewRef | null = null;
        let setHeightFunction: any;

        const Wrapper = ({ children, height }: { children: React.ReactNode; height: number }) => (
            <Box flexShrink={0} height={height}>
                {children}
            </Box>
        );

        const TestComponent = () => {
            const ref = useRef<ScrollViewRef>(null);
            const [height, setHeight] = useState(1);

            useEffect(() => {
                scrollViewRef = ref.current;
                setHeightFunction = setHeight;
            }, []);

            return (
                <ScrollView height={5} ref={ref}>
                    <Wrapper height={height}>
                        <Text>Item 1</Text>
                    </Wrapper>
                    <Box flexShrink={0} height={1}>
                        <Text>Item 2</Text>
                    </Box>
                </ScrollView>
            );
        };

        const { unmount } = render(<TestComponent />);

        await delay(100);

        const scrollView = scrollViewRef!;

        expect(scrollView.getContentHeight()).toBe(2); // 1 + 1

        // Change height of first item
        setHeightFunction(3);
        await delay(100);

        // Check if height updated
        expect(scrollView.getContentHeight()).toBe(4); // 3 + 1

        unmount();
    });

    /**
     * Verifies that ContentHeight drops to 0 when all children are cleared.
     */
    it("should update ContentHeight when all elements are cleared", async () => {
        expect.assertions(2);

        let scrollViewRef: ScrollViewRef | null = null;
        let setItemsFunction: any;

        const TestComponent = () => {
            const ref = useRef<ScrollViewRef>(null);
            const [items, setItems] = useState([1, 2, 3]);

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

        expect(scrollView.getContentHeight()).toBe(3);

        // Clear all
        setItemsFunction([]);
        await delay(100);

        expect(scrollView.getContentHeight()).toBe(0);

        unmount();
    });

    /**
     * Verifies that ContentHeight is recalculated correctly when the entire children array is replaced.
     * @remarks
     * This covers scenarios where children are replaced with new objects having different keys.
     */
    it("should update ContentHeight when elements are replaced entirely", async () => {
        expect.assertions(2);

        let scrollViewRef: ScrollViewRef | null = null;
        let setItemsFunction: any;

        const TestComponent = () => {
            const ref = useRef<ScrollViewRef>(null);
            const [items, setItems] = useState([
                { h: 1, id: "a" },
                { h: 1, id: "b" },
            ]);

            useEffect(() => {
                scrollViewRef = ref.current;
                setItemsFunction = setItems;
            }, []);

            return (
                <ScrollView height={5} ref={ref}>
                    {items.map((item) => (
                        <Box flexShrink={0} height={item.h} key={item.id}>
                            <Text>
                                Item
                                {item.id}
                            </Text>
                        </Box>
                    ))}
                </ScrollView>
            );
        };

        const { unmount } = render(<TestComponent />);

        await delay(100);

        const scrollView = scrollViewRef!;

        expect(scrollView.getContentHeight()).toBe(2);

        // Replace batch with new keys and different heights
        setItemsFunction([
            { h: 2, id: "c" },
            { h: 3, id: "d" },
            { h: 1, id: "e" },
        ]);
        await delay(100);

        expect(scrollView.getContentHeight()).toBe(6); // 2 + 3 + 1

        unmount();
    });

    /**
     * Verifies that `remeasureItem` triggers a height update when internal content size changes.
     * @remarks
     * This is critical for scenarios where a child component has internal state that changes its rendered height
     * without triggering a prop update or re-render in the parent ScrollView.
     */
    it("should trigger remeasureItem correctly when internal content changes size without prop change", async () => {
        expect.assertions(3);

        let scrollViewRef: ScrollViewRef | null = null;
        const DynamicItem = ({ index }: { forwardedRef: any; index: number }) => {
            const [lines, setLines] = useState(1);

            useEffect(() => {
                // eslint-disable-next-line unicorn/prefer-global-this -- test aliases window to a local store; globalThis would write to a different object
                (window as any)[`setLines_${index}`] = setLines;
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
                <ScrollView height={10} ref={ref}>
                    <DynamicItem forwardedRef={null} index={0} />
                    <Box height={1}>
                        <Text>Fixed</Text>
                    </Box>
                </ScrollView>
            );
        };

        const globalStore: any = {};

        // eslint-disable-next-line unicorn/prefer-global-this, no-restricted-globals -- intentionally creating a `window` alias on globalThis
        (global as any).window = globalStore;

        const { unmount } = render(<TestComponent />);

        await delay(100);

        const scrollView = scrollViewRef!;

        expect(scrollView.getContentHeight()).toBe(2);

        if (globalStore["setLines_0"]) {
            globalStore["setLines_0"](5);
        }

        await delay(100);

        expect(scrollView.getContentHeight()).toBe(2); // Still thinks it is 2

        scrollView.remeasureItem(0);
        await delay(100);

        expect(scrollView.getContentHeight()).toBe(6);

        unmount();
    });

    /**
     * Verifies that the component handles empty children (e.g., null, commented out) gracefully.
     * @remarks
     * Expects the component to render without error and report 0 height.
     */
    it("should handle empty children gracefully (ContentHeight 0)", async () => {
        expect.assertions(2);

        let scrollViewRef: ScrollViewRef | null = null;

        const TestComponent = () => {
            const ref = useRef<ScrollViewRef>(null);

            useEffect(() => {
                scrollViewRef = ref.current;
            }, []);

            return (
                <ScrollView height={5} ref={ref}>
                    {/* Empty */}
                </ScrollView>
            );
        };

        const { unmount } = render(<TestComponent />);

        await delay(100);

        const scrollView = scrollViewRef!;

        expect(scrollView).not.toBeNull();
        expect(scrollView.getContentHeight()).toBe(0);

        unmount();
    });

    /**
     * Verifies that children with 0 height do not contribute to the total content height.
     */
    it("should ignore zero-height children in calculations", async () => {
        expect.assertions(1);

        let scrollViewRef: ScrollViewRef | null = null;

        const TestComponent = () => {
            const ref = useRef<ScrollViewRef>(null);

            useEffect(() => {
                scrollViewRef = ref.current;
            }, []);

            return (
                <ScrollView height={5} ref={ref}>
                    <Box flexShrink={0} height={1}>
                        <Text>Visible</Text>
                    </Box>
                    <Box flexShrink={0} height={0}>
                        <Text />
                    </Box>
                    <Box flexShrink={0} height={0} />
                    <Box flexShrink={0} height={1}>
                        <Text>Visible 2</Text>
                    </Box>
                </ScrollView>
            );
        };

        const { unmount } = render(<TestComponent />);

        await delay(100);

        const scrollView = scrollViewRef!;

        expect(scrollView.getContentHeight()).toBe(2);

        unmount();
    });

    /**
     * Verifies that ContentHeight is calculated correctly immediately after the initial render.
     */
    it("should initialize with correct content height", async () => {
        expect.assertions(1);

        let scrollViewRef: ScrollViewRef | null = null;
        const TestComponent = () => {
            const ref = useRef<ScrollViewRef>(null);

            useEffect(() => {
                scrollViewRef = ref.current;
            }, []);

            return (
                <ScrollView height={5} ref={ref}>
                    <Box flexShrink={0} height={1}>
                        <Text>Item 1</Text>
                    </Box>
                    <Box flexShrink={0} height={1}>
                        <Text>Item 2</Text>
                    </Box>
                </ScrollView>
            );
        };

        const { unmount } = render(<TestComponent />);

        await delay(100);
        const scrollView = scrollViewRef!;

        expect(scrollView.getContentHeight()).toBe(2);

        unmount();
    });

    /**
     * Verifies that the `onContentHeightChange` callback is triggered accurately.
     * @remarks
     * The callback should receive `(newHeight, oldHeight)` arguments whenever the height changes.
     */
    it("should trigger onContentHeightChange callback accurately", async () => {
        expect.assertions(4);

        const onHeightChange = vi.fn();
        let setItemsFunction: any;

        const TestComponent = () => {
            const [items, setItems] = useState([1]);

            useEffect(() => {
                setItemsFunction = setItems;
            }, []);

            return (
                <ScrollView height={5} onContentHeightChange={onHeightChange}>
                    {items.map((i) => (
                        <Box flexShrink={0} height={1} key={i}>
                            <Text>{i}</Text>
                        </Box>
                    ))}
                </ScrollView>
            );
        };

        const { unmount } = render(<TestComponent />);

        await delay(100);

        expect(onHeightChange).toHaveBeenCalledWith(1, expect.any(Number));

        const lastCall = onHeightChange.mock.calls[onHeightChange.mock.calls.length - 1];

        expect(lastCall?.[0]).toBe(1); // height

        // Add Items
        onHeightChange.mockClear();
        setItemsFunction([1, 2, 3]);
        await delay(100);

        expect(onHeightChange).toHaveBeenCalledWith(3, 1);

        // Remove Items
        onHeightChange.mockClear();
        setItemsFunction([1]);
        await delay(100);

        expect(onHeightChange).toHaveBeenCalledWith(1, 3);

        unmount();
    });

    /**
     * Verifies that mixed valid and invalid (null/false) children are handled correctly.
     * @remarks
     * Invalid children should be skipped, and the total height should be the sum of valid, visible children.
     * This ensures that sparse arrays resulting from conditional rendering do not break index or key tracking.
     */
    it("should handle mixed empty/valid children correctly", async () => {
        expect.assertions(1);

        let scrollViewRef: ScrollViewRef | null = null;

        const TestComponent = () => {
            const ref = useRef<ScrollViewRef>(null);

            useEffect(() => {
                scrollViewRef = ref.current;
            }, []);

            return (
                <ScrollView height={5} ref={ref}>
                    <Box flexShrink={0} height={1} key="a">
                        <Text>A</Text>
                    </Box>
                    {false}
                    {null}
                    <Box flexShrink={0} height={1} key="b">
                        <Text>B</Text>
                    </Box>
                </ScrollView>
            );
        };

        const { unmount } = render(<TestComponent />);

        await delay(100);

        const scrollView = scrollViewRef!;

        expect(scrollView.getContentHeight()).toBe(2);

        unmount();
    });

    /**
     * Verifies that ContentHeight updates dynamically with conditional rendering.
     * @remarks
     * Tests switching a child from `false` to an Element and back, ensuring height updates reflect presence/absence.
     */
    it("should handle conditional rendering of children", async () => {
        expect.assertions(3);

        let scrollViewRef: ScrollViewRef | null = null;
        let setShowFunction: any;

        const TestComponent = () => {
            const ref = useRef<ScrollViewRef>(null);
            const [show, setShow] = useState(false);

            useEffect(() => {
                scrollViewRef = ref.current;
                setShowFunction = setShow;
            }, []);

            return (
                <ScrollView height={5} ref={ref}>
                    <Box flexShrink={0} height={1}>
                        <Text>Fixed</Text>
                    </Box>
                    {show && (
                        <Box flexShrink={0} height={1}>
                            <Text>Dynamic</Text>
                        </Box>
                    )}
                    <Box flexShrink={0} height={1}>
                        <Text>Fixed 2</Text>
                    </Box>
                </ScrollView>
            );
        };

        const { unmount } = render(<TestComponent />);

        await delay(100);

        expect(scrollViewRef!.getContentHeight()).toBe(2);

        setShowFunction(true);
        await delay(100);

        expect(scrollViewRef!.getContentHeight()).toBe(3);

        setShowFunction(false);
        await delay(100);

        expect(scrollViewRef!.getContentHeight()).toBe(2);

        unmount();
    });
});
