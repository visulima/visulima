/**
 * CSS-level scroll example.
 *
 * Demonstrates overflow:'scroll' with keyboard-driven scrolling,
 * scrollbar rendering, and sticky headers.
 *
 * Run: npx tsx examples/scroll.tsx
 */
import React, { useLayoutEffect, useMemo, useRef, useState } from "react";

import { Box, Text } from "../src/components/index";
import { useInput } from "../src/ink/hooks/use-input";
import type { DOMElement } from "../src/ink/index";
import { getInnerHeight, getScrollHeight, render } from "../src/ink/index";

const ScrollDemo = () => {
    const [scrollTop, setScrollTop] = useState(0);
    const ref = useRef<DOMElement>(null);
    const [metrics, setMetrics] = useState({ innerHeight: 0, scrollHeight: 0 });

    const items = useMemo(
        () =>
            Array.from({ length: 30 }, (_, i) => {
                return {
                    id: i,
                    lines: Array.from({ length: (i % 5) + 2 }, (_, j) => `  Line ${j + 1} of item ${i + 1}`),
                    title: `Section ${i + 1}`,
                };
            }),
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
            setScrollTop((previous) => Math.max(0, previous - 1));
        }

        if (key.downArrow) {
            setScrollTop((previous) => Math.min(maxScroll, previous + 1));
        }

        if (key.pageDown) {
            setScrollTop((previous) => Math.min(maxScroll, previous + metrics.innerHeight));
        }

        if (key.pageUp) {
            setScrollTop((previous) => Math.max(0, previous - metrics.innerHeight));
        }
    });

    return (
        <Box flexDirection="column" height={20}>
            <Text bold> Scroll Demo (↑↓ to scroll, PgUp/PgDn for pages)</Text>
            <Box borderStyle="round" flexDirection="column" flexGrow={1} overflowY="scroll" ref={ref} scrollbarThumbColor="cyan" scrollTop={scrollTop}>
                {items.map((item) => (
                    <Box flexDirection="column" key={item.id} marginBottom={1}>
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
                scrollTop=
                {scrollTop}
{" "}
innerHeight=
{metrics.innerHeight}
{" "}
scrollHeight=
{metrics.scrollHeight}
            </Text>
        </Box>
    );
};

render(<ScrollDemo />);
