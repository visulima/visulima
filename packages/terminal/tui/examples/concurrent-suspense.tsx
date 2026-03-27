// @ts-nocheck
// Ratatat port of ink/examples/concurrent-suspense
import React, { Suspense, useState } from "react";
import { render, Box, Text, useInput } from "@visulima/tui/react";

if (typeof global !== "undefined" && !global.document) {
    global.document = { createElement: () => ({}), addEventListener: () => {}, removeEventListener: () => {} };
    global.window = global;
    Object.defineProperty(global, "navigator", {
        value: { scheduling: { isInputPending: () => false } },
        writable: true,
        configurable: true,
    });
}

const cache = new Map();

function fetchData(key, delay) {
    const cached = cache.get(key);
    if (cached?.status === "resolved") return cached.data;
    if (cached?.status === "pending") throw cached.promise;
    const promise = new Promise((resolve) => {
        setTimeout(() => {
            cache.set(key, { status: "resolved", data: `Data for "${key}" (${delay}ms)` });
            resolve();
        }, delay);
    });
    cache.set(key, { status: "pending", promise });
    throw promise;
}

function DataComponent({ id, delay }) {
    const data = fetchData(id, delay);
    return <Text color="green">✓ {data}</Text>;
}

function App() {
    const [showThird, setShowThird] = useState(false);

    useInput((_, key) => {
        if (key.return) setShowThird((s) => !s);
    });

    return (
        <Box flexDirection="column" padding={1}>
            <Text bold>Concurrent Suspense Demo</Text>
            <Text dim>Press Enter to toggle third item. Ctrl+C to exit.</Text>
            <Box flexDirection="column" marginTop={1}>
                <Suspense fallback={<Text color="yellow">Loading fast (200ms)...</Text>}>
                    <DataComponent id="fast" delay={200} />
                </Suspense>
                <Suspense fallback={<Text color="yellow">Loading slow (800ms)...</Text>}>
                    <DataComponent id="slow" delay={800} />
                </Suspense>
                {showThird && (
                    <Suspense fallback={<Text color="yellow">Loading extra (400ms)...</Text>}>
                        <DataComponent id="extra" delay={400} />
                    </Suspense>
                )}
            </Box>
        </Box>
    );
}

render(<App />);
