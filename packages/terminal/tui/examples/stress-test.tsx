/* eslint-disable func-style, no-empty, no-param-reassign, no-secrets/no-secrets, no-underscore-dangle */

/**
 * stress-test.tsx — Ratatat stress test
 *
 * Renders a full-terminal color-cycling grid as fast as possible.
 * The stats bar uses React components normally.
 * The grid writes directly to the Uint32Array buffer, bypassing React
 * reconciliation for individual cells — this is the correct pattern for
 * high-frequency full-screen updates where React's per-node overhead
 * would otherwise accumulate fiber work objects faster than GC can collect.
 *
 * Run: node --import @oxc-node/core/register examples/stress-test.tsx
 *
 * Controls:
 *   q / Esc / Ctrl+C   quit
 */
// @ts-nocheck
import { Box } from "@visulima/tui/components/box";
import { Text } from "@visulima/tui/components/text";
import { render, useApp, useInput, useWindowSize } from "@visulima/tui/react";
import React, { useCallback, useEffect, useRef, useState } from "react";

// ─── FPS counter ─────────────────────────────────────────────────────────────

function useFps() {
    const [fps, setFps] = useState(0);
    const frames = useRef(0);
    const last = useRef(Date.now());

    const tick = useCallback(() => {
        frames.current++;
        const now = Date.now();
        const elapsed = now - last.current;

        if (elapsed >= 500) {
            setFps(Math.round((frames.current / elapsed) * 1000));
            frames.current = 0;
            last.current = now;
        }
    }, []);

    return { fps, tick };
}

// ─── Color cycling helpers ────────────────────────────────────────────────────

// ANSI color indices — standard terminal palette positions, hardcoded.
// red=1, green=2, yellow=3, blue=4, magenta=5, cyan=6, white=7
const ANSI_INDICES = [1, 2, 3, 4, 5, 6, 7];

const CHARS = "█▓▒░▪▫●○◆◇";
const CHAR_CODES = Array.from(CHARS, (c) => c.codePointAt(0)!);

// ─── Direct buffer painter ────────────────────────────────────────────────────
// Writes grid cells directly to the Uint32Array back-buffer, bypassing React.
// This avoids React allocating fiber update objects for each of the ~4000+
// grid cells on every frame, which accumulates native memory faster than GC.

function paintGrid(buffer: Uint32Array, cols: number, rows: number, headerRows: number, frame: number) {
    for (let y = headerRows; y < rows; y++) {
        const gridY = y - headerRows;

        for (let x = 0; x < cols; x++) {
            const index = (y * cols + x) * 2;
            const fgIndex = (x + gridY + frame) % ANSI_INDICES.length;
            const charIndex = (x * 3 + gridY * 7 + frame) % CHAR_CODES.length;
            const fg = ANSI_INDICES[fgIndex];

            // attr = (styles<<16) | (bg<<8) | fg  — bg=255 (terminal default)
            buffer[index] = CHAR_CODES[charIndex];
            buffer[index + 1] = (0 << 16) | (255 << 8) | fg;
        }
    }
}

// ─── Stats bar ────────────────────────────────────────────────────────────────

// StatsBar is: 1 (top border) + 1 (content) + 1 (bottom border) + 1 (marginBottom) = 4 rows
const HEADER_ROWS = 4;

const StatsBar = ({ cols, fps, frame, rows }: { cols: number; fps: number; frame: number; rows: number }) => {
    const gridRows = Math.max(1, rows - HEADER_ROWS);
    const gridCols = Math.max(1, cols);

    return (
        <Box borderColor="cyan" borderStyle="round" flexShrink={0} marginBottom={1} paddingX={2}>
            <Text bold color="cyan">
                Ratatat stress test
                {"  "}
            </Text>
            <Text>
                {String(fps).padStart(3)}
{" "}
updates/sec
{"  "}
                Frame:
{" "}
<Text color="white">{String(frame).padStart(7)}</Text>
                {"  "}
                Terminal:
{" "}
                <Text color="white">
                    {cols}
×
{rows}
                </Text>
                {"  "}
                Cells/frame:
{" "}
<Text color="white">{(gridCols * gridRows).toLocaleString()}</Text>
                {"  "}
                <Text dim>q / Esc / Ctrl+C to exit</Text>
            </Text>
        </Box>
    );
};

// ─── App ──────────────────────────────────────────────────────────────────────

const StressTest = () => {
    const { columns, rows } = useWindowSize();
    const { fps, tick } = useFps();
    const [frame, setFrame] = useState(0);
    const { exit } = useApp();

    useInput((input, key) => {
        if (input.toLowerCase() === "q" || key.escape) {
            exit();
        }
    });

    useEffect(() => {
        let running = true;
        let handle: ReturnType<typeof setTimeout>;

        let loopFrame = 0;

        function loop() {
            if (!running) {
                return;
            }

            loopFrame++;
            setFrame((f) => {
                tick();

                return f + 1;
            });

            // Prevent MaxPerformanceEntryBufferExceededWarning
            if (loopFrame % 10_000 === 0) {
                try {
                    performance.clearMeasures();
                    performance.clearMarks();
                } catch {}
            }

            handle = setTimeout(loop, 0);
        }

        loop();

        return () => {
            running = false;
            clearTimeout(handle);
        };
    }, [tick]);

    // Paint the grid directly into the buffer on every frame.
    // We get the buffer via the Ratatat render context by using a side-channel:
    // render() exposes the app, and the app exposes getBuffer().
    useEffect(() => {
        const app = (globalThis as any).__ratatatApp;

        if (!app) {
            return;
        }

        const unsub = app.onBeforeFlush((buffer: Uint32Array, w: number, h: number) => {
            paintGrid(buffer, w, h, HEADER_ROWS, (globalThis as any).__ratatatFrame ?? 0);
        });

        return unsub;
    }, []);

    // Keep a global frame ref so the render listener can access latest frame
    useEffect(() => {
        (globalThis as any).__ratatatFrame = frame;
    });

    return (
        <Box flexDirection="column" height={rows} width={columns}>
            <StatsBar cols={columns} fps={fps} frame={frame} rows={rows} />
            {/* Grid rows are NOT rendered as React components — painted directly to buffer above */}
        </Box>
    );
};

// Expose app globally so the StressTest component can hook into it
const { app } = render(<StressTest />);

(globalThis as any).__ratatatApp = app;
