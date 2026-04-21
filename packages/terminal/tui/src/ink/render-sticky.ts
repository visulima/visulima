/* eslint-disable @typescript-eslint/no-unnecessary-condition, jsdoc/check-param-names */

/**
 * Sticky header rendering for elements with `overflow: 'scroll'`.
 *
 * Sticky headers remain pinned at the top or bottom of a scroll viewport
 * while the rest of the content scrolls. A header is only sticky when its
 * parent section is visible in the viewport.
 *
 * Ported from jacob314/ink fork (Google LLC, Apache-2.0).
 */
import Yoga from "yoga-layout";

import type { DOMElement } from "./dom";
import { getRelativeLeft, getRelativeTop } from "./measure-element";
import type Output from "./output";
import type { OutputTransformer } from "./render-node-to-output";
import renderNodeToOutput from "./render-node-to-output";
import { getScrollTop } from "./scroll";

export type StickyNodeInfo = {
    node: DOMElement;
    type: "top" | "bottom";
};

/**
 * Factory function type for creating Output instances.
 * Passed as a parameter to avoid circular dependency between render-sticky and output.
 */
export type OutputFactory = (options: { height: number; width: number }) => Output;

/**
 * Walk the DOM tree under `node` to find all sticky descendants.
 * Stops at scroll boundaries (nested scrollable containers own their sticky nodes).
 */
export const getStickyDescendants = (node: DOMElement, result: StickyNodeInfo[] = []): StickyNodeInfo[] => {
    for (const child of node.childNodes) {
        if (child.nodeName === "#text") {
            continue;
        }

        const domChild = child;

        // Skip alternate sticky versions (they're rendered only when stuck)
        if (domChild.internal_stickyAlternate) {
            continue;
        }

        if (domChild.internal_sticky) {
            result.push({
                node: domChild,
                type: domChild.internal_sticky === "bottom" ? "bottom" : "top",
            });
        } else {
            // Don't recurse into nested scroll containers — they own their own sticky nodes
            const overflow = domChild.style.overflow ?? "visible";
            const overflowX = domChild.style.overflowX ?? overflow;
            const overflowY = domChild.style.overflowY ?? overflow;
            const isScrollable = overflowX === "scroll" || overflowY === "scroll";

            if (!isScrollable && domChild.childNodes) {
                getStickyDescendants(domChild, result);
            }
        }
    }

    return result;
};

/**
 * Identify which sticky nodes are currently active (should be pinned)
 * based on the scroll position and viewport.
 */
export const identifyActiveStickyNodes = (
    stickyNodes: StickyNodeInfo[],
    node: DOMElement,
    scrollTop: number,
    viewportBottom: number,
): {
    nextStickyNodeInfo?: StickyNodeInfo;
    stickyNode: DOMElement;
    type: "top" | "bottom";
}[] => {
    let activeTopStickyNode: StickyNodeInfo | undefined;
    let activeTopStickyNodeIndex = -1;
    let activeBottomStickyNode: StickyNodeInfo | undefined;
    let activeBottomStickyNodeIndex = -1;

    for (const [index, stickyNodeInfo] of stickyNodes.entries()) {
        const { node: stickyChild, type: stickyType } = stickyNodeInfo;

        if (!stickyChild.yogaNode) {
            continue;
        }

        const stickyNodeTop = getRelativeTop(stickyChild, node) ?? 0;
        const stickyNodeHeight = Math.round(stickyChild.yogaNode.getComputedHeight());
        const stickyNodeBottom = stickyNodeTop + stickyNodeHeight;

        const parent = stickyChild.parentNode;
        let parentTop = 0;
        let parentHeight = Number.MAX_SAFE_INTEGER;

        if (parent?.yogaNode) {
            parentTop = getRelativeTop(parent, node) ?? 0;
            parentHeight = Math.round(parent.yogaNode.getComputedHeight());
        }

        // A top-sticky node is active when it has scrolled above the viewport
        // but its parent section is still visible
        if (stickyType === "top" && stickyNodeTop < scrollTop && parentTop + parentHeight > scrollTop) {
            activeTopStickyNode = stickyNodeInfo;
            activeTopStickyNodeIndex = index;
        }

        // A bottom-sticky node is active when it has scrolled below the viewport
        // but its parent section is still visible
        if (stickyType === "bottom" && Math.floor(stickyNodeBottom) > Math.floor(viewportBottom) && parentTop < viewportBottom) {
            activeBottomStickyNode = stickyNodeInfo;
            activeBottomStickyNodeIndex = index;
        }
    }

    const result: {
        nextStickyNodeInfo?: StickyNodeInfo;
        stickyNode: DOMElement;
        type: "top" | "bottom";
    }[] = [];

    if (activeTopStickyNode) {
        // Find the next non-bottom sticky node (for push-up calculation)
        let nextStickyNodeInfo: StickyNodeInfo | undefined;

        for (let index = activeTopStickyNodeIndex + 1; index < stickyNodes.length; index++) {
            const info = stickyNodes[index]!;

            if (info.type !== "bottom") {
                nextStickyNodeInfo = info;
                break;
            }
        }

        result.push({
            nextStickyNodeInfo,
            stickyNode: activeTopStickyNode.node,
            type: "top",
        });
    }

    if (activeBottomStickyNode) {
        let nextStickyNodeInfo: StickyNodeInfo | undefined;

        for (let index = activeBottomStickyNodeIndex - 1; index >= 0; index--) {
            const info = stickyNodes[index]!;

            if (info.type === "bottom") {
                nextStickyNodeInfo = info;
                break;
            }
        }

        result.push({
            nextStickyNodeInfo,
            stickyNode: activeBottomStickyNode.node,
            type: "bottom",
        });
    }

    return result;
};

