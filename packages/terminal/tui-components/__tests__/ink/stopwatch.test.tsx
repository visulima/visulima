import { strip as stripAnsi } from "@visulima/ansi";
import { render } from "@visulima/tui";
import { Text } from "@visulima/tui/components/text";
import { useStopwatch } from "@visulima/tui/hooks/use-stopwatch";
import delay from "delay";
import React from "react";
import { afterEach, describe, expect, it } from "vitest";

import { Stopwatch } from "../../src/index";
import createStdout from "../helpers/ink-create-stdout";
import { renderToString } from "../helpers/ink-render";

describe("stopwatch", () => {
    describe("useStopwatch hook", () => {
        let currentUnmount: (() => void) | undefined;

        afterEach(async () => {
            currentUnmount?.();
            await delay(50);
        });

        it("starts with zero elapsed", () => {
            expect.assertions(1);

            const StopwatchDisplay = () => {
                const { elapsed } = useStopwatch();

                return <Text>{String(elapsed)}</Text>;
            };

            const output = renderToString(<StopwatchDisplay />);

            expect(output).toBe("0");
        });

        it("shows not running by default", () => {
            expect.assertions(1);

            const StopwatchDisplay = () => {
                const { isRunning } = useStopwatch();

                return <Text>{isRunning ? "running" : "stopped"}</Text>;
            };

            const output = renderToString(<StopwatchDisplay />);

            expect(output).toBe("stopped");
        });

        it("autoStart begins counting", async () => {
            expect.assertions(1);

            const StopwatchDisplay = () => {
                const { elapsed } = useStopwatch({ autoStart: true, interval: 50 });

                return <Text>{String(elapsed)}</Text>;
            };

            const stdout = createStdout();
            const { unmount } = render(<StopwatchDisplay />, { debug: true, stdout });

            currentUnmount = unmount;

            await delay(200);

            const elapsed = Number.parseInt(stdout.get(), 10);

            expect(elapsed).toBeGreaterThan(0);
        });

        it("starts with empty laps", () => {
            expect.assertions(1);

            const StopwatchDisplay = () => {
                const { laps } = useStopwatch();

                return <Text>{String(laps.length)}</Text>;
            };

            const output = renderToString(<StopwatchDisplay />);

            expect(output).toBe("0");
        });
    });

    describe("stopwatch component", () => {
        it("renders formatted time", () => {
            expect.assertions(1);

            const output = stripAnsi(renderToString(<Stopwatch />));

            expect(output).toBe("00:00");
        });

        it("renders with custom format", () => {
            expect.assertions(1);

            const output = stripAnsi(renderToString(<Stopwatch format={(ms) => `${ms}ms`} />));

            expect(output).toBe("0ms");
        });
    });
});
