import { strip as stripAnsi } from "@visulima/ansi";
import delay from "delay";
import React, { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Text } from "../../src/components/index";
import { useKeyBindings } from "../../src/ink/hooks/use-key-bindings";
import { render } from "../../src/ink/index";
import { createStdin, emitReadable } from "../helpers/ink-create-stdin";
import createStdout from "../helpers/ink-create-stdout";

describe(useKeyBindings, () => {
    let currentUnmount: (() => void) | undefined;

    afterEach(async () => {
        currentUnmount?.();
        await delay(50);
    });

    it("returns enabled bindings only", async () => {
        expect.assertions(1);

        const App = () => {
            const { bindings } = useKeyBindings([
                { binding: { description: "Quit", key: "q" }, handler: () => {} },
                { binding: { description: "Hidden", enabled: false, key: "h" }, handler: () => {} },
                { binding: { description: "Save", key: "s" }, handler: () => {} },
            ]);

            return <Text>{String(bindings.length)}</Text>;
        };

        const stdout = createStdout();
        const stdin = createStdin();

        const { unmount } = render(<App />, { debug: true, stdin, stdout });

        currentUnmount = unmount;

        await delay(50);

        expect(stripAnsi(stdout.get())).toBe("2");
    });

    it("calls handler on matching key press", async () => {
        expect.assertions(1);

        const App = () => {
            const [count, setCount] = useState(0);

            useKeyBindings([
                {
                    binding: { description: "Increment", key: "i" },
                    handler: () => {
                        setCount((c) => c + 1);
                    },
                },
            ]);

            return <Text>{String(count)}</Text>;
        };

        const stdout = createStdout();
        const stdin = createStdin();

        const { unmount } = render(<App />, { debug: true, stdin, stdout });

        currentUnmount = unmount;

        await delay(50);
        emitReadable(stdin, "i");
        await delay(50);

        expect(stdout.get()).toBe("1");
    });

    it("handles special key bindings", async () => {
        expect.assertions(1);

        const App = () => {
            const [pressed, setPressed] = useState("none");

            useKeyBindings([
                {
                    binding: { description: "Up", key: "upArrow" },
                    handler: () => {
                        setPressed("up");
                    },
                },
            ]);

            return <Text>{pressed}</Text>;
        };

        const stdout = createStdout();
        const stdin = createStdin();

        const { unmount } = render(<App />, { debug: true, stdin, stdout });

        currentUnmount = unmount;

        await delay(50);
        // Up arrow escape sequence
        emitReadable(stdin, "\u001B[A");
        await delay(50);

        expect(stdout.get()).toBe("up");
    });

    it("does not call disabled binding handlers", async () => {
        expect.assertions(1);

        const handler = vi.fn();

        const App = () => {
            useKeyBindings([{ binding: { description: "Disabled", enabled: false, key: "d" }, handler }]);

            return <Text>ok</Text>;
        };

        const stdout = createStdout();
        const stdin = createStdin();

        const { unmount } = render(<App />, { debug: true, stdin, stdout });

        currentUnmount = unmount;

        await delay(50);
        emitReadable(stdin, "d");
        await delay(50);

        expect(handler).not.toHaveBeenCalled();
    });

    it("respects isActive option", async () => {
        expect.assertions(1);

        const handler = vi.fn();

        const App = () => {
            useKeyBindings([{ binding: { description: "Test", key: "t" }, handler }], { isActive: false });

            return <Text>ok</Text>;
        };

        const stdout = createStdout();
        const stdin = createStdin();

        const { unmount } = render(<App />, { debug: true, stdin, stdout });

        currentUnmount = unmount;

        await delay(50);
        emitReadable(stdin, "t");
        await delay(50);

        expect(handler).not.toHaveBeenCalled();
    });

    it("matches array of keys", async () => {
        expect.assertions(1);

        const App = () => {
            const [pressed, setPressed] = useState(false);

            useKeyBindings([
                {
                    binding: { description: "Test", key: ["a", "b"] },
                    handler: () => {
                        setPressed(true);
                    },
                },
            ]);

            return <Text>{pressed ? "yes" : "no"}</Text>;
        };

        const stdout = createStdout();
        const stdin = createStdin();

        const { unmount } = render(<App />, { debug: true, stdin, stdout });

        currentUnmount = unmount;

        await delay(50);
        emitReadable(stdin, "b");
        await delay(50);

        expect(stdout.get()).toBe("yes");
    });
});
