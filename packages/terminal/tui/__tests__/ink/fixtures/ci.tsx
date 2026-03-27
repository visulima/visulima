import React from "react";

import { render, Static, Text } from "../../../src/ink/index.js";

type TestState = {
    counter: number;
    items: string[];
};

class Test extends React.Component<Record<string, unknown>, TestState> {
    timer?: NodeJS.Timeout;

    override state: TestState = {
        counter: 0,
        items: [],
    };

    override render() {
        return (
            <>
                <Static items={this.state.items}>{(item) => <Text key={item}>{item}</Text>}</Static>

                <Text>
                    Counter:
                    {this.state.counter}
                </Text>
            </>
        );
    }

    override componentDidMount() {
        const onTimeout = () => {
            if (this.state.counter > 4) {
                return;
            }

            this.setState((previousState) => {
                return {
                    counter: previousState.counter + 1,
                    items: [...previousState.items, `#${previousState.counter + 1}`],
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
