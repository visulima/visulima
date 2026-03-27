/**
 * sierpinski.tsx — React Fiber stress test, ported to the terminal
 *
 * The classic React Fiber demo: a Sierpinski triangle that pulses in size
 * while a counter increments every second across all 243 leaf nodes.
 * Originally used by the React team to demonstrate Fiber's scheduler.
 *
 * Adapted for ratatat:
 *   - CSS absolute positioning → Yoga flexbox
 *   - Mouse hover → keyboard focus (Tab to cycle)
 *   - CSS scale transform → dynamic `width` prop on root Box
 *   - Artificial slowdown loop removed (not meaningful in a TUI render loop)
 *
 * Node count at depth 5: 3^5 = 243 leaf Dot components
 * Each frame: root width changes → all 243 Dots re-render
 * Each second: counter text changes in all 243 Dots
 *
 * Run: node --import @oxc-node/core/register examples/sierpinski.tsx
 */
// @ts-nocheck
import React, { useState, useEffect, useRef, useCallback, memo } from "react";
import { render, Box, Text, useInput, useApp, useWindowSize, useFocus, useFocusManager } from "@visulima/tui/react";

// React internals call performance.measure() on every reconcile.
// At 300fps this fills Node's default 1M entry buffer in ~3 seconds.
// Drain entries immediately via a PerformanceObserver so they never accumulate.
try {
    const obs = new PerformanceObserver((list) => {
        list.getEntries();
    });
    obs.observe({ entryTypes: ["measure", "mark"] });
} catch {}
performance.clearMeasures();
performance.clearMarks();

// ─── Constants ────────────────────────────────────────────────────────────────

const DEPTH = 5; // 3^5 = 243 leaf nodes
const MIN_DOT_WIDTH = 3; // chars per dot cell
const PULSE_PERIOD = 4000; // ms for one full pulse cycle

// At depth N the bottom row is 2^N dots wide.
// Minimum container width = 2^DEPTH × MIN_DOT_WIDTH
const MIN_TRIANGLE_WIDTH = Math.pow(2, DEPTH) * MIN_DOT_WIDTH; // 96 cols

// ─── FPS counter ──────────────────────────────────────────────────────────────

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

// ─── Dot ──────────────────────────────────────────────────────────────────────
// A leaf node. Displays the current counter value.
// Highlights when focused.

let dotId = 0;
function nextId() {
    return String(++dotId);
}

const Dot = memo(function Dot({ id, text }: { id: string; text: string }) {
    const { isFocused } = useFocus({ id });
    return (
        <Box width={MIN_DOT_WIDTH} height={1} justifyContent="center" alignItems="center" flexShrink={0}>
            <Text color={isFocused ? "black" : "cyan"} backgroundColor={isFocused ? "cyan" : undefined} bold={isFocused}>
                {text.padStart(MIN_DOT_WIDTH - 1).slice(0, MIN_DOT_WIDTH)}
            </Text>
        </Box>
    );
});

// ─── SierpinskiTriangle ───────────────────────────────────────────────────────
// Recursive fractal. At depth 0 renders a Dot.
// At each level renders 3 children arranged as a triangle:
//   top center
//   bottom-left + bottom-right (side by side)

interface TriangleProps {
    depth: number;
    text: string;
    ids: string[];
    idIndex: { current: number };
}

function SierpinskiTriangle({ depth, text, ids, idIndex }: TriangleProps) {
    if (depth === 0) {
        const id = ids[idIndex.current++] ?? String(idIndex.current);
        return <Dot id={id} text={text} />;
    }

    return (
        <Box flexDirection="column" alignItems="center" flexShrink={0}>
            {/* top point */}
            <SierpinskiTriangle depth={depth - 1} text={text} ids={ids} idIndex={idIndex} />
            {/* bottom row */}
            <Box flexDirection="row" flexShrink={0}>
                <SierpinskiTriangle depth={depth - 1} text={text} ids={ids} idIndex={idIndex} />
                <SierpinskiTriangle depth={depth - 1} text={text} ids={ids} idIndex={idIndex} />
            </Box>
        </Box>
    );
}

// ─── Generate stable IDs once ─────────────────────────────────────────────────
// IDs are fixed across renders — only text changes.

