import delay from "delay";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";

// Imported from individual component/hook files (not the components barrel) so
// this suite does not drag in optional-peer components like Spinner/Table.
import Box from "../../src/components/box";
import Text from "../../src/components/text";
import { useFocus } from "../../src/ink/hooks/use-focus";
import { useFocusManager } from "../../src/ink/hooks/use-focus-manager";
import { useInput } from "../../src/ink/hooks/use-input";
import render from "../../src/ink/render";
import { createStdin, emitReadable } from "../helpers/ink-create-stdin";
import createStdout from "../helpers/ink-create-stdout";

/**
 * Regression coverage for finding tui-5: focusNext/focusPrevious/focus used to
 * queue setActiveFocusId from inside a setFocusables updater (impure updater).
 * These tests assert Tab navigation advances by exactly one focusable per press.
 */
const Item = ({ autoFocus, label }: { readonly autoFocus: boolean; readonly label: string }) => {
    const { isFocused } = useFocus({ autoFocus, isActive: true });

    return (
        <Text>
            {label}
            {isFocused ? " ✔" : ""}
        </Text>
    );
};

const Test = ({ autoFocus = false }: { readonly autoFocus?: boolean }) => {
    useFocusManager();

    return (
        <Box flexDirection="column">
            <Item autoFocus={autoFocus} label="First" />
            <Item autoFocus={false} label="Second" />
            <Item autoFocus={false} label="Third" />
        </Box>
    );
};

/**
 * Mounts/unmounts a third focusable on "s" so add/removeFocusable are exercised
 * against a live focus list.
 */
const Dynamic = () => {
    useFocusManager();

    const [showThird, setShowThird] = useState(false);

    useInput((input) => {
        if (input === "s") {
            setShowThird((current) => !current);
        }
    });

    return (
        <Box flexDirection="column">
            <Item autoFocus label="First" />
            <Item autoFocus={false} label="Second" />
            {showThird ? <Item autoFocus={false} label="Third" /> : undefined}
        </Box>
    );
};

const lastFrame = (stdout: ReturnType<typeof createStdout>): string => (stdout.write as any).mock.calls.at(-1)[0];

describe("focus navigation", () => {
    let currentUnmount: (() => void) | undefined;

    afterEach(async () => {
        currentUnmount?.();
        currentUnmount = undefined;
        await delay(100);
    });

    it("advances focus by exactly one focusable per Tab", async () => {
        expect.assertions(2);

        const stdout = createStdout();
        const stdin = createStdin();

        const { unmount } = render(<Test autoFocus />, { debug: true, stdin, stdout });

        currentUnmount = unmount;

        await delay(50);

        expect(lastFrame(stdout)).toBe(["First ✔", "Second", "Third"].join("\n"));

        // One Tab must move focus to the second item — not skip to the third.
        emitReadable(stdin, "\t");
        await delay(50);

        expect(lastFrame(stdout)).toBe(["First", "Second ✔", "Third"].join("\n"));
    });

    it("wraps to the first item after Tab past the last", async () => {
        expect.assertions(1);

        const stdout = createStdout();
        const stdin = createStdin();

        const { unmount } = render(<Test autoFocus />, { debug: true, stdin, stdout });

        currentUnmount = unmount;

        await delay(50);
        emitReadable(stdin, "\t");
        await delay(50);
        emitReadable(stdin, "\t");
        await delay(50);

        expect(lastFrame(stdout)).toBe(["First", "Second", "Third ✔"].join("\n"));
    });

    it("keeps navigation correct when focusables are added and removed", async () => {
        expect.assertions(3);

        const stdout = createStdout();
        const stdin = createStdin();

        const { unmount } = render(<Dynamic />, { debug: true, stdin, stdout });

        currentUnmount = unmount;

        await delay(50);

        expect(lastFrame(stdout)).toBe(["First ✔", "Second"].join("\n"));

        // "s" mounts a third item — addFocusable must extend the list, not replace it.
        emitReadable(stdin, "s");
        await delay(50);
        emitReadable(stdin, "\t");
        await delay(50);

        expect(lastFrame(stdout)).toBe(["First", "Second ✔", "Third"].join("\n"));

        // "s" again unmounts it — removeFocusable must shrink the list so Tab wraps
        // over two items rather than stepping onto a stale entry.
        emitReadable(stdin, "s");
        await delay(50);
        emitReadable(stdin, "\t");
        await delay(50);

        expect(lastFrame(stdout)).toBe(["First ✔", "Second"].join("\n"));
    });

    it("moves focus back by exactly one focusable on Shift+Tab", async () => {
        expect.assertions(2);

        const stdout = createStdout();
        const stdin = createStdin();

        const { unmount } = render(<Test autoFocus />, { debug: true, stdin, stdout });

        currentUnmount = unmount;

        await delay(50);
        emitReadable(stdin, "\t");
        await delay(50);

        expect(lastFrame(stdout)).toBe(["First", "Second ✔", "Third"].join("\n"));

        // Shift+Tab must step back to the first item, not skip past it.
        emitReadable(stdin, "[Z");
        await delay(50);

        expect(lastFrame(stdout)).toBe(["First ✔", "Second", "Third"].join("\n"));
    });
});
