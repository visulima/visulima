// @ts-nocheck
// Ratatat port of ink/examples/use-stderr
import React from "react";
import { render, Text, useStderr } from "@visulima/tui/react";

if (typeof global !== "undefined" && !global.document) {
    global.document = { createElement: () => ({}), addEventListener: () => {}, removeEventListener: () => {} };
    global.window = global;
    Object.defineProperty(global, "navigator", {
        value: { scheduling: { isInputPending: () => false } },
        writable: true,
        configurable: true,
    });
}

function Example() {
    const { write } = useStderr();

    React.useEffect(() => {
        const timer = setInterval(() => {
            write("Hello from ratatat to stderr\n");
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    return <Text>Hello World (check stderr for output)</Text>;
}

render(<Example />);
