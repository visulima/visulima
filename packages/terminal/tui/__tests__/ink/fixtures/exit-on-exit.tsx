import React from "react";

import { Text } from "../../../src/components/index";
import { useApp } from "../../../src/ink/hooks/use-app";
import { render } from "../../../src/ink/index";

class Exit extends React.Component<{ onExit: (error: Error) => void }, { counter: number }> {
    timer?: NodeJS.Timeout;

    override state = {
        counter: 0,
    };

    override render() {
        return <Text>Counter: {this.state.counter}</Text>;
    }

    override componentDidMount() {
        setTimeout(this.props.onExit, 500);

        this.timer = setInterval(() => {
            this.setState((previousState) => {
                return {
                    counter: previousState.counter + 1,
                };
            });
        }, 100);
    }

    override componentWillUnmount() {
        clearInterval(this.timer);
    }
}

const Test = () => {
    const { exit } = useApp();

    return <Exit onExit={exit} />;
};

const app = render(<Test />);

await app.waitUntilExit();
console.log("exited");
