import { render } from "@visulima/tui";
import { Box } from "@visulima/tui/components/box";
import { Text } from "@visulima/tui/components/text";
import { useApp } from "@visulima/tui/hooks/use-app";
import { useKeyBindings } from "@visulima/tui/hooks/use-key-bindings";
import { Help } from "@visulima/tui-components/help";
import React, { useState } from "react";

const App = () => {
    const { exit } = useApp();
    const [count, setCount] = useState(0);
    const [showFullHelp, setShowFullHelp] = useState(false);

    const { bindings } = useKeyBindings([
        { binding: { description: "Increment", group: "Counter", key: ["upArrow", "k"] }, handler: () => { setCount((c) => c + 1); } },
        { binding: { description: "Decrement", group: "Counter", key: ["downArrow", "j"] }, handler: () => { setCount((c) => c - 1); } },
        { binding: { description: "Reset", group: "Counter", key: "r" }, handler: () => { setCount(0); } },
        { binding: { description: "Toggle help", group: "General", key: "?" }, handler: () => { setShowFullHelp((s) => !s); } },
        { binding: { description: "Quit", group: "General", key: "q" }, handler: () => { exit(); } },
    ]);

    return (
        <Box flexDirection="column" gap={1} padding={1}>
            <Text bold color="cyan">
                Help component demo
            </Text>
            <Box borderColor="cyan" borderStyle="round" flexDirection="column" paddingX={2} paddingY={1}>
                <Text>
                    Count:{" "}
                    <Text bold color="yellow">
                        {count}
                    </Text>
                </Text>
            </Box>
            <Help bindings={bindings} mode={showFullHelp ? "full" : "short"} />
        </Box>
    );
};

render(<App />);
