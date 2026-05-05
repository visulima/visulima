/* eslint-disable @typescript-eslint/no-confusing-void-expression, @typescript-eslint/no-use-before-define, func-style, no-empty, no-param-reassign, no-secrets/no-secrets, no-underscore-dangle, sonarjs/no-dead-store, sonarjs/no-nested-conditional, sonarjs/no-nested-functions, sonarjs/no-unused-vars, sonarjs/pseudo-random, unicorn/prefer-math-trunc, unicorn/prevent-abbreviations */

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
import { Box, Newline, Spacer, Text } from "@visulima/tui";
import {
    DevTools,
    render,
    Static,
    useApp,
    useFocus,
    useFocusManager,
    useInput,
    useMouse,
    useScrollable,
    useTextInput,
    useWindowSize,
} from "@visulima/tui/react";
import React, { useEffect, useRef, useState } from "react";

// ─── Ratatat-local Spinner & ProgressBar ────────────────────────────────────
// The ink-based <Spinner> and <ProgressBar> live in @visulima/tui and depend on
// ink's AnimationContext. The kitchen-sink uses the Ratatat renderer, so we
// provide lightweight local versions that work without that context.

const DEFAULT_SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

const Spinner = ({ frames = DEFAULT_SPINNER_FRAMES, interval = 80, ...textProps }) => {
    const resolvedFrames = frames.length > 0 ? frames : ["-"];
    const [index, setIndex] = React.useState(0);

    React.useEffect(() => {
        if (interval <= 0 || resolvedFrames.length <= 1) {
            return;
        }

        const timer = setInterval(() => setIndex((p) => (p + 1) % resolvedFrames.length), interval);

        return () => clearInterval(timer);
    }, [interval, resolvedFrames]);

    return React.createElement(Text, textProps, resolvedFrames[index] ?? "-");
};

const ProgressBar = ({ bracket = true, completeChar = "█", incompleteChar = "░", max = 100, showPercentage = true, value, width = 20, ...textProps }) => {
    const ratio = Math.max(0, Math.min(value, max)) / (max > 0 ? max : 1);
    const filled = Math.round(ratio * Math.max(1, width));
    const body = completeChar.repeat(filled) + incompleteChar.repeat(Math.max(0, width - filled));
    const bar = bracket ? `[${body}]` : body;

    return React.createElement(Text, textProps, showPercentage ? `${bar} ${Math.round(ratio * 100)}%` : bar);
};

// ─── Section list ─────────────────────────────────────────────────────────────

const SECTIONS = ["Layout", "Focus", "Graph", "Live", "Incremental", "UI", "Static", "Mouse"] as const;

type SectionName = (typeof SECTIONS)[number];

// ─── Section header ───────────────────────────────────────────────────────────

const SectionHeading = ({ title }: { title: string }) => (
    <Box marginBottom={1}>
        <Text bold color="cyan">
            ━━ {title}{" "}
        </Text>
        <Text dim>{"━".repeat(Math.max(0, 40 - title.length - 4))}</Text>
    </Box>
);

// ─── Borders ──────────────────────────────────────────────────────────────────

const BordersSubsection = () => {
    const styles = ["single", "double", "round", "bold", "singleDouble", "doubleSingle", "classic"] as const;

    return (
        <Box flexDirection="column">
            <SectionHeading title="Borders" />
            <Box flexDirection="row" flexWrap="wrap" gap={1} marginBottom={2}>
                {styles.map((s) => (
                    <Box borderStyle={s} key={s} paddingX={2} paddingY={1}>
                        <Text color="white">{s}</Text>
                    </Box>
                ))}
            </Box>
            <Box flexDirection="row" gap={2}>
                <Box borderColor="cyan" borderStyle="round" paddingX={2} paddingY={1}>
                    <Text color="cyan">borderColor</Text>
                </Box>
                <Box borderColor="yellow" borderStyle="bold" paddingX={2} paddingY={1}>
                    <Text color="yellow">bold + yellow</Text>
                </Box>
                <Box borderColor="magenta" borderStyle="double" paddingX={2} paddingY={1}>
                    <Text color="magenta">double + magenta</Text>
                </Box>
            </Box>
        </Box>
    );
};

// ─── Colors ───────────────────────────────────────────────────────────────────

