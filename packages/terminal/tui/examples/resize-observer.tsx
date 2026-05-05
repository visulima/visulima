/**
 * ResizeObserver example.
 *
 * Demonstrates how to observe element size changes after layout.
 *
 * Run: npx tsx examples/resize-observer.tsx
 */
import React, { forwardRef, useEffect, useRef, useState } from "react";

import type { DOMElement } from "../src/ink/index";
import { Box, render, ResizeObserver, Text } from "../src/ink/index";

const ObservedBox = forwardRef<DOMElement, { label: string }>(({ label }, ref) => (
    <Box borderStyle="single" flexGrow={1} padding={1} ref={ref}>
        <Text>{label}</Text>
    </Box>
));

ObservedBox.displayName = "ObservedBox";

const ResizeObserverDemo = () => {
    const ref = useRef<DOMElement>(null);
    const [size, setSize] = useState({ height: 0, width: 0 });

    useEffect(() => {
        if (!ref.current) {
            return;
        }

        const observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
                setSize({ height: entry.contentRect.height, width: entry.contentRect.width });
            }
        });

        observer.observe(ref.current);

        return () => {
            observer.disconnect();
        };
    }, []);

    return (
        <Box flexDirection="column" height={10}>
            <Text bold> ResizeObserver Demo</Text>
            <ObservedBox label="Resize your terminal to see this update" ref={ref} />
            <Text>
                {" "}
                Observed size: {size.width}x{size.height}
            </Text>
        </Box>
    );
};

render(<ResizeObserverDemo />);
