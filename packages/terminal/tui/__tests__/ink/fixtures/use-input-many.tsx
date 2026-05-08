import process from "node:process";

import React, { useEffect } from "react";

import { Text } from "../../../src/components/index";
import { useApp } from "../../../src/ink/hooks/use-app";
import { useInput } from "../../../src/ink/hooks/use-input";
import { render } from "../../../src/ink/index";
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
