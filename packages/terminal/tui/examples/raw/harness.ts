/* eslint-disable @typescript-eslint/explicit-module-boundary-types, func-style, jsdoc/match-description, no-empty, no-param-reassign, unicorn/no-process-exit, unicorn/prefer-code-point, unicorn/prevent-abbreviations */

/**
 * harness.ts — minimal terminal loop for raw buffer demos
 *
 * Usage:
 *   const loop = createLoop((buf, cols, rows, frame) => {
 *     // fill buf however you like
 *   })
 *   loop.start()
 *
 * The harness owns:
 *   - TerminalGuard  (alternate screen, raw mode, cleanup on exit)
 *   - Renderer       (Rust double-buffer diff engine)
 *   - Uint32Array    (back buffer — passed to your paint fn each frame)
 *   - setInterval    (render loop at target fps)
 *   - SIGWINCH       (terminal resize)
 *   - Ctrl+C / SIGINT (clean exit)
 */

import { Renderer, TerminalGuard } from "@visulima/tui/core";

export type PaintFn = (buf: Uint32Array, cols: number, rows: number, frame: number) => void;

export interface Loop {
    start: () => void;
    stop: () => void;
}

export function createLoop(paint: PaintFn, fps = 60): Loop {
    const guard = new TerminalGuard();
    let { cols, rows } = guard.getSize();
    const renderer = new Renderer(cols, rows);
    let buf = new Uint32Array(cols * rows * 2);
    let frame = 0;
    let timer: ReturnType<typeof setInterval> | null = null;
    let running = false;

    function resize() {
        const size = guard.getSize();

        cols = size.cols;
        rows = size.rows;
        renderer.resize(cols, rows);
        buf = new Uint32Array(cols * rows * 2);
    }

    function tick() {
        buf.fill(0);
        paint(buf, cols, rows, frame++);
        renderer.render(buf);
    }

    function stop() {
        if (!running) {
            return;
        }

        running = false;

        if (timer) {
            clearInterval(timer);
        }

        // Restore Node's stream raw mode before guard.leave() restores OS flags
        try {
            process.stdin.setRawMode?.(false);
        } catch {}

        process.stdin.pause();
        guard.leave();
        process.exit(0);
    }

    function start() {
        running = true;

        process.on("SIGWINCH", resize);

        // Clean exit on Ctrl+C
        process.stdin.setRawMode?.(true);
        process.stdin.resume();
        process.stdin.on("data", (data: Buffer) => {
            if (data[0] === 3) {
                stop();
            } // ETX = Ctrl+C
        });

        process.on("SIGINT", stop);
        process.on("SIGTERM", stop);

        timer = setInterval(tick, Math.round(1000 / fps));
    }

    return { start, stop };
}

/**
 * Write a single cell into the back buffer.
 *   x, y   — 0-based column and row
 *   char   — single character
 *   fg     — foreground color index (0-255)
 *   bg     — background color index (0-255)
 *   styles — StyleMasks bitmask (optional)
 */
export function setCell(buf: Uint32Array, cols: number, x: number, y: number, char: string, fg = 255, bg = 0, styles = 0) {
    const index = (y * cols + x) * 2;

    buf[index] = char.charCodeAt(0);
    buf[index + 1] = ((styles & 0xff) << 16) | ((bg & 0xff) << 8) | (fg & 0xff);
}

/**
 * Fill a rectangular region with a single char + colors.
 */
export function fillRect(buf: Uint32Array, cols: number, x: number, y: number, w: number, h: number, char: string, fg = 255, bg = 0) {
    for (let row = y; row < y + h; row++) {
        for (let col = x; col < x + w; col++) {
            setCell(buf, cols, col, row, char, fg, bg);
        }
    }
}
