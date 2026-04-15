/* eslint-disable jsdoc/lines-before-block */
/**
 * diff-view.tsx — &lt;DiffView> component demo
 *
 * Controls:
 *   s       toggle split/unified mode
 *   i       toggle inline diff
 *   q / Esc quit
 *
 * Run: node --import @oxc-node/core/register examples/diff-view.tsx
 */

import { Box, DiffView, render, Text, useApp, useInput } from "@visulima/tui";
import React, { useState } from "react";

const oldCode = `function greet(name) {
  console.log("Hello, " + name);
  return true;
}

const users = ["Alice", "Bob"];

for (const user of users) {
  greet(user);
}`;

const newCode = `function greet(name, greeting = "Hello") {
  console.log(\`\${greeting}, \${name}!\`);
  return { name, greeting };
}

const users = ["Alice", "Bob", "Charlie"];

for (const user of users) {
  const result = greet(user);
  console.log(result);
}`;

const App = () => {
    const { exit } = useApp();
    const [mode, setMode] = useState<"unified" | "split">("unified");
    const [inlineDiff, setInlineDiff] = useState(true);

    useInput((input, key) => {
        if (key.escape || input === "q") {
            exit();
        }

        if (input === "s") {
            setMode((m) => (m === "unified" ? "split" : "unified"));
        }

        if (input === "i") {
            setInlineDiff((v) => !v);
        }
    });

    return (
        <Box flexDirection="column" gap={1} padding={1}>
            <Text bold color="cyan">
                DiffView component demo
            </Text>
            <Text dimColor>s toggle split/unified · i toggle inline diff · q quit</Text>
            <Text>
                Mode:{" "}
                <Text bold color="yellow">
                    {mode}
                </Text>
                {" · "}
                Inline diff:{" "}
                <Text bold color={inlineDiff ? "green" : "red"}>
                    {inlineDiff ? "on" : "off"}
                </Text>
            </Text>

            <DiffView inlineDiff={inlineDiff} mode={mode} newLabel="greet.js (after)" newText={newCode} oldLabel="greet.js (before)" oldText={oldCode} />
        </Box>
    );
};

render(<App />);
