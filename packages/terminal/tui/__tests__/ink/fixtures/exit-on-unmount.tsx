import React from "react";

import { Text } from "../../../src/components/index";
import { render } from "../../../src/ink/index";

class Test extends React.Component<Record<string, unknown>, { counter: number }> {
    timer?: NodeJS.Timeout;

    override state = {
        counter: 0,
    };

    override render() {
        return <Text>Counter: {this.state.counter}</Text>;
    }

    override componentDidMount() {
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

const app = render(<Test />);

setTimeout(() => {
    app.unmount();
}, 500);

await app.waitUntilExit();
console.log("exited");
