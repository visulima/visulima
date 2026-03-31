/**
 * CSS-level scroll example.
 *
 * Demonstrates overflow:'scroll' with keyboard-driven scrolling,
 * scrollbar rendering, and sticky headers.
 *
 * Run: npx tsx examples/scroll.tsx
 */
import React, { useLayoutEffect, useMemo, useRef, useState } from "react";

import { Box, getInnerHeight, getScrollHeight, render, Text, useInput } from "../src/ink/index";
import type { DOMElement } from "../src/ink/index";

function ScrollDemo() {
    const [scrollTop, setScrollTop] = useState(0);
    const ref = useRef<DOMElement>(null);
    const [metrics, setMetrics] = useState({ innerHeight: 0, scrollHeight: 0 });

    const items = useMemo(
        () =>
            Array.from({ length: 30 }, (_, i) => ({
                id: i,
                lines: Array.from({ length: (i % 5) + 2 }, (_, j) => `  Line ${j + 1} of item ${i + 1}`),
                title: `Section ${i + 1}`,
            })),
        [],
    );

    useLayoutEffect(() => {
        if (ref.current) {
            const innerHeight = getInnerHeight(ref.current);
            const scrollHeight = getScrollHeight(ref.current);

            if (metrics.innerHeight !== innerHeight || metrics.scrollHeight !== scrollHeight) {
                setMetrics({ innerHeight, scrollHeight });
            }
        }
    });

    useInput((_input, key) => {
        const maxScroll = Math.max(0, metrics.scrollHeight - metrics.innerHeight);

        if (key.upArrow) {
            setScrollTop((prev) => Math.max(0, prev - 1));
        }

        if (key.downArrow) {
            setScrollTop((prev) => Math.min(maxScroll, prev + 1));
        }

        if (key.pageDown) {
            setScrollTop((prev) => Math.min(maxScroll, prev + metrics.innerHeight));
        }

        if (key.pageUp) {
            setScrollTop((prev) => Math.max(0, prev - metrics.innerHeight));
        }
    });

    return (
        <Box flexDirection="column" height={20}>
            <Text bold> Scroll Demo (↑↓ to scroll, PgUp/PgDn for pages)</Text>
            <Box ref={ref} borderStyle="round" flexDirection="column" flexGrow={1} overflowY="scroll" scrollTop={scrollTop} scrollbarThumbColor="cyan">
                {items.map((item) => (
                    <Box key={item.id} flexDirection="column" marginBottom={1}>
                        <Box sticky>
                            <Text bold color="green">
                                {item.title}
                            </Text>
                        </Box>
                        {item.lines.map((line, j) => (
                            <Text key={`${item.id}-${j}`}>{line}</Text>
                        ))}
                    </Box>
                ))}
            </Box>
            <Text dimColor>
                {" "}
                scrollTop={scrollTop} innerHeight={metrics.innerHeight} scrollHeight={metrics.scrollHeight}
            </Text>
        </Box>
    );
}

render(<ScrollDemo />);
