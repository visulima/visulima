import { LayoutNode } from "./layout.js";
import cliBoxes from "cli-boxes";
import { resolveColor } from "./styles.js";
import { getCodePointWidth } from "./text-width.js";

// Clip rectangle: cells outside [x0,x1) × [y0,y1) are not painted.
// Passed down through paintNode so children can never overflow their parent.
type Clip = { x0: number; y0: number; x1: number; y1: number };

// Internal sentinel for trailing cells of wide glyphs.
// Must be outside Unicode scalar range so it never collides with real text.
const CONTINUATION_CELL_CODE = 0x110000;

export function renderTreeToBuffer(root: LayoutNode, buffer: Uint32Array, cols: number, rows: number): void {
    // Clear buffer first
    for (let i = 0; i < buffer.length; i += 2) {
        buffer[i] = 32; // ' ' char code
        buffer[i + 1] = (0 << 16) | (255 << 8) | 255;
    }

    // Two-pass render:
    //   Pass 1: paint backgrounds + text for the whole tree (children can overpaint freely)
    //   Pass 2: repaint borders on top of everything (so no child can overwrite them)
    const borderJobs: Array<{
        node: LayoutNode;
        absX: number;
        absY: number;
        w: number;
        h: number;
        fg: number;
        bg: number;
        styles: number;
        clip: Clip;
    }> = [];

    // Root clip is the full terminal
    const rootClip: Clip = { x0: 0, y0: 0, x1: cols, y1: rows };

    try {
        paintNode(root, buffer, cols, rows, 0, 0, root.fg, root.bg, root.styles, borderJobs, rootClip);
        for (const job of borderJobs) {
            paintBorder(job.node, buffer, cols, rows, job.absX, job.absY, job.w, job.h, job.fg, job.bg, job.styles, job.clip);
        }
    } catch (err) {
        console.error("Renderer Error:", err);
    }
}

function writeCell(buffer: Uint32Array, cols: number, rows: number, sx: number, sy: number, charCode: number, attrCode: number, clip: Clip) {
    // Clip to parent bounds first, then terminal bounds
    if (sx < clip.x0 || sx >= clip.x1 || sy < clip.y0 || sy >= clip.y1) return;
    if (sx < 0 || sx >= cols || sy < 0 || sy >= rows) return;
    const idx = (sy * cols + sx) * 2;
    buffer[idx] = charCode;
    buffer[idx + 1] = attrCode;
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
    if (!node._style?.borderStyle) return;

    const box = (cliBoxes as any)[node._style.borderStyle];
    const borderFg = node._style.borderColor !== undefined ? resolveColor(node._style.borderColor) : fg;
    const borderAttr = (styles << 16) | (bg << 8) | borderFg;

    const showTop = node._style.borderTop !== false;
    const showBottom = node._style.borderBottom !== false;
    const showLeft = node._style.borderLeft !== false;
    const showRight = node._style.borderRight !== false;

    if (showTop) {
        for (let x = 0; x < w; x++) {
            const ch = x === 0 && showLeft ? box.topLeft : x === w - 1 && showRight ? box.topRight : box.top;
            writeCell(buffer, cols, rows, absX + x, absY, ch.codePointAt(0)!, borderAttr, clip);
        }
    }

    if (showBottom) {
        for (let x = 0; x < w; x++) {
            const ch = x === 0 && showLeft ? box.bottomLeft : x === w - 1 && showRight ? box.bottomRight : box.bottom;
            writeCell(buffer, cols, rows, absX + x, absY + h - 1, ch.codePointAt(0)!, borderAttr, clip);
        }
    }

    const yStart = showTop ? 1 : 0;
    const yEnd = showBottom ? h - 1 : h;
    for (let y = yStart; y < yEnd; y++) {
        if (showLeft) writeCell(buffer, cols, rows, absX, absY + y, box.left.codePointAt(0)!, borderAttr, clip);
        if (showRight) writeCell(buffer, cols, rows, absX + w - 1, absY + y, box.right.codePointAt(0)!, borderAttr, clip);
    }
}

