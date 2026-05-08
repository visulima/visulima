/* eslint-disable @typescript-eslint/no-confusing-void-expression */

/**
 * use-key-chord.tsx — multi-key sequence matcher
 *
 * Shortcuts:
 *   g g          "go to top"
 *   g d          "go to definition"
 *   space f      "format file"
 *   Esc          quit
 *
 * Run: node --import @oxc-node/core/register examples/use-key-chord.tsx
 */
import { render } from "@visulima/tui";
import { Box } from "@visulima/tui/components/box";
import { Text } from "@visulima/tui/components/text";
import { useApp } from "@visulima/tui/hooks/use-app";
import { useHotkey } from "@visulima/tui/hooks/use-hotkey";
import { useKeyChord } from "@visulima/tui/hooks/use-key-chord";
import React, { useState } from "react";

const App = () => {
    const { exit } = useApp();
    const [messages, setMessages] = useState<ReadonlyArray<string>>([]);
    const push = (message: string) => setMessages((current) => [...current.slice(-9), message]);

    useKeyChord(["g", "g"], () => push("go to top"));
    useKeyChord(["g", "d"], () => push("go to definition"));
    useKeyChord(["space", "f"], () => push("format file"));
    useHotkey("escape", exit);

    return (
        <Box flexDirection="column" gap={1} padding={1}>
            <Text bold color="cyan">
                useKeyChord
            </Text>
            <Text dimColor>Try `g g`, `g d`, or `space f`. Partial chords reset after 1s.</Text>
            <Box borderColor="gray" borderStyle="round" flexDirection="column" paddingX={1}>
                <Text bold dimColor>
                    fired
                </Text>
                {messages.length === 0 ? <Text dimColor>(none yet)</Text> : messages.map((m, index) => <Text key={index}>{m}</Text>)}
            </Box>
        </Box>
    );
};

render(<App />);
