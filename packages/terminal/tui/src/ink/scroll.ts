/**
 * CSS-level scroll calculation utilities for elements with `overflow: 'scroll'`.
 *
 * Ported from jacob314/ink fork (Google LLC, Apache-2.0).
 */
import type { Node as YogaNode } from "yoga-layout";
import Yoga from "yoga-layout";

import type { DOMElement } from "./dom";

export type ScrollState = {
    actualScrollHeight: number;
    clientHeight: number;
    clientWidth: number;
    scrollHeight: number;
    scrollLeft: number;
    scrollTop: number;
    scrollWidth: number;
};

const calculateScrollDimensions = (node: DOMElement): { scrollHeight: number; scrollWidth: number } => {
    const { yogaNode } = node;

    if (!yogaNode) {
        return { scrollHeight: 0, scrollWidth: 0 };
    }

    const top = yogaNode.getComputedBorder(Yoga.EDGE_TOP);
    const left = yogaNode.getComputedBorder(Yoga.EDGE_LEFT);

    // maxBottom is initialized to top border because child getComputedTop() is
    // relative to the border edge. maxRight uses left padding because child
    // getComputedLeft() is relative to the padding edge in Yoga's scroll mode.
    let maxBottom = top;
    let maxRight = yogaNode.getComputedPadding(Yoga.EDGE_LEFT);

    for (let index = 0; index < yogaNode.getChildCount(); index++) {
        const child: YogaNode = yogaNode.getChild(index);
        const childBottom = child.getComputedTop() + child.getComputedHeight() + child.getComputedMargin(Yoga.EDGE_BOTTOM);

        if (childBottom > maxBottom) {
            maxBottom = childBottom;
        }

        const childRight = child.getComputedLeft() + child.getComputedWidth() + child.getComputedMargin(Yoga.EDGE_RIGHT);

        if (childRight > maxRight) {
            maxRight = childRight;
        }
    }

    const scrollHeight = maxBottom - top + yogaNode.getComputedPadding(Yoga.EDGE_BOTTOM);
    const scrollWidth = maxRight - left + yogaNode.getComputedPadding(Yoga.EDGE_RIGHT);

    return { scrollHeight: Math.round(scrollHeight), scrollWidth: Math.round(scrollWidth) };
};

export const getScrollHeight = (node: DOMElement): number => Math.round(node.internal_scrollState?.scrollHeight ?? 0);

export const getScrollWidth = (node: DOMElement): number => Math.round(node.internal_scrollState?.scrollWidth ?? 0);

export const calculateScroll = (node: DOMElement): void => {
    const { yogaNode } = node;

    if (!yogaNode) {
        return;
    }

    const { scrollHeight: actualScrollHeight, scrollWidth } = calculateScrollDimensions(node);
    let scrollHeight = actualScrollHeight;

    const clientHeight = Math.max(0, yogaNode.getComputedHeight() - yogaNode.getComputedBorder(Yoga.EDGE_TOP) - yogaNode.getComputedBorder(Yoga.EDGE_BOTTOM));

    if (node.style.stableScrollback && node.style.overflowToBackbuffer) {
        const actualMaxScrollTop = Math.max(0, actualScrollHeight - clientHeight);

        if (node.internal_isScrollbackDirty) {
            node.internal_maxScrollTop = actualMaxScrollTop;
            node.internal_isScrollbackDirty = false;
        } else {
            node.internal_maxScrollTop = Math.max(node.internal_maxScrollTop ?? 0, actualMaxScrollTop);
        }

        scrollHeight = Math.max(actualScrollHeight, (node.internal_maxScrollTop ?? 0) + clientHeight);
    }

    const scrollTop = Math.max(0, Math.min(node.style.scrollTop ?? 0, scrollHeight - clientHeight));

    const clientWidth = Math.max(0, yogaNode.getComputedWidth() - yogaNode.getComputedBorder(Yoga.EDGE_LEFT) - yogaNode.getComputedBorder(Yoga.EDGE_RIGHT));

    const scrollLeft = Math.max(0, Math.min(node.style.scrollLeft ?? 0, scrollWidth - clientWidth));

    node.internal_scrollState = {
        actualScrollHeight,
        clientHeight,
        clientWidth,
        scrollHeight,
        scrollLeft,
        scrollTop,
        scrollWidth,
    };
};

/**
 * Get the effective scroll top position from the pre-computed scroll state.
 * Falls back to computing from style if scroll state hasn't been calculated yet.
 */
export const getScrollTop = (node: DOMElement): number => Math.round(node.internal_scrollState?.scrollTop ?? 0);

/**
 * Get the effective scroll left position from the pre-computed scroll state.
 * Falls back to computing from style if scroll state hasn't been calculated yet.
 */
export const getScrollLeft = (node: DOMElement): number => Math.round(node.internal_scrollState?.scrollLeft ?? 0);
