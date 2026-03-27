/**
 * logo.tsx — Ratatat logo demo
 *
 * Renders the Ratatui logo glyphs with an animated color sweep across
 * the cells, demonstrating direct buffer painting alongside a React shell.
 *
 * Run:
 *   node --import @oxc-node/core/register examples/logo.tsx                    # 6s sweep, loop
 *   node --import @oxc-node/core/register examples/logo.tsx --once             # one sweep, exit
 *   node --import @oxc-node/core/register examples/logo.tsx --speed 3          # 3s sweep
 *   node --import @oxc-node/core/register examples/logo.tsx --speed 3 --once   # 3s, one pass
 */
// @ts-nocheck
import React, { useEffect, useRef } from "react";
import { render, Box, Text, useApp, useInput, useWindowSize } from "@visulima/tui/react";

// ─── Args ─────────────────────────────────────────────────────────────────────

const ONCE = process.argv.includes("--once");
const speedIdx = process.argv.indexOf("--speed");
const SWEEP_SECONDS = speedIdx !== -1 ? parseFloat(process.argv[speedIdx + 1]) || 6 : 6;

// ─── Logo strings (from ratatui/ratatui-widgets/src/logo.rs) ─────────────────

const LOGO_SMALL = ["█▀▀▄ ▄▀▀▄ ▝▜▛▘ ▄▀▀▄ ▝▜▛▘ ▄▀▀▄ ▝▜▛▘", "█▀▀▄ █▀▀█  ▐▌  █▀▀█  ▐▌  █▀▀█  ▐▌ "];

const SCALE = 4;

function scaleLogo(lines: string[], scale: number): string[] {
    const scaled: string[] = [];
    for (const line of lines) {
        const chars = [...line];
        const row = chars.map((c) => c.repeat(scale)).join("");
        for (let r = 0; r < scale; r++) scaled.push(row);
    }
    return scaled;
}

const LOGO_LINES = scaleLogo(LOGO_SMALL, SCALE);
const LOGO_HEIGHT = LOGO_LINES.length; // 8
const LOGO_WIDTH = [...LOGO_LINES[0]].length; // 108

const LOGO_CELLS: number[][] = LOGO_LINES.map((line) => [...line].map((c) => c.codePointAt(0)!));

// ─── Color palette — cyan → blue → magenta sweep ─────────────────────────────

const PALETTE = [51, 45, 39, 33, 27, 21, 57, 93, 129, 165, 201, 165, 129, 93, 57, 27];

// 3 seconds across LOGO_WIDTH columns
const MS_PER_FRAME = Math.round((SWEEP_SECONDS * 1000) / LOGO_WIDTH);
const ONE_LOOP_FRAMES = LOGO_WIDTH + PALETTE.length; // full sweep + tail

// ─── Buffer painter ───────────────────────────────────────────────────────────

function paintLogo(buffer: Uint32Array, cols: number, rows: number, logoRow: number, logoCol: number, frame: number) {
    for (let y = 0; y < LOGO_HEIGHT; y++) {
        const termY = logoRow + y;
        if (termY < 0 || termY >= rows) continue;
        const cells = LOGO_CELLS[y];
        for (let x = 0; x < cells.length; x++) {
            const termX = logoCol + x;
            if (termX < 0 || termX >= cols) continue;
            const cp = cells[x];
            if (cp === 32) continue;
            const idx = (termY * cols + termX) * 2;
            const paletteIdx = (x + frame) % PALETTE.length;
            buffer[idx] = cp;
            buffer[idx + 1] = (0 << 16) | (255 << 8) | PALETTE[paletteIdx];
        }
    }
}

// ─── App ──────────────────────────────────────────────────────────────────────

function LogoApp() {
    const { columns, rows } = useWindowSize();
    const { exit } = useApp();

    // Use a ref for frame — paint callback reads it directly, no stale closure
    const frameRef = useRef(0);
    const exitRef = useRef(exit);
    exitRef.current = exit;

    const logoRow = Math.max(0, Math.floor((rows - LOGO_HEIGHT - 6) / 2));
    const logoCol = Math.max(0, Math.floor((columns - LOGO_WIDTH) / 2));
    const logoRowRef = useRef(logoRow);
    const logoColRef = useRef(logoCol);
    logoRowRef.current = logoRow;
    logoColRef.current = logoCol;

    useInput((input, key) => {
        if (input === "q" || (key.ctrl && input === "c") || key.escape || key.return) exit();
    });

    // Animation loop — runs once, advances frameRef, triggers re-render via forceUpdate
    const forceUpdate = useRef<() => void>(null);
    const [, setTick] = React.useState(0);
    forceUpdate.current = () => setTick((t) => t + 1);

    useEffect(() => {
        let handle: ReturnType<typeof setTimeout>;

        function loop() {
            frameRef.current++;
            forceUpdate.current?.();
            if (ONCE && frameRef.current >= ONE_LOOP_FRAMES) {
                setTimeout(() => exitRef.current(), 100);
                return;
            }
            handle = setTimeout(loop, MS_PER_FRAME);
        }
        handle = setTimeout(loop, MS_PER_FRAME);
        return () => clearTimeout(handle);
    }, []); // runs exactly once

    // Paint listener — registered once, reads frameRef/logoRowRef directly
    useEffect(() => {
        const app = (globalThis as any).__ratatatApp;
        if (!app) return;
        const unsub = app.onBeforeFlush((buffer: Uint32Array, w: number, h: number) => {
            paintLogo(buffer, w, h, logoRowRef.current, logoColRef.current, frameRef.current);
        });
        return unsub;
    }, []); // runs exactly once

    const subtitleRow = logoRow + LOGO_HEIGHT + 1;

    return (
        <Box flexDirection="column" width={columns} height={rows}>
            <Box height={subtitleRow} flexShrink={0} />
            <Box justifyContent="center">
                <Text bold color="cyan">
                    Ratatat
                </Text>
                <Text color="white"> — Ratatui + Ink. React for the terminal.</Text>
            </Box>
            <Box height={1} flexShrink={0} />
            <Box justifyContent="center">
                <Text dim>{ONCE ? "recording…" : "q · enter · esc to exit"}</Text>
            </Box>
        </Box>
    );
}

const { app } = render(<LogoApp />);
(globalThis as any).__ratatatApp = app;
