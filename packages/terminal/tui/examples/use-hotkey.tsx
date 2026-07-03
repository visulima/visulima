/* eslint-disable @typescript-eslint/no-confusing-void-expression */

/**
 * use-hotkey.tsx — useHotkey demo (string + descriptor shortcuts)
 *
 * Controls:
 *   ?        show help (toggles overlay)
 *   Ctrl+S   "save"
 *   Ctrl+R   "refresh"
 *   Esc      quit
 *
 * Run: node --import @oxc-node/core/register examples/use-hotkey.tsx
 */
import { render } from "@visulima/tui";
import { Box } from "@visulima/tui/components/box";
import { Text } from "@visulima/tui/components/text";
import { useApp } from "@visulima/tui/hooks/use-app";
import { useHotkey } from "@visulima/tui/hooks/use-hotkey";
import React, { useState } from "react";

const App = () => {
    const { exit } = useApp();
    const [log, setLog] = useState<ReadonlyArray<string>>([]);
    const [helpOpen, setHelpOpen] = useState(false);

    const push = (message: string) => setLog((previous) => [...previous.slice(-9), message]);

    useHotkey("?", () => setHelpOpen((v) => !v));
    useHotkey("ctrl+s", () => push(`save @ ${new Date().toLocaleTimeString()}`));
    useHotkey({ ctrl: true, input: "r" }, () => push("refresh"));
    useHotkey("escape", exit);

    return (
        <Box flexDirection="column" gap={1} padding={1}>
            <Text bold color="cyan">
                useHotkey
            </Text>
            <Text dimColor>Press ?, Ctrl+S, Ctrl+R, or Esc</Text>
            {helpOpen && (
                <Box borderColor="yellow" borderStyle="round" flexDirection="column" paddingX={1}>
                    <Text bold>Shortcuts</Text>
                    <Text>? — toggle this help</Text>
                    <Text>Ctrl+S — save</Text>
                    <Text>Ctrl+R — refresh</Text>
                    <Text>Esc — quit</Text>
                </Box>
            )}
            <Box borderColor="gray" borderStyle="round" flexDirection="column" paddingX={1}>
                <Text bold dimColor>
                    log
                </Text>
                {log.length === 0 ? <Text dimColor>(empty)</Text> : log.map((message, index) => <Text key={index}>{message}</Text>)}
            </Box>
        </Box>
    );
};

render(<App />);
