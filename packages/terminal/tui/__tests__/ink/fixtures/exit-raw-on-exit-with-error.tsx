import React from "react";

import { Text } from "../../../src/components/index";
import { useApp } from "../../../src/ink/hooks/use-app";
import { useStdin } from "../../../src/ink/hooks/use-stdin";
import { render } from "../../../src/ink/index";

class Exit extends React.Component<{
    onExit: (error: Error) => void;
    onSetRawMode: (value: boolean) => void;
}> {
    override render() {
        return <Text>Hello World</Text>;
    }

    override componentDidMount() {
        this.props.onSetRawMode(true);

        setTimeout(() => {
            this.props.onExit(new Error("errored"));
        }, 500);
    }
}

const Test = () => {
    const { exit } = useApp();
    const { setRawMode } = useStdin();

    return <Exit onExit={exit} onSetRawMode={setRawMode} />;
};

const app = render(<Test />);

try {
    await app.waitUntilExit();
} catch (error: unknown) {
    console.log((error as any).message);
}
