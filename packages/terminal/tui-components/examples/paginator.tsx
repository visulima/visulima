import { render } from "@visulima/tui";
import { Box } from "@visulima/tui/components/box";
import { Text } from "@visulima/tui/components/text";
import { useApp } from "@visulima/tui/hooks/use-app";
import { useInput } from "@visulima/tui/hooks/use-input";
import { Paginator } from "@visulima/tui-components/paginator";
import React, { useState } from "react";

const items = Array.from({ length: 50 }, (_, i) => `Item ${i + 1}`);

const App = () => {
    const { exit } = useApp();
    const [style, setStyle] = useState<"dots" | "fraction" | "numeric">("dots");

    useInput((input, key) => {
        if (key.escape || input === "q") {
            exit();
        } else {
            switch (input) {
                case "1": {
                    setStyle("dots");

                    break;
                }
                case "2": {
                    setStyle("numeric");

                    break;
                }
                case "3": {
                    setStyle("fraction");

                    break;
                }
                // No default
            }
        }
    });

    return (
        <Box flexDirection="column" gap={1} padding={1}>
            <Text bold color="cyan">
                Paginator demo (
{style}
)
            </Text>
            <Box borderColor="cyan" borderStyle="round" flexDirection="column" paddingX={2} paddingY={1}>
                <Paginator indicatorColor="cyan" items={items} pageSize={8} style={style}>
                    {(pageItems, meta) => (
                        <Box flexDirection="column">
                            <Text bold dimColor>
                                Showing
{" "}
{meta.startIndex + 1}
-
{meta.endIndex}
{" "}
of
{" "}
{items.length}
                            </Text>
                            {pageItems.map((item, i) => (
                                <Text key={i}>{item}</Text>
                            ))}
                        </Box>
                    )}
                </Paginator>
            </Box>
            <Box flexDirection="column">
                <Text dimColor>←/→ = change page · 1/2/3 = dots/numeric/fraction · q = quit</Text>
            </Box>
        </Box>
    );
};

render(<App />);
