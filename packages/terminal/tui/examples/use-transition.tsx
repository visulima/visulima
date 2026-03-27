// @ts-nocheck
// Ratatat port of ink/examples/use-transition
import React, { useState, useTransition } from "react";
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

function generateItems(filter) {
    const all = Array.from({ length: 200 }, (_, i) => `Item ${i + 1}: ${["Apple", "Banana", "Cherry", "Date", "Elderberry"][i % 5]}`);
    if (!filter) return all.slice(0, 10);
    const start = Date.now();
    while (Date.now() - start < 100) {}
    return all.filter((item) => item.toLowerCase().includes(filter.toLowerCase())).slice(0, 10);
}

function SearchApp() {
    const [query, setQuery] = useState("");
    const [deferredQuery, setDeferredQuery] = useState("");
    const [isPending, startTransition] = useTransition();

    useInput((char, key) => {
        if (key.backspace) {
            const next = query.slice(0, -1);
            setQuery(next);
            startTransition(() => setDeferredQuery(next));
        } else if (char) {
            const next = query + char;
            setQuery(next);
            startTransition(() => setDeferredQuery(next));
        }
    });

    const items = generateItems(deferredQuery);

    return (
        <Box flexDirection="column" padding={1}>
            <Text>
                Search: {query}
                {isPending ? <Text color="yellow"> (filtering...)</Text> : null}
            </Text>
            <Box flexDirection="column" marginTop={1}>
                {items.map((item, i) => (
                    <Text key={i}>{item}</Text>
                ))}
            </Box>
            <Box marginTop={1}>
                <Text dim>Type to filter. Press Ctrl+C to exit.</Text>
            </Box>
        </Box>
    );
}

render(<SearchApp />);
