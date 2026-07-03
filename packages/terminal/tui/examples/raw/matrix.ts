/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion, func-style, no-secrets/no-secrets, no-useless-concat, sonarjs/pseudo-random */

/**
 * matrix.ts — Matrix digital rain
 *
 * Each column has an independent falling drop at a random speed.
 * The drop head is bright white; the trail fades through green shades
 * to black. Characters randomize as the drop passes.
 *
 * Direct Uint32Array buffer painting — no React, no Yoga, no reconciler.
 *
 * Run: node --import @oxc-node/core/register examples/raw/matrix.ts
 *
 * Controls:
 *   Ctrl+C   quit
 */

import { createLoop, setCell } from "./harness";

// ─── Character pool ───────────────────────────────────────────────────────────
// Katakana block + digits + a few Latin letters for that classic look
const CHARS = "アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン" + "0123456789ABCDEFZ";

function randomChar(): string {
    return CHARS[Math.floor(Math.random() * CHARS.length)]!;
}

// ─── Persistent screen buffer with fade ──────────────────────────────────────
// We maintain our own buffer that persists between frames.
// Each cell has an age (0 = just written, increases each frame).
// Cells fade through the palette based on age, then go dark.

interface ScreenCell {
    age: number; // frames since written; 0 = fresh
    char: string;
    isHead: boolean;
}

let screen: ScreenCell[] = [];
let screenCols = 0;
let screenRows = 0;

function initScreen(cols: number, rows: number) {
    screenCols = cols;
    screenRows = rows;
    screen = Array.from({ length: cols * rows }, () => {
        return { age: 999, char: " ", isHead: false };
    });
}

function writeCell(x: number, y: number, char: string, isHead: boolean) {
    if (x < 0 || x >= screenCols || y < 0 || y >= screenRows) {
        return;
    }

    const cell = screen[y * screenCols + x]!;

    cell.char = char;
    cell.age = 0;
    cell.isHead = isHead;
}

// Fade palette indexed by age. The trail lingers for ~2 seconds at 24fps.
// Ages 0-1: bright head, 2-8: green trail, 9-40: slow fade to dark, 41+: blank
const FADE: number[] = [
    231, // 0: white head
    231, // 1: white (head lingers one extra frame)
    154, // 2: bright yellow-green
    46, // 3: bright green
    46, // 4: bright green
    40, // 5: medium green
    40, // 6: medium green
    34, // 7: green
    34, // 8: green
    28, // 9: dark green
    28, // 10: dark green
    22, // 11: very dark green
    22, // 12: very dark green
    22, // 13: very dark green
    238, // 14: near-black
    238, // 15
    238, // 16
    237, // 17
    237, // 18
    237, // 19
    237, // 20
    236, // 21
    236, // 22
    236, // 23
    236, // 24
    235, // 25
    235, // 26
    235, // 27
    235, // 28
    234, // 29
    234, // 30
    234, // 31
    234, // 32
    233, // 33
    233, // 34
    233, // 35
    233, // 36
    232, // 37
    232, // 38
    232, // 39
    232, // 40 — fully dark, next frame goes blank
];
const FADE_OUT = FADE.length; // age >= this → blank (cell disappears)

// ─── Drop state ───────────────────────────────────────────────────────────────

interface Drop {
    head: number;
    speed: number;
    tick: number;
}

let drops: Drop[] = [];
let lastCols = 0;
let lastRows = 0;

function initDrops(cols: number, rows: number) {
    drops = [];

    for (let x = 0; x < cols; x++) {
        drops.push({
            head: -Math.floor(Math.random() * rows) - 1,
            speed: 1 + Math.floor(Math.random() * 4),
            tick: Math.floor(Math.random() * 4),
        });
    }

    lastCols = cols;
    lastRows = rows;
}

function makeDrop(): Drop {
    return {
        head: -1 - Math.floor(Math.random() * 5),
        speed: 1 + Math.floor(Math.random() * 4),
        tick: 0,
    };
}

// ─── Paint ────────────────────────────────────────────────────────────────────

function paint(buf: Uint32Array, cols: number, rows: number, _frame: number) {
    // Init on first frame
    if (drops.length === 0) {
        initDrops(cols, rows);
        initScreen(cols, rows);
    }

    // Handle resize — reinit everything (visual glitch on resize is acceptable)
    if (cols !== lastCols || rows !== lastRows) {
        initDrops(cols, rows);
        initScreen(cols, rows);
    }

    // Age every cell by 1 each frame
    for (const element of screen) {
        element!.age++;
    }

    // Advance drops and write head characters into the screen buffer
    for (let x = 0; x < cols; x++) {
        const drop = drops[x]!;

        drop.tick++;

        if (drop.tick >= drop.speed) {
            drop.tick = 0;
            drop.head++;

            if (drop.head >= 0 && drop.head < rows) {
                writeCell(x, drop.head, randomChar(), true);

                if (drop.head > 0 && Math.random() < 0.3) {
                    writeCell(x, drop.head - 1, randomChar(), false);
                }
            }

            if (drop.head >= rows) {
                drops[x] = makeDrop();
            }
        }
    }

    // Render screen buffer → Uint32Array
    // Note: harness zero-fills buf each frame, which is fine —
    // we repaint every cell that has any age < FADE_OUT
    for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
            const cell = screen[y * cols + x]!;

            if (cell.age >= FADE_OUT) {
                continue;
            } // fully faded — leave blank

            const color = FADE[cell.age]!;
            const bold = cell.age === 0 ? 1 : 0;

            setCell(buf, cols, x, y, cell.char, color, 0, bold);
        }
    }
}

// ─── Run ─────────────────────────────────────────────────────────────────────

const loop = createLoop(paint, 24); // 24fps — rain doesn't need 60

loop.start();