/**
 * Render active sticky headers and write them to the output at their stuck positions.
 * Called during the rendering of a scrollable container.
 * @param createOutput Factory function for creating Output instances (avoids circular imports).
 */
export const renderActiveStickyNodes = (
    activeStickyNodes: {
        nextStickyNodeInfo?: StickyNodeInfo;
        stickyNode: DOMElement;
        type: "top" | "bottom";
    }[],
    node: DOMElement,
    output: Output,
    createOutput: OutputFactory,
    options: {
        newTransformers: OutputTransformer[];
        skipStaticElements: boolean;
        x: number;
        y: number;
    },
): void => {
    const { newTransformers, skipStaticElements, x, y } = options;
    const { yogaNode } = node;

    if (!yogaNode) {
        return;
    }

    const currentBorderTop = yogaNode.getComputedBorder(Yoga.EDGE_TOP);
    const currentBorderLeft = yogaNode.getComputedBorder(Yoga.EDGE_LEFT);
    const currentScrollTop = getScrollTop(node);
    const currentClientHeight = node.internal_scrollState?.clientHeight ?? 0;

    for (const { nextStickyNodeInfo, stickyNode, type } of activeStickyNodes) {
        if (!stickyNode.yogaNode) {
            continue;
        }

        const stickyNodeTop = getRelativeTop(stickyNode, node) ?? 0;
        const stickyNodeHeight = Math.round(stickyNode.yogaNode.getComputedHeight());
        const stickyOffsetX = x + (getRelativeLeft(stickyNode, node) ?? 0);

        const parent = stickyNode.parentNode;
        let parentTop = 0;
        let parentHeight = Number.MAX_SAFE_INTEGER;

        if (parent?.yogaNode) {
            parentTop = getRelativeTop(parent, node) ?? 0;
            parentHeight = Math.round(parent.yogaNode.getComputedHeight());
        }

        let finalStickyY: number;

        if (type === "top") {
            const parentBorderBottom = parent?.yogaNode?.getComputedBorder(Yoga.EDGE_BOTTOM) ?? 0;
            const parentBottom = parentTop + parentHeight - parentBorderBottom;
            let maxStickyTop = y - currentScrollTop + parentBottom - stickyNodeHeight;
            const naturalStickyY = y - currentScrollTop + stickyNodeTop;
            const stuckStickyY = y + currentBorderTop;

            // If the next sticky node would overlap, push this one up
            if (nextStickyNodeInfo?.node?.yogaNode) {
                const nextNodeTop = getRelativeTop(nextStickyNodeInfo.node, node) ?? 0;
                const nextNodeTopInViewport = y - currentScrollTop + nextNodeTop;
                const nextNodePushTop = nextNodeTopInViewport - stickyNodeHeight;

                if (nextNodePushTop < maxStickyTop) {
                    maxStickyTop = nextNodePushTop;
                }
            }

            finalStickyY = Math.min(Math.max(stuckStickyY, naturalStickyY), maxStickyTop);
        } else {
            const parentBorderTop = parent?.yogaNode?.getComputedBorder(Yoga.EDGE_TOP) ?? 0;
            let minStickyTop = y - currentScrollTop + parentTop + parentBorderTop;
            const naturalStickyY = y - currentScrollTop + stickyNodeTop;
            const stuckStickyY = y + currentBorderTop + currentClientHeight - stickyNodeHeight;

            if (nextStickyNodeInfo?.node?.yogaNode) {
                const nextNodeHeight = Math.round(nextStickyNodeInfo.node.yogaNode.getComputedHeight());
                const nextNodeTop = getRelativeTop(nextStickyNodeInfo.node, node) ?? 0;
                const nextNodeBottomInViewport = y - currentScrollTop + nextNodeTop + nextNodeHeight;

                if (nextNodeBottomInViewport > minStickyTop) {
                    minStickyTop = nextNodeBottomInViewport;
                }
            }

            finalStickyY = Math.max(Math.min(stuckStickyY, naturalStickyY), minStickyTop);
        }

        // Render the sticky node into a temporary output to capture its content
        const stickyOutput = createOutput({
            height: stickyNodeHeight,
            width: Math.round(stickyNode.yogaNode.getComputedWidth()),
        });

        renderNodeToOutput(stickyNode, stickyOutput, {
            offsetX: -Math.round(stickyNode.yogaNode.getComputedLeft()),
            offsetY: -Math.round(stickyNode.yogaNode.getComputedTop()),
            skipStaticElements,
            transformers: newTransformers,
        });

        // Write the rendered sticky content at the stuck position
        const renderedResult = stickyOutput.get();
        const renderedLines = renderedResult.output.split("\n");

        for (const [lineIndex, line] of renderedLines.entries()) {
            if (line && line.length > 0) {
                output.write(stickyOffsetX - (x + currentBorderLeft), finalStickyY - (y + currentBorderTop) + lineIndex, line, {
                    transformers: [],
                });
            }
        }
    }
};
