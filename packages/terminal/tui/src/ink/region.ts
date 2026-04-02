/**
 * Region-based hierarchical output model.
 *
 * A Region represents a rectangular area of terminal output with its own
 * line buffer, scroll state, and child regions. Regions form a tree that
 * is composited into the final screen buffer via flattenRegion().
 *
 * This enables:
 * - Incremental rendering (only changed regions are re-composited)
 * - Render caching (cachedRender stores a Region for unchanged subtrees)
 * - Dirty tracking (terminal buffer only writes changed lines)
 *
 * Ported from jacob314/ink (Google LLC, Apache-2.0).
 */

import type { StyledLine } from "./styled-line";

export type Region = {
    /** Unique identifier for this region (used for dirty tracking) */
    id: number | string;

    /** Position relative to parent region */
    x: number;
    y: number;

    /** Dimensions */
    width: number;
    height: number;

    /** Content buffer — StyledLine per row, relative to (0,0) of this region */
    readonly lines: readonly StyledLine[];

    /** Trimmed output (trailing spaces removed) for final rendering */
    readonly styledOutput: readonly StyledLine[];

    /** Whether this region supports scrolling */
    isScrollable: boolean;
    isVerticallyScrollable?: boolean;
    isHorizontallyScrollable?: boolean;

    /** Scroll state */
    scrollTop?: number;
    scrollLeft?: number;
    scrollHeight?: number;
    scrollWidth?: number;
    scrollbarVisible?: boolean;

    /** Layout properties */
    overflowToBackbuffer?: boolean;
    marginRight?: number;
    marginBottom?: number;
    scrollbarThumbColor?: string;
    backgroundColor?: string;
    opaque?: boolean;
    borderTop?: number;
    borderBottom?: number;

    /** Sticky headers for this region */
    stickyHeaders: StickyHeader[];
    cachedStickyHeaders?: StickyHeader[];

    /** Child regions (nested content areas) */
    children: Region[];

    /** Cursor position within this region */
    cursorPosition?: { col: number; row: number };

    /** Whether the scrollback position is stable */
    stableScrollback?: boolean;

    /** DOM node reference for debugging/caching */
    nodeId?: number;

    /** Selectable text spans for text selection */
    selectableSpans: SelectableSpan[];
    selectableText?: string;
};

export type SelectableSpan = {
    endX: number;
    startX: number;
    text: string;
    y: number;
};

export type StickyHeader = {
    /** Lines in the natural (scrolling) position */
    lines: readonly StyledLine[];
    /** Height of the header in lines */
    maxHeaderHeight: number;
    /** Natural row offset relative to content start */
    naturalRow: number;
    /** Node ID for identification */
    nodeId: number;
    /** Lines in the stuck (fixed) position */
    stuckLines?: readonly StyledLine[];
    /** Stuck X position relative to region */
    x: number;
    /** Stuck Y position relative to region */
    y: number;
};

export type RegionNode = {
    children: RegionNode[];
    id: number | string;
};

/**
 * Compare two region trees for structural equality (same IDs in same order).
 */
export const treesEqual = (a: RegionNode, b: RegionNode): boolean => {
    if (a === b) {
        return true;
    }

    if (a.id !== b.id) {
        return false;
    }

    if (a.children.length !== b.children.length) {
        return false;
    }

    for (let i = 0; i < a.children.length; i++) {
        if (!treesEqual(a.children[i]!, b.children[i]!)) {
            return false;
        }
    }

    return true;
};

/**
 * Extract selectable text from a list of selectable spans.
 */
export const extractSelectableText = (spans: readonly SelectableSpan[]): string => {
    if (spans.length === 0) {
        return "";
    }

    return spans.map((s) => s.text).join("");
};
