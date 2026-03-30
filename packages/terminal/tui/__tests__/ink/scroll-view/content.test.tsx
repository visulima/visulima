import { useRef, useState, useEffect } from "react";
import { Box, render, Text } from "../../../src/ink/index";
import { describe, it, expect, vi } from "vitest";
import { ScrollView } from "../../../src/ink/index";
import type { ScrollViewRef } from "../../../src/ink/index";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Tests for content height calculation logic in ScrollView.
 *
 * @remarks
 * Verifies that the component accurately tracks total height as children are added, removed, resized, or replaced.
 */
describe("ContentHeight", () => {
  /**
   * Verifies that ContentHeight updates correctly when elements are added or removed.
   *
   * @remarks
   * The content height should exactly match the number of visible items (assuming height 1 per item).
   */
  it("should update ContentHeight when adding/removing elements", async () => {
    let scrollViewRef: ScrollViewRef | null = null;
    let setItemsFn: any;

    const TestComponent = () => {
      const ref = useRef<ScrollViewRef>(null);
      const [items, setItems] = useState([1, 2]); // Initial height 2
      useEffect(() => {
        scrollViewRef = ref.current;
        setItemsFn = setItems;
      }, []);

      return (
        <ScrollView ref={ref} height={5}>
          {items.map((i) => (
            <Box key={i} height={1} flexShrink={0}>
              <Text>Item {i}</Text>
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
    setItemsFn([1, 2, 3, 4]);
    await delay(100);
    expect(scrollView.getContentHeight()).toBe(4);

    // Remove items
    setItemsFn([1]);
    await delay(100);
    expect(scrollView.getContentHeight()).toBe(1);

    unmount();
  });

  /**
   * Verifies that ContentHeight updates when an individual child element resizes.
   *
   * @remarks
   * The total content height should reflect the new size of the child.
   */
  it("should update ContentHeight when element size changes", async () => {
    let scrollViewRef: ScrollViewRef | null = null;
    let setHeightFn: any;

    const Wrapper = ({
      children,
      height,
    }: {
      children: React.ReactNode;
      height: number;
    }) => {
      return (
        <Box height={height} flexShrink={0}>
          {children}
        </Box>
      );
    };

    const TestComponent = () => {
      const ref = useRef<ScrollViewRef>(null);
      const [height, setHeight] = useState(1);

      useEffect(() => {
        scrollViewRef = ref.current;
        setHeightFn = setHeight;
      }, []);

      return (
        <ScrollView ref={ref} height={5}>
          <Wrapper height={height}>
            <Text>Item 1</Text>
          </Wrapper>
          <Box height={1} flexShrink={0}>
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
    setHeightFn(3);
    await delay(100);

    // Check if height updated
    expect(scrollView.getContentHeight()).toBe(4); // 3 + 1

    unmount();
  });

  /**
   * Verifies that ContentHeight drops to 0 when all children are cleared.
   */
  it("should update ContentHeight when all elements are cleared", async () => {
    let scrollViewRef: ScrollViewRef | null = null;
    let setItemsFn: any;

    const TestComponent = () => {
      const ref = useRef<ScrollViewRef>(null);
      const [items, setItems] = useState([1, 2, 3]);
      useEffect(() => {
        scrollViewRef = ref.current;
        setItemsFn = setItems;
      }, []);

      return (
        <ScrollView ref={ref} height={5}>
          {items.map((i) => (
            <Box key={i} height={1} flexShrink={0}>
              <Text>Item {i}</Text>
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
    setItemsFn([]);
    await delay(100);
    expect(scrollView.getContentHeight()).toBe(0);

    unmount();
  });

  /**
   * Verifies that ContentHeight is recalculated correctly when the entire children array is replaced.
   *
   * @remarks
   * This covers scenarios where children are replaced with new objects having different keys.
   */
  it("should update ContentHeight when elements are replaced entirely", async () => {
    let scrollViewRef: ScrollViewRef | null = null;
    let setItemsFn: any;

    const TestComponent = () => {
      const ref = useRef<ScrollViewRef>(null);
      const [items, setItems] = useState([
        { id: "a", h: 1 },
        { id: "b", h: 1 },
      ]);
      useEffect(() => {
        scrollViewRef = ref.current;
        setItemsFn = setItems;
      }, []);

      return (
        <ScrollView ref={ref} height={5}>
          {items.map((item) => (
            <Box key={item.id} height={item.h} flexShrink={0}>
              <Text>Item {item.id}</Text>
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
    setItemsFn([
      { id: "c", h: 2 },
      { id: "d", h: 3 },
      { id: "e", h: 1 },
    ]);
    await delay(100);
    expect(scrollView.getContentHeight()).toBe(6); // 2 + 3 + 1

    unmount();
  });

  /**
   * Verifies that `remeasureItem` triggers a height update when internal content size changes.
   *
   * @remarks
   * This is critical for scenarios where a child component has internal state that changes its rendered height
   * without triggering a prop update or re-render in the parent ScrollView.
   */
  it("should trigger remeasureItem correctly when internal content changes size without prop change", async () => {
    let scrollViewRef: ScrollViewRef | null = null;
    const DynamicItem = ({ index }: { index: number; forwardedRef: any }) => {
      const [lines, setLines] = useState(1);
      useEffect(() => {
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
        <ScrollView ref={ref} height={10}>
          <DynamicItem index={0} forwardedRef={null} />
          <Box height={1}>
            <Text>Fixed</Text>
          </Box>
        </ScrollView>
      );
    };

    const globalStore: any = {};
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
   *
   * @remarks
   * Expects the component to render without error and report 0 height.
   */
  it("should handle empty children gracefully (ContentHeight 0)", async () => {
    let scrollViewRef: ScrollViewRef | null = null;

    const TestComponent = () => {
      const ref = useRef<ScrollViewRef>(null);
      useEffect(() => {
        scrollViewRef = ref.current;
      }, []);
      return (
        <ScrollView ref={ref} height={5}>
          {/* Empty */}
        </ScrollView>
      );
    };

    const { unmount } = render(<TestComponent />);
    await delay(100);

    const scrollView = scrollViewRef!;
    expect(scrollView).toBeTruthy();
    expect(scrollView.getContentHeight()).toBe(0);

    unmount();
  });

  /**
   * Verifies that children with 0 height do not contribute to the total content height.
   */
  it("should ignore zero-height children in calculations", async () => {
    let scrollViewRef: ScrollViewRef | null = null;

    const TestComponent = () => {
      const ref = useRef<ScrollViewRef>(null);
      useEffect(() => {
        scrollViewRef = ref.current;
      }, []);
      return (
        <ScrollView ref={ref} height={5}>
          <Box height={1} flexShrink={0}>
            <Text>Visible</Text>
          </Box>
          <Box height={0} flexShrink={0}>
            <Text></Text>
          </Box>
          <Box height={0} flexShrink={0}></Box>
          <Box height={1} flexShrink={0}>
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
    let scrollViewRef: ScrollViewRef | null = null;
    const TestComponent = () => {
      const ref = useRef<ScrollViewRef>(null);
      useEffect(() => {
        scrollViewRef = ref.current;
      }, []);
      return (
        <ScrollView ref={ref} height={5}>
          <Box height={1} flexShrink={0}>
            <Text>Item 1</Text>
          </Box>
          <Box height={1} flexShrink={0}>
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
   *
   * @remarks
   * The callback should receive `(newHeight, oldHeight)` arguments whenever the height changes.
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
        <ScrollView height={5} onContentHeightChange={onHeightChange}>
          {items.map((i) => (
            <Box key={i} height={1} flexShrink={0}>
              <Text>{i}</Text>
            </Box>
          ))}
        </ScrollView>
      );
    };

    const { unmount } = render(<TestComponent />);
    await delay(100);

    expect(onHeightChange).toHaveBeenCalled();
    const lastCall =
      onHeightChange.mock.calls[onHeightChange.mock.calls.length - 1];
    expect(lastCall?.[0]).toBe(1); // height

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

  /**
   * Verifies that mixed valid and invalid (null/false) children are handled correctly.
   *
   * @remarks
   * Invalid children should be skipped, and the total height should be the sum of valid, visible children.
   * This ensures that sparse arrays resulting from conditional rendering do not break index or key tracking.
   */
  it("should handle mixed empty/valid children correctly", async () => {
    let scrollViewRef: ScrollViewRef | null = null;

    const TestComponent = () => {
      const ref = useRef<ScrollViewRef>(null);
      useEffect(() => {
        scrollViewRef = ref.current;
      }, []);

      return (
        <ScrollView ref={ref} height={5}>
          <Box key="a" height={1} flexShrink={0}>
            <Text>A</Text>
          </Box>
          {false}
          {null}
          <Box key="b" height={1} flexShrink={0}>
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
   *
   * @remarks
   * Tests switching a child from `false` to an Element and back, ensuring height updates reflect presence/absence.
   */
  it("should handle conditional rendering of children", async () => {
    let scrollViewRef: ScrollViewRef | null = null;
    let setShowFn: any;

    const TestComponent = () => {
      const ref = useRef<ScrollViewRef>(null);
      const [show, setShow] = useState(false);

      useEffect(() => {
        scrollViewRef = ref.current;
        setShowFn = setShow;
      }, []);

      return (
        <ScrollView ref={ref} height={5}>
          <Box height={1} flexShrink={0}>
            <Text>Fixed</Text>
          </Box>
          {show && (
            <Box height={1} flexShrink={0}>
              <Text>Dynamic</Text>
            </Box>
          )}
          <Box height={1} flexShrink={0}>
            <Text>Fixed 2</Text>
          </Box>
        </ScrollView>
      );
    };

    const { unmount } = render(<TestComponent />);
    await delay(100);
    expect(scrollViewRef!.getContentHeight()).toBe(2);

    setShowFn(true);
    await delay(100);
    expect(scrollViewRef!.getContentHeight()).toBe(3);

    setShowFn(false);
    await delay(100);
    expect(scrollViewRef!.getContentHeight()).toBe(2);

    unmount();
  });
});
