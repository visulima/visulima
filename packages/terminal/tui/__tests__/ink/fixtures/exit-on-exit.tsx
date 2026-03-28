/* eslint-disable vitest/require-hook -- standalone fixture script executed by node-pty, not a test file */
import React from "react";

import { render, Text, useApp } from "../../../src/ink/index.js";

class Exit extends React.Component<{ onExit: (error: Error) => void }, { counter: number }> {
    timer?: NodeJS.Timeout;

    override state = {
        counter: 0,
    };

    override render() {
        return (
            <Text>
                Counter: {this.state.counter}
            </Text>
        );
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
