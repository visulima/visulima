/**
 * Handle a DOM node that has a cached render result (a Region).
 *
 * When a node has `cachedRender` set, the entire subtree is skipped
 * during rendering and the cached region is composited directly into
 * the output. This is the core mechanism for render caching.
 *
 * Ported from jacob314/ink (Google LLC, Apache-2.0).
 *
 * @license Apache-2.0
 */

import type { DOMElement, DOMNode } from "./dom";
import type Output from "./output";
import type { Region } from "./region";

/**
 * Composite a cached render result into the output.
 *
 * Fast path: if no selection applies, the cached region is passed directly
 * to output.addRegionTree() with zero copying cost.
 *
 * Note: The current Output class doesn't support addRegionTree() yet
 * (Phase 6 in progress). This function is a placeholder that will be
 * activated when the Region-based Output is complete.
 */
export const handleCachedRenderNode = (
    node: DOMElement,
    _output: Output,
    options: {
        x: number;
        y: number;
        selectionMap?: Map<DOMNode, { end: number; start: number }>;
    },
): void => {
    const { x, y } = options;

    if (!node.cachedRender) {
        return;
    }

    // TODO: When Output supports addRegionTree(), use it here:
    // output.addRegionTree(node.cachedRender, x, y);
    //
    // For now, this is a no-op placeholder. The cached render check
    // in renderNodeToOutput will skip the subtree traversal, but the
    // cached content won't be composited until the Region-based Output
    // is complete.
    void x;
    void y;
};