const ColorsSubsection = () => {
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
                            <Box backgroundColor={c} key={c} paddingX={1}>
                                <Text color={c === "white" || c === "yellow" ? "black" : "white"}>{c}</Text>
                            </Box>
                        ))}
                    </Box>
                </Box>
                <Box flexDirection="column">
                    <Text dim>Hex colors</Text>
                    <Box flexDirection="row" gap={1}>
                        {hexes.map((h) => (
                            <Box backgroundColor={h} key={h} paddingX={1}>
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
                            <Box backgroundColor={c} key={c} paddingX={2} paddingY={1}>
                                <Text bold color="black">
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
};

// ─── Text styles ──────────────────────────────────────────────────────────────

const TextSubsection = () => (
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
                <Text bold color="yellow" underline>
                    bold+underline+yellow
                </Text>
                <Text color="cyan" dim italic>
                    italic+dim+cyan
                </Text>
            </Box>
            <Box flexDirection="row" gap={2} marginTop={1}>
                {["red", "green", "yellow", "blue", "magenta", "cyan", "white"].map((c) => (
                    <Text bold color={c} key={c}>
                        {c[0].toUpperCase()}
                    </Text>
                ))}
                <Text> </Text>
                {["red", "green", "yellow", "blue", "magenta", "cyan", "white"].map((c) => (
                    <Text color={c} italic key={c}>
                        {c[0].toUpperCase()}
                    </Text>
                ))}
                <Text> </Text>
                {["red", "green", "yellow", "blue", "magenta", "cyan", "white"].map((c) => (
                    <Text color={c} dim key={c}>
                        {c[0].toUpperCase()}
                    </Text>
                ))}
            </Box>
            <Box borderColor="gray" borderStyle="single" flexDirection="column" gap={1} marginTop={1} paddingX={2} paddingY={1}>
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

// ─── Backgrounds ─────────────────────────────────────────────────────────────

const BackgroundsSubsection = () => (
    <Box flexDirection="column">
        <SectionHeading title="Backgrounds" />
        <Box flexDirection="row" flexWrap="wrap" gap={1}>
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
                <Box backgroundColor={bg} key={bg} paddingX={2} paddingY={1}>
                    <Text bold color={fg}>
                        {bg}
                    </Text>
                </Box>
            ))}
        </Box>
        <Box flexDirection="row" flexWrap="wrap" gap={1} marginTop={1}>
            {["#ff6b6b", "#ffd93d", "#6bcb77", "#4d96ff", "#c77dff", "#ff9f43", "#f8961e", "#90e0ef"].map((h) => (
                <Box backgroundColor={h} key={h} paddingX={2} paddingY={1}>
                    <Text color="black">{h}</Text>
                </Box>
            ))}
        </Box>
        <Box flexDirection="row" gap={2} marginTop={1}>
            <Box backgroundColor="rgb(40,40,80)" borderColor="blue" borderStyle="round" paddingX={3} paddingY={1}>
                <Text bold color="white">
                    Dark blue bg
                </Text>
            </Box>
            <Box backgroundColor="rgb(80,40,40)" borderColor="red" borderStyle="round" paddingX={3} paddingY={1}>
                <Text bold color="white">
                    Dark red bg
                </Text>
            </Box>
            <Box backgroundColor="rgb(40,80,40)" borderColor="green" borderStyle="round" paddingX={3} paddingY={1}>
                <Text bold color="white">
                    Dark green bg
                </Text>
            </Box>
        </Box>
    </Box>
);

// ─── UI Primitives (select-input patterns + built-in components + table) ─────

const LayoutSection = () => (
    <Box flexDirection="column">
        <SectionHeading title="Layout (Flexbox)" />
        <Box flexDirection="row" gap={3}>
            {/* justify-content */}
            <Box flexDirection="column" gap={1}>
                <Text bold dim>
                    justifyContent
                </Text>
                {(["flex-start", "center", "flex-end", "space-between", "space-around"] as const).map((j) => (
                    <Box borderColor="gray" borderStyle="single" justifyContent={j} key={j} width={26}>
                        <Text color="yellow">▪</Text>
                        <Text color="cyan">▪</Text>
                        <Text color="green">▪</Text>
                    </Box>
                ))}
            </Box>
            {/* align-items */}
            <Box flexDirection="column" gap={1}>
                <Text bold dim>
                    alignItems
                </Text>
                {(["flex-start", "center", "flex-end"] as const).map((a) => (
                    <Box alignItems={a} borderColor="gray" borderStyle="single" height={5} key={a} width={16}>
                        <Text color="magenta">▪▪▪</Text>
                    </Box>
                ))}
            </Box>
            {/* Spacer + nesting */}
            <Box flexDirection="column" gap={1}>
                <Text bold dim>
                    Spacer / nesting
                </Text>
                <Box borderColor="gray" borderStyle="single" width={24}>
                    <Text color="green">◀ left</Text>
                    <Spacer />
                    <Text color="red">right ▶</Text>
                </Box>
                <Box borderColor="cyan" borderStyle="round" padding={1} width={24}>
                    <Box borderColor="yellow" borderStyle="single" paddingX={1}>
                        <Text color="yellow">nested</Text>
                    </Box>
                </Box>
                <Box flexDirection="row" gap={1}>
                    {[1, 2, 3].map((n) => (
                        <Box alignItems="center" borderColor="blue" borderStyle="single" height={n + 1} justifyContent="center" key={n} width={6}>
                            <Text color="blue">{n}</Text>
                        </Box>
                    ))}
                </Box>
            </Box>
        </Box>
    </Box>
);

