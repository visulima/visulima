import { render } from "@visulima/tui";
import { Text } from "@visulima/tui/components/text";
import delay from "delay";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AnimatePresence, Transition } from "../../src/index";
import createStdout from "../helpers/ink-create-stdout";
import { renderToString } from "../helpers/ink-render";

let currentUnmount: (() => void) | undefined;

const mount = (jsx: React.JSX.Element) => {
    const stdout = createStdout();
    const { unmount } = render(jsx, { debug: true, stdout });

    currentUnmount = unmount;

    const getOutput = () => {
        const { calls } = (stdout.write as ReturnType<typeof vi.fn>).mock;

        return (calls.at(-1)?.[0] ?? "") as string;
    };

    return { getOutput };
};

afterEach(async () => {
    currentUnmount?.();
    currentUnmount = undefined;
    await delay(20);
});

describe(Transition, () => {
    it("should render its children once fully entered", () => {
        expect.assertions(1);

        const output = renderToString(
            <Transition preset="fade" show>
                <Text>visible</Text>
            </Transition>,
        );

        expect(output).toContain("visible");
    });

    it("should render nothing once fully exited", async () => {
        expect.assertions(1);

        const { getOutput } = mount(
            <Transition duration={20} preset="fade" show={false} tickInterval={5}>
                <Text>hidden</Text>
            </Transition>,
        );

        await delay(80);

        expect(getOutput()).not.toContain("hidden");
    });

    it("should call onExit after an exit transition completes", async () => {
        expect.hasAssertions();

        const onExit = vi.fn();

        // We need to start from an entered state and flip to show=false after mount.
        const Harness = () => {
            const [visible, setVisible] = React.useState(true);

            React.useEffect(() => {
                const id = setTimeout(setVisible, 10, false);

                return () => clearTimeout(id);
            }, []);

            return (
                <Transition duration={15} onExit={onExit} preset="fade" show={visible} tickInterval={5}>
                    <Text>body</Text>
                </Transition>
            );
        };

        mount(<Harness />);

        await vi.waitFor(() => expect(onExit).toHaveBeenCalledWith(), { interval: 10, timeout: 500 });
    });
});

describe(AnimatePresence, () => {
    // Windows runners don't reliably complete the exit transition in 200ms;
    // the 30ms duration + 5ms tickInterval race the event loop on slow CI.
    it.skipIf(process.platform === "win32")("should keep a removed child mounted until its exit animation finishes", async () => {
        expect.assertions(2);

        const Harness = ({ visible }: { visible: boolean }) => (
            <AnimatePresence>
                {visible
                    ? (
                    <Transition duration={30} key="panel" preset="fade" tickInterval={5}>
                        <Text>panel-body</Text>
                    </Transition>
                    )
                    : null}
            </AnimatePresence>
        );

        const Runner = () => {
            const [visible, setVisible] = React.useState(true);

            React.useEffect(() => {
                const id = setTimeout(setVisible, 10, false);

                return () => clearTimeout(id);
            }, []);

            return <Harness visible={visible} />;
        };

        const { getOutput } = mount(<Runner />);

        await delay(20);

        // At this point the removal has been requested but AnimatePresence
        // should still be rendering it (show=false, transitioning out).
        expect(getOutput()).toContain("panel-body");

        await delay(200);

        // After the exit transition finishes AnimatePresence unmounts it.
        expect(getOutput()).not.toContain("panel-body");
    });
});
