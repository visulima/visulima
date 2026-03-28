/* eslint-disable vitest/require-hook -- standalone fixture script executed by node-pty, not a test file */
import React, { useEffect } from "react";

import { render, Text, useApp } from "../../../src/ink/index";

const Test = () => {
    const { exit } = useApp();

    useEffect(() => {
        setTimeout(() => {
            exit("hello from ink");
        }, 500);
    });

    return <Text>Testing</Text>;
};

const app = render(<Test />);
const result = await app.waitUntilExit();

console.log(`result:${String(result)}`);
