/* eslint-disable react-perf/jsx-no-new-function-as-prop, react-perf/jsx-no-new-object-as-prop, react/function-component-definition, unicorn/filename-case */
import type React from "react";
import type { ForwardRefExoticComponent, ReactNode, RefAttributes } from "react";
import {
  useState,
  useRef,
  forwardRef,
  useImperativeHandle,
  useLayoutEffect,
  useCallback,
  Children,
  isValidElement,
} from "react";

import type { DOMElement } from "../../dom";
import measureElement from "../../measure-element";
import type { Props as BoxProps } from "../Box";
import Box from "../Box";
import { useStateRef } from "./use-state-ref";

const MeasurableItem = ({
  children,
  onMeasure,
  index,
  width,
  measureKey,
}: {
  children: ReactNode;
  onMeasure: (index: number, height: number) => void;
  index: number;
  width: number;
  measureKey?: number;
}): React.JSX.Element => {
  const ref = useRef<DOMElement>(null);

  useLayoutEffect(() => {
    if (ref.current) {
      const { height } = measureElement(ref.current);
      onMeasure(index, height);
    }
  }, [index, onMeasure, width, measureKey, children]);

  return (
    <Box ref={ref} flexShrink={0} width="100%" flexDirection="column">
      {children}
    </Box>
  );
};

