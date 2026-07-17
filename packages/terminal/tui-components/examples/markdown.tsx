/* eslint-disable jsdoc/lines-before-block */
/**
 * markdown.tsx — &lt;Markdown> component demo
 *
 * Controls:
 *   q / Esc     quit
 *
 * Run: node --import @oxc-node/core/register examples/markdown.tsx
 */

import { render } from "@visulima/tui";
import { Box } from "@visulima/tui/components/box";
import { Text } from "@visulima/tui/components/text";
import { useApp } from "@visulima/tui/hooks/use-app";
import { useInput } from "@visulima/tui/hooks/use-input";
import { Markdown } from "@visulima/tui-components/markdown";
import React from "react";

const sampleMarkdown = `# Markdown Demo

This is a **bold** statement with *italic* emphasis and ~~strikethrough~~ text.

## Code Blocks

Inline code: \`console.log("hello")\`

\`\`\`typescript
interface Config {
  port: number;
  host: string;
  debug?: boolean;
}

const config: Config = {
  port: 3000,
  host: "localhost",
  debug: true,
};
\`\`\`

## Lists

### Unordered
- First item
- Second item
- Third item

### Ordered
1. Install dependencies
2. Configure the project
3. Deploy

## Blockquote

> "The best way to predict the future is to invent it."
> — Alan Kay

## Links

Check out [Visulima](https://visulima.com) for more.

---

## Table

| Feature | Status | Notes |
|---------|--------|-------|
| Markdown | Done | Full GFM support |
| Code | Done | Shiki highlighting |
| Diff | Done | Unified + split |

That's all! 🎉
`;

const App = () => {
    const { exit } = useApp();

    useInput((input, key) => {
        if (key.escape || input === "q") {
            exit();
        }
    });

    return (
        <Box flexDirection="column" padding={1}>
            <Text bold color="cyan">
                Markdown component demo
            </Text>
            <Text dimColor>q / Esc to quit</Text>
            <Box marginTop={1}>
                <Markdown>{sampleMarkdown}</Markdown>
            </Box>
        </Box>
    );
};

render(<App />);
