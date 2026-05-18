/**
 * Terminal-scrollback overflow ("backbuffer") slice composition.
 *
 * When a scrollable box has `overflowToBackbuffer` enabled and runs in inline
 * (non-alternate-screen) mode, lines that scroll off the TOP of the box are
 * flushed into the terminal emulator's real scrollback history instead of
 * being clipped and discarded.
 *
 * Our renderer rebuilds the full grid from the React tree every frame, so the
 * scrolled-off content is still available — it is only dropped by the clip at
 * render time. This module re-renders just the newly-scrolled-off slice into a
 * standalone, height-bounded Output (the same isolated-render pattern as
 * `renderToStatic`) and serializes it to a string. ink.tsx then emits that
 * string through the existing static-output channel so it lands permanently
 * above the in-place live region.
 */
import Yoga from "yoga-layout";

import type { DOMElement } from "./dom";
import Output from "./output";
import renderNodeToOutput from "./render-node-to-output";

/**
 * Render scroll-content rows `[start, start + count)` of a scrollable node to a
 * terminal string, with content line `start` pinned to output row 0.
 *
 * The live path renders scroll children at `offsetY = boxY - scrollTop` and
 * clips them to a region starting at `boxY + borderTop` (so the box's border
 * and padding inset the visible content — `render-node-to-output.ts:380-403`).
 * Re-deriving for an isolated, clip-free Output where we want content line
 * `start` at row 0: the child's own `getComputedTop()` cancels out and the
 * surviving correction is the box's top inset (`borderTop + paddingTop`). The
 * border/padding are NOT re-emitted — only the scrolled-off content itself
 * lands in scrollback. Horizontal scroll position is preserved, and the
 * left/right border+padding columns are dropped the same way.
 *
 * Returns `""` when there is nothing to emit (no new lines scrolled off, or the
 * node is not laid out / has no inner width yet).
 */
export const composeBackbufferSlice = (node: DOMElement, start: number, count: number): string => {
    if (count <= 0 || !node.yogaNode) {
        return "";
    }

    const { yogaNode } = node;

    const borderLeft = yogaNode.getComputedBorder(Yoga.EDGE_LEFT);
    const borderRight = yogaNode.getComputedBorder(Yoga.EDGE_RIGHT);
    const borderTop = yogaNode.getComputedBorder(Yoga.EDGE_TOP);
    const paddingLeft = yogaNode.getComputedPadding(Yoga.EDGE_LEFT);
    const paddingRight = yogaNode.getComputedPadding(Yoga.EDGE_RIGHT);
    const paddingTop = yogaNode.getComputedPadding(Yoga.EDGE_TOP);

    const width = Math.round(yogaNode.getComputedWidth() - borderLeft - borderRight - paddingLeft - paddingRight);

    if (width <= 0) {
        return "";
    }

    const slice = new Output({
        height: count,
        width,
    });

    const scrollLeft = node.internal_scrollState?.scrollLeft ?? 0;

    // Content line `start` → output row 0 (drop the box's top inset); the
    // current horizontal scroll position is preserved and the left
    // border/padding columns are dropped. No clip is pushed, so the
    // grid-bounds check is the only filter: rows < 0 or >= count are dropped,
    // yielding precisely the slice.
    const offsetX = -scrollLeft - borderLeft - paddingLeft;
    const offsetY = -start - borderTop - paddingTop;

    for (const childNode of node.childNodes) {
        renderNodeToOutput(childNode as DOMElement, slice, {
            absoluteOffsetX: offsetX,
            absoluteOffsetY: offsetY,
            offsetX,
            offsetY,
            skipStaticElements: false,
        });
    }

    return slice.get().output;
};

export default composeBackbufferSlice;
