/* eslint-disable vitest/require-hook -- standalone fixture script executed by node-pty, not a test file */
import React from "react";

import { render, Text, useStdin } from "../../../src/ink/index";

class Exit extends React.Component<{
    onSetRawMode: (value: boolean) => void;
}> {
    override render() {
        return <Text>Hello World</Text>;
    }

    override componentDidMount() {
        this.props.onSetRawMode(true);
    }
}

const Test = () => {
    const { setRawMode } = useStdin();

    return <Exit onSetRawMode={setRawMode} />;
};

const app = render(<Test />);

setTimeout(() => {
    app.unmount();
}, 500);

await app.waitUntilExit();
console.log("exited");
