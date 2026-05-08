import React from "react";

import { Text } from "../../../src/components/index";
import { useApp } from "../../../src/ink/hooks/use-app";
import { render } from "../../../src/ink/index";

class Exit extends React.Component<{ onExit: (error: Error) => void }, { counter: number }> {
    public timer?: NodeJS.Timeout;

    public override state = {
        counter: 0,
    };

    public override componentDidMount() {
        const { onExit } = this.props;

        setTimeout(() => {
            onExit(new Error("errored"));
        }, 500);

        this.timer = setInterval(() => {
            this.setState((previousState) => {
                return {
                    counter: previousState.counter + 1,
                };
            });
        }, 100);
    }

    public override componentWillUnmount() {
        clearInterval(this.timer);
    }

    public override render() {
        const { counter } = this.state;

        return <Text>Counter: {counter}</Text>;
    }
}

const Test = () => {
    const { exit } = useApp();

    return <Exit onExit={exit} />;
};

const app = render(<Test />);

try {
    await app.waitUntilExit();
} catch (error: unknown) {
    console.log((error as any).message);
}
