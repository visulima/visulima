/* eslint-disable react-you-might-not-need-an-effect/no-derived-state, react-you-might-not-need-an-effect/no-event-handler */
import type React from "react";
import type { Ref } from "react";
import { useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";

import useScrollInput from "../../hooks/use-scroll-input";
import type { ControlledScrollViewRef } from "./controlled-scroll-view";
import { ControlledScrollView } from "./controlled-scroll-view";
import type { ScrollViewProps, ScrollViewRef } from "./scroll-view";

export type ScrollAlignment = "auto" | "bottom" | "center" | "top";

export interface ScrollListProps extends ScrollViewProps {
    readonly scrollAlignment?: ScrollAlignment;
    readonly selectedIndex?: number;
}

export type ScrollListRef = ScrollViewRef;

export const ScrollList = (props: ScrollListProps & { ref?: Ref<ScrollListRef> }): React.JSX.Element => {
    const {
        children,
        keyboard = false,
        onContentHeightChange,
        onItemHeightChange,
        onScroll,
        onViewportSizeChange,
        overscan,
        ref,
        scrollAlignment = "auto",
        selectedIndex,
        vimBindings = false,
        virtualize,
        ...boxProps
    } = props;

    const scrollViewRef = useRef<ControlledScrollViewRef>(null);

    const [scrollOffset, setScrollOffset] = useState(0);
    const scrollOffsetRef = useRef(0);

    useEffect(() => {
        scrollOffsetRef.current = scrollOffset;
    }, [scrollOffset]);

    const updateScroll = useCallback(
        (newOffset: number) => {
            if (newOffset !== scrollOffsetRef.current) {
                setScrollOffset(newOffset);
                onScroll?.(newOffset);
            }
        },
        [onScroll],
    );

    const selectedIndexRef = useRef(selectedIndex);

    selectedIndexRef.current = selectedIndex;

    const getSelectionVisibleBounds = useCallback((): { max: number; min: number } | null => {
        const currentSelectedIndex = selectedIndexRef.current;

        if (currentSelectedIndex === undefined || currentSelectedIndex < 0) {
            return null;
        }

        const position = scrollViewRef.current?.getItemPosition(currentSelectedIndex);

        if (!position) {
            return null;
        }

        const viewportHeight = scrollViewRef.current?.getViewportHeight() ?? 0;
        const contentHeight = scrollViewRef.current?.getContentHeight() ?? 0;
        let minOffset = position.top + position.height - viewportHeight;
        let maxOffset = position.top;

        if (minOffset > maxOffset) {
            [minOffset, maxOffset] = [maxOffset, minOffset];
        }

        const globalMaxScroll = Math.max(0, contentHeight - viewportHeight);

        return {
            max: Math.min(globalMaxScroll, maxOffset),
            min: Math.max(0, minOffset),
        };
    }, []);

    const clampToSelectionBounds = useCallback(
        (targetOffset: number): number => {
            const contentHeight = scrollViewRef.current?.getContentHeight() ?? 0;
            const viewportHeight = scrollViewRef.current?.getViewportHeight() ?? 0;
            const globalMaxScroll = Math.max(0, contentHeight - viewportHeight);

            let clampedOffset = Math.max(0, Math.min(targetOffset, globalMaxScroll));

            const selectionBounds = getSelectionVisibleBounds();

            if (selectionBounds) {
                clampedOffset = Math.max(selectionBounds.min, Math.min(clampedOffset, selectionBounds.max));
            }

            return clampedOffset;
        },
        [getSelectionVisibleBounds],
    );

    const getConstrainedScrollOffset = useCallback((index: number, currentOffset: number, mode: ScrollAlignment, viewportHeightOverride?: number): number => {
        const position = scrollViewRef.current?.getItemPosition(index);

        if (!position) {
            return currentOffset;
        }

        const viewportHeight = viewportHeightOverride ?? scrollViewRef.current?.getViewportHeight() ?? 0;
        const contentHeight = scrollViewRef.current?.getContentHeight() ?? 0;
        let target = currentOffset;

        switch (mode) {
            case "bottom": {
                target = position.top + position.height - viewportHeight;

                break;
            }
            case "center": {
                target = position.top + position.height / 2 - viewportHeight / 2;

                break;
            }
            case "top": {
                target = position.top;

                break;
            }
            default: {
                const itemBottom = position.top + position.height;
                const isFillingViewport = position.top <= currentOffset && itemBottom >= currentOffset + viewportHeight;

                if (isFillingViewport) {
                    target = currentOffset;
                } else if (position.top < currentOffset) {
                    target = position.top;
                } else if (itemBottom > currentOffset + viewportHeight) {
                    target = itemBottom - viewportHeight;
                }
            }
        }

        const maxScroll = Math.max(0, contentHeight - viewportHeight);

        return Math.max(0, Math.min(target, maxScroll));
    }, []);

    let renderScrollOffset = scrollOffset;

    if (selectedIndex !== undefined && selectedIndex >= 0) {
        renderScrollOffset = getConstrainedScrollOffset(selectedIndex, scrollOffset, scrollAlignment);
    }

    useEffect(() => {
        if (renderScrollOffset !== scrollOffset) {
            updateScroll(renderScrollOffset);
        }
    }, [renderScrollOffset, scrollOffset, updateScroll]);

    const handleViewportSizeChange = useCallback(
        (size: { height: number; width: number }, previousSize: { height: number; width: number }) => {
            if (selectedIndexRef.current !== undefined && selectedIndexRef.current >= 0) {
                const newOffset = getConstrainedScrollOffset(selectedIndexRef.current, scrollOffset, scrollAlignment, size.height);

                updateScroll(newOffset);
            }

            onViewportSizeChange?.(size, previousSize);
        },
        [onViewportSizeChange, getConstrainedScrollOffset, scrollOffset, scrollAlignment, updateScroll],
    );

    const handleItemHeightChange = useCallback(
        (index: number, height: number, previousHeight: number) => {
            const currentSelectedIndex = selectedIndexRef.current;

            if (currentSelectedIndex !== undefined && currentSelectedIndex >= 0) {
                if (index < currentSelectedIndex) {
                    const newOffset = clampToSelectionBounds(scrollOffset + (height - previousHeight));

                    updateScroll(newOffset);
                } else if (index === currentSelectedIndex) {
                    const newOffset = getConstrainedScrollOffset(index, scrollOffset, scrollAlignment);

                    updateScroll(newOffset);
                }
            }

            onItemHeightChange?.(index, height, previousHeight);
        },
        [onItemHeightChange, getConstrainedScrollOffset, scrollAlignment, scrollOffset, clampToSelectionBounds, updateScroll],
    );

    const handleContentHeightChange = useCallback(
        (height: number, previousHeight: number) => {
            if (selectedIndexRef.current !== undefined && selectedIndexRef.current >= 0) {
                const newOffset = getConstrainedScrollOffset(selectedIndexRef.current, scrollOffset, scrollAlignment);

                updateScroll(newOffset);
            }

            onContentHeightChange?.(height, previousHeight);
        },
        [onContentHeightChange, getConstrainedScrollOffset, scrollOffset, scrollAlignment, updateScroll],
    );

    const viewportHeightRef = useRef(0);

    const scrollByImperative = useCallback(
        (delta: number) => {
            const currentOffset = scrollOffsetRef.current;
            const clampedY = clampToSelectionBounds(currentOffset + delta);

            updateScroll(clampedY);
        },
        [clampToSelectionBounds, updateScroll],
    );

    const scrollToBottomImperative = useCallback(() => {
        const contentHeight = scrollViewRef.current?.getContentHeight() ?? 0;
        const viewportHeight = scrollViewRef.current?.getViewportHeight() ?? 0;
        const maxScroll = Math.max(0, contentHeight - viewportHeight);
        const clampedY = clampToSelectionBounds(maxScroll);

        updateScroll(clampedY);
    }, [clampToSelectionBounds, updateScroll]);

    const scrollToTopImperative = useCallback(() => {
        const clampedY = clampToSelectionBounds(0);

        updateScroll(clampedY);
    }, [clampToSelectionBounds, updateScroll]);

    const getViewportHeight = useCallback(() => viewportHeightRef.current, []);

    useScrollInput({
        getViewportHeight,
        isActive: keyboard,
        scrollBy: scrollByImperative,
        scrollToBottom: scrollToBottomImperative,
        scrollToTop: scrollToTopImperative,
        vimBindings,
    });

    useImperativeHandle(ref, () => {
        return {
            getBottomOffset: () => scrollViewRef.current?.getBottomOffset() ?? 0,
            getContentHeight: () => scrollViewRef.current?.getContentHeight() ?? 0,
            getItemHeight: (index: number) => scrollViewRef.current?.getItemHeight(index) ?? 0,
            getItemPosition: (index: number) => scrollViewRef.current?.getItemPosition(index) ?? null,
            getScrollOffset: () => scrollOffsetRef.current,
            getViewportHeight: () => scrollViewRef.current?.getViewportHeight() ?? 0,
            remeasure: () => scrollViewRef.current?.remeasure(),
            remeasureItem: (index: number) => scrollViewRef.current?.remeasureItem(index),
            scrollBy: scrollByImperative,
            scrollTo: (y: number) => {
                const clampedY = clampToSelectionBounds(y);

                updateScroll(clampedY);
            },
            scrollToBottom: scrollToBottomImperative,
            scrollToTop: scrollToTopImperative,
        };
    }, [clampToSelectionBounds, updateScroll, scrollByImperative, scrollToBottomImperative, scrollToTopImperative]);

    const handleViewportSizeChangeWithTracking = useCallback(
        (size: { height: number; width: number }, previousSize: { height: number; width: number }) => {
            viewportHeightRef.current = size.height;
            handleViewportSizeChange(size, previousSize);
        },
        [handleViewportSizeChange],
    );

    return (
        <ControlledScrollView
            onContentHeightChange={handleContentHeightChange}
            onItemHeightChange={handleItemHeightChange}
            onViewportSizeChange={handleViewportSizeChangeWithTracking}
            overscan={overscan}
            ref={scrollViewRef}
            scrollOffset={renderScrollOffset}
            virtualize={virtualize}
            {...boxProps}
        >
            {children}
        </ControlledScrollView>
    );
};
