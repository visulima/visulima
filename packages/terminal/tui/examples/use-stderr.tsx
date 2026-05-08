/* eslint-disable @typescript-eslint/no-confusing-void-expression, sonarjs/different-types-comparison */
// @ts-nocheck
// Ratatat port of ink/examples/use-stderr
import { Text } from "@visulima/tui/components/text";
import { render, useStderr } from "@visulima/tui/react";
import React from "react";

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

const Example = () => {
    const { write } = useStderr();

    React.useEffect(() => {
        const timer = setInterval(() => {
            write("Hello from ratatat to stderr\n");
        }, 1000);

        return () => clearInterval(timer);
    }, []);

    return <Text>Hello World (check stderr for output)</Text>;
};

render(<Example />);
