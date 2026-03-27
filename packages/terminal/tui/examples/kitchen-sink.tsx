/**
 * kitchen-sink.tsx — Ratatat interactive kitchen sink
 *
 * Navigate sections with ← → arrow keys. Each section fills the viewport.
 * Sections: Layout · Focus · Graph · Live · Incremental · UI · Static · Mouse
 *   UI sub-sections (↑↓ in sidebar): Borders · Colors · Text · Backgrounds · Primitives
 *
 * The Graph section renders an animated bar chart directly to the Uint32Array
 * buffer (bypassing React reconciliation for individual bars) — same technique
 * as the stress test.
 *
 * Controls:
 *   ← →     navigate sections
 *   Tab      cycle focus (Focus section)
 *   Ctrl+C   quit
 *
 * Run: node --import @oxc-node/core/register examples/kitchen-sink.tsx
 */
// @ts-nocheck
import React, { useState, useEffect, useRef } from "react";
import {
    render,
    Box,
    Text,
    Spinner,
    ProgressBar,
    Newline,
    Spacer,
    useApp,
    useWindowSize,
    useInput,
    useFocus,
    useFocusManager,
    useMouse,
    useTextInput,
    useScrollable,
    DevTools,
    Static,
} from "@visulima/tui/react";

// ─── Section list ─────────────────────────────────────────────────────────────

const SECTIONS = ["Layout", "Focus", "Graph", "Live", "Incremental", "UI", "Static", "Mouse"] as const;
type SectionName = (typeof SECTIONS)[number];

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeading({ title }: { title: string }) {
    return (
        <Box marginBottom={1}>
            <Text bold color="cyan">
                ━━ {title}{" "}
            </Text>
            <Text dim>{"━".repeat(Math.max(0, 40 - title.length - 4))}</Text>
        </Box>
    );
}

// ─── Borders ──────────────────────────────────────────────────────────────────

function BordersSubsection() {
    const styles = ["single", "double", "round", "bold", "singleDouble", "doubleSingle", "classic"] as const;
    return (
        <Box flexDirection="column">
            <SectionHeading title="Borders" />
            <Box flexDirection="row" gap={1} flexWrap="wrap" marginBottom={2}>
                {styles.map((s) => (
                    <Box key={s} borderStyle={s} paddingX={2} paddingY={1}>
                        <Text color="white">{s}</Text>
                    </Box>
                ))}
            </Box>
            <Box flexDirection="row" gap={2}>
                <Box borderStyle="round" borderColor="cyan" paddingX={2} paddingY={1}>
                    <Text color="cyan">borderColor</Text>
                </Box>
                <Box borderStyle="bold" borderColor="yellow" paddingX={2} paddingY={1}>
                    <Text color="yellow">bold + yellow</Text>
                </Box>
                <Box borderStyle="double" borderColor="magenta" paddingX={2} paddingY={1}>
                    <Text color="magenta">double + magenta</Text>
                </Box>
            </Box>
        </Box>
    );
}

// ─── Colors ───────────────────────────────────────────────────────────────────

function ColorsSubsection() {
    const named = ["red", "green", "yellow", "blue", "magenta", "cyan", "white", "gray"];
    const hexes = ["#ff6b6b", "#ffd93d", "#6bcb77", "#4d96ff", "#c77dff", "#ff9f43", "#f8961e", "#90e0ef"];
    return (
        <Box flexDirection="column">
            <SectionHeading title="Colors" />
            <Box flexDirection="column" gap={1}>
                <Box flexDirection="column">
                    <Text dim>Named colors</Text>
                    <Box flexDirection="row" gap={1}>
                        {named.map((c) => (
                            <Box key={c} backgroundColor={c} paddingX={1}>
                                <Text color={c === "white" || c === "yellow" ? "black" : "white"}>{c}</Text>
                            </Box>
                        ))}
                    </Box>
                </Box>
                <Box flexDirection="column">
                    <Text dim>Hex colors</Text>
                    <Box flexDirection="row" gap={1}>
                        {hexes.map((h) => (
                            <Box key={h} backgroundColor={h} paddingX={1}>
                                <Text color="black">{h}</Text>
                            </Box>
                        ))}
                    </Box>
                </Box>
                <Box flexDirection="column">
                    <Text dim>RGB colors</Text>
                    <Box flexDirection="row" gap={1}>
                        {[
                            ["rgb(255,100,100)", "R"],
                            ["rgb(100,255,100)", "G"],
                            ["rgb(100,100,255)", "B"],
                            ["rgb(255,200,0)", "Y"],
                            ["rgb(200,100,255)", "P"],
                            ["rgb(0,200,200)", "C"],
                        ].map(([c, label]) => (
                            <Box key={c} backgroundColor={c} paddingX={2} paddingY={1}>
                                <Text color="black" bold>
                                    {label}
                                </Text>
                                <Newline />
                                <Text color="black" dim>
                                    {c}
                                </Text>
                            </Box>
                        ))}
                    </Box>
                </Box>
            </Box>
        </Box>
    );
}

// ─── Text styles ──────────────────────────────────────────────────────────────

function TextSubsection() {
    return (
        <Box flexDirection="column">
            <SectionHeading title="Text Styles" />
            <Box flexDirection="column" gap={1}>
                <Box flexDirection="row" gap={3}>
                    <Text bold>bold</Text>
                    <Text italic>italic</Text>
                    <Text underline>underline</Text>
                    <Text dim>dim</Text>
                    <Text bold italic>
                        bold+italic
                    </Text>
                    <Text bold underline color="yellow">
                        bold+underline+yellow
                    </Text>
                    <Text italic dim color="cyan">
                        italic+dim+cyan
                    </Text>
                </Box>
                <Box flexDirection="row" gap={2} marginTop={1}>
                    {["red", "green", "yellow", "blue", "magenta", "cyan", "white"].map((c) => (
                        <Text key={c} color={c} bold>
                            {c[0].toUpperCase()}
                        </Text>
                    ))}
                    <Text> </Text>
                    {["red", "green", "yellow", "blue", "magenta", "cyan", "white"].map((c) => (
                        <Text key={c} color={c} italic>
                            {c[0].toUpperCase()}
                        </Text>
                    ))}
                    <Text> </Text>
                    {["red", "green", "yellow", "blue", "magenta", "cyan", "white"].map((c) => (
                        <Text key={c} color={c} dim>
                            {c[0].toUpperCase()}
                        </Text>
                    ))}
                </Box>
                <Box flexDirection="column" marginTop={1} gap={1} borderStyle="single" borderColor="gray" paddingX={2} paddingY={1}>
                    <Text bold color="cyan">
                        Combined styles demo
                    </Text>
                    <Text>
                        Normal <Text bold>Bold</Text> Normal <Text italic>Italic</Text> Normal <Text underline>Underline</Text>
                    </Text>
                    <Text color="green">
                        Green <Text color="yellow">Yellow</Text> <Text color="red">Red</Text> <Text color="cyan">Cyan</Text>
                    </Text>
                    <Text dim>Dimmed text looks like this — useful for hints</Text>
                </Box>
            </Box>
        </Box>
    );
}

