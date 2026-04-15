import React from "react";

import { render, Text, useApp, useStdin } from "../../../src/ink/index";

class Exit extends React.Component<{
    onExit: (error: Error) => void;
    onSetRawMode: (value: boolean) => void;
}> {
    override render() {
        return <Text>Hello World</Text>;
    }

    override componentDidMount() {
        this.props.onSetRawMode(true);
        setTimeout(this.props.onExit, 500);
    }
}

const Test = () => {
    const { exit } = useApp();
    const { setRawMode } = useStdin();

    return <Exit onExit={exit} onSetRawMode={setRawMode} />;
};

const app = render(<Test />);

await app.waitUntilExit();
console.log("exited");
