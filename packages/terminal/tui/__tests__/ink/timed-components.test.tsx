import delay from "delay";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { StreamingText, Toast } from "../../src/components/index";
import { render } from "../../src/ink/index";
import createStdout from "../helpers/ink-create-stdout";

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
    await delay(10);
});

describe("toast auto-dismiss", () => {
    it("should auto-dismiss after the configured duration", async () => {
        expect.assertions(2);

        const onDismiss = vi.fn();
        const { getOutput } = mount(
            <Toast duration={50} onDismiss={onDismiss} variant="info">
                About to disappear
            </Toast>,
        );

        // Visible on first paint
        await delay(10);

        expect(getOutput()).toContain("About to disappear");

        // After the duration elapses the toast hides itself and fires onDismiss
        await delay(80);

        expect(onDismiss).toHaveBeenCalledTimes(1);
    });

    it("should not auto-dismiss when duration is 0", async () => {
        expect.assertions(1);

        const onDismiss = vi.fn();

        mount(
            <Toast duration={0} onDismiss={onDismiss} variant="info">
                Sticky
            </Toast>,
        );

        await delay(80);

        expect(onDismiss).not.toHaveBeenCalled();
    });
});

describe("streamingText typewriter", () => {
    it("should reveal the full text over time and fire onComplete exactly once", async () => {
        expect.assertions(2);

        const onComplete = vi.fn();
        const text = "Hi";
        const { getOutput } = mount(<StreamingText interval={10} onComplete={onComplete} text={text} />);

        // Wait for enough intervals to reveal the full string
        await delay(text.length * 10 + 50);

        expect(getOutput()).toContain(text);
        expect(onComplete).toHaveBeenCalledTimes(1);
    });
});