// ─── Backgrounds ─────────────────────────────────────────────────────────────

function BackgroundsSubsection() {
    return (
        <Box flexDirection="column">
            <SectionHeading title="Backgrounds" />
            <Box flexDirection="row" gap={1} flexWrap="wrap">
                {[
                    ["red", "white"],
                    ["green", "black"],
                    ["yellow", "black"],
                    ["blue", "white"],
                    ["magenta", "white"],
                    ["cyan", "black"],
                    ["white", "black"],
                    ["gray", "white"],
                ].map(([bg, fg]) => (
                    <Box key={bg} backgroundColor={bg} paddingX={2} paddingY={1}>
                        <Text color={fg} bold>
                            {bg}
                        </Text>
                    </Box>
                ))}
            </Box>
            <Box flexDirection="row" gap={1} marginTop={1} flexWrap="wrap">
                {["#ff6b6b", "#ffd93d", "#6bcb77", "#4d96ff", "#c77dff", "#ff9f43", "#f8961e", "#90e0ef"].map((h) => (
                    <Box key={h} backgroundColor={h} paddingX={2} paddingY={1}>
                        <Text color="black">{h}</Text>
                    </Box>
                ))}
            </Box>
            <Box flexDirection="row" gap={2} marginTop={1}>
                <Box backgroundColor="rgb(40,40,80)" paddingX={3} paddingY={1} borderStyle="round" borderColor="blue">
                    <Text color="white" bold>
                        Dark blue bg
                    </Text>
                </Box>
                <Box backgroundColor="rgb(80,40,40)" paddingX={3} paddingY={1} borderStyle="round" borderColor="red">
                    <Text color="white" bold>
                        Dark red bg
                    </Text>
                </Box>
                <Box backgroundColor="rgb(40,80,40)" paddingX={3} paddingY={1} borderStyle="round" borderColor="green">
                    <Text color="white" bold>
                        Dark green bg
                    </Text>
                </Box>
            </Box>
        </Box>
    );
}

// ─── UI Primitives (select-input patterns + built-in components + table) ─────

function LayoutSection() {
    return (
        <Box flexDirection="column">
            <SectionHeading title="Layout (Flexbox)" />
            <Box flexDirection="row" gap={3}>
                {/* justify-content */}
                <Box flexDirection="column" gap={1}>
                    <Text dim bold>
                        justifyContent
                    </Text>
                    {(["flex-start", "center", "flex-end", "space-between", "space-around"] as const).map((j) => (
                        <Box key={j} borderStyle="single" borderColor="gray" width={26} justifyContent={j}>
                            <Text color="yellow">▪</Text>
                            <Text color="cyan">▪</Text>
                            <Text color="green">▪</Text>
                        </Box>
                    ))}
                </Box>
                {/* align-items */}
                <Box flexDirection="column" gap={1}>
                    <Text dim bold>
                        alignItems
                    </Text>
                    {(["flex-start", "center", "flex-end"] as const).map((a) => (
                        <Box key={a} borderStyle="single" borderColor="gray" width={16} height={3} alignItems={a}>
                            <Text color="magenta">▪▪▪</Text>
                        </Box>
                    ))}
                </Box>
                {/* Spacer + nesting */}
                <Box flexDirection="column" gap={1}>
                    <Text dim bold>
                        Spacer / nesting
                    </Text>
                    <Box borderStyle="single" borderColor="gray" width={24}>
                        <Text color="green">◀ left</Text>
                        <Spacer />
                        <Text color="red">right ▶</Text>
                    </Box>
                    <Box borderStyle="round" borderColor="cyan" width={24} padding={1}>
                        <Box borderStyle="single" borderColor="yellow" paddingX={1}>
                            <Text color="yellow">nested</Text>
                        </Box>
                    </Box>
                    <Box flexDirection="row" gap={1}>
                        {[1, 2, 3].map((n) => (
                            <Box key={n} borderStyle="single" borderColor="blue" width={6} height={n + 1} alignItems="center" justifyContent="center">
                                <Text color="blue">{n}</Text>
                            </Box>
                        ))}
                    </Box>
                </Box>
            </Box>
        </Box>
    );
}

// ─── Focus ────────────────────────────────────────────────────────────────────

function FocusablePanel({ label, color, description }: { label: string; color: string; description: string }) {
    const { isFocused } = useFocus();
    return (
        <Box flexDirection="column" borderStyle={isFocused ? "round" : "single"} borderColor={isFocused ? color : "gray"} paddingX={2} paddingY={1} width={18}>
            <Text color={isFocused ? color : "gray"} bold>
                {isFocused ? "▶ " : "  "}
                {label}
            </Text>
            <Text dim>{description}</Text>
            {isFocused && (
                <Text color={color} dim>
                    focused ✓
                </Text>
            )}
        </Box>
    );
}

function FocusSection() {
    const { activeId } = useFocusManager();
    const panels = [
        { label: "Alpha", color: "green", description: "panel one" },
        { label: "Beta", color: "yellow", description: "panel two" },
        { label: "Gamma", color: "magenta", description: "panel three" },
        { label: "Delta", color: "cyan", description: "panel four" },
        { label: "Epsilon", color: "blue", description: "panel five" },
    ];
    return (
        <Box flexDirection="column">
            <SectionHeading title="Focus Management" />
            <Text dim marginBottom={1}>
                Tab / Shift+Tab to cycle focus between panels
            </Text>
            <Box flexDirection="row" gap={1}>
                {panels.map((p) => (
                    <FocusablePanel key={p.label} {...p} />
                ))}
            </Box>
            <Box marginTop={1}>
                <Text dim>Active ID: </Text>
                <Text color="cyan">{activeId ?? "none"}</Text>
            </Box>
        </Box>
    );
}

