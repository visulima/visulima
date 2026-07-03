/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unnecessary-condition, @typescript-eslint/no-unnecessary-type-assertion, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/restrict-plus-operands, no-bitwise, no-console, sonarjs/no-nested-conditional, unicorn/no-array-callback-reference */
import cliBoxes from "cli-boxes";

import type { LayoutNode } from "./layout";
import { resolveColor } from "./styles";
import { getCodePointWidth } from "./text-width";

// Clip rectangle: cells outside [x0,x1) × [y0,y1) are not painted.
// Passed down through paintNode so children can never overflow their parent.
type Clip = { x0: number; x1: number; y0: number; y1: number };

// Internal sentinel for trailing cells of wide glyphs.
// Must be outside Unicode scalar range so it never collides with real text.
const CONTINUATION_CELL_CODE = 0x11_00_00;

// Scrollbar Unicode characters for half-step rendering
const SCROLLBAR_FULL = 0x25_88; // █
const SCROLLBAR_UPPER = 0x25_80; // ▀
const SCROLLBAR_LOWER = 0x25_84; // ▄

/** Compute effective border widths accounting for per-side boolean overrides. */
function getEffectiveBorderWidths(nodeStyle: Record<string, unknown> | undefined): { bottom: number; left: number; right: number; top: number } {
    const base = nodeStyle?.borderStyle ? 1 : 0;

    return {
        bottom: nodeStyle?.borderBottom === false ? 0 : base,
        left: nodeStyle?.borderLeft === false ? 0 : base,
        right: nodeStyle?.borderRight === false ? 0 : base,
        top: nodeStyle?.borderTop === false ? 0 : base,
    };
}

function getScrollContentHeight(node: LayoutNode): number {
    let maxBottom = 0;

    for (const child of node.children) {
        const layout = child.getLayout();
        const bottom = layout.top + layout.height;

        if (bottom > maxBottom) {
            maxBottom = bottom;
        }
    }

    // Account for bottom padding — Yoga child positions are relative to
    // the content box (after border+padding), but the visual scroll range
    // must include any trailing padding so the last child isn't clipped.
    const style = node._style;
    const paddingBottom = style?.paddingBottom ?? style?.paddingY ?? style?.padding ?? 0;

    return maxBottom + paddingBottom;
}

function paintScrollbar(
    node: LayoutNode,
    buffer: Uint32Array,
    cols: number,
    rows: number,
    absX: number,
    absY: number,
    w: number,
    h: number,
    fg: number,
    parentStyles: number,
    clip: Clip,
    nodeStyle: Record<string, unknown>,
): void {
    const borders = getEffectiveBorderWidths(nodeStyle);
    const innerHeight = h - borders.top - borders.bottom;
    const scrollTop = (nodeStyle.scrollTop as number) ?? 0;
    const scrollHeight = getScrollContentHeight(node);
    const clientHeight = innerHeight;

    if (scrollHeight <= clientHeight || innerHeight <= 0) {
        return;
    }

    // Calculate thumb position using half-step precision
    const halves = innerHeight * 2;
    const thumbHalves = Math.max(2, Math.round((clientHeight / scrollHeight) * halves));
    const maxScroll = scrollHeight - clientHeight;
    const maxThumbPos = halves - thumbHalves;
    const thumbPos = maxScroll > 0 ? Math.round((scrollTop / maxScroll) * maxThumbPos) : 0;

    const thumbColor = typeof nodeStyle.scrollbarThumbColor === "string" ? resolveColor(nodeStyle.scrollbarThumbColor) : fg;

    const scrollbarX = absX + w - 1 - borders.right;
    const attributeCode = (parentStyles << 16) | (255 << 8) | thumbColor;

    for (let index = 0; index < innerHeight; index++) {
        const halfTop = index * 2;
        const halfBottom = halfTop + 1;
        const hasUpper = halfTop >= thumbPos && halfTop < thumbPos + thumbHalves;
        const hasLower = halfBottom >= thumbPos && halfBottom < thumbPos + thumbHalves;

        if (!hasUpper && !hasLower) {
            continue;
        }

        let charCode = SCROLLBAR_FULL;

        if (hasUpper && !hasLower) {
            charCode = SCROLLBAR_UPPER;
        } else if (!hasUpper && hasLower) {
            charCode = SCROLLBAR_LOWER;
        }

        writeCell(buffer, cols, rows, scrollbarX, absY + borders.top + index, charCode, attributeCode, clip);
    }
}