// ─── Focus ────────────────────────────────────────────────────────────────────

const FocusablePanel = ({ color, description, label }: { color: string; description: string; label: string }) => {
    const { isFocused } = useFocus();

    return (
        <Box borderColor={isFocused ? color : "gray"} borderStyle={isFocused ? "round" : "single"} flexDirection="column" paddingX={2} paddingY={1} width={18}>
            <Text bold color={isFocused ? color : "gray"}>
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
};

const FocusSection = () => {
    const { activeId } = useFocusManager();
    const panels = [
        { color: "green", description: "panel one", label: "Alpha" },
        { color: "yellow", description: "panel two", label: "Beta" },
        { color: "magenta", description: "panel three", label: "Gamma" },
        { color: "cyan", description: "panel four", label: "Delta" },
        { color: "blue", description: "panel five", label: "Epsilon" },
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
};

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
            const index = (row * cols + col) * 2;

            buffer[index] = SPACE;
            buffer[index + 1] = (0 << 16) | (255 << 8) | 255;
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
            const attribute = (0 << 16) | (255 << 8) | fg;

            for (let dc = 0; dc < BAR_WIDTH; dc++) {
                const col = colStart + dc;

                if (col >= cols) {
                    continue;
                }

                const index = (row * cols + col) * 2;

                buffer[index] = char;
                buffer[index + 1] = attribute;
            }
        }
    }

    // Paint bar labels (A–L) at the bottom row
    const labelRow = startRow + barRows;

    if (labelRow * cols * 2 + cols * 2 <= buffer.length) {
        for (let b = 0; b < BAR_COUNT; b++) {
            const fg = BAR_COLORS[b % BAR_COLORS.length];
            const colStart = startCol + b * (BAR_WIDTH + BAR_GAP) + 1;
            const index = (labelRow * cols + colStart) * 2;

            if (index + 1 < buffer.length) {
                buffer[index] = 65 + b; // 'A'..'L'
                buffer[index + 1] = (0 << 16) | (255 << 8) | fg;
            }
        }
    }
}

// How many rows the React heading occupies before the bars start
// TabBar(3) + paddingTop(1) + SectionHeading(1) + subtitle(1) + values(1) + marginTop(1) = 8
const GRAPH_HEADER_ROWS = 8;

const GraphSection = ({ active }: { active: boolean }) => {
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
        if (!active) {
            return;
        }

        const app = (globalThis as any).__ratatatApp;

        if (!app) {
            return;
        }

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
                    <Text color={barColors[i % barColors.length]} key={i}>
                        {String(p).padStart(3)}%
                    </Text>
                ))}
            </Box>
            {/* The bars themselves are painted into the buffer by paintGraph() above */}
            {/* Reserve vertical space so React lays out the heading correctly */}
            <Box height={barRows + 1} />
        </Box>
    );
};

// ─── Live ─────────────────────────────────────────────────────────────────────

