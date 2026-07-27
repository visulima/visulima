import type { Props as BoxProps } from "@visulima/tui/components/box";
import Box from "@visulima/tui/components/box";
import useScrollInput from "@visulima/tui/hooks/use-scroll-input";
import type React from "react";
import type { ReactNode, Ref } from "react";
import { useCallback, useImperativeHandle, useRef, useState } from "react";

import type { ControlledScrollViewRef } from "./controlled-scroll-view";
import { ControlledScrollView } from "./controlled-scroll-view";
import { ScrollBar } from "./scroll-bar";
import useStateRef from "./use-state-ref";

export interface ScrollViewProps extends BoxProps {
    children?: ReactNode;
    debug?: boolean;

    /**
     * Auto-scroll to bottom when content grows and user is at/near the bottom.
     * Pauses when user scrolls away from bottom; resumes when they return.
     * @default false
     */
    followOutput?: boolean;

    /**
     * Number of lines from bottom that still counts as "at bottom" for followOutput.
     * @default 3
     */
    followThreshold?: number;

    /**
     * Enable built-in keyboard navigation (arrows, page up/down, home/end, ctrl+u/d).
     * When enabled, the component becomes focusable.
     * @default false
     */
    keyboard?: boolean;
    onContentHeightChange?: (height: number, previousHeight: number) => void;
    onItemHeightChange?: (index: number, height: number, previousHeight: number) => void;

    /**
     * Fires when scrolled within `reachThreshold` lines of the end.
     * Only fires once per entry into the threshold zone.
     */
    onReachEnd?: () => void;

    /**
     * Fires when scrolled within `reachThreshold` lines of the start.
     * Only fires once per entry into the threshold zone.
     */
    onReachStart?: () => void;
    onScroll?: (scrollOffset: number) => void;
    onViewportSizeChange?: (size: { height: number; width: number }, previousSize: { height: number; width: number }) => void;

    /**
     * Number of extra items to render above/below the viewport when virtualized.
     * @default 3
     */
    overscan?: number;

    /**
     * Distance in lines from the edge to trigger onReachEnd/onReachStart.
     * @default 5
     */
    reachThreshold?: number;

    /**
     * Show a scrollbar track when content overflows the viewport.
     * @default false
     */
    scrollbar?: boolean;

    /**
     * Color of the scrollbar thumb and track.
     */
    scrollbarColor?: string;

    /**
     * Scrollbar visual style.
     * @default "line"
     */
    scrollbarStyle?: "arrow" | "block" | "bold" | "classic" | "dots" | "double" | "doubleSingle" | "line" | "round" | "single" | "singleDouble" | "thick";

    /**
     * Enable vim-style keybindings (j/k/g/G/u/d). Requires `keyboard` to be true.
     * @default false
     */
    vimBindings?: boolean;

    /**
     * Only render items visible in the viewport plus overscan. Requires items to be measured first.
     * @default false
     */
    virtualize?: boolean;
}

export interface ScrollViewRef {
    getBottomOffset: () => number;
    getContentHeight: () => number;
    getItemHeight: (index: number) => number;
    getItemPosition: (index: number) => { height: number; top: number } | null;
    getScrollOffset: () => number;
    getViewportHeight: () => number;
    remeasure: () => void;
    remeasureItem: (index: number) => void;
    scrollBy: (delta: number) => void;
    scrollTo: (offset: number) => void;
    scrollToBottom: () => void;
    scrollToTop: () => void;
}