function paintStickyHeaders(
    node: LayoutNode,
    buffer: Uint32Array,
    cols: number,
    rows: number,
    absX: number,
    absY: number,
    _w: number,
    _h: number,
    fg: number,
    bg: number,
    parentStyles: number,
    borderJobs: {
        absX: number;
        absY: number;
        bg: number;
        clip: Clip;
        fg: number;
        h: number;
        node: LayoutNode;
        styles: number;
        w: number;
    }[],
    clip: Clip,
    nodeStyle: Record<string, unknown>,
): void {
    const borders = getEffectiveBorderWidths(nodeStyle);
    const scrollTop = (nodeStyle.scrollTop as number) ?? 0;
    const contentY = absY + borders.top;

    for (const child of node.children) {
        if (!child._style?.sticky) {
            continue;
        }

        const childLayout = child.getLayout();
        const childNaturalY = childLayout.top;

        // Only pin if the child has scrolled above the viewport
        if (childNaturalY >= scrollTop) {
            continue;
        }

        // Check parent section is still visible
        const childParent = child.parent;

        if (childParent && childParent !== node) {
            const parentLayout = childParent.getLayout();
            const parentBottom = parentLayout.top + parentLayout.height;

            if (parentBottom <= scrollTop) {
                continue;
            }
        }

        // Paint the sticky child at the pinned position (top of viewport)
        const stickyY = contentY;
        const childFg = child.fg === 255 ? fg : child.fg;
        const childBg = child.bg === 255 ? bg : child.bg;
        const childStyles = child.styles === 0 ? parentStyles : child.styles;

        paintNode(child, buffer, cols, rows, absX - childLayout.left, stickyY - childLayout.top, childFg, childBg, childStyles, borderJobs, clip);
    }
}

export function renderTreeToBuffer(root: LayoutNode, buffer: Uint32Array, cols: number, rows: number): void {
    // Clear buffer first
    for (let i = 0; i < buffer.length; i += 2) {
        buffer[i] = 32; // ' ' char code
        buffer[i + 1] = (0 << 16) | (255 << 8) | 255;
    }

    // Two-pass render:
    //   Pass 1: paint backgrounds + text for the whole tree (children can overpaint freely)
    //   Pass 2: repaint borders on top of everything (so no child can overwrite them)
    const borderJobs: {
        absX: number;
        absY: number;
        bg: number;
        clip: Clip;
        fg: number;
        h: number;
        node: LayoutNode;
        styles: number;
        w: number;
    }[] = [];

    // Root clip is the full terminal
    const rootClip: Clip = { x0: 0, x1: cols, y0: 0, y1: rows };

    try {
        paintNode(root, buffer, cols, rows, 0, 0, root.fg, root.bg, root.styles, borderJobs, rootClip);

        for (const job of borderJobs) {
            paintBorder(job.node, buffer, cols, rows, job.absX, job.absY, job.w, job.h, job.fg, job.bg, job.styles, job.clip);
        }
    } catch (error) {
        console.error("Renderer Error:", error);
    }
}

function writeCell(buffer: Uint32Array, cols: number, rows: number, sx: number, sy: number, charCode: number, attributeCode: number, clip: Clip) {
    // Clip to parent bounds first, then terminal bounds
    if (sx < clip.x0 || sx >= clip.x1 || sy < clip.y0 || sy >= clip.y1) {
        return;
    }

    if (sx < 0 || sx >= cols || sy < 0 || sy >= rows) {
        return;
    }

    const index = (sy * cols + sx) * 2;

    buffer[index] = charCode;
    buffer[index + 1] = attributeCode;
}

