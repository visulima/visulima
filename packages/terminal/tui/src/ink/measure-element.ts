/**
 * Element measurement utilities.
 *
 * Enhanced with scroll-aware bounding box, inner dimensions, and scrollbar
 * position APIs ported from jacob314/ink fork (Google LLC, Apache-2.0).
 */
import Yoga from "yoga-layout";

import type { DOMElement } from "./dom";
import { getAbsolutePosition } from "./layout";
import { getScrollLeft, getScrollTop } from "./scroll";

type Output = {
    /**
     * Element height.
     */
    height: number;

    /**
     * Element width.
     */
    width: number;

    /**
     * Element X position relative to Ink output origin.
     */
    x: number;

    /**
     * Element Y position relative to Ink output origin.
     */
    y: number;
};

/**
 * Measure the dimensions of a particular `<Box>` element.
 * Returns an object with `x`, `y`, `width` and `height` properties.
 */
const measureElement = (node: DOMElement): Output => {
    const position = getAbsolutePosition(node);

    return {
        height: node.yogaNode?.getComputedHeight() ?? 0,
        width: node.yogaNode?.getComputedWidth() ?? 0,
        x: position?.x ?? 0,
        y: position?.y ?? 0,
    };
};

export default measureElement;

/**
 * Get an element's inner width (excluding borders).
 */
export const getInnerWidth = (node: DOMElement): number => {
    const { yogaNode } = node;

    if (!yogaNode) {
        return 0;
    }

    const width = yogaNode.getComputedWidth() ?? 0;
    const borderLeft = yogaNode.getComputedBorder(Yoga.EDGE_LEFT);
    const borderRight = yogaNode.getComputedBorder(Yoga.EDGE_RIGHT);

    return width - borderLeft - borderRight;
};

/**
 * Get an element's inner height (excluding borders).
 */
export const getInnerHeight = (node: DOMElement): number => {
    const { yogaNode } = node;

    if (!yogaNode) {
        return 0;
    }

    const height = yogaNode.getComputedHeight() ?? 0;
    const borderTop = yogaNode.getComputedBorder(Yoga.EDGE_TOP);
    const borderBottom = yogaNode.getComputedBorder(Yoga.EDGE_BOTTOM);

    return height - borderTop - borderBottom;
};

/**
 * Get an element's position and dimensions relative to the root,
 * accounting for scroll offsets of ancestor elements.
 */
export const getBoundingBox = (node: DOMElement): { height: number; width: number; x: number; y: number } => {
    const { yogaNode } = node;

    if (!yogaNode) {
        return { height: 0, width: 0, x: 0, y: 0 };
    }

    const width = yogaNode.getComputedWidth() ?? 0;
    const height = yogaNode.getComputedHeight() ?? 0;

    let x = yogaNode.getComputedLeft();
    let y = yogaNode.getComputedTop();

    let parent = node.parentNode;

    while (parent?.yogaNode) {
        x += parent.yogaNode.getComputedLeft();
        y += parent.yogaNode.getComputedTop();

        if (parent.nodeName === "ink-box") {
            const overflow = parent.style.overflow ?? "visible";
            const overflowX = parent.style.overflowX ?? overflow;
            const overflowY = parent.style.overflowY ?? overflow;

            if (overflowY === "scroll") {
                y -= getScrollTop(parent);
            }

            if (overflowX === "scroll") {
                x -= getScrollLeft(parent);
            }
        }

        parent = parent.parentNode;
    }

    return { height, width, x, y };
};

/**
 * Get how much scroll height was added by stableScrollback.
 */
export const getAddedScrollHeight = (node: DOMElement): number => {
    const scrollHeight = node.internal_scrollState?.scrollHeight ?? 0;
    const actualScrollHeight = node.internal_scrollState?.actualScrollHeight ?? 0;

    return Math.max(0, scrollHeight - actualScrollHeight);
};

export type ScrollbarBoundingBox = {
    height: number;
    thumb: {
        end: number;
        endHalf: number;
        height: number;
        start: number;
        startHalf: number;
        width: number;
        x: number;
        y: number;
    };
    width: number;
    x: number;
    y: number;
};

