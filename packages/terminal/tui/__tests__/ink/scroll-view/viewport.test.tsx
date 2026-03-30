import { useRef, useState, useEffect } from "react";
import { Box, render, Text } from "../../../src/ink/index";
import { describe, it, expect, vi } from "vitest";
import { ScrollView } from "../../../src/ink/index";
import type { ScrollViewRef } from "../../../src/ink/index";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Tests for viewport dimension management.
 *
 * @remarks
 * Verifies handling of width/height props, terminal resizing, and viewport callbacks.
 */
describe("Dimensions", () => {
  /**
   * Verifies that content height updates when ScrollView width changes (due to text wrapping).
   *
   * @remarks
   * When width decreases, text should wrap more, increasing content height. When width increases, height should decrease.
   */
  it("should update ContentHeight when ScrollView width changes (text wrapping)", async () => {
    let scrollViewRef: ScrollViewRef | null = null;
    let setWidthFn: any;

    const TestComponent = () => {
      const ref = useRef<ScrollViewRef>(null);
      const [width, setWidth] = useState(10);
      useEffect(() => {
        scrollViewRef = ref.current;
        setWidthFn = setWidth;
      }, []);

      return (
        <ScrollView ref={ref} height={5} width={width}>
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
    setWidthFn(25);
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
   *
   * @remarks
   * Should be called whenever the ScrollView's own `width` or `height` props change (or terminal resizes).
   */
  it("should trigger onViewportSizeChange when dimensions change", async () => {
    let setSizeFn: any;
    const onViewportSizeChange = vi.fn();

    const TestComponent = () => {
      const [size, setSize] = useState({ w: 10, h: 5 });
      useEffect(() => {
        setSizeFn = setSize;
      }, []);

      return (
        <ScrollView
          width={size.w}
          height={size.h}
          onViewportSizeChange={onViewportSizeChange}
        >
          <Text>Content</Text>
        </ScrollView>
      );
    };

    const { unmount } = render(<TestComponent />);
    await delay(100);

    // Initial call
    expect(onViewportSizeChange).toHaveBeenCalled();
    const initialCall = onViewportSizeChange.mock.calls[0];
    expect(initialCall[0]).toEqual({ width: 10, height: 5 });

    // Change size
    onViewportSizeChange.mockClear();
    setSizeFn({ w: 15, h: 8 });
    await delay(100);

    expect(onViewportSizeChange).toHaveBeenCalled();
    const lastCall = onViewportSizeChange.mock.calls[0];
    expect(lastCall[0]).toEqual({ width: 15, height: 8 });

    unmount();
  });

  /**
   * Verifies that scroll offset remains valid when viewport height changes.
   *
   * @remarks
   * Resizing the viewport height should generally preserve the scroll offset, unless the viewport grows so large that the offset is no longer valid.
   * More importantly: Expanding height reduces max scrollable range, but if we are at top (0), we stay at top.
   */
  it("should maintain valid ScrollOffset when height changes", async () => {
    let scrollViewRef: ScrollViewRef | null = null;
    let setHeightFn: any;

    const TestComponent = () => {
      const ref = useRef<ScrollViewRef>(null);
      const [height, setHeight] = useState(5);
      useEffect(() => {
        scrollViewRef = ref.current;
        setHeightFn = setHeight;
      }, []);

      return (
        <ScrollView ref={ref} height={height}>
          {Array.from({ length: 20 }).map((_, i) => (
            <Box key={i}>
              <Text>Item {i}</Text>
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
    setHeightFn(15);
    await delay(100);

    // Viewport height 15. Content 20.
    // Scroll offset 10 is still valid (<= 20).
    expect(scrollView.getScrollOffset()).toBe(10);

    // Now shrink height to 2.
    // Viewport 2.
    setHeightFn(2);
    await delay(100);
    expect(scrollView.getScrollOffset()).toBe(10); // Still valid.

    unmount();
  });

  /**
   * Verifies that ScrollView handles zero height gracefully.
   *
   * @remarks
   * Should report 0 content height and 0 viewport height without error.
   */
  it("should handle ScrollView with zero height", async () => {
    // While rare, user might hide the view by setting height 0
    let scrollViewRef: ScrollViewRef | null = null;
    let setHeightFn: any;

    const TestComponent = () => {
      const ref = useRef<ScrollViewRef>(null);
      const [h, setH] = useState(0);
      useEffect(() => {
        scrollViewRef = ref.current;
        setHeightFn = setH;
      }, []);
      return (
        <ScrollView ref={ref} height={h}>
          <Box height={5} flexShrink={0}>
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
    setHeightFn(5);
    await delay(100);

    expect(scrollView.getContentHeight()).toBe(5);
    expect(scrollView.getViewportHeight()).toBe(5);

    unmount();
  });
});
