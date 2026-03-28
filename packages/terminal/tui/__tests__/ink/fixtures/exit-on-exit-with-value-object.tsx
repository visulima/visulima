/* eslint-disable vitest/require-hook -- standalone fixture script executed by node-pty, not a test file */
import React, { useEffect } from "react";

import { render, Text, useApp } from "../../../src/ink/index.js";

const Test = () => {
    const { exit } = useApp();

    useEffect(() => {
        setTimeout(() => {
            exit({ message: "hello from ink object" });
        }, 500);
    });

    return <Text>Testing</Text>;
};

const app = render(<Test />);
const result = await app.waitUntilExit();

console.log(`result:${(result as { message: string }).message}`);
