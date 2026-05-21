/* eslint-disable @typescript-eslint/no-confusing-void-expression, jsdoc/lines-before-block */
/**
 * textarea.tsx — &lt;Textarea> component demo
 *
 * Controls:
 *   Type         enter text
 *   Enter        new line
 *   Meta+Enter   submit
 *   Ctrl+Z       undo
 *   Ctrl+Y       redo
 *   Arrow keys   navigate
 *   Shift+Arrows select text
 *   Ctrl+C       copy selection (to clipboard via OSC 52)
 *   Tab          insert spaces
 *   Ctrl+Q       quit
 *
 * Run: node --import @oxc-node/core/register examples/textarea.tsx
 */

import { render } from "@visulima/tui";
import { Box } from "@visulima/tui/components/box";
import { Text } from "@visulima/tui/components/text";
import { Textarea } from "@visulima/tui/components/textarea";
import { useApp } from "@visulima/tui/hooks/use-app";
import { useInput } from "@visulima/tui/hooks/use-input";
import React, { useState } from "react";

const App = () => {
    const { exit } = useApp();
    const [submitted, setSubmitted] = useState<string | undefined>();
    const [charCount, setCharCount] = useState(0);
    const [lineCount, setLineCount] = useState(1);

    // Textarea captures Escape to clear selection, so we use Ctrl+Q to quit
    useInput((input, key) => {
        if (key.ctrl && input === "q") {
            exit();
        }
    });

    return (
        <Box flexDirection="column" gap={1} padding={1}>
            <Text bold color="cyan">
                Textarea demo
            </Text>
            <Text dimColor>Type to edit · Enter for newline · Meta+Enter to submit · Ctrl+Z/Y undo/redo · Ctrl+Q quit</Text>

            <Box borderColor="green" borderStyle="round" flexDirection="column" paddingX={1}>
                <Textarea
                    onChange={(value) => {
                        setCharCount(value.length);
                        setLineCount(value.split("\n").length);
                    }}
                    onSubmit={(value) => setSubmitted(value)}
                    placeholder="Write something here..."
                    rows={8}
                    showLineNumbers
                    tabSize={4}
                />
            </Box>

            <Text dimColor>
                {lineCount} line
                {lineCount === 1 ? "" : "s"} ·{charCount} char
                {charCount === 1 ? "" : "s"}
            </Text>

            {submitted !== undefined && (
                <Box borderColor="yellow" borderStyle="round" flexDirection="column" paddingX={1}>
                    <Text bold color="yellow">
                        Submitted:
                    </Text>
                    <Text>{submitted}</Text>
                </Box>
            )}

            <Box flexDirection="column" gap={1} marginTop={1}>
                <Text bold color="cyan">
                    With max rows (auto-grow)
                </Text>
                <Box borderColor="blue" borderStyle="round" paddingX={1}>
                    <Textarea maxRows={10} placeholder="This textarea grows from 3 to 10 rows..." rows={3} />
                </Box>
            </Box>

            <Box flexDirection="column" gap={1} marginTop={1}>
                <Text bold color="cyan">
                    Disabled textarea
                </Text>
                <Box borderColor="gray" borderStyle="round" paddingX={1}>
                    <Textarea defaultValue={"This content\nis read-only\nand dimmed."} isDisabled rows={3} />
                </Box>
            </Box>
        </Box>
    );
};

render(<App />);
