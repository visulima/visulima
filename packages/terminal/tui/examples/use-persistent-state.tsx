/**
 * use-persistent-state.tsx — state backed by a pluggable storage
 *
 * This example uses the in-memory storage so it doesn't touch your disk.
 * In production, the default backend persists under
 * ~/.cache/visulima-tui/&lt;namespace>.json.
 *
 * Controls:
 *   ↑ / ↓      increment / decrement counter (persisted)
 *   Tab        cycle theme
 *   r          reset to defaults
 *   Esc        quit
 *
 * Run: node --import @oxc-node/core/register examples/use-persistent-state.tsx
 */
import { render } from "@visulima/tui";
import { Box } from "@visulima/tui/components/box";
import { Text } from "@visulima/tui/components/text";
import { useApp } from "@visulima/tui/hooks/use-app";
import { useInput } from "@visulima/tui/hooks/use-input";
import { createMemoryStorage, usePersistentState } from "@visulima/tui/hooks/use-persistent-state";
import React, { useMemo } from "react";

const THEMES = ["light", "dark", "solarized"] as const;

const App = () => {
    const { exit } = useApp();
    const storage = useMemo(() => createMemoryStorage(), []);
    const [count, setCount] = usePersistentState("counter", 0, { storage });
    const [theme, setTheme] = usePersistentState("theme", "light", { storage });

    useInput((_input, key) => {
        if (key.escape) {
            exit();
        }

        if (key.upArrow) {
            setCount((n) => n + 1);
        } else if (key.downArrow) {
            setCount((n) => Math.max(0, n - 1));
        } else if (key.tab) {
            setTheme((current) => {
                const index = THEMES.indexOf(current as (typeof THEMES)[number]);

                return THEMES[(index + 1) % THEMES.length] ?? "light";
            });
        } else if (_input === "r") {
            setCount(0);
            setTheme("light");
        }
    });

    return (
        <Box flexDirection="column" gap={1} padding={1}>
            <Text bold color="cyan">
                usePersistentState
            </Text>
            <Text>
                counter:
{" "}
<Text bold>{count}</Text>
            </Text>
            <Text>
                theme:
{" "}
<Text bold>{theme}</Text>
            </Text>
            <Text dimColor>Values survive remount; the in-memory store keeps them alive this session.</Text>
        </Box>
    );
};

render(<App />);