// ─── Graph ────────────────────────────────────────────────────────────────────
// Bar chart rendered directly to the Uint32Array buffer — bypasses React
// reconciliation for individual bar cells, same technique as stress-test.tsx.

// Bar colors by column (ANSI indices)
const BAR_COLORS = [1, 2, 3, 4, 5, 6, 7, 2, 3, 4, 5, 6];

// Block characters for vertical bars (bottom to top)
const FULL_BLOCK = "█".codePointAt(0)!;
const SHADE_75 = "▓".codePointAt(0)!;
const SHADE_50 = "▒".codePointAt(0)!;
const SHADE_25 = "░".codePointAt(0)!;
const SPACE = 0x20;

/**
 * Paint an animated bar chart into the buffer.
 * Called from the 'render' event listener — paints into the region below
 * the React-managed heading/axis rows.
 */
function paintGraph(
    buffer: Uint32Array,
    cols: number,
    _rows: number,
    startRow: number, // first row available for bars
    barRows: number, // total bar height in rows
    frame: number,
) {
    const BAR_COUNT = 12;
    const BAR_WIDTH = 3;
    const BAR_GAP = 1;
    const TOTAL_WIDTH = BAR_COUNT * (BAR_WIDTH + BAR_GAP);
    const startCol = Math.max(0, Math.floor((cols - TOTAL_WIDTH) / 2));

    // Compute bar heights (0..barRows) driven by animated sine waves
    // Same time scale as the React display: t = frame * 0.004
    const heights: number[] = [];
    for (let b = 0; b < BAR_COUNT; b++) {
        const phase = (b / BAR_COUNT) * Math.PI * 2;
        const t = frame * 0.004;
        const v = (Math.sin(t + phase) * 0.5 + 0.5) * (Math.sin(t * 0.37 + phase * 1.3) * 0.3 + 0.7);
        heights.push(Math.max(1, Math.round(v * barRows)));
    }

    // Clear graph region first
    for (let row = startRow; row < startRow + barRows; row++) {
        for (let col = startCol; col < startCol + TOTAL_WIDTH; col++) {
            const idx = (row * cols + col) * 2;
            buffer[idx] = SPACE;
            buffer[idx + 1] = (0 << 16) | (255 << 8) | 255;
        }
    }

    // Paint bars bottom-up
    for (let b = 0; b < BAR_COUNT; b++) {
        const barH = heights[b];
        const fg = BAR_COLORS[b % BAR_COLORS.length];
        const colStart = startCol + b * (BAR_WIDTH + BAR_GAP);

        for (let row = startRow; row < startRow + barRows; row++) {
            // distance from bottom of chart
            const fromBottom = startRow + barRows - 1 - row;
            const char = fromBottom < barH ? FULL_BLOCK : SPACE;
            const attr = (0 << 16) | (255 << 8) | fg;

            for (let dc = 0; dc < BAR_WIDTH; dc++) {
                const col = colStart + dc;
                if (col >= cols) continue;
                const idx = (row * cols + col) * 2;
                buffer[idx] = char;
                buffer[idx + 1] = attr;
            }
        }
    }

    // Paint bar labels (A–L) at the bottom row
    const labelRow = startRow + barRows;
    if (labelRow * cols * 2 + cols * 2 <= buffer.length) {
        for (let b = 0; b < BAR_COUNT; b++) {
            const fg = BAR_COLORS[b % BAR_COLORS.length];
            const colStart = startCol + b * (BAR_WIDTH + BAR_GAP) + 1;
            const idx = (labelRow * cols + colStart) * 2;
            if (idx + 1 < buffer.length) {
                buffer[idx] = 65 + b; // 'A'..'L'
                buffer[idx + 1] = (0 << 16) | (255 << 8) | fg;
            }
        }
    }
}

// How many rows the React heading occupies before the bars start
// TabBar(3) + paddingTop(1) + SectionHeading(1) + subtitle(1) + values(1) + marginTop(1) = 8
const GRAPH_HEADER_ROWS = 8;

function GraphSection({ active }: { active: boolean }) {
    const { columns, rows } = useWindowSize();
    const [frame, setFrame] = useState(0);
    const barRows = Math.max(4, rows - GRAPH_HEADER_ROWS - 6);

    const onTick = React.useCallback((f: number) => setFrame(f), []);
    useAnimationLoop(active, onTick);

    // Keep global frame ref for the buffer painter
    useEffect(() => {
        (globalThis as any).__kitchenFrame = frame;
    });

    useEffect(() => {
        if (!active) return;
        const app = (globalThis as any).__ratatatApp;
        if (!app) return;

        const unsub = app.onBeforeFlush((buffer: Uint32Array, w: number, h: number) => {
            const f = (globalThis as any).__kitchenFrame ?? 0;
            paintGraph(buffer, w, h, GRAPH_HEADER_ROWS, barRows, f);
        });
        return unsub;
    }, [active, barRows]);

    const BAR_COUNT = 12;
    const BAR_WIDTH = 3;
    const BAR_GAP = 1;
    const TOTAL_WIDTH = BAR_COUNT * (BAR_WIDTH + BAR_GAP);

    // Animation time advances at a fixed rate regardless of FPS.
    // frame increments at ~setTimeout(0) speed, so we scale it down
    // so the wave completes a cycle in ~4 seconds visually.
    const t = frame * 0.004; // ~4s per full cycle at 500fps, ~0.4s at 50fps

    // Compute heights for the value display and buffer painter
    const heights: number[] = [];
    for (let b = 0; b < BAR_COUNT; b++) {
        const phase = (b / BAR_COUNT) * Math.PI * 2;
        const v = (Math.sin(t + phase) * 0.5 + 0.5) * (Math.sin(t * 0.37 + phase * 1.3) * 0.3 + 0.7);
        heights.push(Math.max(1, Math.round(v * barRows)));
    }

    const barColors = ["red", "green", "yellow", "blue", "magenta", "cyan", "white"];
    const pcts = heights.map((h) => Math.round((h / barRows) * 100));

    return (
        <Box flexDirection="column">
            <SectionHeading title="Animated Bar Chart" />
            <Text dim>Sine-wave driven bars, painted directly to buffer (bypasses React reconciler)</Text>
            <Box marginTop={1}>
                <Text dim> </Text>
                {pcts.map((p, i) => (
                    <Text key={i} color={barColors[i % barColors.length]}>
                        {String(p).padStart(3)}%
                    </Text>
                ))}
            </Box>
            {/* The bars themselves are painted into the buffer by paintGraph() above */}
            {/* Reserve vertical space so React lays out the heading correctly */}
            <Box height={barRows + 1} />
        </Box>
    );
}

