/* eslint-disable no-bitwise */

/**
 * Rust-backed rendering for the Ink path.
 *
 * Uses the native Renderer (cell-diff engine) to turn Uint32Array buffers into
 * minimal ANSI diffs, bypassing string generation and log-update's line-based
 * diffing. The Rust renderer compares the current buffer against the previous
 * frame cell-by-cell. The diff is written to the caller's stream, so custom and
 * non-TTY stdouts see the same bytes as every other Ink write.
 *
 * Two placements share the renderer. The alternate screen owns row 0, so its diff
 * uses absolute rows. Inline output has no known row: the Rust diff is still
 * computed in frame rows, then its absolute CUP sequences are rewritten into
 * relative moves from the row the cursor is on. That keeps the frame anchored where
 * the cursor was when rendering started, and the terminal scrolls on its own.
 */
import { cursorDown, cursorHide, cursorShow, cursorTo, cursorUp } from "@visulima/ansi";

import loadNativeRootBinding from "../core/load-native-root-binding";
import type { RendererConstructor, RendererInstance } from "../core/native-binding";
import type { CursorPosition, CursorShape } from "./cursor-helpers";
import { createCursorShapeTracker } from "./log-update";
import { bsu, esu } from "./write-synchronized";

export type NativeFrameOptions = {
    /** Cursor to place (and show) after the diff, relative to the frame. Without one the cursor stays hidden. */
    cursor?: CursorPosition;

    /**
     * Text written in the same synchronized update before the frame, e.g. a clear and the `Static` output. It can overwrite
     * the frame, so the whole frame is drawn again.
     */
    prefix?: string;
    /** Alternate screen only: terminal row the frame starts on, e.g. below the `Static` output written above it. */
    rowOffset?: number;
};

export type NativeLogUpdate = {
    clear: () => void;
    /** Forgets the frame without erasing it, e.g. after another program took the screen. */
    destroy: () => void;

    /**
     * Restores the terminal's default cursor shape if a frame changed it and, inline, moves the cursor below the frame.
     * Call once when the app stops rendering, before leaving the alternate screen.
     */
    done: () => void;

    /**
     * Draw a frame. On the alternate screen it is drawn at absolute coordinates, starting `rowOffset` rows down. Inline, it is
     * drawn from the cursor's row. Rows below the bottom of the terminal are dropped rather than wrapped onto it.
     */
    render: (buffer: Uint32Array, width: number, height: number, options?: NativeFrameOptions) => void;

    resize: (width: number, height: number) => void;
    /** Declared cursor shape for the next frame; `undefined` when no Cursor is mounted. Written only when it changes. */
    setCursorShape: (shape: CursorShape | undefined) => void;
};

