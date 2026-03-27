/**
 * use-paste.tsx — usePaste hook demo
 *
 * Demonstrates Ink-compatible paste channel behavior:
 * - When paste handler is active, pasted text goes to usePaste()
 * - When paste handler is disabled, pasted text falls back to useInput()
 *
 * Controls:
 *   p         toggle paste handler active/inactive
 *   c         clear event log
 *   q / Esc   quit
 *
 * Run: node --import @oxc-node/core/register examples/use-paste.tsx
 */

import React, { useState } from "react";
import { render, Box, Text, useApp, useInput, usePaste } from "@visulima/tui/react";

type EventLine = {
    id: number;
    source: "usePaste" | "useInput";
    payload: string;
};

function normalizeNewlines(text: string) {
    return text.replace(/\r\n?/g, "\n");
}

function App() {
    const { exit } = useApp();
    const [pasteActive, setPasteActive] = useState(true);
    const [events, setEvents] = useState<EventLine[]>([]);

    const pushEvent = (source: EventLine["source"], payload: string) => {
        const normalized = normalizeNewlines(payload);
        setEvents((prev) => {
            const next = [...prev, { id: prev.length + 1, source, payload: normalized }];
            // Keep a bounded log so giant pastes don't consume the full UI forever.
            return next.slice(-16);
        });
    };

    usePaste(
        (text) => {
            pushEvent("usePaste", text);
        },
        { isActive: pasteActive },
    );

    useInput((input, key) => {
        if (key.escape || input === "q" || (key.ctrl && input === "c")) {
            exit();
            return;
        }

        if (input === "p") {
            setPasteActive((v) => !v);
            return;
        }

        if (input === "c") {
            setEvents([]);
            return;
        }

        // useInput always sees typed keys; it only sees paste payload when usePaste
        // has no active listener (fallback behavior).
        if (input.length > 0) {
            pushEvent("useInput", input);
        }
    });

    const pasteCount = events.filter((e) => e.source === "usePaste").length;
    const inputCount = events.filter((e) => e.source === "useInput").length;

    return (
        <Box flexDirection="column" gap={1}>
            <Text bold color="cyan">
                usePaste demo
            </Text>

            <Text>
                paste handler:{" "}
                <Text color={pasteActive ? "green" : "yellow"} bold>
                    {pasteActive ? "active" : "inactive"}
                </Text>
                <Text dim> · active routes paste to usePaste; inactive falls back to useInput</Text>
            </Text>

            <Text dim>p toggle paste handler · c clear log · q/Esc quit · paste multiline text to test channel routing</Text>

            <Box flexDirection="column" gap={1}>
                <Box borderStyle="round" borderColor="cyan" paddingX={1} paddingY={1} flexDirection="column" gap={1}>
                    <Text bold>What active/inactive means</Text>
                    <Text>
                        • <Text color="green">active</Text>: paste is delivered as one chunk to <Text color="green">usePaste</Text>
                    </Text>
                    <Text>
                        • <Text color="yellow">inactive</Text>: no paste listeners, so paste falls back to <Text color="yellow">useInput</Text>
                    </Text>
                    <Text dim>this keeps old apps working while giving prompts/editors a clean paste channel</Text>
                    <Box flexDirection="row" gap={3}>
                        <Text>
                            usePaste events: <Text color="green">{pasteCount}</Text>
                        </Text>
                        <Text>
                            useInput events: <Text color="yellow">{inputCount}</Text>
                        </Text>
                    </Box>
                </Box>

                <Box borderStyle="round" borderColor="gray" paddingX={1} paddingY={1} flexDirection="column" gap={1}>
                    <Text bold>Events</Text>

                    {events.length === 0 && <Text dim>(no events yet)</Text>}

                    {events.map((item) => {
                        const lines = item.payload.split("\n");
                        return (
                            <Box key={item.id} flexDirection="column">
                                <Text color={item.source === "usePaste" ? "green" : "yellow"} bold>
                                    [{item.source}] len={item.payload.length} lines={lines.length}
                                </Text>
                                {/* Text nodes are single-line in the current renderer; render payload as explicit lines. */}
                                <Box flexDirection="column">
                                    {lines.map((line, i) => (
                                        <Text key={i}>{line.length > 0 ? line : " "}</Text>
                                    ))}
                                </Box>
                                <Text dim>{"─".repeat(40)}</Text>
                            </Box>
                        );
                    })}
                </Box>
            </Box>
        </Box>
    );
}

render(<App />);
