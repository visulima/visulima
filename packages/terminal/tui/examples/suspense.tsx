// @ts-nocheck
// Ratatat port of ink/examples/suspense
import React, { Suspense } from "react";
import { render, Text } from "@visulima/tui/react";

if (typeof global !== "undefined" && !global.document) {
    global.document = { createElement: () => ({}), addEventListener: () => {}, removeEventListener: () => {} };
    global.window = global;
    Object.defineProperty(global, "navigator", {
        value: { scheduling: { isInputPending: () => false } },
        writable: true,
        configurable: true,
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
    if (state === "done") return value;
};

function Dynamic() {
    const value = read();
    return <Text>{value}</Text>;
}

function Example() {
    return (
        <Suspense fallback={<Text color="yellow">Loading...</Text>}>
            <Dynamic />
        </Suspense>
    );
}

render(<Example />);
