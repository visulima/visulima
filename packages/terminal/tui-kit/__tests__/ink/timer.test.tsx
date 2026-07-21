import { strip as stripAnsi } from "@visulima/ansi";
import { render } from "@visulima/tui";
import { Text } from "@visulima/tui/components/text";
import { useTimer } from "@visulima/tui/hooks/use-timer";
import delay from "delay";
import React from "react";
import { afterEach, describe, expect, it } from "vitest";

import { Timer } from "../../src/index";
import createStdout from "../helpers/ink-create-stdout";
import { renderToString } from "../helpers/ink-render";

describe("timer", () => {
    describe("useTimer hook", () => {
        let currentUnmount: (() => void) | undefined;

        afterEach(async () => {
            currentUnmount?.();
            await delay(50);
        });

        it("starts with full duration remaining", () => {
            expect.assertions(1);

            const TimerDisplay = () => {
                const { remaining } = useTimer({ duration: 10_000 });

                return <Text>{remaining}</Text>;
            };

            const output = renderToString(<TimerDisplay />);

            expect(output).toBe("10000");
        });

        it("shows not running by default", () => {
            expect.assertions(1);

            const TimerDisplay = () => {
                const { isRunning } = useTimer({ duration: 10_000 });

                return <Text>{isRunning ? "running" : "stopped"}</Text>;
            };

            const output = renderToString(<TimerDisplay />);

            expect(output).toBe("stopped");
        });

        it("autoStart begins counting", async () => {
            expect.assertions(1);

            const TimerDisplay = () => {
                const { remaining } = useTimer({ autoStart: true, duration: 5000, interval: 50 });

                return <Text>{String(remaining)}</Text>;
            };

            const stdout = createStdout();
            const { unmount } = render(<TimerDisplay />, { debug: true, stdout });

            currentUnmount = unmount;

            await delay(200);

            const remaining = Number.parseInt(stdout.get(), 10);

            expect(remaining).toBeLessThan(5000);
        });

        it("shows not finished initially", () => {
            expect.assertions(1);

            const TimerDisplay = () => {
                const { isFinished } = useTimer({ duration: 10_000 });

                return <Text>{isFinished ? "done" : "pending"}</Text>;
            };

            const output = renderToString(<TimerDisplay />);

            expect(output).toBe("pending");
        });
    });

    describe("timer component", () => {
        it("renders formatted time", () => {
            expect.assertions(1);

            const output = stripAnsi(renderToString(<Timer duration={65_000} />));

            expect(output).toBe("01:05");
        });

        it("renders with custom format", () => {
            expect.assertions(1);

            const output = stripAnsi(renderToString(<Timer duration={30_000} format={(ms) => `${ms / 1000}s`} />));

            expect(output).toBe("30s");
        });

        it("renders HH:MM:SS for durations over 1 hour", () => {
            expect.assertions(1);

            const output = stripAnsi(renderToString(<Timer duration={3_661_000} />));

            expect(output).toBe("01:01:01");
        });
    });
});