function makeIds(depth: number): string[] {
    const count = Math.pow(3, depth);
    return Array.from({ length: count }, (_, i) => `dot-${i}`);
}

const IDS = makeIds(DEPTH);
const DOT_COUNT = IDS.length;

// ─── Stats bar ────────────────────────────────────────────────────────────────

function StatsBar({
    fps,
    frame,
    counter,
    cols,
    rows,
    pulseWidth,
}: {
    fps: number;
    frame: number;
    counter: number;
    cols: number;
    rows: number;
    pulseWidth: number;
}) {
    return (
        <Box borderStyle="round" borderColor="cyan" paddingX={2} flexShrink={0}>
            <Text bold color="cyan">
                Sierpinski{" "}
            </Text>
            <Text>
                {String(fps).padStart(3)} fps{"  "}
                frame: <Text color="white">{String(frame).padStart(6)}</Text>
                {"  "}
                counter: <Text color="yellow">{counter}</Text>
                {"  "}
                nodes: <Text color="white">{DOT_COUNT}</Text>
                {"  "}
                width: <Text color="white">{pulseWidth}</Text>
                {"  "}
                <Text dim>Tab · Ctrl+C</Text>
            </Text>
        </Box>
    );
}

// ─── App ──────────────────────────────────────────────────────────────────────

function SierpinskiApp() {
    const { columns, rows } = useWindowSize();
    const { fps, tick } = useFps();
    const { exit } = useApp();
    const { focusNext, focusPrevious } = useFocusManager();

    // Pulse: frame drives a sine wave that oscillates the root triangle width
    const [frame, setFrame] = useState(0);
    const startTime = useRef(Date.now());

    // Counter increments every second (shown in all dots)
    const [counter, setCounter] = useState(1);

    // Keyboard: Tab / Shift+Tab for focus, q/Ctrl+C to exit
    useInput((input, key) => {
        if (key.tab) {
            if (key.shift) focusPrevious();
            else focusNext();
        }
        if (input === "q" || (key.ctrl && input === "c")) exit();
    });

    // Animation loop — drives pulse
    useEffect(() => {
        let running = true;
        let handle: ReturnType<typeof setTimeout>;
        let loopFrame = 0;

        function loop() {
            if (!running) return;
            loopFrame++;
            // Belt-and-suspenders: also clear periodically in case the observer misses anything
            if (loopFrame % 500 === 0) {
                try {
                    performance.clearMeasures();
                    performance.clearMarks();
                } catch {}
            }
            setFrame((f) => {
                tick();
                return f + 1;
            });
            handle = setTimeout(loop, 0);
        }
        loop();
        return () => {
            running = false;
            clearTimeout(handle);
        };
    }, [tick]);

    // Counter: increment every second
    useEffect(() => {
        const id = setInterval(() => {
            setCounter((c) => (c % 10) + 1);
        }, 1000);
        return () => clearInterval(id);
    }, []);

    // Pulse width: sine wave, clamped so triangle never clips
    // Range: MIN_TRIANGLE_WIDTH → columns (never narrower than the triangle needs)
    const elapsed = Date.now() - startTime.current;
    const t = (elapsed % PULSE_PERIOD) / PULSE_PERIOD;
    const sine = (Math.sin(t * Math.PI * 2) + 1) / 2; // 0→1
    const minW = Math.min(MIN_TRIANGLE_WIDTH, columns);
    const pulseWidth = Math.round(minW + sine * (columns - minW));

    // idIndex is a mutable ref reset each render so IDs are assigned
    // in the same order every render
    const idIndex = useRef(0);
    idIndex.current = 0;

    const text = String(counter);

    return (
        <Box flexDirection="column" width={columns} height={rows}>
            <StatsBar fps={fps} frame={frame} counter={counter} cols={columns} rows={rows} pulseWidth={pulseWidth} />
            <Box flexDirection="column" alignItems="center" justifyContent="center" flexGrow={1} width={pulseWidth}>
                <SierpinskiTriangle depth={DEPTH} text={text} ids={IDS} idIndex={idIndex} />
            </Box>
        </Box>
    );
}

render(<SierpinskiApp />);
