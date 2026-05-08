/* eslint-disable jsdoc/lines-before-block */
/**
 * use-clipboard.tsx — useClipboard hook demo
 *
 * Demonstrates copying text to the system clipboard via the OSC 52
 * terminal escape sequence. Works in terminals that support OSC 52
 * (Alacritty, Ghostty, Kitty, WezTerm, iTerm2, xterm, foot, etc.).
 *
 * Controls:
 *   1       copy a greeting
 *   2       copy current timestamp
 *   3       copy multi-line text
 *   q / Esc quit
 *
 * Run: node --import @oxc-node/core/register examples/use-clipboard.tsx
 */

import { render } from "@visulima/tui";
import { Box } from "@visulima/tui/components/box";
import { Text } from "@visulima/tui/components/text";
import { useApp } from "@visulima/tui/hooks/use-app";
import { useClipboard } from "@visulima/tui/hooks/use-clipboard";
import { useInput } from "@visulima/tui/hooks/use-input";
import React, { useState } from "react";

const App = () => {
    const { exit } = useApp();
    const { copy, isSupported } = useClipboard();
    const [lastCopied, setLastCopied] = useState<string | undefined>();

    useInput((input, key) => {
        if (key.escape || input === "q") {
            exit();

            return;
        }

        if (input === "1") {
            const text = "Hello from visulima TUI!";

            copy(text);
            setLastCopied(text);

            return;
        }

        if (input === "2") {
            const text = new Date().toISOString();

            copy(text);
            setLastCopied(text);

            return;
        }

        if (input === "3") {
            const text = "Line 1: Multi-line clipboard\nLine 2: content works too\nLine 3: paste this somewhere!";

            copy(text);
            setLastCopied(text);
        }
    });

    return (
        <Box flexDirection="column" gap={1} padding={1}>
            <Text bold color="cyan">
                useClipboard demo
            </Text>

            <Text>
                OSC 52 support:
{" "}
                <Text bold color={isSupported ? "green" : "red"}>
                    {isSupported ? "yes" : "no"}
                </Text>
                {!isSupported && <Text dimColor> (your terminal may not support OSC 52 clipboard)</Text>}
            </Text>

            <Text dimColor>1 copy greeting · 2 copy timestamp · 3 copy multi-line · q quit</Text>

            <Box borderColor="gray" borderStyle="round" flexDirection="column" paddingX={2} paddingY={1}>
                <Text bold>Last copied:</Text>
                {lastCopied
                    ? (
                    <Box flexDirection="column">
                        {lastCopied.split("\n").map((line, index) => (
                            <Text color="green" key={index}>
                                {line}
                            </Text>
                        ))}
                    </Box>
                    )
                    : (
                    <Text dimColor>(nothing copied yet — press 1, 2, or 3)</Text>
                    )}
            </Box>

            {lastCopied && <Text dimColor>Try pasting (Ctrl+V / Cmd+V) in another application to verify!</Text>}
        </Box>
    );
};

render(<App />);