export const calculateScrollbarThumb = (options: {
    axis: "horizontal" | "vertical";
    clientDimension: number;
    scrollDimension: number;
    scrollPosition: number;
    scrollbarDimension: number;
}): {
    endIndex: number;
    startIndex: number;
    thumbEndHalf: number;
    thumbStartHalf: number;
} => {
    const { axis, clientDimension, scrollDimension, scrollPosition, scrollbarDimension } = options;

    const scrollbarDimensionHalves = scrollbarDimension * 2;

    const thumbDimensionHalves = Math.max(
        axis === "vertical" ? 2 : 1,
        Math.round((clientDimension / scrollDimension) * scrollbarDimensionHalves),
    );

    const maxScrollPosition = scrollDimension - clientDimension;
    const maxThumbPosition = scrollbarDimensionHalves - thumbDimensionHalves;

    const thumbPosition = maxScrollPosition > 0 ? Math.round((scrollPosition / maxScrollPosition) * maxThumbPosition) : 0;

    const thumbStartHalf = thumbPosition;
    const thumbEndHalf = thumbPosition + thumbDimensionHalves;

    const startIndex = Math.floor(thumbStartHalf / 2);
    const endIndex = Math.min(scrollbarDimension, Math.ceil(thumbEndHalf / 2));

    return { endIndex, startIndex, thumbEndHalf, thumbStartHalf };
};

export const calculateScrollbarLayout = (options: {
    axis: "horizontal" | "vertical";
    clientDimension: number;
    hasOppositeScrollbar: boolean;
    height: number;
    marginBottom: number;
    marginRight: number;
    scrollDimension: number;
    scrollPosition: number;
    width: number;
    x: number;
    y: number;
}): ScrollbarBoundingBox | undefined => {
    const { axis, clientDimension, hasOppositeScrollbar, height, marginBottom, marginRight, scrollDimension, scrollPosition, width, x, y } =
        options;

    if (scrollDimension <= clientDimension) {
        return undefined;
    }

    if (axis === "vertical") {
        const { endIndex, startIndex, thumbEndHalf, thumbStartHalf } = calculateScrollbarThumb({
            axis,
            clientDimension,
            scrollDimension,
            scrollPosition,
            scrollbarDimension: height,
        });

        const scrollbarX = x + width - 1 - marginRight;

        return {
            height,
            thumb: {
                end: endIndex,
                endHalf: thumbEndHalf,
                height: endIndex - startIndex,
                start: startIndex,
                startHalf: thumbStartHalf,
                width: 1,
                x: scrollbarX,
                y: y + startIndex,
            },
            width: 1,
            x: scrollbarX,
            y,
        };
    }

    const scrollbarWidth = width - (hasOppositeScrollbar ? 1 : 0);
    const { endIndex, startIndex, thumbEndHalf, thumbStartHalf } = calculateScrollbarThumb({
        axis,
        clientDimension,
        scrollDimension,
        scrollPosition,
        scrollbarDimension: scrollbarWidth,
    });

    const scrollbarY = y + height - 1 - marginBottom;

    return {
        height: 1,
        thumb: {
            end: endIndex,
            endHalf: thumbEndHalf,
            height: 1,
            start: startIndex,
            startHalf: thumbStartHalf,
            width: endIndex - startIndex,
            x: x + startIndex,
            y: scrollbarY,
        },
        width: scrollbarWidth,
        x,
        y: scrollbarY,
    };
};

/**
 * Get the bounding box of the vertical scrollbar.
 */
export const getVerticalScrollbarBoundingBox = (
    node: DOMElement,
    offset?: { x: number; y: number },
): ScrollbarBoundingBox | undefined => {
    const { yogaNode } = node;

    if (!yogaNode) {
        return undefined;
    }

    const overflow = node.style.overflow ?? "visible";
    const overflowY = node.style.overflowY ?? overflow;

    if (overflowY !== "scroll") {
        return undefined;
    }

    const clientHeight = node.internal_scrollState?.clientHeight ?? 0;
    const scrollHeight = node.internal_scrollState?.scrollHeight ?? 0;

    if (scrollHeight <= clientHeight) {
        return undefined;
    }

    const { x, y } = offset ?? getBoundingBox(node);
    const scrollbarHeight =
        yogaNode.getComputedHeight() - yogaNode.getComputedBorder(Yoga.EDGE_TOP) - yogaNode.getComputedBorder(Yoga.EDGE_BOTTOM);

    return calculateScrollbarLayout({
        axis: "vertical",
        clientDimension: clientHeight,
        hasOppositeScrollbar: false,
        height: scrollbarHeight,
        marginBottom: yogaNode.getComputedBorder(Yoga.EDGE_BOTTOM),
        marginRight: yogaNode.getComputedBorder(Yoga.EDGE_RIGHT),
        scrollDimension: scrollHeight,
        scrollPosition: node.internal_scrollState?.scrollTop ?? 0,
        width: yogaNode.getComputedWidth() - yogaNode.getComputedBorder(Yoga.EDGE_LEFT),
        x: x + yogaNode.getComputedBorder(Yoga.EDGE_LEFT),
        y: y + yogaNode.getComputedBorder(Yoga.EDGE_TOP),
    });
};

