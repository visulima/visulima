/* eslint-disable @typescript-eslint/no-confusing-void-expression, func-style, no-empty, sonarjs/different-types-comparison */
// @ts-nocheck
// Ratatat port of ink/examples/use-transition
import { Box } from "@visulima/tui/components/box";
import { Text } from "@visulima/tui/components/text";
import { render, useInput } from "@visulima/tui/react";
import React, { useState, useTransition } from "react";

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

function generateItems(filter) {
    const all = Array.from({ length: 200 }, (_, i) => `Item ${i + 1}: ${["Apple", "Banana", "Cherry", "Date", "Elderberry"][i % 5]}`);

    if (!filter) {
        return all.slice(0, 10);
    }

    const start = Date.now();

    while (Date.now() - start < 100) {}

    return all.filter((item) => item.toLowerCase().includes(filter.toLowerCase())).slice(0, 10);
}

const SearchApp = () => {
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
                Search:
{" "}
{query}
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
};

render(<SearchApp />);
