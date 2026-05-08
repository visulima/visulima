import React from "react";

import { Static, Text } from "../../../src/components/index";
import { render } from "../../../src/ink/index";

type TestState = {
    counter: number;
    items: string[];
};

class Test extends React.Component<Record<string, unknown>, TestState> {
    public timer?: NodeJS.Timeout;

    public override state: TestState = {
        counter: 0,
        items: [],
    };

    public override componentDidMount() {
        const onTimeout = () => {
            const { counter } = this.state;

            if (counter > 4) {
                return;
            }

            this.setState((previousState) => {
                return {
                    counter: previousState.counter + 1,
                    items: [...previousState.items, `#${String(previousState.counter + 1)}`],
                };
            });

            this.timer = setTimeout(onTimeout, 20);
        };

        this.timer = setTimeout(onTimeout, 20);
    }

    public override componentWillUnmount() {
        clearTimeout(this.timer);
    }

    public override render() {
        const { counter, items } = this.state;

        return (
            <>
                <Static items={items}>{(item) => <Text key={item}>{item}</Text>}</Static>

                <Text>Counter: {counter}</Text>
            </>
        );
    }
}

render(<Test />);
