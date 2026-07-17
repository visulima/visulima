/* eslint-disable jsdoc/lines-before-block */
/**
 * code.tsx — &lt;Code> component demo
 *
 * Controls:
 *   q / Esc     quit
 *
 * Run: node --import @oxc-node/core/register examples/code.tsx
 */

import { render } from "@visulima/tui";
import { Box } from "@visulima/tui/components/box";
import { Text } from "@visulima/tui/components/text";
import { useApp } from "@visulima/tui/hooks/use-app";
import { useInput } from "@visulima/tui/hooks/use-input";
import { Code } from "@visulima/tui-components/code";
import React from "react";

const tsCode = `interface User {
  name: string;
  age: number;
  email?: string;
}

function greet(user: User): string {
  return \`Hello, \${user.name}! You are \${user.age} years old.\`;
}

const users: User[] = [
  { name: "Alice", age: 30, email: "alice@example.com" },
  { name: "Bob", age: 25 },
];

for (const user of users) {
  console.log(greet(user));
}`;

const pyCode = `def fibonacci(n: int) -> list[int]:
    """Generate Fibonacci sequence."""
    if n <= 0:
        return []
    fib = [0, 1]
    for _ in range(2, n):
        fib.append(fib[-1] + fib[-2])
    return fib[:n]

print(fibonacci(10))`;

const App = () => {
    const { exit } = useApp();

    useInput((input, key) => {
        if (key.escape || input === "q") {
            exit();
        }
    });

    return (
        <Box flexDirection="column" gap={1} padding={1}>
            <Text bold color="cyan">
                Code component demo
            </Text>
            <Text dimColor>q / Esc to quit</Text>

            <Box flexDirection="column" gap={1}>
                <Text bold>TypeScript (with line numbers):</Text>
                <Code code={tsCode} language="typescript" showLineNumbers />
            </Box>

            <Box flexDirection="column" gap={1}>
                <Text bold>Python (with highlighted lines):</Text>
                <Code code={pyCode} highlightLines={new Set([1, 6, 9])} language="python" showLineNumbers />
            </Box>

            <Box flexDirection="column" gap={1}>
                <Text bold>Plain text (no language):</Text>
                <Code code={"No syntax highlighting here.\nJust plain text."} />
            </Box>
        </Box>
    );
};

render(<App />);