export interface ControlledScrollViewProps extends BoxProps {
  scrollOffset: number;
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

export interface ControlledScrollViewRef {
  getContentHeight: () => number;
  getViewportHeight: () => number;
  getBottomOffset: () => number;
  getItemHeight: (index: number) => number;
  getItemPosition: (index: number) => { top: number; height: number } | null;
  remeasure: () => void;
  remeasureItem: (index: number) => void;
}

export const ControlledScrollView: ForwardRefExoticComponent<ControlledScrollViewProps & RefAttributes<ControlledScrollViewRef>> = forwardRef<
  ControlledScrollViewRef,
  ControlledScrollViewProps
>(
  (
    {
      scrollOffset,
      onViewportSizeChange,
      onContentHeightChange,
      onItemHeightChange,
      debug = false,
      children,
      ...boxProps
    },
    ref,
  ) => {
    const [viewportSize, setViewportSize, getViewportSize] = useStateRef({
      height: 0,
      width: 0,
    });
    const [contentHeight, setContentHeight, getContentHeight] = useStateRef(0);
    const [itemMeasureKeys, setItemMeasureKeys] = useState<
      Record<number, number>
    >({});

    const viewportRef = useRef<DOMElement>(null);
    const prevContentHeightRef = useRef(0);

    useLayoutEffect(() => {
      if (contentHeight !== prevContentHeightRef.current) {
        onContentHeightChange?.(contentHeight, prevContentHeightRef.current);
        prevContentHeightRef.current = contentHeight;
      }
    }, [contentHeight, onContentHeightChange]);

    const itemHeightsRef = useRef<Record<string | number, number>>({});
    const itemKeysRef = useRef<(string | number)[]>([]);
    const itemOffsetsRef = useRef<number[]>([]);
    const firstInvalidOffsetIndexRef = useRef<number>(0);

    const handleItemMeasure = useCallback(
      (index: number, height: number) => {
        const key = itemKeysRef.current[index] || index;

        if (itemHeightsRef.current[key] !== height) {
          const previousHeight = itemHeightsRef.current[key] || 0;

          itemHeightsRef.current = {
            ...itemHeightsRef.current,
            [key]: height,
          };

          let newTotalHeight = 0;
          for (const itemKey of itemKeysRef.current) {
            newTotalHeight += itemHeightsRef.current[itemKey] || 0;
          }

          const currentHeight = getContentHeight();
          if (newTotalHeight !== currentHeight) {
            setContentHeight(newTotalHeight);
          }

          onItemHeightChange?.(index, height, previousHeight);

          firstInvalidOffsetIndexRef.current = Math.min(
            firstInvalidOffsetIndexRef.current,
            index + 1,
          );
        }
      },
      [
        onItemHeightChange,
        getContentHeight,
        setContentHeight,
      ],
    );

    const measureViewport = useCallback(() => {
      if (viewportRef.current) {
        const { width, height } = measureElement(viewportRef.current);
        const currentSize = getViewportSize();
        if (width !== currentSize.width || height !== currentSize.height) {
          onViewportSizeChange?.({ width, height }, currentSize);
          setViewportSize({ width, height });
        }
      }
    }, [viewportRef, onViewportSizeChange, getViewportSize, setViewportSize]);

    useLayoutEffect(() => {
      measureViewport();
    });

    const prevChildrenRef = useRef<typeof children>(null);
    if (prevChildrenRef.current !== children) {
      prevChildrenRef.current = children;

      const newItemKeys: (string | number)[] = [];
      const newItemHeights: Record<string | number, number> = {};

      Children.forEach(children, (child, index) => {
        if (!child) return;
        const key = isValidElement(child) ? child.key : null;
        const effectiveKey = key !== null ? key : index;

        newItemKeys[index] = effectiveKey;
        const itemHeight = itemHeightsRef.current[effectiveKey] || 0;
        newItemHeights[effectiveKey] = itemHeight;
      });

      itemHeightsRef.current = newItemHeights;
      itemKeysRef.current = newItemKeys;
      itemOffsetsRef.current = new Array(newItemKeys.length).fill(0);
      firstInvalidOffsetIndexRef.current = 0;

      let newTotalHeight = 0;
      newItemKeys.forEach((itemKey) => {
        newTotalHeight += newItemHeights[itemKey] || 0;
      });

      const currentHeight = getContentHeight();
      if (newTotalHeight !== currentHeight) {
        setContentHeight(newTotalHeight);
      }
    }

    useImperativeHandle(
      ref,
      () => ({
        getContentHeight,
        getViewportHeight: () => getViewportSize().height,
        getBottomOffset: () =>
          Math.max(0, getContentHeight() - getViewportSize().height),
        getItemHeight: (index: number) => {
          const key = itemKeysRef.current[index] || index;
          return itemHeightsRef.current[key] || 0;
        },
        remeasure: measureViewport,
        remeasureItem: (index: number) =>
          setItemMeasureKeys((prev) => ({
            ...prev,
            [index]: (prev[index] || 0) + 1,
          })),
        getItemPosition: (index: number) => {
          if (index < 0 || index >= itemKeysRef.current.length) {
            return null;
          }

          if (index >= firstInvalidOffsetIndexRef.current) {
            let currentOffset = 0;
            let startIndex = 0;

            if (firstInvalidOffsetIndexRef.current > 0) {
              startIndex = firstInvalidOffsetIndexRef.current;
              const prevIndex = startIndex - 1;
              const prevKey = itemKeysRef.current[prevIndex] || prevIndex;
              const prevHeight = itemHeightsRef.current[prevKey] || 0;
              currentOffset =
                (itemOffsetsRef.current[prevIndex] ?? 0) + prevHeight;
            }

            for (let i = startIndex; i <= index; i++) {
              itemOffsetsRef.current[i] = currentOffset;
              const key = itemKeysRef.current[i] || i;
              const height = itemHeightsRef.current[key] || 0;
              currentOffset += height;
            }
            firstInvalidOffsetIndexRef.current = index + 1;
          }

          const top = itemOffsetsRef.current[index] ?? 0;
          const key = itemKeysRef.current[index] || index;
          const height = itemHeightsRef.current[key] || 0;
          return { top, height };
        },
      }),
      [measureViewport, getContentHeight, getViewportSize, setItemMeasureKeys],
    );

    return (
      <Box {...boxProps}>
        <Box ref={viewportRef} width="100%">
          <Box overflow={debug ? undefined : "hidden"} width="100%">
            <Box
              width="100%"
              flexDirection="column"
              marginTop={-scrollOffset}
            >
              {Children.map(children, (child, index) => {
                if (!child) return null;
                return (
                  <MeasurableItem
                    key={isValidElement(child) ? child.key || index : index}
                    index={index}
                    width={viewportSize.width}
                    onMeasure={handleItemMeasure}
                    measureKey={itemMeasureKeys[index]}
                  >
                    {child}
                  </MeasurableItem>
                );
              })}
            </Box>
          </Box>
        </Box>
      </Box>
    );
  },
);
