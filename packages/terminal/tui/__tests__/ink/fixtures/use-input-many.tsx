/* eslint-disable vitest/require-hook -- standalone fixture script executed by node-pty, not a test file */
import process from "node:process";

import React, { useEffect } from "react";

import { render, Text, useApp, useInput } from "../../../src/ink/index";

// Detect MaxListenersExceededWarning
process.on("warning", (warning) => {
    if (warning.name === "MaxListenersExceededWarning") {
        console.log("MaxListenersExceededWarning");
    }
});

const InputHandler = () => {
    useInput(() => {});

    return null;
};

const App = () => {
    const { exit } = useApp();

    useEffect(() => {
        setTimeout(exit, 100);
    }, []);

    return (
        <>
            <InputHandler />
            <InputHandler />
            <InputHandler />
            <InputHandler />
            <InputHandler />
            <InputHandler />
            <InputHandler />
            <InputHandler />
            <InputHandler />
            <InputHandler />
            <InputHandler />
            <Text>ready</Text>
        </>
    );
};

const app = render(<App />);

await app.waitUntilExit();
console.log("exited");
