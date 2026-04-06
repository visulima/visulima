/* eslint-disable @stylistic/max-statements-per-line, @typescript-eslint/ban-ts-comment, @typescript-eslint/no-floating-promises, @typescript-eslint/no-shadow, @typescript-eslint/no-unnecessary-condition, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return, consistent-return, no-promise-executor-return, react-refresh/only-export-components, sonarjs/different-types-comparison */
// @ts-nocheck
// Ratatat port of ink/examples/suspense
import { render, Text } from "@visulima/tui/react";
import React, { Suspense } from "react";

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

let promise;
let state;
let value;

const read = () => {
    if (!promise) {
        promise = new Promise((resolve) => setTimeout(resolve, 500));
        state = "pending";
        (async () => {
            await promise;
            state = "done";
            value = "Hello World";
        })();
    }

    if (state === "pending") throw promise;

    if (state === "done") {
        return value;
    }
};

const Dynamic = () => {
    const value = read();

    return <Text>{value}</Text>;
};

const Example = () => (
    <Suspense fallback={<Text color="yellow">Loading...</Text>}>
        <Dynamic />
    </Suspense>
);

render(<Example />);
