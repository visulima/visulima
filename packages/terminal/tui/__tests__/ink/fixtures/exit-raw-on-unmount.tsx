import React from "react";

import { Text } from "../../../src/components/index";
import { useStdin } from "../../../src/ink/hooks/use-stdin";
import { render } from "../../../src/ink/index";

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
