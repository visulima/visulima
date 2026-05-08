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
        const onTimeout = () => {
            if (this.state.counter > 4) {
                return;
            }

            this.setState((previousState) => {
                return {
                    counter: previousState.counter + 1,
                };
            });

            this.timer = setTimeout(onTimeout, 20);
        };

        this.timer = setTimeout(onTimeout, 20);
    }

    override componentWillUnmount() {
        clearTimeout(this.timer);
    }
}

render(<Test />);
