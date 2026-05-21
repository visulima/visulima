/* eslint-disable @typescript-eslint/no-use-before-define, sonarjs/no-dead-store, sonarjs/no-unused-vars, unicorn/prevent-abbreviations */

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

import { Box } from "@visulima/tui/components/box";
import { Text } from "@visulima/tui/components/text";
import { render, useApp, useMouse, useScrollable, useTextInput, useWindowSize } from "@visulima/tui/react";
import React, { useCallback, useState } from "react";

interface LogEntry {
    color: string;
    id: number;
    text: string;
}

let nextId = 0;

const App = () => {
    const { exit } = useApp();
    const { columns, rows } = useWindowSize();
    const [log, setLog] = useState<LogEntry[]>([{ color: "dim", id: nextId++, text: "Click anywhere · scroll wheel · type below · ⌘V to paste" }]);
    const [, setSubmitted] = useState<string[]>([]);

    const addLog = useCallback((text: string, color = "white") => {
        setLog((previous) => [...previous, { color, id: nextId++, text }]);
    }, []);

    // ── Mouse ──────────────────────────────────────────────────────────────────
    useMouse((e) => {
        switch (e.button) {
            case "left": {
                addLog(`click  (${e.x}, ${e.y})${e.shift ? " +shift" : ""}${e.ctrl ? " +ctrl" : ""}`, "cyan");

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

    // ── Text input ─────────────────────────────────────────────────────────────
    const { clear, cursor, value } = useTextInput({
        onChange: () => {},
        onSubmit: (v) => {
            if (v.trim()) {
                addLog(`submit "${v}"`, "green");
                setSubmitted((previous) => [...previous, v]);
            }

            clear();
        },
    });

    // ── Scrollable log ─────────────────────────────────────────────────────────
    const CHROME = 5; // input bar (3) + header (1) + bottom border (1)
    const logViewport = Math.max(4, rows - CHROME);
    const scroll = useScrollable({ contentHeight: log.length, viewportHeight: logViewport });

    const visibleLog = log.slice(scroll.offset, scroll.offset + logViewport);

    // Render cursor: inverse block at cursor position, trailing space at end
    const before = value.slice(0, cursor);
    const atChar = value[cursor] ?? " ";
    const after = value.slice(cursor + 1);

    return (
        <Box flexDirection="column" height={rows} width={columns}>
            {/* Header */}
            <Box borderColor="magenta" borderStyle="single" paddingX={1}>
                <Text bold color="magenta">
                    useMouse · useTextInput · bracketed paste
                </Text>
                <Text dim> Ctrl+C to quit</Text>
            </Box>

            {/* Event log */}
            <Box flexDirection="column" flexGrow={1} overflow="hidden">
                {visibleLog.map((entry) => (
                    <Text color={entry.color} key={entry.id}>
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
            <Box borderColor="cyan" borderStyle="single" paddingX={1}>
                <Text color="cyan">› </Text>
                <Text>{before}</Text>
                <Text inverse>{atChar}</Text>
                <Text>{after}</Text>
            </Box>
        </Box>
    );
};

render(<App />);