// ─── Live ─────────────────────────────────────────────────────────────────────

function LiveSection() {
    const { columns, rows } = useWindowSize();
    const [frame, setFrame] = useState(0);

    useEffect(() => {
        const t = setInterval(() => setFrame((f) => f + 1), 100);
        return () => clearInterval(t);
    }, []);

    const now = new Date();
    const time = now.toTimeString().split(" ")[0];
    const date = now.toDateString();

    const sparkData = Array.from({ length: 40 }, (_, i) => {
        const f = frame - 39 + i;
        return Math.abs(Math.sin(f * 0.3) * 7) | 0;
    });
    const sparkChars = ["▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"];

    // Benchmark data — matches bench.js output
    const benchRows = [
        {
            label: "initial mount (simple)",
            ratatat: "67,630",
            ink: "8,215",
            speedup: "8.2×",
            note: "ops/sec ↑  cold reconcile, 2 text nodes",
        },
        {
            label: "initial mount (complex)",
            ratatat: "41,253",
            ink: "1,421",
            speedup: "29×",
            note: "ops/sec ↑  cold reconcile, borders + 3 panels",
        },
        {
            label: "rerender (simple)",
            ratatat: "95,175",
            ink: "8,095",
            speedup: "11.8×",
            note: "ops/sec ↑  warm tree, counter increments each frame",
        },
        {
            label: "rerender (complex)",
            ratatat: "49,852",
            ink: "1,384",
            speedup: "36×",
            note: "ops/sec ↑  warm tree, all panels update each frame",
        },
        {
            label: "p99 latency (complex)",
            ratatat: "23 µs",
            ink: "1,586 µs",
            speedup: "68×",
            note: "time/op ↓  worst-case frame — tail latency matters",
        },
    ];

    return (
        <Box flexDirection="column" gap={1}>
            <SectionHeading title="Live Stats" />

            {/* Clock row */}
            <Box flexDirection="row" gap={3} borderStyle="round" borderColor="cyan" paddingX={2} paddingY={1}>
                <Box flexDirection="column" width={12}>
                    <Text dim>Time</Text>
                    <Text color="green" bold>
                        {time}
                    </Text>
                </Box>
                <Box flexDirection="column" width={22}>
                    <Text dim>Date</Text>
                    <Text color="cyan">{date}</Text>
                </Box>
                <Box flexDirection="column" width={10}>
                    <Text dim>Frame</Text>
                    <Text color="yellow" bold>
                        {frame}
                    </Text>
                </Box>
                <Box flexDirection="column" width={14}>
                    <Text dim>Terminal</Text>
                    <Text color="magenta" bold>
                        {columns}×{rows}
                    </Text>
                </Box>
                <Box flexDirection="column">
                    <Text dim>Sparkline</Text>
                    <Box flexDirection="row">
                        {sparkData.map((v, i) => (
                            <Text key={i} color={v > 5 ? "green" : v > 3 ? "yellow" : "red"}>
                                {sparkChars[v]}
                            </Text>
                        ))}
                    </Box>
                </Box>
            </Box>

            {/* Benchmark table */}
            <Box flexDirection="column" borderStyle="round" borderColor="yellow" paddingX={2} paddingY={1}>
                <Box flexDirection="row" marginBottom={1}>
                    <Text bold color="yellow">
                        Ratatat vs Ink — benchmark{" "}
                    </Text>
                    <Text dim>ops/sec, higher is better</Text>
                </Box>
                {/* Header */}
                <Box flexDirection="row">
                    <Text dim bold>
                        {"Suite".padEnd(28)}
                    </Text>
                    <Text dim bold>
                        {"Ratatat".padEnd(14)}
                    </Text>
                    <Text dim bold>
                        {"Ink".padEnd(14)}
                    </Text>
                    <Text dim bold>
                        {"Speedup".padEnd(10)}
                    </Text>
                    <Text dim bold>
                        Notes
                    </Text>
                </Box>
                <Box flexDirection="row">
                    <Text dim>{"─".repeat(74)}</Text>
                </Box>
                {/* Rows */}
                {benchRows.map((r, i) => (
                    <Box key={i} flexDirection="row">
                        <Text color="white">{r.label.padEnd(28)}</Text>
                        <Text color="cyan" bold>
                            {r.ratatat.padEnd(14)}
                        </Text>
                        <Text color="gray">{r.ink.padEnd(14)}</Text>
                        <Text color="green" bold>
                            {"🚀 " + r.speedup.padEnd(7)}
                        </Text>
                        <Text dim>{r.note}</Text>
                    </Box>
                ))}
                <Box flexDirection="row" marginTop={1}>
                    <Text dim>stress test </Text>
                    <Text color="green" bold>
                        700 FPS sustained
                    </Text>
                    <Text dim> · 8,648 cells/frame · 188×50 terminal · zero memory growth</Text>
                </Box>
            </Box>
        </Box>
    );
}

// ─── Incremental rendering ────────────────────────────────────────────────────

const INC_SERVICES = [
    "Server Authentication Module - Handles JWT token validation, OAuth2 flows, and session management",
    "Database Connection Pool - Maintains persistent connections to PostgreSQL with automatic failover",
    "API Gateway Service - Routes HTTP requests to microservices with rate limiting and transformation",
    "User Profile Manager - Caches user data in Redis with write-through policy and invalidation",
    "Payment Processing Engine - Integrates with Stripe, PayPal, and Square for transaction processing",
    "Email Notification Queue - Processes outbound emails through SendGrid with retry logic",
    "File Storage Handler - Manages S3 bucket operations with multipart uploads and CDN integration",
    "Search Indexer Service - Maintains Elasticsearch indices with real-time document updates",
    "Metrics Aggregation Pipeline - Collects telemetry data for Prometheus and Grafana dashboards",
    "WebSocket Connection Manager - Handles real-time bidirectional communication for chat",
    "Cache Invalidation Service - Coordinates distributed cache updates across Redis cluster nodes",
    "Background Job Processor - Executes async tasks via RabbitMQ with dead letter queue handling",
    "Rate Limiter Module - Enforces API quotas using token bucket algorithm with Redis backend",
    "Health Check Monitor - Performs periodic service health checks with circuit breaker pattern",
    "Configuration Manager - Loads environment-specific settings from Consul with hot reload",
];

