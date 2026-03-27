/**
 * scroll-test.tsx — minimal useScrollable demo
 *
 * A fixed 10-row viewport over 40 items.
 * ↑/↓ scroll one row, PageUp/PageDown jump 5.
 * Nothing else — just the scroll mechanic isolated.
 *
 * Run: node --import @oxc-node/core/register examples/scroll-test.tsx
 */
import React, { useCallback } from "react";
import { render, Box, Text, useInput, useApp, useScrollable } from "@visulima/tui/react";

const ITEMS = Array.from({ length: 40 }, (_, i) => ({
    id: i,
    label: `item ${String(i + 1).padStart(2, "0")}`,
    // alternate colors to make rows easy to track visually
    color: i % 2 === 0 ? "white" : "blackBright",
}));

const VIEWPORT_H = 10;

function App() {
    const { exit } = useApp();

    const scroll = useScrollable({
        viewportHeight: VIEWPORT_H,
        contentHeight: ITEMS.length,
    });

    useInput(
        useCallback(
            (_ch, key) => {
                if (key.escape || _ch === "q") {
                    exit();
                    return;
                }
                if (key.upArrow) scroll.scrollUp();
                if (key.downArrow) scroll.scrollDown();
                if (key.pageUp) scroll.scrollBy(-5);
                if (key.pageDown) scroll.scrollBy(5);
            },
            [scroll, exit],
        ),
    );

    const visibleItems = ITEMS.slice(scroll.offset, scroll.offset + VIEWPORT_H);

    return (
        <Box flexDirection="column" gap={1}>
            {/* title */}
            <Box paddingX={1}>
                <Text color="cyan" bold>
                    scroll-test{" "}
                </Text>
                <Text color="blackBright">↑↓ scroll · PgUp/PgDn jump 5 · q quit</Text>
            </Box>

            {/* viewport: fixed height, items sliced to fit — no marginTop trick needed here */}
            <Box
                flexDirection="column"
                borderStyle="single"
                borderColor="cyan"
                width={30}
                height={VIEWPORT_H + 2} // +2 for border rows
            >
                {visibleItems.map((item) => (
                    <Box key={item.id} paddingX={1}>
                        <Text color={item.color}>{item.label}</Text>
                    </Box>
                ))}
            </Box>

            {/* scroll position readout */}
            <Box paddingX={1} flexDirection="row" gap={2}>
                <Text color="blackBright">
                    offset <Text color="white">{scroll.offset}</Text>
                    {" / "}
                    <Text color="white">{ITEMS.length - VIEWPORT_H}</Text>
                </Text>
                <Text color={scroll.atTop ? "blackBright" : "yellow"}>{scroll.atTop ? "· top" : "↑ more above"}</Text>
                <Text color={scroll.atBottom ? "blackBright" : "yellow"}>{scroll.atBottom ? "· bottom" : "↓ more below"}</Text>
            </Box>
        </Box>
    );
}

render(<App />);
