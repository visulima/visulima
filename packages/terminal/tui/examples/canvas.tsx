/**
 * canvas.tsx — Raw Canvas drawing API
 *
 * Shows the imperative API directly: setCell, drawText, drawRect, drawHBar,
 * drawVBar. Use this when you need a custom visualization and the built-in
 * chart components don't fit.
 *
 * Run: node --import @oxc-node/core/register examples/canvas.tsx
 */
import { render } from "@visulima/tui";
import { Box } from "@visulima/tui/components/box";
import { Canvas } from "@visulima/tui/components/canvas";
import { Text } from "@visulima/tui/components/text";
import { useApp } from "@visulima/tui/hooks/use-app";
import { useInput } from "@visulima/tui/hooks/use-input";
import React, { useState } from "react";

const App = () => {
    const { exit } = useApp();
    const [tick, setTick] = useState(0);

    useInput((input, key) => {
        if (key.escape) {
            exit();
        }

        if (input === " ") {
            setTick((n) => n + 1);
        }
    });

    return (
        <Box flexDirection="column" gap={1} padding={1}>
            <Text bold color="cyan">
                Canvas — press Space to advance the ball
            </Text>
            <Canvas
                draw={(context) => {
                    context.clear();

                    // Border
                    context.drawRect(0, 0, context.width, 1, "═", { color: "gray" });
                    context.drawRect(0, context.height - 1, context.width, 1, "═", { color: "gray" });

                    for (let y = 1; y < context.height - 1; y += 1) {
                        context.setCell(0, y, "║", { color: "gray" });
                        context.setCell(context.width - 1, y, "║", { color: "gray" });
                    }

                    // Title
                    context.drawText(2, 0, " Status ", { background: "gray", color: "black" });

                    // Progress bar
                    const progress = (tick % 20) / 20;

                    context.drawText(2, 2, `Loading: ${Math.round(progress * 100)}%`);
                    context.drawHBar(2, 3, context.width - 4, progress, { color: "cyan" });

                    // Vertical meters
                    for (let column = 0; column < 6; column += 1) {
                        const ratio = Math.abs(Math.sin((tick + column) / 3));

                        context.drawVBar(context.width - 3 - column * 2, 5, context.height - 7, ratio, {
                            color: column % 2 === 0 ? "magenta" : "yellow",
                        });
                    }

                    // Bouncing ball
                    const ballX = 2 + (tick % (context.width - 4));

                    context.setCell(ballX, context.height - 2, "●", { color: "red" });
                }}
                height={12}
                version={tick}
                width={50}
            />
            <Text dimColor>Space = advance · Esc = quit</Text>
        </Box>
    );
};

render(<App />);
