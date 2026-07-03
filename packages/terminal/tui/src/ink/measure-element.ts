/* eslint-disable @typescript-eslint/no-unnecessary-condition, jsdoc/informative-docs, unicorn/prevent-abbreviations */

/**
 * Element measurement utilities.
 *
 * Enhanced with scroll-aware bounding box, inner dimensions, and scrollbar
 * position APIs ported from jacob314/ink fork (Google LLC, Apache-2.0).
 */
import Yoga from "yoga-layout";

import { getAbsolutePosition } from "./absolute-position";
import type { DOMElement, DOMNode } from "./dom";
import { getScrollLeft, getScrollTop } from "./scroll";
import squashTextNodes from "./squash-text-nodes";

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
 * Measure the dimensions of a particular `&lt;Box>` element.
 * Returns an object with `x`, `y`, `width` and `height` properties.
 */
const measureElement = (node: DOMElement): Output => {
    const position = getAbsolutePosition(node);

    return {
        height: Math.round(node.yogaNode?.getComputedHeight() ?? 0),
        width: Math.round(node.yogaNode?.getComputedWidth() ?? 0),
        x: Math.round(position?.x ?? 0),
        y: Math.round(position?.y ?? 0),
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

    return Math.round(width - borderLeft - borderRight);
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

    return Math.round(height - borderTop - borderBottom);
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

    return {
        height: Math.round(height),
        width: Math.round(width),
        x: Math.round(x),
        y: Math.round(y),
    };
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
    scrollbarDimension: number;
    scrollDimension: number;
    scrollPosition: number;
}): {
    endIndex: number;
    startIndex: number;
    thumbEndHalf: number;
    thumbStartHalf: number;
} => {
    const { axis, clientDimension, scrollbarDimension, scrollDimension, scrollPosition } = options;

    const scrollbarDimensionHalves = scrollbarDimension * 2;

    const thumbDimensionHalves = Math.max(axis === "vertical" ? 2 : 1, Math.round((clientDimension / scrollDimension) * scrollbarDimensionHalves));

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
    const { axis, clientDimension, hasOppositeScrollbar, height, marginBottom, marginRight, scrollDimension, scrollPosition, width, x, y } = options;

    if (scrollDimension <= clientDimension) {
        return undefined;
    }

    if (axis === "vertical") {
        const { endIndex, startIndex, thumbEndHalf, thumbStartHalf } = calculateScrollbarThumb({
            axis,
            clientDimension,
            scrollbarDimension: height,
            scrollDimension,
            scrollPosition,
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
        scrollbarDimension: scrollbarWidth,
        scrollDimension,
        scrollPosition,
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
export const getVerticalScrollbarBoundingBox = (node: DOMElement, offset?: { x: number; y: number }): ScrollbarBoundingBox | undefined => {
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
    const scrollbarHeight = yogaNode.getComputedHeight() - yogaNode.getComputedBorder(Yoga.EDGE_TOP) - yogaNode.getComputedBorder(Yoga.EDGE_BOTTOM);

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
export const getHorizontalScrollbarBoundingBox = (node: DOMElement, offset?: { x: number; y: number }): ScrollbarBoundingBox | undefined => {
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
        width: yogaNode.getComputedWidth() - yogaNode.getComputedBorder(Yoga.EDGE_LEFT) - yogaNode.getComputedBorder(Yoga.EDGE_RIGHT),
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

    return Math.round(top);
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

    return Math.round(left);
};

/**
 * A text fragment from the layout tree with its position and dimensions.
 * Used by `processLayout` for text extraction and selection.
 *
 * Ported from jacob314/ink fork (Google LLC, Apache-2.0).
 */
export type TextFragment = {
    height: number;
    node: DOMElement;
    text: string;
    visualX: number;
    visualY: number;
    width: number;
    x: number;
    y: number;
};

/**
 * Get the text content of a DOM node (text node value or squashed children).
 */
export const getText = (node: DOMNode): string => {
    if (node.nodeName === "#text") {
        return node.nodeValue;
    }

    if (node.nodeName === "ink-text" || node.nodeName === "ink-virtual-text") {
        return squashTextNodes(node);
    }

    return "";
};

/**
 * Walk the layout tree to collect all text fragments in document order,
 * with their positions adjusted for borders and flex layout.
 *
 * Ported from jacob314/ink fork (Google LLC, Apache-2.0).
 */
export const collectSortedFragments = (node: DOMNode): { fragments: TextFragment[]; removedHorizontal: number; removedVertical: number } => {
    const fragments: TextFragment[] = [];

    const collect = (
        currentNode: DOMNode,
        coords: { visualX: number; visualY: number; x: number; y: number },
        selectable: boolean,
    ): { h: number; hasContent: boolean; v: number } => {
        const { visualX, visualY, x, y } = coords;
        let v = 0;
        let h = 0;

        let currentSelectable = selectable;
        const { userSelect } = currentNode.style;

        if (userSelect === "none") {
            currentSelectable = false;
        } else if (userSelect === "text" || userSelect === "all") {
            currentSelectable = true;
        }

        if (currentNode.nodeName === "ink-text" || currentNode.nodeName === "ink-virtual-text") {
            if (currentSelectable) {
                const text = getText(currentNode);

                fragments.push({
                    height: Math.round(currentNode.yogaNode?.getComputedHeight() ?? 0),
                    node: currentNode,
                    text,
                    visualX: Math.round(visualX),
                    visualY: Math.round(visualY),
                    width: Math.round(currentNode.yogaNode?.getComputedWidth() ?? 0),
                    x: Math.round(x),
                    y: Math.round(y),
                });

                return { h: 0, hasContent: true, v: 0 };
            }

            return {
                h: currentNode.yogaNode?.getComputedWidth() ?? 0,
                hasContent: false,
                v: currentNode.yogaNode?.getComputedHeight() ?? 0,
            };
        }

        if (currentNode.nodeName === "ink-box" || currentNode.nodeName === "ink-root") {
            if (!currentNode.yogaNode || currentNode.yogaNode.getDisplay() === Yoga.DISPLAY_NONE) {
                return { h: 0, hasContent: false, v: 0 };
            }

            const borderTop = currentNode.yogaNode.getComputedBorder(Yoga.EDGE_TOP);
            const borderBottom = currentNode.yogaNode.getComputedBorder(Yoga.EDGE_BOTTOM);
            const borderLeft = currentNode.yogaNode.getComputedBorder(Yoga.EDGE_LEFT);
            const borderRight = currentNode.yogaNode.getComputedBorder(Yoga.EDGE_RIGHT);

            v += borderTop + borderBottom;
            h += borderLeft + borderRight;

            const flexDirection = currentNode.yogaNode.getFlexDirection();
            const isColumn = flexDirection === Yoga.FLEX_DIRECTION_COLUMN || flexDirection === Yoga.FLEX_DIRECTION_COLUMN_REVERSE;

            let siblingRemovedH = 0;
            let siblingRemovedV = 0;
            let childHasContent = false;

            for (const child of currentNode.childNodes) {
                if (child.yogaNode) {
                    const childX = x + child.yogaNode.getComputedLeft() - borderLeft - siblingRemovedH;
                    const childY = y + child.yogaNode.getComputedTop() - borderTop - siblingRemovedV;
                    const childVisualX = visualX + child.yogaNode.getComputedLeft();
                    const childVisualY = visualY + child.yogaNode.getComputedTop();

                    const res = collect(child, { visualX: childVisualX, visualY: childVisualY, x: childX, y: childY }, currentSelectable);

                    if (res.hasContent) {
                        childHasContent = true;
                    }

                    if (isColumn) {
                        siblingRemovedV += res.v;
                    } else {
                        siblingRemovedH += res.h;
                    }
                }
            }

            if (isColumn) {
                v += siblingRemovedV;
            } else {
                h += siblingRemovedH;
            }

            return { h, hasContent: childHasContent, v };
        }

        return { h: 0, hasContent: false, v: 0 };
    };

    const { h, v } = collect(node, { visualX: 0, visualY: 0, x: 0, y: 0 }, true);

    fragments.sort((a, b) => {
        if (a.y !== b.y) {
            return a.y - b.y;
        }

        return a.x - b.x;
    });

    return {
        fragments,
        removedHorizontal: Math.round(h),
        removedVertical: Math.round(v),
    };
};
