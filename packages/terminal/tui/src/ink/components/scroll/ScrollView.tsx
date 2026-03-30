/* eslint-disable unicorn/filename-case */
import type React from "react";
import type { ReactNode, Ref } from "react";
import { useCallback, useImperativeHandle, useRef } from "react";

import type { Props as BoxProps } from "../Box";
import type { ControlledScrollViewRef } from "./ControlledScrollView";
import { ControlledScrollView } from "./ControlledScrollView";
import useStateRef from "./use-state-ref";

export interface ScrollViewProps extends BoxProps {
    children?: ReactNode;
    debug?: boolean;
    onContentHeightChange?: (height: number, previousHeight: number) => void;
    onItemHeightChange?: (index: number, height: number, previousHeight: number) => void;
    onScroll?: (scrollOffset: number) => void;
    onViewportSizeChange?: (size: { height: number; width: number }, previousSize: { height: number; width: number }) => void;
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
    onContentHeightChange,
    onItemHeightChange,
    onScroll,
    onViewportSizeChange,
    ref,
    ...boxProps
}: ScrollViewProps & { ref?: Ref<ScrollViewRef> }): React.JSX.Element => {
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

    const getBottomOffset = useCallback(() => Math.max(0, contentHeightRef.current - (innerRef.current?.getViewportHeight() ?? 0)), []);

    useImperativeHandle(ref, () => {
        return {
            getBottomOffset,
            getContentHeight: () => contentHeightRef.current,
            getItemHeight: (index: number) => innerRef.current?.getItemHeight(index) ?? 0,
            getItemPosition: (index: number) => innerRef.current?.getItemPosition(index) ?? null,
            getScrollOffset,
            getViewportHeight: () => innerRef.current?.getViewportHeight() ?? 0,
            remeasure: () => innerRef.current?.remeasure(),
            remeasureItem: (index: number) => innerRef.current?.remeasureItem(index),
            scrollBy: (delta: number) => {
                if (typeof delta !== "number" || Number.isNaN(delta)) {
                    return;
                }

                const currentContentHeight = contentHeightRef.current;
                const newScrollTop = Math.max(0, Math.min(getScrollOffset() + delta, currentContentHeight));

                if (newScrollTop !== getScrollOffset()) {
                    setScrollOffset(newScrollTop);
                    onScroll?.(newScrollTop);
                }
            },
            scrollTo: (offset: number) => {
                if (typeof offset !== "number" || Number.isNaN(offset)) {
                    return;
                }

                const currentContentHeight = contentHeightRef.current;
                const newScrollTop = Math.max(0, Math.min(offset, currentContentHeight));

                if (newScrollTop !== getScrollOffset()) {
                    setScrollOffset(newScrollTop);
                    onScroll?.(newScrollTop);
                }
            },
            scrollToBottom: () => {
                const bottomOffset = getBottomOffset();

                if (getScrollOffset() !== bottomOffset) {
                    setScrollOffset(bottomOffset);
                    onScroll?.(bottomOffset);
                }
            },
            scrollToTop: () => {
                if (getScrollOffset() !== 0) {
                    setScrollOffset(0);
                    onScroll?.(0);
                }
            },
        };
    }, [onScroll, getBottomOffset, getScrollOffset, setScrollOffset]);

    return (
        <ControlledScrollView
            children={children}
            debug={debug}
            onContentHeightChange={handleContentHeightChange}
            onItemHeightChange={onItemHeightChange}
            onViewportSizeChange={onViewportSizeChange}
            ref={innerRef}
            scrollOffset={scrollOffset}
            // eslint-disable-next-line react/jsx-props-no-spreading
            {...boxProps}
        />
    );
};
