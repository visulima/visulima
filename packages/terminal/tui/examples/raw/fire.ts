/* eslint-disable func-style, jsdoc/lines-before-block, sonarjs/pseudo-random */
/**
 * fire.ts — Doom-style plasma fire effect
 *
 * Classic demoscene fire algorithm:
 *   1. Seed the bottom row with max heat
 *   2. Each frame, propagate heat upward with random decay + spread
 *   3. Map heat value → 256-color palette
 *
 * Direct Uint32Array buffer painting — no React, no Yoga, no reconciler.
 *
 * Run: node --import @oxc-node/core/register examples/raw/fire.ts
 *
 * Controls:
 *   Ctrl+C   quit
 */

import { createLoop, setCell } from "./harness";

// ─── Fire palette — black → deep red → orange → yellow → white ───────────────
// 256 entries mapping heat intensity (0-255) to a 256-color terminal index.
const PALETTE: number[] = Array.from({ length: 256 }).fill(0);

function buildPalette() {
    // 0       → color 232 (near-black)
    // 0-85    → black to deep red
    // 85-170  → deep red to orange/yellow
    // 170-255 → yellow to white
    for (let i = 0; i < 256; i++) {
        if (i < 32) {
            PALETTE[i] = 232 + Math.floor((i / 32) * 4); // near-black ramp (232-235)
        } else if (i < 96) {
            PALETTE[i] = 196 + Math.floor(((i - 32) / 64) * 6); // red ramp (196-202)
        } else if (i < 160) {
            PALETTE[i] = 202 + Math.floor(((i - 96) / 64) * 8); // orange ramp (202-210)
        } else if (i < 224) {
            PALETTE[i] = 226 + Math.floor(((i - 160) / 64) * 5); // yellow ramp (226-231)
        } else {
            PALETTE[i] = 231; // white-hot
        }
    }
}

buildPalette();

// Fire characters — sparse at low heat, dense/solid at high heat
function heatChar(heat: number): string {
    if (heat < 20) {
        return " ";
    }

    if (heat < 60) {
        return "·";
    }

    if (heat < 100) {
        return "░";
    }

    if (heat < 150) {
        return "▒";
    }

    if (heat < 200) {
        return "▓";
    }

    return "█";
}

// ─── Fire state ──────────────────────────────────────────────────────────────

let fireW = 0;
let fireH = 0;
let fire: Uint8Array; // heat values, 0-255

function initFire(w: number, h: number) {
    fireW = w;
    fireH = h;
    fire = new Uint8Array(w * h);

    // Seed bottom row with full heat
    for (let x = 0; x < w; x++) {
        fire[(h - 1) * w + x] = 255;
    }
}

function stepFire() {
    // Propagate fire upward. Each cell receives heat from the cell below,
    // minus a small random decay, shifted left or right by 0-1 cells.
    for (let y = 0; y < fireH - 1; y++) {
        for (let x = 0; x < fireW; x++) {
            const below = fire[(y + 1) * fireW + x]!;
            const decay = Math.random() < 0.4 ? 1 : 0;
            const spread = Math.floor(Math.random() * 3) - 1; // -1, 0, or +1
            const tx = Math.max(0, Math.min(fireW - 1, x + spread));

            fire[y * fireW + tx] = Math.max(0, below - decay);
        }
    }

    // Re-seed bottom row — flickering source
    for (let x = 0; x < fireW; x++) {
        const current = fire[(fireH - 1) * fireW + x]!;
        const flicker = Math.random() < 0.05 ? -20 : 0;

        fire[(fireH - 1) * fireW + x] = Math.max(200, Math.min(255, current + flicker));
    }
}

// ─── Paint ───────────────────────────────────────────────────────────────────

let initialized = false;
let lastW = 0;
let lastH = 0;

function paint(buf: Uint32Array, w: number, h: number, _frame: number) {
    if (!initialized || w !== lastW || h !== lastH) {
        initFire(w, h);
        initialized = true;
        lastW = w;
        lastH = h;
    }

    stepFire();

    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const heat = fire[y * w + x]!;

            if (heat === 0) {
                continue;
            } // cold cells stay blank

            const fg = PALETTE[heat]!;

            setCell(buf, w, x, y, heatChar(heat), fg, 0);
        }
    }
}

// ─── Run ─────────────────────────────────────────────────────────────────────

const loop = createLoop(paint, 30); // 30fps looks great for fire

loop.start();
