import process from "node:process";

import React, { useCallback, useEffect, useState } from "react";

import { render, Text, useApp, useInput } from "../../../src/ink/index.js";

const App = () => {
    const { exit } = useApp();
    const [input, setInput] = useState("");

    const handleInput = useCallback((input: string) => {
        setInput((previousInput: string) => previousInput + input);
    }, []);

    useInput(handleInput);
    useInput(handleInput, { isActive: false });

    useEffect(() => {
        process.stdout.write("__READY__");
    }, []);

    useEffect(() => {
        setTimeout(exit, 100);
    }, []);

    return <Text>{input}</Text>;
};

const app = render(<App />);

await app.waitUntilExit();
console.log("exited");
