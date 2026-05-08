import process from "node:process";

import React, { useCallback, useEffect, useState } from "react";

import { Text } from "../../../src/components/index";
import { useApp } from "../../../src/ink/hooks/use-app";
import { useInput } from "../../../src/ink/hooks/use-input";
import { render } from "../../../src/ink/index";

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
