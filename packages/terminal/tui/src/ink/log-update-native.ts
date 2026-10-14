/* eslint-disable no-bitwise */

/**
 * Rust-backed rendering for the Ink path.
 *
 * Uses the native Renderer (cell-diff engine) to turn Uint32Array buffers into
 * minimal ANSI diffs, bypassing string generation and log-update's line-based
 * diffing. The Rust renderer compares the current buffer against the previous
 * frame cell-by-cell. The diff is written to the caller's stream, so custom and
 * non-TTY stdouts see the same bytes as every other Ink write.
 */
import { cursorHide, cursorShow, cursorTo } from "@visulima/ansi";

import loadNativeRootBinding from "../core/load-native-root-binding";
import type { RendererConstructor, RendererInstance } from "../core/native-binding";
import type { CursorPosition } from "./cursor-helpers";
import { bsu, esu } from "./write-synchronized";

export type NativeFrameOptions = {
    /** Cursor to place (and show) after the diff, relative to the frame. Without one the cursor stays hidden. */
    cursor?: CursorPosition;

    /**
     * Text written in the same synchronized update before the frame, e.g. a clear and the `Static` output. It can overwrite
     * the frame, so the whole frame is drawn again.
     */
    prefix?: string;
    /** Terminal row the frame starts on, e.g. below the `Static` output written above it. */
    rowOffset?: number;
};

export type NativeLogUpdate = {
    clear: () => void;
    destroy: () => void;

    /**
     * Draw a frame at absolute terminal coordinates, starting `rowOffset` rows down. The cursor is hidden
     * while the diff is written. Rows below the bottom of the terminal are dropped rather than wrapped onto it.
     */
    render: (buffer: Uint32Array, width: number, height: number, options?: NativeFrameOptions) => void;
    resize: (width: number, height: number) => void;
};

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
 * Create a native (Rust-backed) renderer for Ink's output.
 *
 * The native binding is loaded lazily — if it's not available (e.g., unsupported
 * platform), `createNative` returns `undefined`. The binding lookup is cached
 * at the module level so subsequent calls avoid the try-catch + require overhead.
 */
export const createNative = (stream: NodeJS.WriteStream): NativeLogUpdate | undefined => {
    const RendererClass = getRendererClass();

    if (!RendererClass) {
        return undefined;
    }

    let renderer: RendererInstance | undefined;
    let currentWidth = 0;
    let currentHeight = 0;

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

    // Frame placement of the last render, reused by clear() which erases the same rows.
    let rowOffset = 0;
    let visibleHeight = 0;

    // Writes a diff between the front buffer and `buffer`, bracketed by the cursor hide and the
    // optional final placement. The Rust side only builds the diff; it never touches stdout.
    const write = (buffer: Uint32Array, cursor: CursorPosition | undefined, prefix: string): void => {
        if (!renderer) {
            return;
        }

        const diff = renderer.renderDiff(buffer);
        // A cursor below the clipped frame has no row to sit on, so it stays hidden.
        const placement = cursor && cursor.y < visibleHeight ? cursorTo(cursor.x, cursor.y + rowOffset) + cursorShow : "";

        // Wrap in synchronized update (DEC 2026); the prefix goes inside it so the frame never shows half-drawn.
        if (stream.isTTY) {
            stream.write(bsu);
        }

        try {
            stream.write(prefix + cursorHide + diff + placement);
        } finally {
            if (stream.isTTY) {
                stream.write(esu);
            }
        }
    };

    return {
        clear(): void {
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
        },

        render(buffer: Uint32Array, width: number, height: number, options: NativeFrameOptions = {}): void {
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
    };
};
