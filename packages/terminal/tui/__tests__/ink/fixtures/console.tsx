/* eslint-disable vitest/require-hook -- standalone fixture script executed by node-pty, not a test file */
import React, { useEffect } from "react";

import { render, Text } from "../../../src/ink/index";

const App = () => {
    useEffect(() => {
        const timer = setTimeout(() => {}, 1000);

        return () => {
            clearTimeout(timer);
        };
    }, []);

    return <Text>Hello World</Text>;
};

const { unmount } = render(<App />);

console.log("First log");
unmount();
console.log("Second log");