function paintBorder(
    node: LayoutNode,
    buffer: Uint32Array,
    cols: number,
    rows: number,
    absX: number,
    absY: number,
    w: number,
    h: number,
    fg: number,
    bg: number,
    styles: number,
    clip: Clip,
) {
    if (!node._style?.borderStyle) {
        return;
    }

    if (w <= 0 || h <= 0) {
        return;
    }

    const box = (cliBoxes as any)[node._style.borderStyle];
    const borderFg = node._style.borderColor === undefined ? fg : resolveColor(node._style.borderColor);
    const borderAttribute = (styles << 16) | (bg << 8) | borderFg;

    const showTop = node._style.borderTop !== false;
    const showBottom = node._style.borderBottom !== false;
    const showLeft = node._style.borderLeft !== false;
    const showRight = node._style.borderRight !== false;

    // When h=1, top and bottom share the same row — top takes priority.
    // When h>=2, they occupy distinct rows and both are painted.
    const canShowBottom = showBottom && (h > 1 || !showTop);

    if (showTop) {
        for (let x = 0; x < w; x++) {
            let ch: string;

            if (w === 1) {
                // Single-column degenerate case: pick the best corner/vertical
                ch = showLeft && showRight ? box.left : showLeft ? box.topLeft : showRight ? box.topRight : box.top;
            } else if (x === 0 && showLeft) {
                ch = box.topLeft;
            } else if (x === w - 1 && showRight) {
                ch = box.topRight;
            } else {
                ch = box.top;
            }

            writeCell(buffer, cols, rows, absX + x, absY, ch.codePointAt(0)!, borderAttribute, clip);
        }
    }

    if (canShowBottom) {
        for (let x = 0; x < w; x++) {
            let ch: string;

            if (w === 1) {
                ch = showLeft && showRight ? box.left : showLeft ? box.bottomLeft : showRight ? box.bottomRight : box.bottom;
            } else if (x === 0 && showLeft) {
                ch = box.bottomLeft;
            } else if (x === w - 1 && showRight) {
                ch = box.bottomRight;
            } else {
                ch = box.bottom;
            }

            writeCell(buffer, cols, rows, absX + x, absY + h - 1, ch.codePointAt(0)!, borderAttribute, clip);
        }
    }

    const yStart = showTop ? 1 : 0;
    const yEnd = canShowBottom ? h - 1 : h;

    for (let y = yStart; y < yEnd; y++) {
        if (showLeft) {
            writeCell(buffer, cols, rows, absX, absY + y, box.left.codePointAt(0)!, borderAttribute, clip);
        }

        if (showRight) {
            writeCell(buffer, cols, rows, absX + w - 1, absY + y, box.right.codePointAt(0)!, borderAttribute, clip);
        }
    }
}

/**
 * Recursively collect all text content from a node's descendants.
 *  Applies nested transforms so that an outer Transform sees the
 *  correctly transformed output of inner Transforms.
 */
function collectText(node: LayoutNode): string {
    if (node._hidden) {
        return "";
    }

    if (node.text !== undefined) {
        return node.text;
    }

    const raw = node.children.map(collectText).join("");

    // Apply this node's transform (if any) so parent transforms see
    // the post-transform text, not raw children text.
    if (typeof node.transform === "function") {
        return node.transform(raw, 0);
    }

    return raw;
}

/** Paint a plain string at (absX, absY) into the buffer, wrapping at width w. */
function paintText(
    text: string,
    buffer: Uint32Array,
    cols: number,
    rows: number,
    absX: number,
    absY: number,
    w: number,
    h: number,
    attributeCode: number,
    clip: Clip,
) {
    if (w <= 0 || h <= 0) {
        return;
    }

    let cursorX = 0;
    let cursorY = 0;

    // Iterate by Unicode code point (handles surrogate pairs correctly).
    for (const char of text) {
        if (char === "\n") {
            cursorX = 0;
            cursorY++;
            continue;
        }

        const charCode = char.codePointAt(0) ?? 32;
        const charWidth = getCodePointWidth(char);

        // Wide character that can't fit in the remaining space on this line — wrap.
        if (cursorX + charWidth > w) {
            cursorX = 0;
            cursorY++;
        }

        if (cursorY >= h) {
            break;
        }

        // Wide character that can't fit even on an empty line — replace with space
        // to avoid writing a half-glyph without its continuation cell.
        if (charWidth > w) {
            writeCell(buffer, cols, rows, absX + cursorX, absY + cursorY, 32, attributeCode, clip);
            cursorX += 1;
            continue;
        }

        writeCell(buffer, cols, rows, absX + cursorX, absY + cursorY, charCode, attributeCode, clip);

        // Continuation marker for wide chars. Rust diff treats this sentinel as
        // a non-printing occupied trailing cell.
        if (charWidth === 2 && cursorX + 1 < w) {
            writeCell(buffer, cols, rows, absX + cursorX + 1, absY + cursorY, CONTINUATION_CELL_CODE, attributeCode, clip);
        }

        cursorX += charWidth;
    }
}

