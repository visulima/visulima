/**
 * suspendTerminal() — hands terminal control to a child process, then restores
 * Ink's rendering. These are render-only (no keystrokes) so they don't depend on
 * input timing.
 */
import React, { useEffect } from "react";
import { describe, expect, it } from "vitest";

import { Text } from "../../src/components/index";
import { useApp } from "../../src/ink/hooks/use-app";
import { render } from "../../src/ink/index";
import createStdout from "../helpers/ink-create-stdout";
import waitFor from "../helpers/wait-for";

const ALT_SCREEN_ON = "[?1049h";
const ALT_SCREEN_OFF = "[?1049l";

describe("suspendTerminal", () => {
    it("runs the callback, resolves undefined, and releases then restores the screen", async () => {
        expect.assertions(3);

        const stdout = createStdout();
        const state: { done: boolean; ranCallback: boolean; result: unknown } = { done: false, ranCallback: false, result: "unset" };

        const App = (): React.ReactNode => {
            const { suspendTerminal } = useApp();

            useEffect(() => {
                void (async () => {
                    state.result = await suspendTerminal(async () => {
                        state.ranCallback = true;
                    });
                    state.done = true;
                })();
            }, [suspendTerminal]);

            return <Text>app</Text>;
        };

        const { unmount } = render(<App />, { alternateScreen: true, interactive: true, stdout });

        await waitFor(() => state.done);

        expect(state.ranCallback).toBe(true);
        expect(state.result).toBeUndefined();

        // Alt screen left during suspend (OFF) and re-entered on resume (ON after the OFF).
        const out = stdout.getWrites().join("");

        expect(out.includes(ALT_SCREEN_OFF) && out.lastIndexOf(ALT_SCREEN_ON) > out.indexOf(ALT_SCREEN_OFF)).toBe(true);

        unmount();
    });

    it("returns a disposable resume handle when called without a callback", async () => {
        expect.assertions(1);

        const stdout = createStdout();
        const state = { done: false, handleShape: false };

        const App = (): React.ReactNode => {
            const { suspendTerminal } = useApp();

            useEffect(() => {
                void (async () => {
                    const suspension = await suspendTerminal();

                    state.handleShape = typeof suspension.resume === "function" && typeof suspension[Symbol.asyncDispose] === "function";

                    await suspension.resume();
                    state.done = true;
                })();
            }, [suspendTerminal]);

            return <Text>app</Text>;
        };

        const { unmount } = render(<App />, { interactive: true, stdout });

        await waitFor(() => state.done);

        expect(state.handleShape).toBe(true);

        unmount();
    });
});
