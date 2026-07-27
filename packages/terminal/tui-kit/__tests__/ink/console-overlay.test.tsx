import { render } from "@visulima/tui";
import delay from "delay";
import React from "react";
import type { vi } from "vitest";
import { afterEach, describe, expect, it } from "vitest";

import { ConsoleOverlay } from "../../src/index";
import { createStdin } from "../helpers/ink-create-stdin";
import createStdout from "../helpers/ink-create-stdout";

describe(ConsoleOverlay, () => {
    let currentUnmount: (() => void) | undefined;

    const setup = async (jsx: React.JSX.Element, waitMs = 100) => {
        const stdout = createStdout();
        const stdin = createStdin();
        const { unmount } = render(jsx, { debug: true, stdin, stdout });

        currentUnmount = unmount;
        await delay(waitMs);

        const getOutput = () => {
            const { calls } = (stdout.write as ReturnType<typeof vi.fn>).mock;

            for (let index = calls.length - 1; index >= 0; index--) {
                const argument = calls[index]?.[0] as string;

                if (typeof argument === "string" && argument.length > 0 && !argument.startsWith("\u001B[?")) {
                    return argument;
                }
            }

            return "";
        };

        return { getOutput, stdin, stdout };
    };

    afterEach(async () => {
        currentUnmount?.();
        currentUnmount = undefined;
        await delay(100);
    });

    it("should render empty state message", async () => {
        expect.assertions(1);

        const { getOutput } = await setup(<ConsoleOverlay />);

        expect(getOutput()).toContain("Console output will appear here");
    });

    it("should render with custom height", async () => {
        expect.assertions(1);

        const { getOutput } = await setup(<ConsoleOverlay height={4} />);

        expect(getOutput()).toBeDefined();
    });

    it("should render docked to top", async () => {
        expect.assertions(1);

        const { getOutput } = await setup(<ConsoleOverlay dock="top" />);

        expect(getOutput()).toBeDefined();
    });
});
