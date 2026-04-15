import type React from "react";
import type { ReactNode, Ref } from "react";
import { Fragment, isValidElement, useCallback, useImperativeHandle, useLayoutEffect, useRef, useState } from "react";

import type { DOMElement } from "../../dom";
import measureElement from "../../measure-element";
import type { Props as BoxProps } from "../box";
import Box from "../box";
import useStateRef from "./use-state-ref";

const MeasurableItem = ({
    children,
    index,
    measureKey,
    onMeasure,
    width,
}: {
    children: ReactNode;
    index: number;
    measureKey?: number;
    onMeasure: (index: number, height: number) => void;
    width: number;
}): React.JSX.Element => {
    const ref = useRef<DOMElement>(null);

    useLayoutEffect(() => {
        if (ref.current) {
            const { height } = measureElement(ref.current);

            onMeasure(index, height);
        }
    }, [index, onMeasure, width, measureKey, children]);

    return (
        <Box flexDirection="column" flexShrink={0} ref={ref} width="100%">
            {children}
        </Box>
    );
};

const toChildArray = (children: ReactNode): ReactNode[] => {
    if (children == null) {
        return [];
    }

    if (Array.isArray(children)) {
        const result: ReactNode[] = [];

        // eslint-disable-next-line unicorn/no-for-loop
        for (let index = 0; index < children.length; index += 1) {
            const child = children[index] as ReactNode;

            if (isValidElement(child) && child.type === Fragment) {
                result.push(...toChildArray((child.props as { children?: ReactNode }).children));
            } else {
                result.push(child);
            }
        }

        return result;
    }

    if (isValidElement(children) && children.type === Fragment) {
        return toChildArray((children.props as { children?: ReactNode }).children);
    }

    return [children];
};

export interface ControlledScrollViewProps extends BoxProps {
    children?: ReactNode;
    debug?: boolean;
    onContentHeightChange?: (height: number, previousHeight: number) => void;
    onItemHeightChange?: (index: number, height: number, previousHeight: number) => void;
    onViewportSizeChange?: (size: { height: number; width: number }, previousSize: { height: number; width: number }) => void;

    /**
     * Number of extra items to render above/below the viewport when virtualized.
     * @default 3
     */
    overscan?: number;
    scrollOffset: number;

    /**
     * Only render items visible in the viewport plus overscan.
     * Items must be measured first (first render always renders all items).
     * @default false
     */
    virtualize?: boolean;
}

export interface ControlledScrollViewRef {
    getBottomOffset: () => number;
    getContentHeight: () => number;
    getItemHeight: (index: number) => number;
    getItemPosition: (index: number) => { height: number; top: number } | null;
    getViewportHeight: () => number;
    remeasure: () => void;
    remeasureItem: (index: number) => void;
}

