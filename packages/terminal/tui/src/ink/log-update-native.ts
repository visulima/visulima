/* eslint-disable no-bitwise */

/**
 * Rust-backed rendering for the Ink path.
 *
 * Uses the native Renderer (cell-diff engine) to write Uint32Array buffers
 * directly to stdout, bypassing ANSI string generation and log-update's
 * line-based diffing. The Rust renderer produces minimal ANSI escape sequences
 * by comparing the current buffer against the previous frame cell-by-cell.
 */
import loadNativeRootBinding from "../core/load-native-root-binding";
import type { RendererConstructor, RendererInstance } from "../core/native-binding";
import { bsu, esu } from "./write-synchronized";

export type NativeLogUpdate = {
    clear: () => void;
    destroy: () => void;
    render: (buffer: Uint32Array, width: number, height: number) => void;
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
                renderer.writeRaw(bsu);
            }

            try {
                renderer.render(buffer);
            } finally {
                if (stream.isTTY) {
                    renderer.writeRaw(esu);
                }
            }
        },

        resize(width: number, height: number): void {
            ensureRenderer(width, height);
        },
    };
};
