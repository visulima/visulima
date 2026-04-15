/* eslint-disable func-style, jsdoc/lines-before-block, sonarjs/pseudo-random */
/**
 * conway.ts — Conway's Game of Life
 *
 * Direct Uint32Array buffer painting — no React, no Yoga, no reconciler.
 * The Rust diff engine handles all terminal output.
 *
 * Run: node --import @oxc-node/core/register examples/raw/conway.ts
 *
 * Controls:
 *   Ctrl+C   quit
 */

import { createLoop, setCell } from "./harness";

// ─── Palette ─────────────────────────────────────────────────────────────────

// Age → 256-color index. Young cells are bright, old cells cool to blue.
const AGE_COLORS = [
    231, // age 0: white
    226, // age 1: bright yellow
    214, // age 2: orange
    208, // age 3: dark orange
    196, // age 4: red
    160, // age 5: dark red
    124, // age 6: deep red
    93, // age 7: purple
    57, // age 8: dark purple
    21, // age 9+: blue
];

function ageColor(age: number): number {
    return AGE_COLORS[Math.min(age, AGE_COLORS.length - 1)]!;
}

// ─── Cell characters — denser = older ────────────────────────────────────────
const AGE_CHARS = ["█", "▓", "▒", "░", "·", "·", "·", "·", "·", "·"];

function ageChar(age: number): string {
    return AGE_CHARS[Math.min(age, AGE_CHARS.length - 1)]!;
}

// ─── Life state ──────────────────────────────────────────────────────────────

let cols = 0;
let rows = 0;
let grid: Uint8Array; // current generation: 0=dead, 1+=age
let next: Uint8Array; // scratch buffer for next generation

function initGrid(w: number, h: number) {
    cols = w;
    rows = h;
    grid = new Uint8Array(w * h);
    next = new Uint8Array(w * h);

    // Random seed — roughly 30% alive
    for (let i = 0; i < grid.length; i++) {
        grid[i] = Math.random() < 0.3 ? 1 : 0;
    }
}

function index(x: number, y: number): number {
    // Toroidal (wrap-around) topology
    return ((y + rows) % rows) * cols + ((x + cols) % cols);
}

function step() {
    for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
            const alive = grid[index(x, y)]! > 0;

            const neighbors =
                (grid[index(x - 1, y - 1)]! > 0 ? 1 : 0) +
                (grid[index(x, y - 1)]! > 0 ? 1 : 0) +
                (grid[index(x + 1, y - 1)]! > 0 ? 1 : 0) +
                (grid[index(x - 1, y)]! > 0 ? 1 : 0) +
                (grid[index(x + 1, y)]! > 0 ? 1 : 0) +
                (grid[index(x - 1, y + 1)]! > 0 ? 1 : 0) +
                (grid[index(x, y + 1)]! > 0 ? 1 : 0) +
                (grid[index(x + 1, y + 1)]! > 0 ? 1 : 0);

            const currentAge = grid[index(x, y)]!;

            if (alive) {
                // Survival: 2 or 3 neighbors
                next[index(x, y)] = neighbors === 2 || neighbors === 3 ? Math.min(currentAge + 1, 255) : 0;
            } else {
                // Birth: exactly 3 neighbors
                next[index(x, y)] = neighbors === 3 ? 1 : 0;
            }
        }
    }

    // Swap buffers
    const temporary = grid;

    grid = next;
    next = temporary;
}

// ─── Paint ───────────────────────────────────────────────────────────────────

let initialized = false;
let lastCols = 0;
let lastRows = 0;
let generation = 0;

function paint(buf: Uint32Array, w: number, h: number, frame: number) {
    // Reinitialize if terminal was resized
    if (!initialized || w !== lastCols || h !== lastRows) {
        initGrid(w, h);
        initialized = true;
        lastCols = w;
        lastRows = h;
        generation = 0;
    }

    // Advance the simulation every frame
    step();
    generation++;

    // Paint cells
    for (let y = 0; y < h - 1; y++) {
        // leave last row for status bar
        for (let x = 0; x < w; x++) {
            const age = grid[y * w + x]!;

            if (age > 0) {
                setCell(buf, w, x, y, ageChar(age), ageColor(age));
            }
            // dead cells stay blank (buf is zero-filled by harness)
        }
    }

    // Status bar
    const alive = grid.reduce((n, v) => n + (v > 0 ? 1 : 0), 0);
    const status = ` Gen ${generation}  Alive ${alive}  ${w}×${h}  Ctrl+C to quit `;

    for (let i = 0; i < Math.min(status.length, w); i++) {
        setCell(buf, w, i, h - 1, status[i]!, 0, 250); // dark bg status bar
    }
}

// ─── Run ─────────────────────────────────────────────────────────────────────

const loop = createLoop(paint, 20); // 20fps — life doesn't need 60

loop.start();
