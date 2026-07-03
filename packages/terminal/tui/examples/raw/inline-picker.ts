/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion */

/**
 * inline-picker.ts — Inline mode demo
 *
 * A file picker that renders inline (no alternate screen).
 * The selected file is printed to stdout after exit and stays
 * in the terminal scrollback.
 *
 * Run: node --import @oxc-node/core/register examples/raw/inline-picker.ts
 *
 * Controls:
 *   ↑ / ↓   navigate
 *   Enter    select and exit
 *   Ctrl+C   cancel
 */

import { createInlineLoop } from "@visulima/tui/core";

import { setCell } from "./harness";

const ITEMS = [
    "src/app.ts",
    "src/hooks.ts",
    "src/input.ts",
    "src/layout.ts",
    "src/reconciler.ts",
    "src/renderer.ts",
    "src/styles.ts",
    "src/terminal.rs",
    "src/inline.ts",
];

let selected = 0;
let done = false;
let result: string | null = null;

const BORDER_FG = 238;
const SELECTED_BG = 19; // dark blue
const SELECTED_FG = 231; // white
const NORMAL_FG = 250; // light grey
const HEADER_FG = 51; // cyan
const HINT_FG = 238;

const ROWS = ITEMS.length + 4; // 2 border + 1 header + 1 hint

const loop = createInlineLoop(
    (buf, cols, rows, frame) => {
        const listRows = rows - 4;
        const visibleItems = ITEMS.slice(0, listRows);

        // Top border
        const top = `┌${"─".repeat(cols - 2)}┐`;

        for (let i = 0; i < Math.min(top.length, cols); i++) {
            setCell(buf, cols, i, 0, top[i]!, BORDER_FG);
        }

        // Header
        const header = "│  pick a file";

        for (let i = 0; i < Math.min(header.length, cols - 1); i++) {
            setCell(buf, cols, i, 1, header[i]!, HEADER_FG, 0, 1);
        }

        setCell(buf, cols, cols - 1, 1, "│", BORDER_FG);

        // Divider
        const div = `├${"─".repeat(cols - 2)}┤`;

        for (let i = 0; i < Math.min(div.length, cols); i++) {
            setCell(buf, cols, i, 2, div[i]!, BORDER_FG);
        }

        // Items
        for (const [i, visibleItem] of visibleItems.entries()) {
            const item = visibleItem!;
            const isSelected = i === selected;
            const prefix = isSelected ? "  › " : "    ";
            const label = prefix + item;
            const fg = isSelected ? SELECTED_FG : NORMAL_FG;
            const bg = isSelected ? SELECTED_BG : 0;

            setCell(buf, cols, 0, 3 + i, "│", BORDER_FG);

            for (let j = 1; j < cols - 1; j++) {
                const ch = label[j - 1] ?? " ";

                setCell(buf, cols, j, 3 + i, ch, fg, bg);
            }

            setCell(buf, cols, cols - 1, 3 + i, "│", BORDER_FG);
        }

        // Bottom border + hint
        const lastRow = rows - 1;
        const hint = `│  ↑↓ navigate   enter select   ctrl+c cancel  [frame ${frame}]`;

        for (let i = 0; i < Math.min(hint.length, cols - 1); i++) {
            setCell(buf, cols, i, lastRow, hint[i]!, HINT_FG);
        }

        setCell(buf, cols, cols - 1, lastRow, "│", BORDER_FG);
    },
    { fps: 30, onExit: "destroy", rows: ROWS },
);

// Input handling
process.stdin.on("data", (key: string) => {
    if (done) {
        return;
    }

    switch (key) {
        case "\r":
        case "\n": {
            // Enter — select and exit
            done = true;
            result = ITEMS[selected]!;
            loop.stop();

            break;
        }
        case "\u0003": {
            // Ctrl+C
            done = true;
            loop.stop();

            break;
        }
        case "\u001B[A":
        case "k": {
            // Up
            selected = Math.max(0, selected - 1);

            break;
        }
        case "\u001B[B":
        case "j": {
            // Down
            selected = Math.min(ITEMS.length - 1, selected + 1);

            break;
        }
        // No default
    }
});

loop.start();

// After loop.stop() calls process.exit(0), this runs first via exit handler
process.on("exit", () => {
    if (result) {
        process.stdout.write(`\nSelected: ${result}\n`);
    }
});
