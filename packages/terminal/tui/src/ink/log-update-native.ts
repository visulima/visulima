/* eslint-disable global-require, no-bitwise */

/**
 * Rust-backed rendering for the Ink path.
 *
 * Uses the native Renderer (cell-diff engine) to write Uint32Array buffers
 * directly to stdout, bypassing ANSI string generation and log-update's
 * line-based diffing. The Rust renderer produces minimal ANSI escape sequences
 * by comparing the current buffer against the previous frame cell-by-cell.
 */
import type { RendererConstructor, RendererInstance } from "../core/native-binding";

export type NativeLogUpdate = {
    clear: () => void;
    destroy: () => void;
    render: (buffer: Uint32Array, width: number, height: number) => void;
    resize: (width: number, height: number) => void;
};

/**
 * Create a native (Rust-backed) renderer for Ink's output.
 *
 * The native binding is loaded lazily — if it's not available (e.g., unsupported
 * platform), `createNative` returns `undefined`.
 */
export const createNative = (stream: NodeJS.WriteStream): NativeLogUpdate | undefined => {
    let RendererClass: RendererConstructor;

    try {
        // Dynamic import to avoid hard dependency on native binding
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const binding = require("../../index.js") as { Renderer: RendererConstructor };

        RendererClass = binding.Renderer;
    } catch {
        // Native binding not available on this platform
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

                renderer.render(blank);
            }
        },

        destroy(): void {
            renderer = undefined;
        },

        render(buffer: Uint32Array, width: number, height: number): void {
            ensureRenderer(width, height);

            if (!renderer) {
                return;
            }

            // Wrap in synchronized update (DEC 2026)
            if (stream.isTTY) {
                renderer.writeRaw("\u001B[?2026h");
            }

            try {
                renderer.render(buffer);
            } finally {
                if (stream.isTTY) {
                    renderer.writeRaw("\u001B[?2026l");
                }
            }
        },

        resize(width: number, height: number): void {
            ensureRenderer(width, height);
        },
    };
};
