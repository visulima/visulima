/* eslint-disable @typescript-eslint/no-confusing-void-expression, sonarjs/different-types-comparison */
// @ts-nocheck
// Ratatat port of ink/examples/counter
// Original: https://github.com/vadimdemedes/ink/tree/master/examples/counter
import { Text } from "@visulima/tui";
import { render } from "@visulima/tui/react";
import React from "react";

// React 18 Scheduler Polyfills for Node
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

const Counter = () => {
    const [counter, setCounter] = React.useState(0);

    React.useEffect(() => {
        const timer = setInterval(() => {
            setCounter((previousCounter) => previousCounter + 1);
        }, 100);

        return () => clearInterval(timer);
    }, []);

    return (
<Text color="green">
{counter}
{" "}
tests passed
</Text>
    );
};

render(<Counter />);
