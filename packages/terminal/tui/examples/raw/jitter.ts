/* eslint-disable func-style, jsdoc/lines-before-block */
/**
 * jitter.ts — Frame timing oscilloscope
 *
 * Plots the actual render time of each frame using performance.now().
 * The waveform shows Ratatat's own render loop jitter in real time —
 * the renderer visualizing itself.
 *
 * Direct Uint32Array buffer painting — no React, no Yoga, no reconciler.
 *
 * Run: node --import @oxc-node/core/register examples/raw/jitter.ts
 *
 * Controls:
 *   Ctrl+C   quit
 */

import { createLoop, setCell } from "./harness";

// ─── Ring buffer for timing samples ──────────────────────────────────────────

const MAX_SAMPLES = 512;
const samples = new Float64Array(MAX_SAMPLES);
let sampleHead = 0;
let sampleCount = 0;

function pushSample(ms: number) {
    samples[sampleHead % MAX_SAMPLES] = ms;
    sampleHead++;

    if (sampleCount < MAX_SAMPLES) {
        sampleCount++;
    }
}

function getSample(i: number): number {
    // i=0 is oldest, i=sampleCount-1 is newest
    const offset = sampleHead - sampleCount + i;

    return samples[((offset % MAX_SAMPLES) + MAX_SAMPLES) % MAX_SAMPLES]!;
}

// ─── Colors ───────────────────────────────────────────────────────────────────

// Value → color: green (fast) → yellow → red (slow)
function valueColor(normalized: number): number {
    if (normalized < 0.5) {
        return 46;
    } // green

    if (normalized < 0.75) {
        return 226;
    } // yellow

    if (normalized < 0.9) {
        return 208;
    } // orange

    return 196; // red
}

// ─── Paint ────────────────────────────────────────────────────────────────────

let lastTime = performance.now();
let frameCount = 0;

// Rolling stats
let rollingMin = Infinity;
let rollingMax = 0;
let rollingSum = 0;
const STAT_WINDOW = 120; // frames

function paint(buf: Uint32Array, cols: number, rows: number, frame: number) {
    const now = performance.now();
    const delta = now - lastTime;

    lastTime = now;

    pushSample(delta);
    frameCount++;

    // Rolling stats over last STAT_WINDOW samples
    rollingMin = Infinity;
    rollingMax = 0;
    rollingSum = 0;
    const statN = Math.min(sampleCount, STAT_WINDOW);

    for (let i = sampleCount - statN; i < sampleCount; i++) {
        const v = getSample(i);

        if (v < rollingMin) {
            rollingMin = v;
        }

        if (v > rollingMax) {
            rollingMax = v;
        }

        rollingSum += v;
    }

    const rollingAvg = rollingSum / statN;

    // Chart area: full width, leave 3 rows at bottom for stats
    const chartRows = rows - 3;
    const chartCols = cols;

    // How many samples to display — one per column
    const displayN = Math.min(sampleCount, chartCols);

    // Y scale: show 0 to max*1.2 so there's headroom
    const yMax = Math.max(rollingMax * 1.2, 50); // at least 50ms range
    const yMin = 0;

    // Draw chart
    for (let cx = 0; cx < chartCols; cx++) {
        // Map column to sample index (oldest on left, newest on right)
        const sampleIndex = sampleCount - displayN + Math.floor((cx / chartCols) * displayN);

        if (sampleIndex < 0 || sampleIndex >= sampleCount) {
            continue;
        }

        const v = getSample(sampleIndex);
        const normalized = (v - yMin) / (yMax - yMin);
        const barHeight = Math.round(normalized * chartRows);
        const topRow = chartRows - barHeight;

        const color = valueColor(normalized);

        // Draw vertical bar from bottom up
        for (let cy = chartRows - 1; cy >= topRow; cy--) {
            const char = cy === topRow ? "▄" : "█";

            setCell(buf, cols, cx, cy, char, color);
        }

        // Draw the zero baseline
        setCell(buf, cols, cx, chartRows - 1, "─", 238);
    }

    // Highlight the newest sample with a bright cursor
    const newestX = chartCols - 1;
    const newestV = getSample(sampleCount - 1);
    const newestNorm = (newestV - yMin) / (yMax - yMin);
    const newestRow = chartRows - 1 - Math.round(newestNorm * (chartRows - 1));

    if (newestRow >= 0 && newestRow < chartRows) {
        setCell(buf, cols, newestX, newestRow, "●", 231, 0, 1); // bold white dot
    }

    // Stats bar
    const targetMs = (1000 / 60).toFixed(1);
    const stats =
        ` frame Δt   ` +
        `cur ${delta.toFixed(2)}ms  ` +
        `avg ${rollingAvg.toFixed(2)}ms  ` +
        `min ${rollingMin.toFixed(2)}ms  ` +
        `max ${rollingMax.toFixed(2)}ms  ` +
        `target ${targetMs}ms  ` +
        `Ctrl+C quit`;

    for (let i = 0; i < Math.min(stats.length, cols); i++) {
        setCell(buf, cols, i, rows - 2, stats[i]!, 250, 0);
    }

    // Scale labels (right side)
    const maxLabel = `${yMax.toFixed(0)}ms`;
    const midLabel = `${(yMax / 2).toFixed(0)}ms`;

    for (let i = 0; i < Math.min(maxLabel.length, cols); i++) {
        setCell(buf, cols, cols - maxLabel.length + i, 0, maxLabel[i]!, 238);
    }

    for (let i = 0; i < Math.min(midLabel.length, cols); i++) {
        setCell(buf, cols, cols - midLabel.length + i, Math.floor(chartRows / 2), midLabel[i]!, 238);
    }
}

// ─── Run ─────────────────────────────────────────────────────────────────────

const loop = createLoop(paint, 60);

loop.start();
