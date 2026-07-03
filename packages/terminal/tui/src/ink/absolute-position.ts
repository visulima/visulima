import Yoga from "yoga-layout";

import type { DOMElement } from "./dom";

/**
 * Absolute (viewport-relative) position helpers.
 *
 * Extracted from `layout.ts` so that `measure-element.ts` and
 * `render-node-to-output.ts` can compute absolute positions without importing
 * `layout.ts` (which in turn imports `collectSortedFragments` from
 * `measure-element.ts`) — that pairing formed an import cycle. These helpers
 * depend only on Yoga + the DOM types, so they live in their own leaf module.
 *
 * Ported from jacob314/ink fork (Google LLC, Apache-2.0).
 */
type Position = {
    x: number;
    y: number;
};

const getAbsoluteBorderPosition = (node: DOMElement): Position | undefined => {
    let currentNode: DOMElement | undefined = node;
    let x = 0;
    let y = 0;

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    while (currentNode?.parentNode) {
        if (!currentNode.yogaNode) {
            return undefined;
        }

        x += currentNode.yogaNode.getComputedLeft();
        y += currentNode.yogaNode.getComputedTop();
        currentNode = currentNode.parentNode;
    }

    return { x, y };
};

const getAbsolutePosition = (node: DOMElement): Position | undefined => getAbsoluteBorderPosition(node);

const getAbsoluteContentPosition = (node: DOMElement): Position | undefined => {
    const borderPosition = getAbsoluteBorderPosition(node);

    if (!borderPosition || !node.yogaNode) {
        return undefined;
    }

    return {
        x: borderPosition.x + node.yogaNode.getComputedBorder(Yoga.EDGE_LEFT) + node.yogaNode.getComputedPadding(Yoga.EDGE_LEFT),
        y: borderPosition.y + node.yogaNode.getComputedBorder(Yoga.EDGE_TOP) + node.yogaNode.getComputedPadding(Yoga.EDGE_TOP),
    };
};

export type { Position };
export { getAbsoluteContentPosition, getAbsolutePosition };
