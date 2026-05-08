/* eslint-disable jsdoc/lines-before-block */
/**
 * scroll-test.tsx — minimal useScrollable demo
 *
 * A fixed 10-row viewport over 40 items.
 * ↑/↓ scroll one row, PageUp/PageDown jump 5.
 * Nothing else — just the scroll mechanic isolated.
 *
 * Run: node --import @oxc-node/core/register examples/scroll-test.tsx
 */
import { Box } from "@visulima/tui/components/box";
import { Text } from "@visulima/tui/components/text";
import { render, useApp, useInput, useScrollable } from "@visulima/tui/react";
import React, { useCallback } from "react";

const ITEMS = Array.from({ length: 40 }, (_, i) => {
    return {
        // alternate colors to make rows easy to track visually
        color: i % 2 === 0 ? "white" : "blackBright",
        id: i,
        label: `item ${String(i + 1).padStart(2, "0")}`,
    };
});

const VIEWPORT_H = 10;

const App = () => {
    const { exit } = useApp();

    const scroll = useScrollable({
        contentHeight: ITEMS.length,
        viewportHeight: VIEWPORT_H,
    });

    useInput(
        useCallback(
            (_ch, key) => {
                if (key.escape || _ch === "q") {
                    exit();

                    return;
                }

                if (key.upArrow) {
                    scroll.scrollUp();
                }

                if (key.downArrow) {
                    scroll.scrollDown();
                }

                if (key.pageUp) {
                    scroll.scrollBy(-5);
                }

                if (key.pageDown) {
                    scroll.scrollBy(5);
                }
            },
            [scroll, exit],
        ),
    );

    const visibleItems = ITEMS.slice(scroll.offset, scroll.offset + VIEWPORT_H);

    return (
        <Box flexDirection="column" gap={1}>
            {/* title */}
            <Box paddingX={1}>
                <Text bold color="cyan">
                    scroll-test
{" "}
                </Text>
                <Text color="blackBright">↑↓ scroll · PgUp/PgDn jump 5 · q quit</Text>
            </Box>

            {/* viewport: fixed height, items sliced to fit — no marginTop trick needed here */}
            <Box
                borderColor="cyan"
                borderStyle="single"
                flexDirection="column"
                height={VIEWPORT_H + 2} // +2 for border rows
                width={30}
            >
                {visibleItems.map((item) => (
                    <Box key={item.id} paddingX={1}>
                        <Text color={item.color}>{item.label}</Text>
                    </Box>
                ))}
            </Box>

            {/* scroll position readout */}
            <Box flexDirection="row" gap={2} paddingX={1}>
                <Text color="blackBright">
                    offset
{" "}
<Text color="white">{scroll.offset}</Text>
                    {" / "}
                    <Text color="white">{ITEMS.length - VIEWPORT_H}</Text>
                </Text>
                <Text color={scroll.atTop ? "blackBright" : "yellow"}>{scroll.atTop ? "· top" : "↑ more above"}</Text>
                <Text color={scroll.atBottom ? "blackBright" : "yellow"}>{scroll.atBottom ? "· bottom" : "↓ more below"}</Text>
            </Box>
        </Box>
    );
};

render(<App />);