function paintNode(
    node: LayoutNode,
    buffer: Uint32Array,
    cols: number,
    rows: number,
    parentX: number,
    parentY: number,
    parentFg: number,
    parentBg: number,
    parentStyles: number,
    borderJobs: {
        absX: number;
        absY: number;
        bg: number;
        clip: Clip;
        fg: number;
        h: number;
        node: LayoutNode;
        styles: number;
        w: number;
    }[],
    clip: Clip,
) {
    // Suspense hides nodes by setting _hidden — skip the entire subtree
    if (node._hidden) {
        return;
    }

    const layout = node.getLayout();

    const absX = Math.round(parentX + layout.left);
    const absY = Math.round(parentY + layout.top);
    const w = Math.round(layout.width);
    const h = Math.round(layout.height);

    const fg = node.fg === 255 ? parentFg : node.fg;
    const bg = node.bg === 255 ? parentBg : node.bg;
    const styles = node.styles === 0 ? parentStyles : node.styles;

    // Intersect this node's bounds with the incoming clip rectangle.
    // Children inherit this tighter clip — they can never paint outside their parent.
    const nodeClip: Clip = {
        x0: Math.max(clip.x0, absX),
        x1: Math.min(clip.x1, absX + w),
        y0: Math.max(clip.y0, absY),
        y1: Math.min(clip.y1, absY + h),
    };

    // If the node is entirely outside the clip, skip it and its children
    if (nodeClip.x0 >= nodeClip.x1 || nodeClip.y0 >= nodeClip.y1) {
        return;
    }

    // <Transform> node: collect all descendant text, apply transform fn, paint result
    if (typeof node.transform === "function") {
        const raw = collectText(node);
        const transformed = node.transform(raw, 0);
        const attributeCode = (styles << 16) | (bg << 8) | fg;

        paintText(transformed, buffer, cols, rows, absX, absY, w, h, attributeCode, nodeClip);

        return;
    }

    if (node.text === undefined) {
        // Fill background — skip when bg is terminal default and no text styles,
        // since the buffer was already cleared to spaces with default attributes.
        if (bg !== 255 || styles !== 0) {
            const attributeCode = (styles << 16) | (bg << 8) | fg;

            for (let y = 0; y < h; y++) {
                for (let x = 0; x < w; x++) {
                    writeCell(buffer, cols, rows, absX + x, absY + y, 32, attributeCode, nodeClip);
                }
            }
        }

        // Queue border repaint for pass 2 (so children can't erase it)
        if (node._style?.borderStyle) {
            borderJobs.push({ absX, absY, bg, clip: nodeClip, fg, h, node, styles, w });
        }
    } else {
        // Text node: optionally fill background then paint characters
        const attributeCode = (styles << 16) | (bg << 8) | fg;

        if (node.bg !== 255) {
            for (let y = 0; y < h; y++) {
                for (let x = 0; x < w; x++) {
                    writeCell(buffer, cols, rows, absX + x, absY + y, 32, attributeCode, nodeClip);
                }
            }
        }

        paintText(node.text, buffer, cols, rows, absX, absY, w, h, attributeCode, nodeClip);
    }

    // Determine overflow and scroll state
    const nodeStyle = node._style;
    const overflow = nodeStyle?.overflow ?? "visible";
    const overflowX = nodeStyle?.overflowX ?? overflow;
    const overflowY = nodeStyle?.overflowY ?? overflow;

    const clipH = overflowX === "hidden" || overflowX === "scroll";
    const clipV = overflowY === "hidden" || overflowY === "scroll";

    // Children are always clipped to this node's bounds. For overflow: hidden/scroll,
    // the clip is further tightened to the content area (inside borders) below.
    let childClip = nodeClip;
    let scrollOffsetX = 0;
    let scrollOffsetY = 0;

    if (clipH || clipV) {
        const borders = getEffectiveBorderWidths(nodeStyle);

        childClip = {
            x0: clipH ? Math.max(nodeClip.x0, absX + borders.left) : nodeClip.x0,
            x1: clipH ? Math.min(nodeClip.x1, absX + w - borders.right) : nodeClip.x1,
            y0: clipV ? Math.max(nodeClip.y0, absY + borders.top) : nodeClip.y0,
            y1: clipV ? Math.min(nodeClip.y1, absY + h - borders.bottom) : nodeClip.y1,
        };

        // Apply scroll offsets
        if (overflowY === "scroll" && typeof nodeStyle?.scrollTop === "number") {
            scrollOffsetY = -nodeStyle.scrollTop;
        }

        if (overflowX === "scroll" && typeof nodeStyle?.scrollLeft === "number") {
            scrollOffsetX = -nodeStyle.scrollLeft;
        }
    }

    // Recurse into children with scroll offset applied
    for (const child of node.children) {
        // Skip sticky alternate nodes during normal render
        if (child._style?.internalStickyAlternate) {
            continue;
        }

        paintNode(child, buffer, cols, rows, absX + scrollOffsetX, absY + scrollOffsetY, fg, bg, styles, borderJobs, childClip);
    }

    // Paint scrollbar for scrollable containers
    if ((overflowY === "scroll" || overflowX === "scroll") && nodeStyle?.scrollbar !== false) {
        paintScrollbar(node, buffer, cols, rows, absX, absY, w, h, fg, styles, nodeClip, nodeStyle);
    }

    // Paint sticky headers at their pinned positions
    if (overflowY === "scroll" && typeof nodeStyle?.scrollTop === "number") {
        paintStickyHeaders(node, buffer, cols, rows, absX, absY, w, h, fg, bg, styles, borderJobs, childClip, nodeStyle);
    }
}