export const ScrollView = ({
    children,
    debug = false,
    followOutput = false,
    followThreshold = 3,
    keyboard = false,
    onContentHeightChange,
    onItemHeightChange,
    onReachEnd,
    onReachStart,
    onScroll,
    onViewportSizeChange,
    overscan,
    reachThreshold = 5,
    ref,
    scrollbar = false,
    scrollbarColor,
    scrollbarStyle: scrollbarStyleProp = "line",
    vimBindings = false,
    virtualize,
    ...boxProps
}: ScrollViewProps & { ref?: Ref<ScrollViewRef> }): React.JSX.Element => {
    const [scrollOffset, setScrollOffset, getScrollOffset] = useStateRef(0);
    const innerRef = useRef<ControlledScrollViewRef>(null);
    const contentHeightRef = useRef(0);
    const viewportHeightRef = useRef(0);
    const [scrollbarContentHeight, setScrollbarContentHeight] = useState(0);
    const [scrollbarViewportHeight, setScrollbarViewportHeight] = useState(0);

    // Reach callback debounce guards
    const reachEndFiredRef = useRef(false);
    const reachStartFiredRef = useRef(false);

    const getBottomOffset = useCallback(() => Math.max(0, contentHeightRef.current - viewportHeightRef.current), []);

    const checkReachBounds = useCallback(
        (offset: number) => {
            const bottomOffset = getBottomOffset();

            if (onReachEnd && offset >= bottomOffset - reachThreshold && !reachEndFiredRef.current) {
                reachEndFiredRef.current = true;
                onReachEnd();
            } else if (offset < bottomOffset - reachThreshold) {
                reachEndFiredRef.current = false;
            }

            if (onReachStart && offset <= reachThreshold && !reachStartFiredRef.current) {
                reachStartFiredRef.current = true;
                onReachStart();
            } else if (offset > reachThreshold) {
                reachStartFiredRef.current = false;
            }
        },
        [onReachEnd, onReachStart, reachThreshold, getBottomOffset],
    );

    const applyScroll = useCallback(
        (newOffset: number) => {
            if (newOffset !== getScrollOffset()) {
                setScrollOffset(newOffset);
                onScroll?.(newOffset);
                checkReachBounds(newOffset);
            }
        },
        [getScrollOffset, setScrollOffset, onScroll, checkReachBounds],
    );

    const handleContentHeightChange = useCallback(
        (height: number, previousHeight: number) => {
            const wasAtBottom = getScrollOffset() >= getBottomOffset() - followThreshold;

            contentHeightRef.current = height;
            setScrollbarContentHeight(height);
            onContentHeightChange?.(height, previousHeight);

            if (followOutput && wasAtBottom && height > previousHeight) {
                const newBottom = Math.max(0, height - viewportHeightRef.current);

                applyScroll(newBottom);
            } else {
                // Clamp scroll offset to the new maximum (content - viewport)
                const maxOffset = Math.max(0, height - viewportHeightRef.current);

                if (getScrollOffset() > maxOffset) {
                    applyScroll(maxOffset);
                }
            }
        },
        [onContentHeightChange, followOutput, followThreshold, getScrollOffset, getBottomOffset, applyScroll],
    );

    const handleViewportSizeChange = useCallback(
        (size: { height: number; width: number }, previousSize: { height: number; width: number }) => {
            viewportHeightRef.current = size.height;
            setScrollbarViewportHeight(size.height);
            onViewportSizeChange?.(size, previousSize);
        },
        [onViewportSizeChange],
    );

    const scrollByImperative = useCallback(
        (delta: number) => {
            if (typeof delta !== "number" || Number.isNaN(delta)) {
                return;
            }

            // Clamp to [0, contentHeight - viewportHeight] so content can't scroll past the end
            const maxOffset = Math.max(0, contentHeightRef.current - viewportHeightRef.current);
            const newScrollTop = Math.max(0, Math.min(getScrollOffset() + delta, maxOffset));

            applyScroll(newScrollTop);
        },
        [getScrollOffset, applyScroll],
    );

    const scrollToImperative = useCallback(
        (offset: number) => {
            if (typeof offset !== "number" || Number.isNaN(offset)) {
                return;
            }

            // Clamp to [0, contentHeight - viewportHeight] so content can't scroll past the end
            const maxOffset = Math.max(0, contentHeightRef.current - viewportHeightRef.current);
            const newScrollTop = Math.max(0, Math.min(offset, maxOffset));

            applyScroll(newScrollTop);
        },
        [applyScroll],
    );

    const scrollToBottomImperative = useCallback(() => {
        const bottomOffset = getBottomOffset();

        applyScroll(bottomOffset);
    }, [getBottomOffset, applyScroll]);

    const scrollToTopImperative = useCallback(() => {
        applyScroll(0);
    }, [applyScroll]);

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
            getBottomOffset,
            getContentHeight: () => contentHeightRef.current,
            getItemHeight: (index: number) => innerRef.current?.getItemHeight(index) ?? 0,
            getItemPosition: (index: number) => innerRef.current?.getItemPosition(index) ?? null,
            getScrollOffset,
            getViewportHeight: () => viewportHeightRef.current,
            remeasure: () => innerRef.current?.remeasure(),
            remeasureItem: (index: number) => innerRef.current?.remeasureItem(index),
            scrollBy: scrollByImperative,
            scrollTo: scrollToImperative,
            scrollToBottom: scrollToBottomImperative,
            scrollToTop: scrollToTopImperative,
        };
    }, [getBottomOffset, getScrollOffset, scrollByImperative, scrollToImperative, scrollToBottomImperative, scrollToTopImperative]);

    const showScrollbar = scrollbar && scrollbarContentHeight > scrollbarViewportHeight && scrollbarViewportHeight > 0;

    if (showScrollbar) {
        // Wrap in a row to place scrollbar beside content
        return (
            <Box flexDirection="row" flexGrow={boxProps.flexGrow} flexShrink={boxProps.flexShrink} overflow="hidden">
                <ControlledScrollView
                    children={children}
                    debug={debug}
                    onContentHeightChange={handleContentHeightChange}
                    onItemHeightChange={onItemHeightChange}
                    onViewportSizeChange={handleViewportSizeChange}
                    overscan={overscan}
                    ref={innerRef}
                    scrollOffset={scrollOffset}
                    virtualize={virtualize}
                    {...boxProps}
                    flexGrow={1}
                />
                <ScrollBar
                    color={scrollbarColor}
                    contentHeight={scrollbarContentHeight}
                    placement="inset"
                    scrollOffset={scrollOffset}
                    style={scrollbarStyleProp}
                    viewportHeight={scrollbarViewportHeight}
                />
            </Box>
        );
    }

    return (
        <ControlledScrollView
            children={children}
            debug={debug}
            onContentHeightChange={handleContentHeightChange}
            onItemHeightChange={onItemHeightChange}
            onViewportSizeChange={handleViewportSizeChange}
            overscan={overscan}
            ref={innerRef}
            scrollOffset={scrollOffset}
            virtualize={virtualize}
            {...boxProps}
        />
    );
};
