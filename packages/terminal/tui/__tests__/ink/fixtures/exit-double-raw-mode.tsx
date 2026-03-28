/* eslint-disable vitest/require-hook -- standalone fixture script executed by node-pty, not a test file */
import process from "node:process";

import React from "react";

import { render, Text, useStdin } from "../../../src/ink/index.js";

class ExitDoubleRawMode extends React.Component<{
    setRawMode: (value: boolean) => void;
}> {
    override render() {
        return <Text>Hello World</Text>;
    }

    override componentDidMount() {
        const { setRawMode } = this.props;

        setRawMode(true);

        setTimeout(() => {
            setRawMode(false);
            setRawMode(true);

            // Start the test
            process.stdout.write("s");
        }, 500);
    }
}

const Test = () => {
    const { setRawMode } = useStdin();

    return <ExitDoubleRawMode setRawMode={setRawMode} />;
};

const { unmount, waitUntilExit } = render(<Test />);

process.stdin.on("data", (data) => {
    if (String(data) === "q") {
        unmount();
    }
});

await waitUntilExit();
console.log("exited");
