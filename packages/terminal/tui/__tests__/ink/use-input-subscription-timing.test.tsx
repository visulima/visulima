import React from "react";
import { describe, expect, it, vi } from "vitest";

import { Text } from "../../src/components/index";
import useFocus from "../../src/ink/hooks/use-focus";
import useInput from "../../src/ink/hooks/use-input";
import { render } from "../../src/ink/index";
import { createStdin, emitReadable } from "../helpers/ink-create-stdin";
import createStdout from "../helpers/ink-create-stdout";

const Focusable = ({ onKey }: { readonly onKey: (input: string) => void }) => {
    const { isFocused } = useFocus({ autoFocus: true });

    useInput((input) => onKey(input), { isActive: isFocused });

    return <Text>{isFocused ? "focused" : "blurred"}</Text>;
};

describe("useInput subscription timing", () => {
    // Regression: `isFocused` flips during render, but the subscription used to
    // land in a passive effect, which React flushes on its own schedule — after
    // the commit, and potentially after the next I/O callback. A key arriving in
    // that window reached the App, found no handler on the input emitter, and was
    // dropped: no queue, no retry, so the caller waited forever for state that
    // could never arrive. On a loaded CI runner this silently killed every
    // keyboard test in @visulima/tui-kit.
    //
    // Delivering the key from inside the write of the very frame that first
    // renders as focused pins that window: the component has committed as
    // focused, so a handler must already be listening.
    it("handles a key delivered one tick after mount, while focus is settling", async () => {
        expect.assertions(1);

        const onKey = vi.fn();
        const stdout = createStdout();
        const stdin = createStdin();

        const { unmount } = render(<Focusable onKey={onKey} />, { debug: true, stdin, stdout });

        // One macrotask: long enough for the focus state update to commit, short
        // enough that a passive-effect subscription has not been flushed yet.
        await new Promise((resolve) => {
            setTimeout(resolve, 0);
        });

        emitReadable(stdin, "x");

        await new Promise((resolve) => {
            setTimeout(resolve, 500);
        });

        unmount();

        expect(onKey).toHaveBeenCalledWith("x");
    });
});
