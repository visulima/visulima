/**
 * stress-test.tsx — Ink stress test
 *
 * Renders a full-terminal color-cycling grid as fast as possible using
 * standard React components — one <Text> per row, color cycling per cell.
 *
 * This is the Ink equivalent of ratatat's stress-test.tsx. The grid is
 * rendered entirely through React reconciliation (no buffer bypass) so the
 * comparison is fair: same work, different renderers.
 *
 * Run: node --import @oxc-node/core/register examples/stress-test/stress-test.tsx
 *   or: npx tsx examples/stress-test/stress-test.tsx
 */
import React, { useState, useEffect, useCallback, useRef } from "react";
import { render, Box, Text, useWindowSize, useApp } from "@visulima/tui/react";

// ─── FPS counter ──────────────────────────────────────────────────────────────

function useFps() {
    const [fps, setFps] = useState(0);
    const frames = useRef(0);
    const last = useRef(Date.now());
    const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const tick = useCallback(() => {
        if (idleTimer.current) clearTimeout(idleTimer.current);
        idleTimer.current = setTimeout(() => {
            setFps(0);
            frames.current = 0;
            last.current = Date.now();
        }, 2000);

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

// ANSI named colors — matches ratatat's ANSI_INDICES [1,2,3,4,5,6,7]
const COLORS = ["red", "green", "yellow", "blue", "magenta", "cyan", "white"] as const;
const CHARS = "█▓▒░▪▫●○◆◇";
const CHAR_LIST = Array.from(CHARS);

// ─── Stats bar ────────────────────────────────────────────────────────────────

const HEADER_ROWS = 4; // border(1) + content(1) + border(1) + marginBottom(1)

function StatsBar({ fps, frame, cols, rows }: { fps: number; frame: number; cols: number; rows: number }) {
    const gridRows = Math.max(1, rows - HEADER_ROWS);
    return (
        <Box borderStyle="round" borderColor="cyan" paddingX={2} marginBottom={1} flexShrink={0}>
            <Text bold color="cyan">
                Ink stress test{"  "}
            </Text>
            <Text>
                {String(fps || "--").padStart(3)} updates/sec{"  "}
                Frame: <Text color="white">{String(frame).padStart(7)}</Text>
                {"  "}
                Terminal:{" "}
                <Text color="white">
                    {cols}×{rows}
                </Text>
                {"  "}
                Cells/frame: <Text color="white">{(cols * gridRows).toLocaleString()}</Text>
                {"  "}
                <Text dimColor>Ctrl+C to exit</Text>
            </Text>
        </Box>
    );
}

// ─── Grid row ─────────────────────────────────────────────────────────────────

// One row of the grid — each character is its own <Text> with a color.
// This is intentionally the most React-work-per-frame approach: every cell
// is a separate fiber node, forcing full reconciliation on every render.
function GridRow({ y, cols, frame }: { y: number; cols: number; frame: number }) {
    const cells: React.ReactElement[] = [];
    for (let x = 0; x < cols; x++) {
        const colorIdx = (x + y + frame) % COLORS.length;
        const charIdx = (x * 3 + y * 7 + frame) % CHAR_LIST.length;
        cells.push(
            <Text key={x} color={COLORS[colorIdx]}>
                {CHAR_LIST[charIdx]}
            </Text>,
        );
    }
    return <Box>{cells}</Box>;
}

// ─── App ──────────────────────────────────────────────────────────────────────

function StressTest() {
    const { columns, rows } = useWindowSize();
    const { fps, tick } = useFps();
    const [frame, setFrame] = useState(0);
    const { exit } = useApp();

    useEffect(() => {
        let running = true;
        let handle: ReturnType<typeof setTimeout>;

        let loopFrame = 0;
        function loop() {
            if (!running) return;
            loopFrame++;
            setFrame((f) => {
                tick();
                return f + 1;
            });
            if (loopFrame % 10000 === 0) {
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

    const gridRows = Math.max(1, rows - HEADER_ROWS);

    return (
        <Box flexDirection="column" width={columns} height={rows}>
            <StatsBar fps={fps} frame={frame} cols={columns} rows={rows} />
            <Box flexDirection="column" flexGrow={1}>
                {Array.from({ length: gridRows }, (_, y) => (
                    <GridRow key={y} y={y} cols={columns} frame={frame} />
                ))}
            </Box>
        </Box>
    );
}

render(<StressTest />);
