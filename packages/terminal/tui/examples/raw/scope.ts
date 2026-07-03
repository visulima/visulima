/* eslint-disable func-style, jsdoc/lines-before-block */
/**
 * scope.ts — Sine harmonic oscilloscope
 *
 * Plots multiple sine waves with slowly drifting frequencies and phases.
 * Each harmonic is a distinct Ratatat brand color. The composite sum is
 * drawn as bright white on top. Looks like a real oscilloscope.
 *
 * Direct Uint32Array buffer painting — no React, no Yoga, no reconciler.
 *
 * Run: node --import @oxc-node/core/register examples/raw/scope.ts
 *
 * Controls:
 *   Ctrl+C   quit
 */

import { createLoop, setCell } from "./harness";

// ─── Harmonics ────────────────────────────────────────────────────────────────

interface Harmonic {
    amp: number;
    color: number;
    freq: number;
    freqDrift: number;
    phase: number;
    phaseDrift: number;
}

const HARMONICS: Harmonic[] = [
    { amp: 0.35, color: 51, freq: 2, freqDrift: 0.07, phase: 0, phaseDrift: 0.8 }, // cyan
    { amp: 0.25, color: 213, freq: 3, freqDrift: -0.05, phase: 1, phaseDrift: -1.1 }, // magenta
    { amp: 0.2, color: 226, freq: 5, freqDrift: 0.11, phase: 2.1, phaseDrift: 1.7 }, // yellow
    { amp: 0.12, color: 46, freq: 7, freqDrift: -0.09, phase: 0.5, phaseDrift: -2.3 }, // green
    { amp: 0.08, color: 208, freq: 11, freqDrift: 0.13, phase: 3.2, phaseDrift: 3.1 }, // orange
];

// ─── Persistent dirty-cell tracking ──────────────────────────────────────────
// Track which cells we painted last frame so we can explicitly clear them
// this frame if we're not painting them again. The Rust diff engine only
// emits changes — if we just zero-fill the back buffer, cells that were
// painted last frame appear as "no change" and never get erased.

let previousPainted = new Set<number>(); // encoded as y * MAX_COLS + x
let currentPainted = new Set<number>();

function cellKey(x: number, y: number, cols: number): number {
    return y * cols + x;
}

function paintCell(buf: Uint32Array, cols: number, x: number, y: number, char: string, fg: number, bold = false) {
    setCell(buf, cols, x, y, char, fg, 0, bold ? 1 : 0);
    currentPainted.add(cellKey(x, y, cols));
}

function clearStale(buf: Uint32Array, cols: number) {
    for (const key of previousPainted) {
        if (!currentPainted.has(key)) {
            const x = key % cols;
            const y = Math.floor(key / cols);

            // Write an explicit space so the diff engine sees the change
            setCell(buf, cols, x, y, " ", 0);
        }
    }
}

// ─── Paint ────────────────────────────────────────────────────────────────────

let lastT = performance.now() / 1000;

function paint(buf: Uint32Array, cols: number, rows: number, _frame: number) {
    const t = performance.now() / 1000;
    const dt = Math.min(t - lastT, 0.1);

    lastT = t;

    currentPainted = new Set();

    // Advance drifts
    for (const h of HARMONICS) {
        h.phase += h.phaseDrift * dt;
        h.freq = Math.max(0.5, Math.min(20, h.freq + h.freqDrift * dt));
    }

    const chartTop = 1;
    const chartBottom = rows - 2;
    const chartHeight = chartBottom - chartTop;
    const midRow = chartTop + Math.floor(chartHeight / 2);
    const halfH = chartHeight / 2;
    const totalAmp = HARMONICS.reduce((a, h) => a + h.amp, 0);

    // Center line
    for (let x = 0; x < cols; x++) {
        paintCell(buf, cols, x, midRow, "─", 234);
    }

    for (let x = 0; x < cols; x++) {
        const xNorm = x / Math.max(cols - 1, 1);

        // Composite — drawn first, harmonics paint over it
        let sum = 0;

        for (const h of HARMONICS) {
            sum += h.amp * Math.sin(2 * Math.PI * h.freq * xNorm + h.phase);
        }

        const compositeRow = midRow - Math.round((sum / totalAmp) * halfH);

        if (compositeRow >= chartTop && compositeRow <= chartBottom) {
            paintCell(buf, cols, x, compositeRow, "▪", 231, true);
        }

        // Individual harmonics on top
        for (const h of HARMONICS) {
            const v = h.amp * Math.sin(2 * Math.PI * h.freq * xNorm + h.phase);
            const row = midRow - Math.round(v * halfH);

            if (row < chartTop || row > chartBottom) {
                continue;
            }

            paintCell(buf, cols, x, row, "▪", h.color, true);
        }
    }

    // Clear cells painted last frame that aren't painted this frame
    clearStale(buf, cols);
    previousPainted = currentPainted;

    // Legend
    const labels = [
        { color: 231, label: "▪ composite" },
        { color: HARMONICS[0]!.color, label: "▪ f1" },
        { color: HARMONICS[1]!.color, label: "▪ f2" },
        { color: HARMONICS[2]!.color, label: "▪ f3" },
        { color: HARMONICS[3]!.color, label: "▪ f4" },
        { color: HARMONICS[4]!.color, label: "▪ f5" },
    ];
    let legendX = 4;

    for (const { color, label } of labels) {
        for (let i = 0; i < label.length && legendX + i < cols - 20; i++) {
            setCell(buf, cols, legendX + i, chartTop, label[i]!, color, 0, 1);
        }

        legendX += label.length + 2;
    }

    // Status bar
    const freqString = HARMONICS.map((h) => `${h.freq.toFixed(1)}Hz`).join("  ");
    const status = `  harmonics: ${freqString}   Ctrl+C quit  `;

    for (let i = 0; i < Math.min(status.length, cols); i++) {
        setCell(buf, cols, i, rows - 1, status[i]!, 240);
    }
}

// ─── Run ─────────────────────────────────────────────────────────────────────

const loop = createLoop(paint, 60);

loop.start();
