/* eslint-disable func-style, jsdoc/lines-before-block */
/**
 * plasma.ts — Classic demoscene plasma effect
 *
 * Every cell gets a color derived from overlapping sine waves in x, y,
 * and time. The result is a smooth, endlessly morphing color wash that
 * fills the entire terminal — no stale cells, no bookkeeping, just math.
 *
 * Direct Uint32Array buffer painting — no React, no Yoga, no reconciler.
 *
 * Run: node --import @oxc-node/core/register examples/raw/plasma.ts
 *
 * Controls:
 *   Ctrl+C   quit
 */

import { createLoop, setCell } from "./harness";

// ─── 256-color palette ────────────────────────────────────────────────────────
// Map a value in [0, 1] to a vivid 256-color index.
// We cycle through the 6×6×6 color cube (indices 16–231) using sine waves
// on each channel so the palette wraps smoothly.

function paletteColor(t: number): number {
    // t in [0, 1] — map to smooth RGB cycle
    const r = Math.floor(((Math.sin(t * Math.PI * 2) + 1) / 2) * 5);
    const g = Math.floor(((Math.sin(t * Math.PI * 2 + (Math.PI * 2) / 3) + 1) / 2) * 5);
    const b = Math.floor(((Math.sin(t * Math.PI * 2 + (Math.PI * 4) / 3) + 1) / 2) * 5);

    return 16 + 36 * r + 6 * g + b;
}

// ─── Plasma ───────────────────────────────────────────────────────────────────
// Classic formula: sum of sine waves in x, y, diagonal, and a circular wave.
// Each contributes a different spatial frequency and direction.

function plasmaValue(x: number, y: number, t: number, cols: number, rows: number): number {
    const nx = x / cols; // normalize to [0, 1]
    const ny = y / rows;

    const v1 = Math.sin(nx * 6 + t);
    const v2 = Math.sin(ny * 6 + t * 0.7);
    const v3 = Math.sin((nx + ny) * 5 + t * 1.3);

    // Circular wave from center
    const cx = nx - 0.5;
    const cy = ny - 0.5;
    const dist = Math.hypot(cx, cy);
    const v4 = Math.sin(dist * 12 - t * 1.7);

    // Sum → normalize to [0, 1]
    return (v1 + v2 + v3 + v4 + 4) / 8;
}

// ─── Characters ───────────────────────────────────────────────────────────────
// Denser characters for brighter values — adds texture to the color field.
const CHARS = " ·:;+=xX$#";

function plasmaChar(v: number): string {
    return CHARS[Math.floor(v * (CHARS.length - 1))]!;
}

// ─── Paint ────────────────────────────────────────────────────────────────────

function paint(buf: Uint32Array, cols: number, rows: number, _frame: number) {
    const t = performance.now() / 1000;

    for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
            const v = plasmaValue(x, y, t, cols, rows);
            const fg = paletteColor(v);
            // Shift bg palette by 0.5 for contrast — complementary color underneath
            const bg = paletteColor((v + 0.5) % 1);
            const char = plasmaChar(v);

            setCell(buf, cols, x, y, char, fg, bg);
        }
    }
}

// ─── Run ─────────────────────────────────────────────────────────────────────

const loop = createLoop(paint, 60);

loop.start();
