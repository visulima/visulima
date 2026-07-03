/* eslint-disable e18e/prefer-static-regex, no-control-regex, regexp/no-unused-capturing-group, sonarjs/prefer-regexp-exec, unicorn/no-null, unicorn/no-process-exit, unicorn/prevent-abbreviations */

/**
 * src/inline.ts — Inline rendering mode
 *
 * Renders a fixed-height region immediately below the current cursor,
 * without switching to the alternate screen.
 *
 * IMPORTANT: All stdout writes go through Renderer.writeRaw() to avoid
 * interleaving between Node's process.stdout and Rust's std::io::stdout.
 * The only exception is the pre-renderer setup (hide cursor, newlines, CPR)
 * which happens before the Renderer exists and completes before the first
 * render tick.
 */

import {
    BracketedPasteMode,
    createDecMode,
    cursorHide,
    cursorPosition,
    cursorShow,
    cursorToColumn1,
    cursorUp,
    eraseLine,
    REQUEST_CURSOR_POSITION,
    resetMode,
    setMode,
} from "@visulima/ansi";

import type { RendererInstance } from "./native-binding";
import { Renderer, terminalSize } from "./native-binding";

// DEC Private Mode 2026 — Synchronized Output. Precomputed once.
const SynchronizedOutputMode = createDecMode(2026);
const DEC_2026_ON = setMode(SynchronizedOutputMode);
const DEC_2026_OFF = resetMode(SynchronizedOutputMode);

const enableBracketedPaste = setMode(BracketedPasteMode);
const disableBracketedPaste = resetMode(BracketedPasteMode);

export interface InlineOptions {
    /** Frames per second. Default: 60 */
    fps?: number;

    /**
     * What to do with the rendered content when the loop stops.
     * - 'preserve' (default) — content stays in terminal scrollback
     * - 'destroy'            — content is cleared, terminal looks untouched
     */
    onExit?: "preserve" | "destroy";
    /** Number of terminal rows to reserve. Default: 10 */
    rows?: number;
}

export type InlinePaintFn = (buf: Uint32Array, cols: number, rows: number, frame: number) => void;

export interface InlineLoop {
    start: () => void;
    stop: () => void;
}

/**
 * Create an inline render loop. Renders `rows` lines immediately below the
 * current cursor position (no alternate screen).
 */
export function createInlineLoop(paint: InlinePaintFn, options: InlineOptions = {}): InlineLoop {
    const reservedRows = options.rows ?? 10;
    const fps = options.fps ?? 60;
    const onExit = options.onExit ?? "preserve";

    let interval: ReturnType<typeof setInterval> | null = null;
    let renderer: RendererInstance | null = null;
    let buf: Uint32Array | null = null;
    let cols = 80;
    let renderRows = 10;
    let frame = 0;
    // 1-based terminal row of the top of our render region — set once CPR resolves
    let regionTopRow = 1;

    /** Write to stdout through the Renderer's Rust handle (avoids interleaving). */
    function write(s: string) {
        renderer!.writeRaw(s);
    }

    function tick() {
        buf!.fill(0);
        paint(buf!, cols, renderRows, frame++);
        write(DEC_2026_ON);

        try {
            renderer!.render(buf!);
        } finally {
            write(DEC_2026_OFF);
        }
    }

    function startRendering(cursorRow: number) {
        regionTopRow = cursorRow - renderRows;
        write(cursorUp(renderRows) + cursorToColumn1);

        // rowOffset: Rust emits \x1b[offset+bufRow+1;colH
        // We need offset+0+1 = regionTopRow+1 → offset = regionTopRow
        renderer!.setRowOffset(regionTopRow);

        tick();

        interval = setInterval(
            () => {
                // No rewind needed — Renderer uses absolute cursor positioning
                // (\x1b[row;colH) for every dirty cell. Rewinding before each
                // frame causes cursor drift when the diff is empty (no-op frames).
                tick();
            },
            Math.round(1000 / fps),
        );
    }

    function start() {
        const size = terminalSize();

        cols = size.cols;
        const termRows = size.rows;

        renderRows = Math.min(reservedRows, termRows);

        if (process.stdin.isTTY) {
            process.stdin.setRawMode(true);
        }

        process.stdin.resume();
        process.stdin.setEncoding("utf8");

        renderer = new Renderer(cols, renderRows);
        buf = new Uint32Array(cols * renderRows * 2);

        // Pre-render setup: these writes happen BEFORE the first render tick.
        // The CPR response arrives asynchronously, so these will have flushed
        // through Node's stdout before Rust's stdout is used.
        write(cursorHide);
        write(enableBracketedPaste); // for usePaste/useTextInput
        write("\n".repeat(renderRows));
        write(REQUEST_CURSOR_POSITION);

        process.on("SIGINT", stop);

        let cprBuf = "";
        const onData = (chunk: string) => {
            cprBuf += chunk;
            const m = cprBuf.match(/\u001B\[(\d+);(\d+)R/);

            if (m) {
                process.stdin.off("data", onData);
                startRendering(Number.parseInt(m[1]!, 10));
            }
        };

        process.stdin.on("data", onData);
    }

    function stop() {
        if (interval) {
            clearInterval(interval);
            interval = null;
        }

        if (renderer) {
            if (onExit === "destroy") {
                // Use absolute positioning — cursor could be anywhere after last render.
                // Region occupies terminal rows (regionTopRow+1) through (regionTopRow+renderRows).
                for (let i = 0; i < renderRows; i++) {
                    write(cursorPosition(regionTopRow + 1 + i, 1) + eraseLine);
                }

                // Leave cursor at top of cleared region
                write(cursorPosition(regionTopRow + 1, 1));
            } else {
                // preserve: move cursor just below the region so prompt appears after content
                write(cursorPosition(regionTopRow + renderRows + 1, 1));
            }

            write(disableBracketedPaste);
            write(cursorShow);
        }

        if (process.stdin.isTTY) {
            process.stdin.setRawMode(false);
        }

        process.stdin.pause();
        process.exit(0);
    }

    return { start, stop };
}
