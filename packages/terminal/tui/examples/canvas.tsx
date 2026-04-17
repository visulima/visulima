/* eslint-disable @typescript-eslint/no-confusing-void-expression */
/**
 * canvas.tsx — Raw Canvas drawing API
 *
 * Shows the imperative API directly: setCell, drawText, drawRect, drawHBar,
 * drawVBar. Use this when you need a custom visualization and the built-in
 * chart components don't fit.
 *
 * Run: node --import @oxc-node/core/register examples/canvas.tsx
 */
import { Box, Canvas, render, Text, useApp, useInput } from "@visulima/tui";
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
            <Text bold color="cyan">Canvas — press Space to advance the ball</Text>
            <Canvas
                draw={(ctx) => {
                    ctx.clear();

                    // Border
                    ctx.drawRect(0, 0, ctx.width, 1, "═", { color: "gray" });
                    ctx.drawRect(0, ctx.height - 1, ctx.width, 1, "═", { color: "gray" });

                    for (let y = 1; y < ctx.height - 1; y += 1) {
                        ctx.setCell(0, y, "║", { color: "gray" });
                        ctx.setCell(ctx.width - 1, y, "║", { color: "gray" });
                    }

                    // Title
                    ctx.drawText(2, 0, " Status ", { background: "gray", color: "black" });

                    // Progress bar
                    const progress = (tick % 20) / 20;

                    ctx.drawText(2, 2, `Loading: ${Math.round(progress * 100)}%`);
                    ctx.drawHBar(2, 3, ctx.width - 4, progress, { color: "cyan" });

                    // Vertical meters
                    for (let column = 0; column < 6; column += 1) {
                        const ratio = Math.abs(Math.sin((tick + column) / 3));

                        ctx.drawVBar(ctx.width - 3 - column * 2, 5, ctx.height - 7, ratio, {
                            color: column % 2 === 0 ? "magenta" : "yellow",
                        });
                    }

                    // Bouncing ball
                    const ballX = 2 + (tick % (ctx.width - 4));

                    ctx.setCell(ballX, ctx.height - 2, "●", { color: "red" });
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