const eraseBelow = "\u001B[J";
const sgrReset = "\u001B[0m";
// Absolute cursor positions in the Rust diff: CSI row ; column H. Its only cursor moves, so they are the ones to rewrite.
// eslint-disable-next-line no-control-regex -- the escape byte is what the Rust diff emits
const absoluteMove = /\u001B\[(\d+);(\d+)H/gu;

// Cache the native binding at module level so it's only loaded once,
// not on every render() mount.
let cachedRendererClass: RendererConstructor | false | undefined;

const getRendererClass = (): RendererConstructor | undefined => {
    if (cachedRendererClass === false) {
        return undefined;
    }

    if (cachedRendererClass !== undefined) {
        return cachedRendererClass;
    }

    try {
        // Load lazily so an unsupported platform degrades gracefully rather
        // than hard-failing at import time.
        const binding = loadNativeRootBinding(import.meta.url) as { Renderer: RendererConstructor };

        cachedRendererClass = binding.Renderer;

        return cachedRendererClass;
    } catch {
        // Native binding not available on this platform — cache the miss
        cachedRendererClass = false;

        return undefined;
    }
};

/**
 * Cursor motion from frame row `from` to frame row `row`, column `column`. Rows that move down use CUD, so the
 * caller must only move within rows that already exist; growing the frame goes through `\n` instead, which scrolls.
 */
const moveWithin = (from: number, row: number, column: number): string => {
    let vertical = "";

    if (row > from) {
        vertical = cursorDown(row - from);
    } else if (row < from) {
        vertical = cursorUp(from - row);
    }

    return vertical + cursorTo(column);
};

/**
 * Create a native (Rust-backed) renderer for Ink's output.
 *
 * The native binding is loaded lazily — if it's not available (e.g., unsupported
 * platform), `createNative` returns `undefined`. The binding lookup is cached
 * at the module level so subsequent calls avoid the try-catch + require overhead.
 * @param stream The stream the frame is written to.
 * @param options Set `inline` for output that starts at the cursor instead of the alternate screen.
 * @param options.inline Whether the frame is drawn inline.
 * @returns The native log updater, or `undefined` when the binding is unavailable.
 */
export const createNative = (stream: NodeJS.WriteStream, { inline = false }: { inline?: boolean } = {}): NativeLogUpdate | undefined => {
    const RendererClass = getRendererClass();

    if (!RendererClass) {
        return undefined;
    }

    let renderer: RendererInstance | undefined;
    let currentWidth = 0;
    let currentHeight = 0;
    const shapeTracker = createCursorShapeTracker();

    const ensureRenderer = (width: number, height: number): void => {
        if (!renderer || currentWidth !== width || currentHeight !== height) {
            if (renderer) {
                renderer.resize(width, height);
            } else {
                renderer = new RendererClass(width, height);
            }

            currentWidth = width;
            currentHeight = height;
        }
    };

    // Alternate screen: frame placement of the last render, reused by clear() which erases the same rows.
    let rowOffset = 0;
    let visibleHeight = 0;

    // Inline: the row the cursor sits on, relative to the frame top, and how many rows the frame occupies. The
    // row below the frame (`drawnRows`) is where the cursor is parked between frames.
    let cursorRow = 0;
    let drawnRows = 0;

    // Writes a diff between the front buffer and `buffer`, bracketed by the cursor hide and the
    // optional final placement. The Rust side only builds the diff; it never touches stdout.
    const write = (buffer: Uint32Array, cursor: CursorPosition | undefined, prefix: string): void => {
        if (!renderer) {
            return;
        }

        const diff = renderer.renderDiff(buffer);
        // A cursor below the clipped frame has no row to sit on, so it stays hidden.
        const placement = cursor && cursor.y < visibleHeight ? cursorTo(cursor.x, cursor.y + rowOffset) + cursorShow : "";
        // DECSCUSR only changes when the declared shape does; it moves no cells, so it can lead the write.
        const shapeDelta = shapeTracker.consumeDelta();

        // Wrap in synchronized update (DEC 2026); the prefix goes inside it so the frame never shows half-drawn.
        if (stream.isTTY) {
            stream.write(bsu);
        }

        try {
            stream.write(shapeDelta + prefix + cursorHide + diff + placement);
        } finally {
            if (stream.isTTY) {
                stream.write(esu);
            }
        }
    };

    // Erases the inline frame, leaving the cursor on its top row, and forgets it so the next frame is drawn in full.
    const eraseInline = (): string => {
        const erase = drawnRows > 0 ? moveWithin(cursorRow, 0, 0) + eraseBelow : "";

        renderer = undefined;
        cursorRow = 0;
        drawnRows = 0;

        return erase;
    };

    // Inline frame: the rows the Rust diff addresses are frame rows. Its absolute CUP sequences become relative moves
    // from the cursor row, tracked as they are written.
    const relativeDiff = (diff: string): string => diff.replaceAll(absoluteMove, (_match, row: string, column: string) => {
        const frameRow = Number(row) - 1;
        const move = moveWithin(cursorRow, frameRow, Number(column) - 1);

        cursorRow = frameRow;

        return move;
    });

    const renderInline = (buffer: Uint32Array, width: number, height: number, { cursor, prefix = "" }: NativeFrameOptions): void => {
        const terminalRows = stream.rows > 0 ? stream.rows : Number.POSITIVE_INFINITY;
        // ponytail: one row short of the viewport, so the park row always exists below the frame and CUU never has to reach
        // above the screen. A taller frame shows its bottom rows; the string renderer scrolls the whole frame instead.
        const visible = Math.min(height, Math.max(0, terminalRows - 1));
        const skipped = height - visible;

        let out = sgrReset;

        // <Static> and scrolled-off lines are written above the frame, after the old frame is erased.
        if (prefix !== "") {
            out += eraseInline() + prefix;
        }

        ensureRenderer(width, visible);

        if (visible < drawnRows) {
            out += moveWithin(cursorRow, visible, 0) + eraseBelow;
            cursorRow = visible;
        } else if (visible > drawnRows) {
            // `\n` scrolls at the bottom of the terminal, where CUD would stop, so the new rows exist before they are drawn.
            out += moveWithin(cursorRow, drawnRows, 0) + "\n".repeat(visible - drawnRows);
            cursorRow = visible;
        }

        const frame = renderer!.renderDiff(buffer.subarray(skipped * width * 2));

        out += relativeDiff(frame) + sgrReset;

        const cursorFrameRow = cursor ? cursor.y - skipped : -1;
        const isPlaced = cursorFrameRow >= 0 && cursorFrameRow < visible;
        // Parked below the frame unless a <Cursor> sits inside it.
        const parkRow = isPlaced ? cursorFrameRow : visible;

        out += moveWithin(cursorRow, parkRow, isPlaced ? cursor!.x : 0);
        cursorRow = parkRow;
        drawnRows = visible;

        if (stream.isTTY) {
            stream.write(bsu);
        }

        try {
            stream.write(cursorHide + out + (isPlaced ? cursorShow : ""));
        } finally {
            if (stream.isTTY) {
                stream.write(esu);
            }
        }
    };

    return {
        clear(): void {
            if (inline) {
                stream.write(eraseInline());

                return;
            }

            if (renderer) {
                // Write a blank frame
                const blank = new Uint32Array(currentWidth * currentHeight * 2);
                const defaultAttribute = (0 << 16) | (255 << 8) | 255;

                for (let index = 0; index < blank.length; index += 2) {
                    blank[index] = 32;
                    blank[index + 1] = defaultAttribute;
                }

                write(blank, undefined, "");
            }
        },

        destroy(): void {
            renderer = undefined;
            cursorRow = 0;
            drawnRows = 0;
        },

        done(): void {
            const restore = shapeTracker.consumeRestoreOnDone();

            if (restore !== "") {
                stream.write(restore);
            }

            if (!inline || drawnRows === 0) {
                return;
            }

            // Below the frame, so the shell's next prompt starts clear of it.
            stream.write(moveWithin(cursorRow, drawnRows, 0));
            cursorRow = drawnRows;
        },

        render(buffer: Uint32Array, width: number, height: number, options: NativeFrameOptions = {}): void {
            if (inline) {
                renderInline(buffer, width, height, options);

                return;
            }

            const { cursor, prefix = "", rowOffset: nextRowOffset = 0 } = options;
            const terminalRows = stream.rows > 0 ? stream.rows : Number.POSITIVE_INFINITY;

            // Text written above the frame may have overwritten it, so diff against nothing.
            if (prefix !== "") {
                renderer = undefined;
            }

            // The renderer reads the first width*height cells of the buffer, so clipping the height just
            // drops the bottom rows of the frame.
            rowOffset = nextRowOffset;
            visibleHeight = Math.max(0, Math.min(height, terminalRows - rowOffset));
            ensureRenderer(width, visibleHeight);
            renderer?.setRowOffset(rowOffset);

            write(buffer, cursor, prefix);
        },

        resize(width: number, height: number): void {
            ensureRenderer(width, height);
        },

        setCursorShape: shapeTracker.setPending,
    };
};
