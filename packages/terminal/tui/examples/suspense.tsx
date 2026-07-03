/* eslint-disable @typescript-eslint/no-floating-promises, no-promise-executor-return, sonarjs/different-types-comparison */
// @ts-nocheck
// Ratatat port of ink/examples/suspense
import { Text } from "@visulima/tui/components/text";
import { render } from "@visulima/tui/react";
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

    if (state === "pending") {
        throw promise;
    }

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