const INC_ACTIONS = ["PROCESSING", "COMPLETED", "UPDATING", "SYNCING", "VALIDATING", "EXECUTING"];

function incLogLine(index: number) {
    const ts = new Date().toLocaleTimeString();
    const action = INC_ACTIONS[Math.floor(Math.random() * INC_ACTIONS.length)];
    return `[${ts}] Worker-${index} ${action}: ${(Math.random() * 1000).toFixed(0)}req/s  ${(Math.random() * 512).toFixed(1)}MB  CPU ${(Math.random() * 100).toFixed(1)}%`;
}

function incProgressBar(value: number, width = 24) {
    const filled = Math.floor((value / 100) * width);
    return "█".repeat(filled) + "░".repeat(width - filled);
}

function IncrementalSection({ active }: { active: boolean }) {
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [timestamp, setTimestamp] = useState(new Date().toLocaleTimeString());
    const [counter, setCounter] = useState(0);
    const [fps, setFps] = useState(0);
    const [p1, setP1] = useState(0);
    const [p2, setP2] = useState(33);
    const [p3, setP3] = useState(66);
    const [randVal, setRandVal] = useState(0);
    const LOG_COUNT = 4;
    const [logLines, setLogLines] = useState(() => Array.from({ length: LOG_COUNT }, (_, i) => incLogLine(i)));

    // Clock — 1s
    useEffect(() => {
        if (!active) return;
        const t = setInterval(() => {
            setTimestamp(new Date().toLocaleTimeString());
            setCounter((c) => c + 1);
        }, 1000);
        return () => clearInterval(t);
    }, [active]);

    // High-freq updates — ~60fps
    useEffect(() => {
        if (!active) return;
        let frameCount = 0,
            lastFps = Date.now(),
            loopFrame = 0;
        const t = setInterval(() => {
            loopFrame++;
            setP1((p) => (p + 1) % 101);
            setP2((p) => (p + 2) % 101);
            setP3((p) => (p + 3) % 101);
            setRandVal(Math.floor(Math.random() * 1000));
            setLogLines((prev) => {
                const next = [...prev];
                next[Math.floor(Math.random() * next.length)] = incLogLine(Math.floor(Math.random() * LOG_COUNT));
                return next;
            });
            frameCount++;
            const now = Date.now();
            if (now - lastFps >= 1000) {
                setFps(frameCount);
                frameCount = 0;
                lastFps = now;
            }
            if (loopFrame % 10000 === 0) {
                try {
                    performance.clearMeasures();
                    performance.clearMarks();
                } catch {}
            }
        }, 16);
        return () => clearInterval(t);
    }, [active]);

    useInput((input, key) => {
        if (!active) return;
        if (key.upArrow) setSelectedIndex((i) => (i === 0 ? INC_SERVICES.length - 1 : i - 1));
        if (key.downArrow) setSelectedIndex((i) => (i === INC_SERVICES.length - 1 ? 0 : i + 1));
    });

    return (
        <Box flexDirection="column" gap={1}>
            <SectionHeading title="Incremental Rendering" />

            {/* Header stats */}
            <Box borderStyle="round" borderColor="cyan" paddingX={2} paddingY={1} flexShrink={0}>
                <Box flexDirection="column">
                    <Box flexDirection="row" gap={4}>
                        <Text>
                            Time:{" "}
                            <Text color="green" bold>
                                {timestamp}
                            </Text>
                        </Text>
                        <Text>
                            Updates:{" "}
                            <Text color="yellow" bold>
                                {counter}
                            </Text>
                        </Text>
                        <Text>
                            Rand: <Text color="cyan">{randVal}</Text>
                        </Text>
                        <Text>{fps || "--"} updates/sec</Text>
                    </Box>
                    <Text>
                        P1: <Text color="green">{incProgressBar(p1)}</Text> <Text color="green">{String(p1).padStart(3)}%</Text>
                    </Text>
                    <Text>
                        P2: <Text color="yellow">{incProgressBar(p2)}</Text> <Text color="yellow">{String(p2).padStart(3)}%</Text>
                    </Text>
                    <Text>
                        P3: <Text color="red">{incProgressBar(p3)}</Text> <Text color="red">{String(p3).padStart(3)}%</Text>
                    </Text>
                </Box>
            </Box>

            {/* Live logs */}
            <Box borderStyle="single" borderColor="yellow" paddingX={2} paddingY={1} flexShrink={0}>
                <Box flexDirection="column">
                    <Text bold color="yellow">
                        Live Logs <Text dim>1-2 lines update per frame at ~60fps</Text>
                    </Text>
                    {logLines.map((line, i) => (
                        <Text key={i} color="green" dim>
                            {line}
                        </Text>
                    ))}
                </Box>
            </Box>

            {/* Service list */}
            <Box borderStyle="single" borderColor="gray" paddingX={2} paddingY={1}>
                <Box flexDirection="column">
                    <Text bold color="magenta">
                        System Services <Text dim>↑↓ to navigate</Text>
                    </Text>
                    {INC_SERVICES.map((svc, i) => {
                        const selected = i === selectedIndex;
                        return (
                            <Text key={i} color={selected ? "cyan" : "white"} bold={selected}>
                                {selected ? "▶ " : "  "}
                                {svc}
                            </Text>
                        );
                    })}
                </Box>
            </Box>

            {/* Selected footer */}
            <Box borderStyle="round" borderColor="magenta" paddingX={2} flexShrink={0}>
                <Text dim>Selected: </Text>
                <Text color="magenta" bold>
                    {INC_SERVICES[selectedIndex].split(" - ")[0]}
                </Text>
            </Box>
        </Box>
    );
}

// ─── UI (combined: Borders · Colors · Text · Backgrounds · Primitives) ───────