const LiveSection = () => {
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
            ink: "8,215",
            label: "initial mount (simple)",
            note: "ops/sec ↑  cold reconcile, 2 text nodes",
            ratatat: "67,630",
            speedup: "8.2×",
        },
        {
            ink: "1,421",
            label: "initial mount (complex)",
            note: "ops/sec ↑  cold reconcile, borders + 3 panels",
            ratatat: "41,253",
            speedup: "29×",
        },
        {
            ink: "8,095",
            label: "rerender (simple)",
            note: "ops/sec ↑  warm tree, counter increments each frame",
            ratatat: "95,175",
            speedup: "11.8×",
        },
        {
            ink: "1,384",
            label: "rerender (complex)",
            note: "ops/sec ↑  warm tree, all panels update each frame",
            ratatat: "49,852",
            speedup: "36×",
        },
        {
            ink: "1,586 µs",
            label: "p99 latency (complex)",
            note: "time/op ↓  worst-case frame — tail latency matters",
            ratatat: "23 µs",
            speedup: "68×",
        },
    ];

    return (
        <Box flexDirection="column" gap={1}>
            <SectionHeading title="Live Stats" />

            {/* Clock row */}
            <Box borderColor="cyan" borderStyle="round" flexDirection="row" gap={3} paddingX={2} paddingY={1}>
                <Box flexDirection="column" width={12}>
                    <Text dim>Time</Text>
                    <Text bold color="green">
                        {time}
                    </Text>
                </Box>
                <Box flexDirection="column" width={22}>
                    <Text dim>Date</Text>
                    <Text color="cyan">{date}</Text>
                </Box>
                <Box flexDirection="column" width={10}>
                    <Text dim>Frame</Text>
                    <Text bold color="yellow">
                        {frame}
                    </Text>
                </Box>
                <Box flexDirection="column" width={14}>
                    <Text dim>Terminal</Text>
                    <Text bold color="magenta">
                        {columns}×{rows}
                    </Text>
                </Box>
                <Box flexDirection="column">
                    <Text dim>Sparkline</Text>
                    <Box flexDirection="row">
                        {sparkData.map((v, i) => (
                            <Text color={v > 5 ? "green" : v > 3 ? "yellow" : "red"} key={i}>
                                {sparkChars[v]}
                            </Text>
                        ))}
                    </Box>
                </Box>
            </Box>

            {/* Benchmark table */}
            <Box borderColor="yellow" borderStyle="round" flexDirection="column" paddingX={2} paddingY={1}>
                <Box flexDirection="row" marginBottom={1}>
                    <Text bold color="yellow">
                        Ratatat vs Ink — benchmark{" "}
                    </Text>
                    <Text dim>ops/sec, higher is better</Text>
                </Box>
                {/* Header */}
                <Box flexDirection="row">
                    <Text bold dim>
                        {"Suite".padEnd(28)}
                    </Text>
                    <Text bold dim>
                        {"Ratatat".padEnd(14)}
                    </Text>
                    <Text bold dim>
                        {"Ink".padEnd(14)}
                    </Text>
                    <Text bold dim>
                        {"Speedup".padEnd(10)}
                    </Text>
                    <Text bold dim>
                        Notes
                    </Text>
                </Box>
                <Box flexDirection="row">
                    <Text dim>{"─".repeat(74)}</Text>
                </Box>
                {/* Rows */}
                {benchRows.map((r, i) => (
                    <Box flexDirection="row" key={i}>
                        <Text color="white">{r.label.padEnd(28)}</Text>
                        <Text bold color="cyan">
                            {r.ratatat.padEnd(14)}
                        </Text>
                        <Text color="gray">{r.ink.padEnd(14)}</Text>
                        <Text bold color="green">
                            {`🚀 ${r.speedup.padEnd(7)}`}
                        </Text>
                        <Text dim>{r.note}</Text>
                    </Box>
                ))}
                <Box flexDirection="row" marginTop={1}>
                    <Text dim>stress test </Text>
                    <Text bold color="green">
                        700 FPS sustained
                    </Text>
                    <Text dim> · 8,648 cells/frame · 188×50 terminal · zero memory growth</Text>
                </Box>
            </Box>
        </Box>
    );
};

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