/**
 * Get the bounding box of the horizontal scrollbar.
 */
export const getHorizontalScrollbarBoundingBox = (
    node: DOMElement,
    offset?: { x: number; y: number },
): ScrollbarBoundingBox | undefined => {
    const { yogaNode } = node;

    if (!yogaNode) {
        return undefined;
    }

    const overflow = node.style.overflow ?? "visible";
    const overflowX = node.style.overflowX ?? overflow;

    if (overflowX !== "scroll") {
        return undefined;
    }

    const clientWidth = node.internal_scrollState?.clientWidth ?? 0;
    const scrollWidth = node.internal_scrollState?.scrollWidth ?? 0;

    if (scrollWidth <= clientWidth) {
        return undefined;
    }

    const { x, y } = offset ?? getBoundingBox(node);

    const overflowY = node.style.overflowY ?? overflow;
    const clientHeight = node.internal_scrollState?.clientHeight ?? 0;
    const scrollHeight = node.internal_scrollState?.scrollHeight ?? 0;
    const isVerticalScrollbarVisible = overflowY === "scroll" && scrollHeight > clientHeight;

    return calculateScrollbarLayout({
        axis: "horizontal",
        clientDimension: clientWidth,
        hasOppositeScrollbar: isVerticalScrollbarVisible,
        height: yogaNode.getComputedHeight() - yogaNode.getComputedBorder(Yoga.EDGE_TOP),
        marginBottom: yogaNode.getComputedBorder(Yoga.EDGE_BOTTOM),
        marginRight: yogaNode.getComputedBorder(Yoga.EDGE_RIGHT),
        scrollDimension: scrollWidth,
        scrollPosition: node.internal_scrollState?.scrollLeft ?? 0,
        width:
            yogaNode.getComputedWidth() -
            yogaNode.getComputedBorder(Yoga.EDGE_LEFT) -
            yogaNode.getComputedBorder(Yoga.EDGE_RIGHT),
        x: x + yogaNode.getComputedBorder(Yoga.EDGE_LEFT),
        y: y + yogaNode.getComputedBorder(Yoga.EDGE_TOP),
    });
};

/**
 * Get the top position of a node relative to a given ancestor.
 * Returns undefined if the ancestor is not in the node's parent chain.
 *
 * Ported from jacob314/ink fork (Google LLC, Apache-2.0).
 */
export const getRelativeTop = (node: DOMElement, ancestor?: DOMElement): number | undefined => {
    if (!node.yogaNode || node === ancestor) {
        return 0;
    }

    let top = node.yogaNode.getComputedTop();
    let parent = node.parentNode;

    while (parent && parent !== ancestor) {
        if (parent.yogaNode) {
            top += parent.yogaNode.getComputedTop();
        }

        parent = parent.parentNode;
    }

    if (ancestor !== undefined && parent !== ancestor) {
        return undefined;
    }

    return top;
};

/**
 * Get the left position of a node relative to a given ancestor.
 * Returns undefined if the ancestor is not in the node's parent chain.
 *
 * Ported from jacob314/ink fork (Google LLC, Apache-2.0).
 */
export const getRelativeLeft = (node: DOMElement, ancestor?: DOMElement): number | undefined => {
    if (!node.yogaNode || node === ancestor) {
        return 0;
    }

    let left = node.yogaNode.getComputedLeft();
    let parent = node.parentNode;

    while (parent && parent !== ancestor) {
        if (parent.yogaNode) {
            left += parent.yogaNode.getComputedLeft();
        }

        parent = parent.parentNode;
    }

    if (ancestor !== undefined && parent !== ancestor) {
        return undefined;
    }

    return left;
};