const SELECT_COLORS = [
    { name: "Red", color: "red" },
    { name: "Green", color: "green" },
    { name: "Yellow", color: "yellow" },
    { name: "Blue", color: "blue" },
    { name: "Magenta", color: "magenta" },
    { name: "Cyan", color: "cyan" },
    { name: "White", color: "white" },
    { name: "Gray", color: "gray" },
];

const TABLE_USERS = [
    { id: 1, name: "ada_lovelace", role: "Engineer", status: "active" },
    { id: 2, name: "grace_hopper", role: "Architect", status: "active" },
    { id: 3, name: "alan_turing", role: "Researcher", status: "idle" },
    { id: 4, name: "margaret_hamilton", role: "Lead", status: "active" },
    { id: 5, name: "linus_torvalds", role: "Maintainer", status: "active" },
    { id: 6, name: "barbara_liskov", role: "Architect", status: "idle" },
    { id: 7, name: "donald_knuth", role: "Researcher", status: "inactive" },
    { id: 8, name: "john_mccarthy", role: "Engineer", status: "inactive" },
    { id: 9, name: "ken_thompson", role: "Engineer", status: "active" },
    { id: 10, name: "dennis_ritchie", role: "Engineer", status: "idle" },
];

function statusColor(s: string) {
    return s === "active" ? "green" : s === "idle" ? "yellow" : "gray";
}

function PrimitivesSubsection({ active }: { active: boolean }) {
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [buildProgress, setBuildProgress] = useState(0);
    const [uploadProgress, setUploadProgress] = useState(12);
    const [syncing, setSyncing] = useState(true);

    useEffect(() => {
        if (!active) return;
        const t = setInterval(() => {
            setBuildProgress((p) => {
                const next = p >= 100 ? 0 : p + 1;
                if (next === 0) setSyncing((s) => !s);
                return next;
            });
            setUploadProgress((p) => (p >= 100 ? 0 : p + 2));
        }, 80);
        return () => clearInterval(t);
    }, [active]);

    useInput((input, key) => {
        if (!active) return;
        if (key.upArrow || input === "k") setSelectedIndex((i) => (i === 0 ? SELECT_COLORS.length - 1 : i - 1));
        if (key.downArrow || input === "j") setSelectedIndex((i) => (i === SELECT_COLORS.length - 1 ? 0 : i + 1));
    });

    const selected = SELECT_COLORS[selectedIndex];

    return (
        <Box flexDirection="column" gap={1}>
            <SectionHeading title="Primitives" />
            <Text dim>
                select-input/table patterns <Text>↑↓ / j k</Text>
                <Text dim> plus built-in Spinner + ProgressBar</Text>
            </Text>
            <Box flexDirection="row" gap={3}>
                <Box flexDirection="column" gap={1} width={26}>
                    <Text bold>Color picker</Text>
                    <Box flexDirection="column" borderStyle="round" borderColor={selected.color} paddingX={1} paddingY={1}>
                        {SELECT_COLORS.map((item, i) => {
                            const isSelected = i === selectedIndex;
                            return (
                                <Box key={item.name} flexDirection="row">
                                    <Text color={isSelected ? item.color : "gray"} bold={isSelected}>
                                        {isSelected ? "▶ " : "  "}
                                    </Text>
                                    <Text color={isSelected ? item.color : "gray"} bold={isSelected}>
                                        {item.name}
                                    </Text>
                                </Box>
                            );
                        })}
                    </Box>
                    <Box borderStyle="single" borderColor={selected.color} paddingX={2} paddingY={1}>
                        <Text>
                            Selected:{" "}
                            <Text color={selected.color} bold>
                                {selected.name}
                            </Text>
                        </Text>
                    </Box>
                </Box>
                <Box flexDirection="column" gap={1} flexGrow={1}>
                    <Text bold>Built-in components</Text>
                    <Box borderStyle="single" borderColor="cyan" paddingX={1} paddingY={1} flexDirection="column" gap={1}>
                        <Box flexDirection="row" gap={1}>
                            <Spinner color="cyan" />
                            <Text>default spinner</Text>
                        </Box>
                        <Box flexDirection="row" gap={1}>
                            <Spinner frames={["-", "\\", "|", "/"]} interval={120} color="yellow" />
                            <Text dim>ascii frames</Text>
                        </Box>
                        <Box flexDirection="row" gap={1}>
                            {syncing ? <Spinner color="magenta" interval={90} /> : <Text color="green">✔</Text>}
                            <Text color={syncing ? "magenta" : "green"}>{syncing ? "syncing metadata…" : "metadata synced"}</Text>
                        </Box>
                        <Box flexDirection="row" gap={1}>
                            <Text dim>build</Text>
                            <ProgressBar value={buildProgress} width={16} color="green" />
                        </Box>
                        <Box flexDirection="row" gap={1}>
                            <Text dim>upload</Text>
                            <ProgressBar
                                value={uploadProgress}
                                width={16}
                                completeChar="■"
                                incompleteChar="·"
                                bracket={false}
                                showPercentage={false}
                                color="yellow"
                            />
                            <Text color="yellow">{String(uploadProgress).padStart(3)}%</Text>
                        </Box>
                        <Box flexDirection="row" gap={1}>
                            <Text dim>assets</Text>
                            <ProgressBar value={45} max={60} width={16} color="blue" />
                        </Box>
                    </Box>

                    <Text bold>User table</Text>
                    <Box flexDirection="column" borderStyle="round" borderColor="gray" paddingX={1} paddingY={1}>
                        <Box flexDirection="row" marginBottom={1}>
                            <Box width="6%">
                                <Text bold dim>
                                    ID
                                </Text>
                            </Box>
                            <Box width="35%">
                                <Text bold dim>
                                    Username
                                </Text>
                            </Box>
                            <Box width="25%">
                                <Text bold dim>
                                    Role
                                </Text>
                            </Box>
                            <Box width="20%">
                                <Text bold dim>
                                    Status
                                </Text>
                            </Box>
                        </Box>
                        <Box marginBottom={1}>
                            <Text dim>{"─".repeat(58)}</Text>
                        </Box>
                        {TABLE_USERS.map((user) => (
                            <Box key={user.id} flexDirection="row">
                                <Box width="6%">
                                    <Text dim>{user.id}</Text>
                                </Box>
                                <Box width="35%">
                                    <Text color="cyan">{user.name}</Text>
                                </Box>
                                <Box width="25%">
                                    <Text color="white">{user.role}</Text>
                                </Box>
                                <Box width="20%">
                                    <Text color={statusColor(user.status)} bold>
                                        {user.status === "active" ? "● " : user.status === "idle" ? "○ " : "· "}
                                        {user.status}
                                    </Text>
                                </Box>
                            </Box>
                        ))}
                    </Box>
                </Box>
            </Box>
        </Box>
    );
}