const IncrementalSection = ({ active }: { active: boolean }) => {
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [timestamp, setTimestamp] = useState(new Date().toLocaleTimeString());
    const [counter, setCounter] = useState(0);
    const [fps, setFps] = useState(0);
    const [p1, setP1] = useState(0);
    const [p2, setP2] = useState(33);
    const [p3, setP3] = useState(66);
    const [randValue, setRandValue] = useState(0);
    const LOG_COUNT = 4;
    const [logLines, setLogLines] = useState(() => Array.from({ length: LOG_COUNT }, (_, i) => incLogLine(i)));

    // Clock — 1s
    useEffect(() => {
        if (!active) {
            return;
        }

        const t = setInterval(() => {
            setTimestamp(new Date().toLocaleTimeString());
            setCounter((c) => c + 1);
        }, 1000);

        return () => clearInterval(t);
    }, [active]);

    // High-freq updates — ~60fps
    useEffect(() => {
        if (!active) {
            return;
        }

        let frameCount = 0;
        let lastFps = Date.now();
        let loopFrame = 0;
        const t = setInterval(() => {
            loopFrame++;
            setP1((p) => (p + 1) % 101);
            setP2((p) => (p + 2) % 101);
            setP3((p) => (p + 3) % 101);
            setRandValue(Math.floor(Math.random() * 1000));
            setLogLines((previous) => {
                const next = [...previous];

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

            if (loopFrame % 10_000 === 0) {
                try {
                    performance.clearMeasures();
                    performance.clearMarks();
                } catch {}
            }
        }, 16);

        return () => clearInterval(t);
    }, [active]);

    useInput((input, key) => {
        if (!active) {
            return;
        }

        if (key.upArrow) {
            setSelectedIndex((i) => (i === 0 ? INC_SERVICES.length - 1 : i - 1));
        }

        if (key.downArrow) {
            setSelectedIndex((i) => (i === INC_SERVICES.length - 1 ? 0 : i + 1));
        }
    });

    return (
        <Box flexDirection="column" gap={1}>
            <SectionHeading title="Incremental Rendering" />

            {/* Header stats */}
            <Box borderColor="cyan" borderStyle="round" flexShrink={0} paddingX={2} paddingY={1}>
                <Box flexDirection="column">
                    <Box flexDirection="row" gap={4}>
                        <Text>
                            Time:{" "}
                            <Text bold color="green">
                                {timestamp}
                            </Text>
                        </Text>
                        <Text>
                            Updates:{" "}
                            <Text bold color="yellow">
                                {counter}
                            </Text>
                        </Text>
                        <Text>
                            Rand: <Text color="cyan">{randValue}</Text>
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
            <Box borderColor="yellow" borderStyle="single" flexShrink={0} paddingX={2} paddingY={1}>
                <Box flexDirection="column">
                    <Text bold color="yellow">
                        Live Logs <Text dim>1-2 lines update per frame at ~60fps</Text>
                    </Text>
                    {logLines.map((line, i) => (
                        <Text color="green" dim key={i}>
                            {line}
                        </Text>
                    ))}
                </Box>
            </Box>

            {/* Service list */}
            <Box borderColor="gray" borderStyle="single" paddingX={2} paddingY={1}>
                <Box flexDirection="column">
                    <Text bold color="magenta">
                        System Services <Text dim>↑↓ to navigate</Text>
                    </Text>
                    {INC_SERVICES.map((svc, i) => {
                        const selected = i === selectedIndex;

                        return (
                            <Text bold={selected} color={selected ? "cyan" : "white"} key={i}>
                                {selected ? "▶ " : "  "}
                                {svc}
                            </Text>
                        );
                    })}
                </Box>
            </Box>

            {/* Selected footer */}
            <Box borderColor="magenta" borderStyle="round" flexShrink={0} paddingX={2}>
                <Text dim>Selected: </Text>
                <Text bold color="magenta">
                    {INC_SERVICES[selectedIndex].split(" - ")[0]}
                </Text>
            </Box>
        </Box>
    );
};

// ─── UI (combined: Borders · Colors · Text · Backgrounds · Primitives) ───────

const SELECT_COLORS = [
    { color: "red", name: "Red" },
    { color: "green", name: "Green" },
    { color: "yellow", name: "Yellow" },
    { color: "blue", name: "Blue" },
    { color: "magenta", name: "Magenta" },
    { color: "cyan", name: "Cyan" },
    { color: "white", name: "White" },
    { color: "gray", name: "Gray" },
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

const PrimitivesSubsection = ({ active }: { active: boolean }) => {
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [buildProgress, setBuildProgress] = useState(0);
    const [uploadProgress, setUploadProgress] = useState(12);
    const [syncing, setSyncing] = useState(true);

    useEffect(() => {
        if (!active) {
            return;
        }

        const t = setInterval(() => {
            setBuildProgress((p) => {
                const next = p >= 100 ? 0 : p + 1;

                if (next === 0) {
                    setSyncing((s) => !s);
                }

                return next;
            });
            setUploadProgress((p) => (p >= 100 ? 0 : p + 2));
        }, 80);

        return () => clearInterval(t);
    }, [active]);

    useInput((input, key) => {
        if (!active) {
            return;
        }

        if (key.upArrow || input === "k") {
            setSelectedIndex((i) => (i === 0 ? SELECT_COLORS.length - 1 : i - 1));
        }

        if (key.downArrow || input === "j") {
            setSelectedIndex((i) => (i === SELECT_COLORS.length - 1 ? 0 : i + 1));
        }
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
                    <Box borderColor={selected.color} borderStyle="round" flexDirection="column" paddingX={1} paddingY={1}>
                        {SELECT_COLORS.map((item, i) => {
                            const isSelected = i === selectedIndex;

                            return (
                                <Box flexDirection="row" key={item.name}>
                                    <Text bold={isSelected} color={isSelected ? item.color : "gray"}>
                                        {isSelected ? "▶ " : "  "}
                                    </Text>
                                    <Text bold={isSelected} color={isSelected ? item.color : "gray"}>
                                        {item.name}
                                    </Text>
                                </Box>
                            );
                        })}
                    </Box>
                    <Box borderColor={selected.color} borderStyle="single" paddingX={2} paddingY={1}>
                        <Text>
                            Selected:{" "}
                            <Text bold color={selected.color}>
                                {selected.name}
                            </Text>
                        </Text>
                    </Box>
                </Box>
                <Box flexDirection="column" flexGrow={1} gap={1}>
                    <Text bold>Built-in components</Text>
                    <Box borderColor="cyan" borderStyle="single" flexDirection="column" gap={1} paddingX={1} paddingY={1}>
                        <Box flexDirection="row" gap={1}>
                            <Spinner color="cyan" />
                            <Text>default spinner</Text>
                        </Box>
                        <Box flexDirection="row" gap={1}>
                            <Spinner color="yellow" frames={["-", "\\", "|", "/"]} interval={120} />
                            <Text dim>ascii frames</Text>
                        </Box>
                        <Box flexDirection="row" gap={1}>
                            {syncing ? <Spinner color="magenta" interval={90} /> : <Text color="green">✔</Text>}
                            <Text color={syncing ? "magenta" : "green"}>{syncing ? "syncing metadata…" : "metadata synced"}</Text>
                        </Box>
                        <Box flexDirection="row" gap={1}>
                            <Text dim>build</Text>
                            <ProgressBar color="green" value={buildProgress} width={16} />
                        </Box>
                        <Box flexDirection="row" gap={1}>
                            <Text dim>upload</Text>
                            <ProgressBar
                                bracket={false}
                                color="yellow"
                                completeChar="■"
                                incompleteChar="·"
                                showPercentage={false}
                                value={uploadProgress}
                                width={16}
                            />
                            <Text color="yellow">{String(uploadProgress).padStart(3)}%</Text>
                        </Box>
                        <Box flexDirection="row" gap={1}>
                            <Text dim>assets</Text>
                            <ProgressBar color="blue" max={60} value={45} width={16} />
                        </Box>
                    </Box>

                    <Text bold>User table</Text>
                    <Box borderColor="gray" borderStyle="round" flexDirection="column" paddingX={1} paddingY={1}>
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
                            <Box flexDirection="row" key={user.id}>
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
                                    <Text bold color={statusColor(user.status)}>
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
};

const UI_SUBSECTIONS = ["Borders", "Colors", "Text", "Backgrounds", "Primitives"] as const;

type UiSubsection = (typeof UI_SUBSECTIONS)[number];

const UiSection = ({ active }: { active: boolean }) => {
    const [subIndex, setSubIndex] = useState(0);

    useInput((_input, key) => {
        if (!active) {
            return;
        }

        if (key.upArrow) {
            setSubIndex((i) => Math.max(0, i - 1));
        }

        if (key.downArrow) {
            setSubIndex((i) => Math.min(UI_SUBSECTIONS.length - 1, i + 1));
        }
    });

    const current: UiSubsection = UI_SUBSECTIONS[subIndex];

    return (
        <Box flexDirection="row" height="100%">
            {/* Left sidebar menu */}
            <Box borderColor="gray" borderStyle="single" flexDirection="column" flexShrink={0} paddingY={1} width={16}>
                {UI_SUBSECTIONS.map((name, i) => (
                    <Box backgroundColor={i === subIndex ? "cyan" : undefined} key={name} paddingX={1}>
                        <Text bold={i === subIndex} color={i === subIndex ? "black" : "gray"}>
                            {i === subIndex ? "▶ " : "  "}
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
};

// ─── Tab bar (top) ───────────────────────────────────────────────────────────

const TabBar = ({ current, onSelect }: { current: number; onSelect: (i: number) => void }) => {
    // Calculate click regions for each tab.
    // Layout: border(1) + leading-space(1) + for each tab: paddingX(1) + name + paddingX(1) + marginRight(1)
    const hitRegions = React.useMemo(() => {
        let x = 2; // border col 0 + leading space col 1

        return SECTIONS.map((s) => {
            const start = x;
            const width = s.length + 2; // paddingX(1) each side

            x += width + 1; // +marginRight(1)

            return { end: start + width - 1, start };
        });
    }, []);

    useMouse((e) => {
        if (e.button !== "left") {
            return;
        }

        if (e.y !== 1) {
            return;
        } // tab bar is always row 1 (border on row 0, content row 1)

        const hit = hitRegions.findIndex((r) => e.x >= r.start && e.x <= r.end);

        if (hit !== -1) {
            onSelect(hit);
        }
    });

    return (
        <Box borderColor="gray" borderStyle="single" flexShrink={0}>
            <Text> </Text>
            {SECTIONS.map((s, i) => {
                const active = i === current;

                return (
                    <Box key={s} marginRight={1}>
                        {active ? (
                            <Box backgroundColor="cyan" paddingX={1}>
                                <Text bold color="black">
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
            <Text dim>navigate ◀ ▶ or click | PgUp/PgDn scroll | Q quit </Text>
        </Box>
    );
};

// ─── Static section ──────────────────────────────────────────────────────────

type Task = { id: number; ms: number; name: string; ok: boolean };

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

const StaticSection = ({ active }: { active: boolean }) => {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [running, setRunning] = useState<string | null>(null);
    const counterRef = useRef(0);

    useEffect(() => {
        if (!active) {
            return;
        }

        let cancelled = false;

        const runNext = () => {
            if (cancelled) {
                return;
            }

            const i = counterRef.current % TASK_NAMES.length;
            const name = TASK_NAMES[i]!;
            const ms = 80 + Math.floor(Math.random() * 200);

            setRunning(name);

            setTimeout(() => {
                if (cancelled) {
                    return;
                }

                const ok = Math.random() > 0.1;

                setTasks((previous) => [...previous, { id: counterRef.current, ms, name, ok }]);
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
            <Box borderColor="gray" borderStyle="single" flexDirection="column" height={20}>
                <Static items={tasks}>
                    {(task: Task) => (
                        <Box key={task.id}>
                            <Text color={task.ok ? "green" : "red"}>{task.ok ? " ✔" : " ✘"} </Text>
                            <Box width={24}>
                                <Text>{task.name}</Text>
                            </Box>
                            <Text dim>
                                {task.ms}
                                ms
                            </Text>
                        </Box>
                    )}
                </Static>
            </Box>

            {/* Live status — always visible below the log window */}
            <Box flexDirection="column" marginTop={1}>
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
                    <Text dim>
                        total:
                        {tasks.length}
                    </Text>
                    <Text color="green">✔{passed}</Text>
                    {failed > 0 && <Text color="red">✘{failed}</Text>}
                </Box>
            </Box>
        </Box>
    );
};

// ─── Mouse ────────────────────────────────────────────────────────────────────

interface MouseLogEntry {
    color: string;
    id: number;
    text: string;
}

let mouseLogId = 0;

const MouseSection = ({ active }: { active: boolean }) => {
    const { rows } = useWindowSize();
    const [log, setLog] = useState<MouseLogEntry[]>([
        { color: "dim", id: mouseLogId++, text: "Click · right-click · scroll wheel" },
        { color: "dim", id: mouseLogId++, text: "Type below — cursor, backspace, Ctrl+U/K/W" },
        { color: "dim", id: mouseLogId++, text: "Paste with ⌘V / ctrl+shift+V" },
    ]);

    const addLog = (text: string, color = "white") => setLog((previous) => [...previous, { color, id: mouseLogId++, text }]);

    // Mouse events
    useMouse((e) => {
        if (!active) {
            return;
        }

        switch (e.button) {
            case "left": {
                addLog(`click  (${e.x}, ${e.y})${e.shift ? " +shift" : ""}${e.ctrl ? " +ctrl" : ""}`, "cyan");

                break;
            }
            case "middle": {
                addLog(`middle (${e.x}, ${e.y})`, "magenta");

                break;
            }
            case "right": {
                addLog(`right  (${e.x}, ${e.y})`, "yellow");

                break;
            }
            case "scrollDown": {
                scroll.scrollBy(1);

                break;
            }
            case "scrollUp": {
                scroll.scrollBy(-1);

                break;
            }
            // No default
        }
    });

    // Text input
    const CHROME = 8; // section header ~3, input bar 3, borders/padding
    const logViewport = Math.max(4, rows - CHROME);
    const scroll = useScrollable({ contentHeight: log.length, viewportHeight: logViewport });

    const { clear, cursor, value } = useTextInput({
        isActive: active,
        onSubmit: (v) => {
            if (v.trim()) {
                addLog(`› ${v}`, "green");
            }

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
                    <Text color={entry.color} key={entry.id}>
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
            <Box borderColor="cyan" borderStyle="single" paddingX={1}>
                <Text bold color="cyan">
                    ›{" "}
                </Text>
                <Text>{before}</Text>
                <Text inverse>{atChar}</Text>
                <Text>{after}</Text>
            </Box>
        </Box>
    );
};

// ─── Animated sections drive their own tick loop ─────────────────────────────
// Static sections (Borders, Colors, etc.) produce no renders when idle — the
// FPS HUD will show the true rate, not a forced 10 FPS from an unnecessary timer.

function useAnimationLoop(active: boolean, onTick: (frame: number) => void) {
    const frameRef = React.useRef(0);

    useEffect(() => {
        if (!active) {
            return;
        }

        let running = true;
        let handle: ReturnType<typeof setTimeout>;

        function loop() {
            if (!running) {
                return;
            }

            frameRef.current++;
            onTick(frameRef.current);

            // Clear React scheduler perf entries every 10k frames to prevent
            // the MaxPerformanceEntryBufferExceededWarning from Node's perf_hooks
            if (frameRef.current % 10_000 === 0) {
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

const KitchenSink = () => {
    const { exit } = useApp();
    const [sectionIndex, setSectionIndex] = useState(0);
    const { rows } = useWindowSize();

    // Viewport height: total rows minus tab bar (3 rows) minus DevTools HUD (3 rows)
    const TAB_BAR_HEIGHT = 3;
    const HUD_HEIGHT = 3;
    const viewportHeight = Math.max(4, rows - TAB_BAR_HEIGHT - HUD_HEIGHT);

    // Estimate content height per section (generous — content can exceed viewport)
    const CONTENT_HEIGHTS: Record<SectionName, number> = {
        Focus: 30,
        Graph: 40,
        Incremental: 50,
        Layout: 30,
        Live: 20,
        Mouse: 40,
        Static: 30,
        UI: 80,
    };

    const currentSection = SECTIONS[sectionIndex];
    const contentHeight = CONTENT_HEIGHTS[currentSection] ?? 40;
    const scroll = useScrollable({ contentHeight, viewportHeight });

    useInput((input, key) => {
        // Mouse section has a text input — don't capture letter keys when it's active
        const hasTextInput = currentSection === "Mouse";

        if (!hasTextInput && (input === "q" || input === "Q")) {
            exit();
        }

        // Ctrl+C always quits regardless of section
        if (key.ctrl && input === "c") {
            exit();
        }

        if (key.rightArrow && !hasTextInput) {
            setSectionIndex((i) => Math.min(i + 1, SECTIONS.length - 1));
            scroll.scrollToTop();
        }

        if (key.leftArrow && !hasTextInput) {
            setSectionIndex((i) => Math.max(i - 1, 0));
            scroll.scrollToTop();
        }

        // Page Up/Down scrolls the viewport
        if (key.pageDown) {
            scroll.scrollBy(Math.floor(viewportHeight / 2));
        }

        if (key.pageUp) {
            scroll.scrollBy(-Math.floor(viewportHeight / 2));
        }
    });

    const isGraphActive = currentSection === "Graph";
    const isIncActive = currentSection === "Incremental";
    const isUiActive = currentSection === "UI";
    const isStaticActive = currentSection === "Static";
    const isMouseActive = currentSection === "Mouse";

    return (
        <Box flexDirection="column" flexGrow={1}>
            {/* Tab bar at top */}
            <TabBar current={sectionIndex} onSelect={setSectionIndex} />

            {/* Section content — scrollable viewport */}
            <Box flexDirection="column" flexGrow={1} overflow="scroll" paddingTop={1} paddingX={2} scrollTop={scroll.offset}>
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
};

const { app } = render(
    <DevTools>
        <KitchenSink />
    </DevTools>,
);

(globalThis as any).__ratatatApp = app;
