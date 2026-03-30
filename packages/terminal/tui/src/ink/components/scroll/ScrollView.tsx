/* eslint-disable react/function-component-definition, unicorn/filename-case */
import React, {
  useState,
  useRef,
  forwardRef,
  useImperativeHandle,
  useCallback,
  ReactNode,
} from "react";
import type { Props as BoxProps } from "../Box";
import { ControlledScrollView } from "./ControlledScrollView";
import type { ControlledScrollViewRef } from "./ControlledScrollView";

export interface ScrollViewProps extends BoxProps {
  onScroll?: (scrollOffset: number) => void;
  onViewportSizeChange?: (
    size: { width: number; height: number },
    previousSize: { width: number; height: number },
  ) => void;
  onContentHeightChange?: (height: number, previousHeight: number) => void;
  onItemHeightChange?: (
    index: number,
    height: number,
    previousHeight: number,
  ) => void;
  debug?: boolean;
  children?: ReactNode;
}

export interface ScrollViewRef {
  scrollTo: (offset: number) => void;
  scrollBy: (delta: number) => void;
  scrollToTop: () => void;
  scrollToBottom: () => void;
  getScrollOffset: () => number;
  getContentHeight: () => number;
  getViewportHeight: () => number;
  getBottomOffset: () => number;
  getItemHeight: (index: number) => number;
  getItemPosition: (index: number) => { top: number; height: number } | null;
  remeasure: () => void;
  remeasureItem: (index: number) => void;
}

function useStateRef<T>(initialValue: T) {
  const [state, setStateInternal] = useState<T>(initialValue);
  const ref = useRef<T>(initialValue);

  const setState = useCallback((update: React.SetStateAction<T>) => {
    const nextValue =
      typeof update === "function"
        ? (update as (prev: T) => T)(ref.current)
        : update;
    ref.current = nextValue;
    setStateInternal(nextValue);
  }, []);

  const getState = useCallback(() => ref.current, []);

  return [state, setState, getState] as const;
}

export const ScrollView = forwardRef<ScrollViewRef, ScrollViewProps>(
  (
    {
      onScroll,
      onViewportSizeChange,
      onContentHeightChange,
      onItemHeightChange,
      debug = false,
      children,
      ...boxProps
    },
    ref,
  ) => {
    const [scrollOffset, setScrollOffset, getScrollOffset] = useStateRef(0);
    const innerRef = useRef<ControlledScrollViewRef>(null);
    const contentHeightRef = useRef(0);

    const handleContentHeightChange = useCallback(
      (height: number, previousHeight: number) => {
        contentHeightRef.current = height;
        onContentHeightChange?.(height, previousHeight);

        if (getScrollOffset() > height) {
          setScrollOffset(height);
          onScroll?.(height);
        }
      },
      [onContentHeightChange, onScroll, getScrollOffset, setScrollOffset],
    );

    const getBottomOffset = useCallback(
      () =>
        Math.max(
          0,
          contentHeightRef.current -
            (innerRef.current?.getViewportHeight() || 0),
        ),
      [],
    );

    useImperativeHandle(
      ref,
      () => ({
        scrollTo: (offset: number) => {
          if (typeof offset !== "number" || isNaN(offset)) {
            return;
          }
          const currentContentHeight = contentHeightRef.current;
          const newScrollTop = Math.max(
            0,
            Math.min(offset, currentContentHeight),
          );
          if (newScrollTop !== getScrollOffset()) {
            setScrollOffset(newScrollTop);
            onScroll?.(newScrollTop);
          }
        },
        scrollBy: (delta: number) => {
          if (typeof delta !== "number" || isNaN(delta)) {
            return;
          }
          const currentContentHeight = contentHeightRef.current;
          const newScrollTop = Math.max(
            0,
            Math.min(getScrollOffset() + delta, currentContentHeight),
          );
          if (newScrollTop !== getScrollOffset()) {
            setScrollOffset(newScrollTop);
            onScroll?.(newScrollTop);
          }
        },
        scrollToTop: () => {
          if (getScrollOffset() !== 0) {
            setScrollOffset(0);
            onScroll?.(0);
          }
        },
        scrollToBottom: () => {
          const bottomOffset = getBottomOffset();
          if (getScrollOffset() !== bottomOffset) {
            setScrollOffset(bottomOffset);
            onScroll?.(bottomOffset);
          }
        },
        getScrollOffset,
        getContentHeight: () => contentHeightRef.current,
        getViewportHeight: () => innerRef.current?.getViewportHeight() || 0,
        getBottomOffset,
        getItemHeight: (index: number) =>
          innerRef.current?.getItemHeight(index) || 0,
        getItemPosition: (index: number) =>
          innerRef.current?.getItemPosition(index) || null,
        remeasure: () => innerRef.current?.remeasure(),
        remeasureItem: (index: number) =>
          innerRef.current?.remeasureItem(index),
      }),
      [onScroll, getBottomOffset, getScrollOffset, setScrollOffset],
    );

    return (
      <ControlledScrollView
        ref={innerRef}
        scrollOffset={scrollOffset}
        onViewportSizeChange={onViewportSizeChange}
        onContentHeightChange={handleContentHeightChange}
        onItemHeightChange={onItemHeightChange}
        debug={debug}
        children={children}
        {...boxProps}
      />
    );
  },
);