const UI_SUBSECTIONS = ["Borders", "Colors", "Text", "Backgrounds", "Primitives"] as const;
type UiSubsection = (typeof UI_SUBSECTIONS)[number];

function UiSection({ active }: { active: boolean }) {
    const [subIdx, setSubIdx] = useState(0);

    useInput((_input, key) => {
        if (!active) return;
        if (key.upArrow) setSubIdx((i) => Math.max(0, i - 1));
        if (key.downArrow) setSubIdx((i) => Math.min(UI_SUBSECTIONS.length - 1, i + 1));
    });

    const current: UiSubsection = UI_SUBSECTIONS[subIdx];

    return (
        <Box flexDirection="row" height="100%">
            {/* Left sidebar menu */}
            <Box flexDirection="column" borderStyle="single" borderColor="gray" paddingY={1} width={16} flexShrink={0}>
                {UI_SUBSECTIONS.map((name, i) => (
                    <Box key={name} paddingX={1} backgroundColor={i === subIdx ? "cyan" : undefined}>
                        <Text color={i === subIdx ? "black" : "gray"} bold={i === subIdx}>
                            {i === subIdx ? "▶ " : "  "}
                            {name}
                        </Text>
                    </Box>
                ))}
                <Box marginTop={1} paddingX={1}>
                    <Text dim>↑↓ navigate</Text>
                </Box>
            </Box>

            {/* Content area */}
            <Box flexDirection="column" flexGrow={1} paddingX={2}>
                {current === "Borders" && <BordersSubsection />}
                {current === "Colors" && <ColorsSubsection />}
                {current === "Text" && <TextSubsection />}
                {current === "Backgrounds" && <BackgroundsSubsection />}
                {current === "Primitives" && <PrimitivesSubsection active={active} />}
            </Box>
        </Box>
    );
}

// ─── Tab bar (top) ───────────────────────────────────────────────────────────

function TabBar({ current, onSelect }: { current: number; onSelect: (i: number) => void }) {
    // Calculate click regions for each tab.
    // Layout: border(1) + leading-space(1) + for each tab: paddingX(1) + name + paddingX(1) + marginRight(1)
    const hitRegions = React.useMemo(() => {
        let x = 2; // border col 0 + leading space col 1
        return SECTIONS.map((s) => {
            const start = x;
            const width = s.length + 2; // paddingX(1) each side
            x += width + 1; // +marginRight(1)
            return { start, end: start + width - 1 };
        });
    }, []);

    useMouse((e) => {
        if (e.button !== "left") return;
        if (e.y !== 1) return; // tab bar is always row 1 (border on row 0, content row 1)
        const hit = hitRegions.findIndex((r) => e.x >= r.start && e.x <= r.end);
        if (hit !== -1) onSelect(hit);
    });

    return (
        <Box borderStyle="single" borderColor="gray" flexShrink={0}>
            <Text> </Text>
            {SECTIONS.map((s, i) => {
                const active = i === current;
                return (
                    <Box key={s} marginRight={1}>
                        {active ? (
                            <Box backgroundColor="cyan" paddingX={1}>
                                <Text color="black" bold>
                                    {s}
                                </Text>
                            </Box>
                        ) : (
                            <Box paddingX={1}>
                                <Text color="gray">{s}</Text>
                            </Box>
                        )}
                    </Box>
                );
            })}
            <Spacer />
            <Text dim>navigate ◀ ▶ or click | Q quit </Text>
        </Box>
    );
}

// ─── Static section ──────────────────────────────────────────────────────────

type Task = { id: number; name: string; ms: number; ok: boolean };

const TASK_NAMES = [
    "Compile TypeScript",
    "Bundle assets",
    "Run unit tests",
    "Lint source",
    "Type check",
    "Generate docs",
    "Minify CSS",
    "Optimize images",
    "Build WASM",
    "Sign artifacts",
    "Upload to CDN",
    "Notify Slack",
];

function StaticSection({ active }: { active: boolean }) {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [running, setRunning] = useState<string | null>(null);
    const counterRef = useRef(0);

    useEffect(() => {
        if (!active) return;
        let cancelled = false;

        const runNext = () => {
            if (cancelled) return;
            const i = counterRef.current % TASK_NAMES.length;
            const name = TASK_NAMES[i]!;
            const ms = 80 + Math.floor(Math.random() * 200);
            setRunning(name);

            setTimeout(() => {
                if (cancelled) return;
                const ok = Math.random() > 0.1;
                setTasks((prev) => [...prev, { id: counterRef.current, name, ms, ok }]);
                counterRef.current++;
                setRunning(null);
                setTimeout(runNext, 50);
            }, ms);
        };

        setTimeout(runNext, 100);
        return () => {
            cancelled = true;
        };
    }, [active]);

    const passed = tasks.filter((t) => t.ok).length;
    const failed = tasks.filter((t) => !t.ok).length;

    return (
        <Box flexDirection="column" height="100%">
            <Box marginBottom={1}>
                <Text bold>Static</Text>
                <Text dim> — completed tasks freeze in place, never re-rendered</Text>
            </Box>

            {/* Fixed-height log window — Static fills it, clipped at the border */}
            <Box borderStyle="single" borderColor="gray" flexDirection="column" height={20}>
                <Static items={tasks}>
                    {(task: Task) => (
                        <Box key={task.id}>
                            <Text color={task.ok ? "green" : "red"}>{task.ok ? " ✔" : " ✘"} </Text>
                            <Box width={24}>
                                <Text>{task.name}</Text>
                            </Box>
                            <Text dim>{task.ms}ms</Text>
                        </Box>
                    )}
                </Static>
            </Box>

            {/* Live status — always visible below the log window */}
            <Box marginTop={1} flexDirection="column">
                {running && (
                    <Box>
                        <Text color="yellow"> ⟳ </Text>
                        <Text>{running}</Text>
                        <Text dim>…</Text>
                    </Box>
                )}
                {!running && tasks.length > 0 && (
                    <Box>
                        <Text dim>idle</Text>
                    </Box>
                )}
                <Box marginTop={1}>
                    <Text dim>total: {tasks.length} </Text>
                    <Text color="green">✔ {passed} </Text>
                    {failed > 0 && <Text color="red">✘ {failed}</Text>}
                </Box>
            </Box>
        </Box>
    );
}

