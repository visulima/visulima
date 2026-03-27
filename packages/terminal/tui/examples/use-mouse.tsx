/**
 * examples/use-mouse.tsx
 *
 * Demonstrates useMouse, useTextInput, and bracketed paste working together.
 *
 *   node --import @oxc-node/core/register examples/use-mouse.tsx
 *
 * - Click anywhere to drop a marker at that position
 * - Scroll wheel to scroll the event log
 * - Type in the input bar (left/right/home/end/backspace/delete, ctrl+u/k/w)
 * - Paste text with ⌘V / ctrl+shift+V (bracketed paste — no spurious newlines)
 * - Enter to submit, Ctrl+C to quit
 */

import React, { useState, useCallback } from "react";
import { render, Box, Text, useApp, useWindowSize, useMouse, useTextInput, useScrollable } from "@visulima/tui/react";

interface LogEntry {
    id: number;
    text: string;
    color: string;
}

let nextId = 0;

function App() {
    const { exit } = useApp();
    const { columns, rows } = useWindowSize();
    const [log, setLog] = useState<LogEntry[]>([{ id: nextId++, text: "Click anywhere · scroll wheel · type below · ⌘V to paste", color: "dim" }]);
    const [submitted, setSubmitted] = useState<string[]>([]);

    const addLog = useCallback((text: string, color = "white") => {
        setLog((prev) => [...prev, { id: nextId++, text, color }]);
    }, []);

    // ── Mouse ──────────────────────────────────────────────────────────────────
    useMouse((e) => {
        if (e.button === "left") {
            addLog(`click  (${e.x}, ${e.y})${e.shift ? " +shift" : ""}${e.ctrl ? " +ctrl" : ""}`, "cyan");
        } else if (e.button === "right") {
            addLog(`right  (${e.x}, ${e.y})`, "yellow");
        } else if (e.button === "scrollUp") {
            scroll.scrollBy(-1);
        } else if (e.button === "scrollDown") {
            scroll.scrollBy(1);
        }
    });

    // ── Text input ─────────────────────────────────────────────────────────────
    const { value, cursor, clear } = useTextInput({
        onSubmit: (v) => {
            if (v.trim()) {
                addLog(`submit "${v}"`, "green");
                setSubmitted((prev) => [...prev, v]);
            }
            clear();
        },
        onChange: () => {},
    });

    // ── Scrollable log ─────────────────────────────────────────────────────────
    const CHROME = 5; // input bar (3) + header (1) + bottom border (1)
    const logViewport = Math.max(4, rows - CHROME);
    const scroll = useScrollable({ viewportHeight: logViewport, contentHeight: log.length });

    const visibleLog = log.slice(scroll.offset, scroll.offset + logViewport);

    // Render cursor: inverse block at cursor position, trailing space at end
    const before = value.slice(0, cursor);
    const atChar = value[cursor] ?? " ";
    const after = value.slice(cursor + 1);

    return (
        <Box flexDirection="column" width={columns} height={rows}>
            {/* Header */}
            <Box borderStyle="single" borderColor="magenta" paddingX={1}>
                <Text bold color="magenta">
                    useMouse · useTextInput · bracketed paste
                </Text>
                <Text dim> Ctrl+C to quit</Text>
            </Box>

            {/* Event log */}
            <Box flexDirection="column" flexGrow={1} overflow="hidden">
                {visibleLog.map((entry) => (
                    <Text key={entry.id} color={entry.color}>
                        {" "}
                        {entry.text}
                    </Text>
                ))}
                {/* fill empty rows so layout stays stable */}
                {Array.from({ length: Math.max(0, logViewport - visibleLog.length) }).map((_, i) => (
                    <Text key={`empty-${i}`}> </Text>
                ))}
            </Box>

            {/* Scroll indicator */}
            {log.length > logViewport && (
                <Box justifyContent="flex-end" paddingRight={1}>
                    <Text dim>
                        {scroll.offset + 1}–{Math.min(scroll.offset + logViewport, log.length)}/{log.length} ↑↓ scroll
                    </Text>
                </Box>
            )}

            {/* Input bar */}
            <Box borderStyle="single" borderColor="cyan" paddingX={1}>
                <Text color="cyan">› </Text>
                <Text>{before}</Text>
                <Text inverse>{atChar}</Text>
                <Text>{after}</Text>
            </Box>
        </Box>
    );
}

render(<App />);