/** Recursively collect all text content from a node's descendants. */
function collectText(node: LayoutNode): string {
    if (node.text !== undefined) return node.text;
    return node.children.map(collectText).join("");
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
    attrCode: number,
    clip: Clip,
) {
    if (w <= 0 || h <= 0) return;

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
        const charWidth = Math.min(getCodePointWidth(char), w);

        if (cursorX + charWidth > w) {
            cursorX = 0;
            cursorY++;
        }

        if (cursorY >= h) break;

        writeCell(buffer, cols, rows, absX + cursorX, absY + cursorY, charCode, attrCode, clip);

        // Continuation marker for wide chars. Rust diff treats this sentinel as
        // a non-printing occupied trailing cell.
        if (charWidth === 2 && cursorX + 1 < w) {
            writeCell(buffer, cols, rows, absX + cursorX + 1, absY + cursorY, CONTINUATION_CELL_CODE, attrCode, clip);
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
    borderJobs: Array<{
        node: LayoutNode;
        absX: number;
        absY: number;
        w: number;
        h: number;
        fg: number;
        bg: number;
        styles: number;
        clip: Clip;
    }>,
    clip: Clip,
) {
    // Suspense hides nodes by setting _hidden — skip the entire subtree
    if (node._hidden) return;

    const layout = node.getLayout();

    const absX = Math.round(parentX + layout.left);
    const absY = Math.round(parentY + layout.top);
    const w = Math.round(layout.width);
    const h = Math.round(layout.height);

    const fg = node.fg !== 255 ? node.fg : parentFg;
    const bg = node.bg !== 255 ? node.bg : parentBg;
    const styles = node.styles !== 0 ? node.styles : parentStyles;

    // Intersect this node's bounds with the incoming clip rectangle.
    // Children inherit this tighter clip — they can never paint outside their parent.
    const nodeClip: Clip = {
        x0: Math.max(clip.x0, absX),
        y0: Math.max(clip.y0, absY),
        x1: Math.min(clip.x1, absX + w),
        y1: Math.min(clip.y1, absY + h),
    };

    // If the node is entirely outside the clip, skip it and its children
    if (nodeClip.x0 >= nodeClip.x1 || nodeClip.y0 >= nodeClip.y1) return;

    // <Transform> node: collect all descendant text, apply transform fn, paint result
    if (typeof node.transform === "function") {
        const raw = collectText(node);
        const transformed = node.transform(raw, 0);
        const attrCode = (styles << 16) | (bg << 8) | fg;
        paintText(transformed, buffer, cols, rows, absX, absY, w, h, attrCode, nodeClip);
        return;
    }

    if (!node.text) {
        // Fill background
        const attrCode = (styles << 16) | (bg << 8) | fg;
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                writeCell(buffer, cols, rows, absX + x, absY + y, 32, attrCode, nodeClip);
            }
        }

        // Queue border repaint for pass 2 (so children can't erase it)
        if (node._style?.borderStyle) {
            borderJobs.push({ node, absX, absY, w, h, fg, bg, styles, clip: nodeClip });
        }
    } else {
        // Text node: optionally fill background then paint characters
        const attrCode = (styles << 16) | (bg << 8) | fg;

        if (node.bg !== 255) {
            for (let y = 0; y < h; y++) {
                for (let x = 0; x < w; x++) {
                    writeCell(buffer, cols, rows, absX + x, absY + y, 32, attrCode, nodeClip);
                }
            }
        }

        paintText(node.text, buffer, cols, rows, absX, absY, w, h, attrCode, nodeClip);
    }

    // Recurse into children — they inherit this node's clip rectangle
    for (const child of node.children) {
        paintNode(child, buffer, cols, rows, absX, absY, fg, bg, styles, borderJobs, nodeClip);
    }
}
