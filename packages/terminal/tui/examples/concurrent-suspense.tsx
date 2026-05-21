/* eslint-disable @typescript-eslint/only-throw-error, func-style, sonarjs/different-types-comparison */
// @ts-nocheck
// Ratatat port of ink/examples/concurrent-suspense
import { Box } from "@visulima/tui/components/box";
import { Text } from "@visulima/tui/components/text";
import { render, useInput } from "@visulima/tui/react";
import React, { Suspense, useState } from "react";

if (globalThis.global !== undefined && !globalThis.document) {
    globalThis.document = {
        addEventListener: () => {},
        createElement: () => {
            return {};
        },
        removeEventListener: () => {},
    };
    globalThis.window = globalThis;
    Object.defineProperty(globalThis, "navigator", {
        configurable: true,
        value: { scheduling: { isInputPending: () => false } },
        writable: true,
    });
}

const cache = new Map();

function fetchData(key, delay) {
    const cached = cache.get(key);

    if (cached?.status === "resolved") {
        return cached.data;
    }

    if (cached?.status === "pending") {
        throw cached.promise;
    }

    const promise = new Promise((resolve) => {
        setTimeout(() => {
            cache.set(key, { data: `Data for "${key}" (${delay}ms)`, status: "resolved" });
            resolve();
        }, delay);
    });

    cache.set(key, { promise, status: "pending" });
    throw promise;
}

const DataComponent = ({ delay, id }) => {
    const data = fetchData(id, delay);

    return (
<Text color="green">
✓
{data}
</Text>
    );
};

const App = () => {
    const [showThird, setShowThird] = useState(false);

    useInput((_, key) => {
        if (key.return) {
            setShowThird((s) => !s);
        }
    });

    return (
        <Box flexDirection="column" padding={1}>
            <Text bold>Concurrent Suspense Demo</Text>
            <Text dim>Press Enter to toggle third item. Ctrl+C to exit.</Text>
            <Box flexDirection="column" marginTop={1}>
                <Suspense fallback={<Text color="yellow">Loading fast (200ms)...</Text>}>
                    <DataComponent delay={200} id="fast" />
                </Suspense>
                <Suspense fallback={<Text color="yellow">Loading slow (800ms)...</Text>}>
                    <DataComponent delay={800} id="slow" />
                </Suspense>
                {showThird && (
                    <Suspense fallback={<Text color="yellow">Loading extra (400ms)...</Text>}>
                        <DataComponent delay={400} id="extra" />
                    </Suspense>
                )}
            </Box>
        </Box>
    );
};

render(<App />);