// ─── Mouse ────────────────────────────────────────────────────────────────────

interface MouseLogEntry {
    id: number;
    text: string;
    color: string;
}

let mouseLogId = 0;

function MouseSection({ active }: { active: boolean }) {
    const { rows } = useWindowSize();
    const [log, setLog] = useState<MouseLogEntry[]>([
        { id: mouseLogId++, text: "Click · right-click · scroll wheel", color: "dim" },
        { id: mouseLogId++, text: "Type below — cursor, backspace, Ctrl+U/K/W", color: "dim" },
        { id: mouseLogId++, text: "Paste with ⌘V / ctrl+shift+V", color: "dim" },
    ]);

    const addLog = (text: string, color = "white") => setLog((prev) => [...prev, { id: mouseLogId++, text, color }]);

    // Mouse events
    useMouse((e) => {
        if (!active) return;
        if (e.button === "left") {
            addLog(`click  (${e.x}, ${e.y})${e.shift ? " +shift" : ""}${e.ctrl ? " +ctrl" : ""}`, "cyan");
        } else if (e.button === "right") {
            addLog(`right  (${e.x}, ${e.y})`, "yellow");
        } else if (e.button === "middle") {
            addLog(`middle (${e.x}, ${e.y})`, "magenta");
        } else if (e.button === "scrollUp") {
            scroll.scrollBy(-1);
        } else if (e.button === "scrollDown") {
            scroll.scrollBy(1);
        }
    });

    // Text input
    const CHROME = 8; // section header ~3, input bar 3, borders/padding
    const logViewport = Math.max(4, rows - CHROME);
    const scroll = useScrollable({ viewportHeight: logViewport, contentHeight: log.length });

    const { value, cursor, clear } = useTextInput({
        isActive: active,
        onSubmit: (v) => {
            if (v.trim()) addLog(`› ${v}`, "green");
            clear();
        },
    });

    const visibleLog = log.slice(scroll.offset, scroll.offset + logViewport);

    // Cursor rendering: inverse block at cursor, trailing space at end
    const before = value.slice(0, cursor);
    const atChar = value[cursor] ?? " ";
    const after = value.slice(cursor + 1);

    return (
        <Box flexDirection="column" height="100%">
            <Box marginBottom={1}>
                <Text bold>Mouse · TextInput · Paste</Text>
                <Text dim> scroll wheel scrolls log · Enter to submit</Text>
            </Box>

            {/* Event log */}
            <Box flexDirection="column" flexGrow={1} overflow="hidden">
                {visibleLog.map((entry) => (
                    <Text key={entry.id} color={entry.color}>
                        {" "}
                        {entry.text}
                    </Text>
                ))}
                {Array.from({ length: Math.max(0, logViewport - visibleLog.length) }).map((_, i) => (
                    <Text key={`pad-${i}`}> </Text>
                ))}
            </Box>

            {/* Scroll hint */}
            {log.length > logViewport && (
                <Box justifyContent="flex-end">
                    <Text dim>
                        {scroll.offset + 1}–{Math.min(scroll.offset + logViewport, log.length)}/{log.length}
                    </Text>
                </Box>
            )}

            {/* Input bar */}
            <Box borderStyle="single" borderColor="cyan" paddingX={1}>
                <Text color="cyan" bold>
                    ›{" "}
                </Text>
                <Text>{before}</Text>
                <Text inverse>{atChar}</Text>
                <Text>{after}</Text>
            </Box>
        </Box>
    );
}

// ─── Animated sections drive their own tick loop ─────────────────────────────
// Static sections (Borders, Colors, etc.) produce no renders when idle — the
// FPS HUD will show the true rate, not a forced 10 FPS from an unnecessary timer.

function useAnimationLoop(active: boolean, onTick: (frame: number) => void) {
    const frameRef = React.useRef(0);
    useEffect(() => {
        if (!active) return;
        let running = true;
        let handle: ReturnType<typeof setTimeout>;
        function loop() {
            if (!running) return;
            frameRef.current++;
            onTick(frameRef.current);
            // Clear React scheduler perf entries every 10k frames to prevent
            // the MaxPerformanceEntryBufferExceededWarning from Node's perf_hooks
            if (frameRef.current % 10000 === 0) {
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
    }, [active, onTick]);
}

// ─── App ─────────────────────────────────────────────────────────────────────

function KitchenSink() {
    const { exit } = useApp();
    const [sectionIdx, setSectionIdx] = useState(0);

    useInput((input, key) => {
        if (input === "q" || input === "Q") exit();
        if (key.rightArrow) setSectionIdx((i) => Math.min(i + 1, SECTIONS.length - 1));
        if (key.leftArrow) setSectionIdx((i) => Math.max(i - 1, 0));
    });

    const currentSection = SECTIONS[sectionIdx];
    const isGraphActive = currentSection === "Graph";
    const isIncActive = currentSection === "Incremental";
    const isUiActive = currentSection === "UI";
    const isStaticActive = currentSection === "Static";
    const isMouseActive = currentSection === "Mouse";

    return (
        <Box flexDirection="column" flexGrow={1}>
            {/* Tab bar at top */}
            <TabBar current={sectionIdx} onSelect={setSectionIdx} />

            {/* Section content fills remaining space */}
            <Box flexDirection="column" flexGrow={1} paddingX={2} paddingTop={1}>
                {currentSection === "Layout" && <LayoutSection />}
                {currentSection === "Focus" && <FocusSection />}
                {currentSection === "Graph" && <GraphSection active={isGraphActive} />}
                {currentSection === "Live" && <LiveSection />}
                {currentSection === "Incremental" && <IncrementalSection active={isIncActive} />}
                {currentSection === "UI" && <UiSection active={isUiActive} />}
                {currentSection === "Static" && <StaticSection active={isStaticActive} />}
                {currentSection === "Mouse" && <MouseSection active={isMouseActive} />}
            </Box>
        </Box>
    );
}

const { app } = render(
    <DevTools>
        <KitchenSink />
    </DevTools>,
);
(globalThis as any).__ratatatApp = app;