export const ControlledScrollView = ({
    children,
    debug = false,
    onContentHeightChange,
    onItemHeightChange,
    onViewportSizeChange,
    overscan = 3,
    ref,
    scrollOffset,
    virtualize = false,
    ...boxProps
}: ControlledScrollViewProps & { ref?: Ref<ControlledScrollViewRef> }): React.JSX.Element => {
    const hasMeasuredRef = useRef(false);
    const [viewportSize, setViewportSize, getViewportSize] = useStateRef({
        height: 0,
        width: 0,
    });
    const [contentHeight, setContentHeight, getContentHeight] = useStateRef(0);
    const [itemMeasureKeys, setItemMeasureKeys] = useState<Record<number, number>>({});

    const viewportRef = useRef<DOMElement>(null);
    const previousContentHeightRef = useRef(0);

    useLayoutEffect(() => {
        if (contentHeight !== previousContentHeightRef.current) {
            onContentHeightChange?.(contentHeight, previousContentHeightRef.current);
            previousContentHeightRef.current = contentHeight;
        }
    }, [contentHeight, onContentHeightChange]);

    const itemHeightsRef = useRef<Record<string | number, number>>({});
    const itemKeysRef = useRef<(string | number)[]>([]);
    const itemOffsetsRef = useRef<number[]>([]);
    const firstInvalidOffsetIndexRef = useRef(0);

    const handleItemMeasure = useCallback(
        (index: number, height: number) => {
            const key = itemKeysRef.current[index] ?? index;

            if (itemHeightsRef.current[key] !== height) {
                const previousHeight = itemHeightsRef.current[key] ?? 0;

                itemHeightsRef.current = {
                    ...itemHeightsRef.current,
                    [key]: height,
                };

                let newTotalHeight = 0;

                for (let i = 0; i < itemKeysRef.current.length; i += 1) {
                    const itemKey = itemKeysRef.current[i];

                    if (itemKey != null) {
                        newTotalHeight += itemHeightsRef.current[itemKey] ?? 0;
                    }
                }

                const currentHeight = getContentHeight();

                if (newTotalHeight !== currentHeight) {
                    setContentHeight(newTotalHeight);
                }

                onItemHeightChange?.(index, height, previousHeight);

                firstInvalidOffsetIndexRef.current = Math.min(firstInvalidOffsetIndexRef.current, index + 1);
            }
        },
        [onItemHeightChange, getContentHeight, setContentHeight],
    );

    const measureViewport = useCallback(() => {
        if (viewportRef.current) {
            const { height, width } = measureElement(viewportRef.current);
            const currentSize = getViewportSize();

            if (width !== currentSize.width || height !== currentSize.height) {
                onViewportSizeChange?.({ height, width }, currentSize);
                setViewportSize({ height, width });
            }
        }
    }, [viewportRef, onViewportSizeChange, getViewportSize, setViewportSize]);

    useLayoutEffect(() => {
        measureViewport();
    });

    const previousChildrenRef = useRef<typeof children>(null);

    if (previousChildrenRef.current !== children) {
        previousChildrenRef.current = children;

        const newItemKeys: (string | number)[] = [];
        const newItemHeights: Record<string | number, number> = {};

        const childArray = toChildArray(children);

        childArray.forEach((child: ReactNode, index: number) => {
            if (!child) {
                return;
            }

            const key = isValidElement(child) ? child.key : null;
            const effectiveKey = key ?? index;

            newItemKeys[index] = effectiveKey;
            const itemHeight = itemHeightsRef.current[effectiveKey] ?? 0;

            newItemHeights[effectiveKey] = itemHeight;
        });

        itemHeightsRef.current = newItemHeights;
        itemKeysRef.current = newItemKeys;
        itemOffsetsRef.current = Array.from<number>({ length: newItemKeys.length }).fill(0);
        firstInvalidOffsetIndexRef.current = 0;

        let newTotalHeight = 0;

        newItemKeys.forEach((itemKey) => {
            newTotalHeight += newItemHeights[itemKey] ?? 0;
        });

        const currentHeight = getContentHeight();

        if (newTotalHeight !== currentHeight) {
            setContentHeight(newTotalHeight);
        }
    }

    useImperativeHandle(ref, () => {
        return {
            getBottomOffset: () => Math.max(0, getContentHeight() - getViewportSize().height),
            getContentHeight,
            getItemHeight: (index: number) => {
                const key = itemKeysRef.current[index] ?? index;

                return itemHeightsRef.current[key] ?? 0;
            },
            getItemPosition: (index: number) => {
                if (index < 0 || index >= itemKeysRef.current.length) {
                    return null;
                }

                if (index >= firstInvalidOffsetIndexRef.current) {
                    let currentOffset = 0;
                    let startIndex = 0;

                    if (firstInvalidOffsetIndexRef.current > 0) {
                        startIndex = firstInvalidOffsetIndexRef.current;
                        const previousIndex = startIndex - 1;
                        const previousKey = itemKeysRef.current[previousIndex] ?? previousIndex;
                        const previousHeight = itemHeightsRef.current[previousKey] ?? 0;

                        currentOffset = (itemOffsetsRef.current[previousIndex] ?? 0) + previousHeight;
                    }

                    for (let i = startIndex; i <= index; i += 1) {
                        itemOffsetsRef.current[i] = currentOffset;
                        const key = itemKeysRef.current[i] ?? i;
                        const height = itemHeightsRef.current[key] ?? 0;

                        currentOffset += height;
                    }

                    firstInvalidOffsetIndexRef.current = index + 1;
                }

                const top = itemOffsetsRef.current[index] ?? 0;
                const key = itemKeysRef.current[index] ?? index;
                const height = itemHeightsRef.current[key] ?? 0;

                return { height, top };
            },
            getViewportHeight: () => getViewportSize().height,
            remeasure: measureViewport,
            remeasureItem: (index: number) => {
                setItemMeasureKeys((previous) => {
                    return {
                        ...previous,
                        [index]: (previous[index] ?? 0) + 1,
                    };
                });
            },
        };
    }, [measureViewport, getContentHeight, getViewportSize, setItemMeasureKeys]);

    const childArray = toChildArray(children);

    // Track when first measurement pass is complete
    if (!hasMeasuredRef.current && contentHeight > 0) {
        hasMeasuredRef.current = true;
    }

    // Virtualization: compute visible range
    let firstRenderIndex = 0;
    let lastRenderIndex = childArray.length - 1;
    let aboveSpacerHeight = 0;
    let belowSpacerHeight = 0;
    // Only virtualize if all current items have been measured (height > 0).
    // New items added dynamically will have height 0 until measured.
    const allItemsMeasured =
        childArray.length > 0 &&
        childArray.every((_: ReactNode, index: number) => {
            const key = itemKeysRef.current[index] ?? index;

            return (itemHeightsRef.current[key] ?? 0) > 0;
        });
    const shouldVirtualize = virtualize && hasMeasuredRef.current && allItemsMeasured;

    if (shouldVirtualize) {
        // Ensure all offsets are computed
        const totalItems = itemKeysRef.current.length;

        if (firstInvalidOffsetIndexRef.current < totalItems) {
            let currentOffset = 0;
            let startIndex = 0;

            if (firstInvalidOffsetIndexRef.current > 0) {
                startIndex = firstInvalidOffsetIndexRef.current;
                const previousIndex = startIndex - 1;
                const previousKey = itemKeysRef.current[previousIndex] ?? previousIndex;
                const previousHeight = itemHeightsRef.current[previousKey] ?? 0;

                currentOffset = (itemOffsetsRef.current[previousIndex] ?? 0) + previousHeight;
            }

            for (let i = startIndex; i < totalItems; i += 1) {
                itemOffsetsRef.current[i] = currentOffset;
                const key = itemKeysRef.current[i] ?? i;

                currentOffset += itemHeightsRef.current[key] ?? 0;
            }

            firstInvalidOffsetIndexRef.current = totalItems;
        }

        // Find visible range
        const viewEnd = scrollOffset + viewportSize.height;

        firstRenderIndex = childArray.length;
        lastRenderIndex = -1;

        for (let i = 0; i < totalItems; i += 1) {
            const itemTop = itemOffsetsRef.current[i] ?? 0;
            const key = itemKeysRef.current[i] ?? i;
            const itemHeight = itemHeightsRef.current[key] ?? 0;
            const itemBottom = itemTop + itemHeight;

            if (itemBottom > scrollOffset && itemTop < viewEnd) {
                if (i < firstRenderIndex) {
                    firstRenderIndex = i;
                }

                lastRenderIndex = i;
            }
        }

        // Guard: if no items are visible, reset to safe empty range
        if (firstRenderIndex > lastRenderIndex) {
            firstRenderIndex = 0;
            lastRenderIndex = -1;
        }

        // Apply overscan
        firstRenderIndex = Math.max(0, firstRenderIndex - overscan);
        lastRenderIndex = Math.min(childArray.length - 1, Math.max(-1, lastRenderIndex) + overscan);

        // Compute spacer heights
        aboveSpacerHeight = itemOffsetsRef.current[firstRenderIndex] ?? 0;

        if (lastRenderIndex < childArray.length - 1) {
            const lastKey = itemKeysRef.current[lastRenderIndex] ?? lastRenderIndex;
            const lastItemBottom = (itemOffsetsRef.current[lastRenderIndex] ?? 0) + (itemHeightsRef.current[lastKey] ?? 0);

            belowSpacerHeight = contentHeight - lastItemBottom;
        }
    }

    return (
        <Box {...boxProps}>
            <Box ref={viewportRef} width="100%">
                <Box overflow={debug ? undefined : "hidden"} width="100%">
                    <Box flexDirection="column" marginTop={-scrollOffset} width="100%">
                        {shouldVirtualize && aboveSpacerHeight > 0 && <Box height={aboveSpacerHeight} />}
                        {childArray.map((child: ReactNode, index: number) => {
                            if (!child) {
                                return null;
                            }

                            if (shouldVirtualize && (index < firstRenderIndex || index > lastRenderIndex)) {
                                return null;
                            }

                            return (
                                <MeasurableItem
                                    index={index}
                                    key={isValidElement(child) ? (child.key ?? index) : index}
                                    measureKey={itemMeasureKeys[index]}
                                    onMeasure={handleItemMeasure}
                                    width={viewportSize.width}
                                >
                                    {child}
                                </MeasurableItem>
                            );
                        })}
                        {shouldVirtualize && belowSpacerHeight > 0 && <Box height={belowSpacerHeight} />}
                    </Box>
                </Box>
            </Box>
        </Box>
    );
};
