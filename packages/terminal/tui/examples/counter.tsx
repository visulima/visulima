// @ts-nocheck
// Ratatat port of ink/examples/counter
// Original: https://github.com/vadimdemedes/ink/tree/master/examples/counter
import React from "react";
import { render, Text } from "@visulima/tui/react";

// React 18 Scheduler Polyfills for Node
if (typeof global !== "undefined" && !global.document) {
    global.document = { createElement: () => ({}), addEventListener: () => {}, removeEventListener: () => {} };
    global.window = global;
    Object.defineProperty(global, "navigator", {
        value: { scheduling: { isInputPending: () => false } },
        writable: true,
        configurable: true,
    });
}

function Counter() {
    const [counter, setCounter] = React.useState(0);

    React.useEffect(() => {
        const timer = setInterval(() => {
            setCounter((prevCounter) => prevCounter + 1);
        }, 100);
        return () => clearInterval(timer);
    }, []);

    return <Text color="green">{counter} tests passed</Text>;
}

render(<Counter />);
