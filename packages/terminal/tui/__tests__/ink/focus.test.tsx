import delay from "delay";
import { useEffect } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Box, Text } from "../../src/components/index";
import { useFocus } from "../../src/ink/hooks/use-focus";
import { useFocusManager } from "../../src/ink/hooks/use-focus-manager";
import { render } from "../../src/ink/index";
import { createStdin, emitReadable } from "../helpers/ink-create-stdin";
import createStdout from "../helpers/ink-create-stdout";

type ItemProps = {
    readonly autoFocus: boolean;
    readonly disabled?: boolean;
    readonly label: string;
};

const Item = ({ autoFocus, disabled = false, label }: ItemProps) => {
    const { isFocused } = useFocus({
        autoFocus,
        isActive: !disabled,
    });

    return (
        <Text>
            {label}
{" "}
{isFocused ? "✔" : null}
        </Text>
    );
};

type TestProps = {
    readonly autoFocus?: boolean;
    readonly disabled?: boolean;
    readonly disableFirst?: boolean;
    readonly disableSecond?: boolean;
    readonly disableThird?: boolean;
    readonly focusNext?: boolean;
    readonly focusPrevious?: boolean;
    readonly showFirst?: boolean;
    readonly unmountChildren?: boolean;
};

const Test = ({
    autoFocus = false,
    disabled = false,
    disableFirst = false,
    disableSecond = false,
    disableThird = false,
    focusNext = false,
    focusPrevious = false,
    showFirst = true,
    unmountChildren = false,
}: TestProps) => {
    const focusManager = useFocusManager();

    useEffect(() => {
        if (disabled) {
            focusManager.disableFocus();
        } else {
            focusManager.enableFocus();
        }
    }, [disabled, focusManager]);

    useEffect(() => {
        if (focusNext) {
            focusManager.focusNext();
        }
    }, [focusNext, focusManager]);

    useEffect(() => {
        if (focusPrevious) {
            focusManager.focusPrevious();
        }
    }, [focusPrevious, focusManager]);

    if (unmountChildren) {
        return null;
    }

    return (
        <Box flexDirection="column">
            {showFirst ? <Item autoFocus={autoFocus} disabled={disableFirst} label="First" /> : null}
            <Item autoFocus={autoFocus} disabled={disableSecond} label="Second" />
            <Item autoFocus={autoFocus} disabled={disableThird} label="Third" />
        </Box>
    );
};

describe("focus", () => {
    let currentUnmount: (() => void) | undefined;

    afterEach(async () => {
        currentUnmount?.();
        currentUnmount = undefined;
        // Allow React cleanup effects and pending microtasks to settle
        // before the next test creates a new Ink instance.
        await delay(100);
    });

    it("do not focus on register when auto focus is off", async () => {
        expect.assertions(1);

        const stdout = createStdout();
        const stdin = createStdin();

        const { unmount } = render(<Test />, { debug: true, stdin, stdout });

        currentUnmount = unmount;

        await delay(50);

        expect((stdout.write as any).mock.calls.at(-1)[0]).toBe(["First", "Second", "Third"].join("\n"));
    });

    it("focus the first component to register", async () => {
        expect.assertions(1);

        const stdout = createStdout();
        const stdin = createStdin();

        const { unmount } = render(<Test autoFocus />, { debug: true, stdin, stdout });

        currentUnmount = unmount;

        await delay(50);

        expect((stdout.write as any).mock.calls.at(-1)[0]).toBe(["First ✔", "Second", "Third"].join("\n"));
    });

    it("unfocus active component on Esc", async () => {
        expect.assertions(1);

        const stdout = createStdout();
        const stdin = createStdin();

        const { unmount } = render(<Test />, { debug: true, stdin, stdout });

        currentUnmount = unmount;

        await delay(50);
        emitReadable(stdin, "\u001B");
        await delay(50);

        expect((stdout.write as any).mock.calls.at(-1)[0]).toBe(["First", "Second", "Third"].join("\n"));
    });

    it("switch focus to first component on Tab", async () => {
        expect.assertions(1);

        const stdout = createStdout();
        const stdin = createStdin();

        const { unmount } = render(<Test />, { debug: true, stdin, stdout });

        currentUnmount = unmount;

        await delay(50);
        emitReadable(stdin, "\t");
        await delay(50);

        expect((stdout.write as any).mock.calls.at(-1)[0]).toBe(["First ✔", "Second", "Third"].join("\n"));
    });

    it("switch focus to the next component on Tab", async () => {
        expect.assertions(1);

        const stdout = createStdout();
        const stdin = createStdin();

        const { unmount } = render(<Test />, { debug: true, stdin, stdout });

        currentUnmount = unmount;

        await delay(50);
        emitReadable(stdin, "\t");
        emitReadable(stdin, "\t");
        await delay(50);

        expect((stdout.write as any).mock.calls.at(-1)[0]).toBe(["First", "Second ✔", "Third"].join("\n"));
    });

    it("switch focus to the first component if currently focused component is the last one on Tab", async () => {
        expect.assertions(2);

        const stdout = createStdout();
        const stdin = createStdin();

        const { unmount } = render(<Test autoFocus />, { debug: true, stdin, stdout });

        currentUnmount = unmount;

        await delay(50);
        emitReadable(stdin, "\t");
        emitReadable(stdin, "\t");
        await delay(50);

        expect((stdout.write as any).mock.calls.at(-1)[0]).toBe(["First", "Second", "Third ✔"].join("\n"));

        emitReadable(stdin, "\t");
        await delay(50);

        expect((stdout.write as any).mock.calls.at(-1)[0]).toBe(["First ✔", "Second", "Third"].join("\n"));
    });

    it("skip disabled component on Tab", async () => {
        expect.assertions(1);

        const stdout = createStdout();
        const stdin = createStdin();

        const { unmount } = render(<Test autoFocus disableSecond />, { debug: true, stdin, stdout });

        currentUnmount = unmount;

        await delay(50);
        emitReadable(stdin, "\t");
        await delay(50);

        expect((stdout.write as any).mock.calls.at(-1)[0]).toBe(["First", "Second", "Third ✔"].join("\n"));
    });

    it("switch focus to the previous component on Shift+Tab", async () => {
        expect.assertions(2);

        const stdout = createStdout();
        const stdin = createStdin();

        const { unmount } = render(<Test autoFocus />, { debug: true, stdin, stdout });

        currentUnmount = unmount;

        await delay(50);
        emitReadable(stdin, "\t");
        await delay(50);

        expect((stdout.write as any).mock.calls.at(-1)[0]).toBe(["First", "Second ✔", "Third"].join("\n"));

        emitReadable(stdin, "\u001B[Z");
        await delay(50);

        expect((stdout.write as any).mock.calls.at(-1)[0]).toBe(["First ✔", "Second", "Third"].join("\n"));
    });

    it("switch focus to the last component if currently focused component is the first one on Shift+Tab", async () => {
        expect.assertions(1);

        const stdout = createStdout();
        const stdin = createStdin();

        const { unmount } = render(<Test autoFocus />, { debug: true, stdin, stdout });

        currentUnmount = unmount;

        await delay(50);
        emitReadable(stdin, "\u001B[Z");
        await delay(50);

        expect((stdout.write as any).mock.calls.at(-1)[0]).toBe(["First", "Second", "Third ✔"].join("\n"));
    });

    it("skip disabled component on Shift+Tab", async () => {
        expect.assertions(1);

        const stdout = createStdout();
        const stdin = createStdin();

        const { unmount } = render(<Test autoFocus disableSecond />, { debug: true, stdin, stdout });

        currentUnmount = unmount;

        await delay(50);
        emitReadable(stdin, "\u001B[Z");
        emitReadable(stdin, "\u001B[Z");
        await delay(50);

        expect((stdout.write as any).mock.calls.at(-1)[0]).toBe(["First ✔", "Second", "Third"].join("\n"));
    });

    it("reset focus when focused component unregisters", async () => {
        expect.assertions(1);

        const stdout = createStdout();
        const stdin = createStdin();
        const { rerender, unmount } = render(<Test autoFocus />, { debug: true, stdin, stdout });

        currentUnmount = unmount;

        await delay(50);
        rerender(<Test autoFocus showFirst={false} />);
        await delay(50);

        expect((stdout.write as any).mock.calls.at(-1)[0]).toBe(["Second", "Third"].join("\n"));
    });

    it("focus first component after focused component unregisters", async () => {
        expect.assertions(2);

        const stdout = createStdout();
        const stdin = createStdin();
        const { rerender, unmount } = render(<Test autoFocus />, { debug: true, stdin, stdout });

        currentUnmount = unmount;

        await delay(50);
        rerender(<Test autoFocus showFirst={false} />);
        await delay(50);

        expect((stdout.write as any).mock.calls.at(-1)[0]).toBe(["Second", "Third"].join("\n"));

        emitReadable(stdin, "\t");
        await delay(50);

        expect((stdout.write as any).mock.calls.at(-1)[0]).toBe(["Second ✔", "Third"].join("\n"));
    });

    // The focus render used to race the fixed 50ms delay — `.at(-1)` could
    // capture an intermediate pending frame (First ✔ vs Second ✔), which flaked
    // on every platform. Waiting for the expected frame with vi.waitUntil makes
    // it deterministic, so it no longer needs to be skipped on Windows/macOS.
    it("toggle focus management", async () => {
        expect.assertions(2);

        const stdout = createStdout();
        const stdin = createStdin();
        const { rerender, unmount } = render(<Test autoFocus />, { debug: true, stdin, stdout });

        currentUnmount = unmount;

        await delay(50);
        rerender(<Test autoFocus disabled />);
        await delay(50);
        emitReadable(stdin, "\t");

        // Wait for the focus render to land instead of racing a fixed delay —
        // `.at(-1)` could otherwise catch an intermediate pending frame.
        await vi.waitUntil(() => (stdout.write as any).mock.calls.at(-1)?.[0] === ["First ✔", "Second", "Third"].join("\n"));

        expect((stdout.write as any).mock.calls.at(-1)[0]).toBe(["First ✔", "Second", "Third"].join("\n"));

        rerender(<Test autoFocus />);
        await delay(50);
        emitReadable(stdin, "\t");

        await vi.waitUntil(() => (stdout.write as any).mock.calls.at(-1)?.[0] === ["First", "Second ✔", "Third"].join("\n"));

        expect((stdout.write as any).mock.calls.at(-1)[0]).toBe(["First", "Second ✔", "Third"].join("\n"));
    });

    it("manually focus next component", async () => {
        expect.assertions(1);

        const stdout = createStdout();
        const stdin = createStdin();
        const { unmount } = render(<Test autoFocus />, { debug: true, stdin, stdout });

        currentUnmount = unmount;

        await delay(100);
        emitReadable(stdin, "\t");
        await delay(100);

        expect((stdout.write as any).mock.calls.at(-1)[0]).toBe(["First", "Second ✔", "Third"].join("\n"));
    });

    it("manually focus previous component", async () => {
        expect.assertions(1);

        const stdout = createStdout();
        const stdin = createStdin();
        const { unmount } = render(<Test autoFocus />, { debug: true, stdin, stdout });

        currentUnmount = unmount;

        await delay(100);
        emitReadable(stdin, "\u001B[Z");
        await delay(100);

        expect((stdout.write as any).mock.calls.at(-1)[0]).toBe(["First", "Second", "Third ✔"].join("\n"));
    });

    it("does not crash when focusing next on unmounted children", async () => {
        expect.assertions(1);

        const stdout = createStdout();
        const stdin = createStdin();
        const { rerender, unmount } = render(<Test autoFocus />, { debug: true, stdin, stdout });

        currentUnmount = unmount;

        await delay(50);
        rerender(<Test focusNext unmountChildren />);
        await delay(50);

        expect((stdout.write as any).mock.calls.at(-1)[0]).toBe("");
    });

    it("does not crash when focusing previous on unmounted children", async () => {
        expect.assertions(1);

        const stdout = createStdout();
        const stdin = createStdin();
        const { rerender, unmount } = render(<Test autoFocus />, { debug: true, stdin, stdout });

        currentUnmount = unmount;

        await delay(50);
        rerender(<Test focusPrevious unmountChildren />);
        await delay(50);

        expect((stdout.write as any).mock.calls.at(-1)[0]).toBe("");
    });

    it("focuses first non-disabled component", async () => {
        expect.assertions(1);

        const stdout = createStdout();
        const stdin = createStdin();

        const { unmount } = render(<Test autoFocus disableFirst disableSecond />, { debug: true, stdin, stdout });

        currentUnmount = unmount;

        await delay(50);

        expect((stdout.write as any).mock.calls.at(-1)[0]).toBe(["First", "Second", "Third ✔"].join("\n"));
    });

    it("skips disabled elements when wrapping around", async () => {
        expect.assertions(1);

        const stdout = createStdout();
        const stdin = createStdin();

        const { unmount } = render(<Test autoFocus disableFirst />, { debug: true, stdin, stdout });

        currentUnmount = unmount;

        await delay(50);
        emitReadable(stdin, "\t");
        await delay(50);
        emitReadable(stdin, "\t");
        await delay(50);

        expect((stdout.write as any).mock.calls.at(-1)[0]).toBe(["First", "Second ✔", "Third"].join("\n"));
    });

    it("skips disabled elements when wrapping around from the front", async () => {
        expect.assertions(1);

        const stdout = createStdout();
        const stdin = createStdin();

        const { unmount } = render(<Test autoFocus disableThird />, { debug: true, stdin, stdout });

        currentUnmount = unmount;

        await delay(50);
        emitReadable(stdin, "\u001B[Z");
        await delay(50);

        expect((stdout.write as any).mock.calls.at(-1)[0]).toBe(["First", "Second ✔", "Third"].join("\n"));
    });

    it("focus component renders in concurrent mode", async () => {
        expect.assertions(1);

        const stdout = createStdout();
        const stdin = createStdin();
        const { act } = await import("react");

        let unmount: (() => void) | undefined;

        await act(() => {
            const result = render(<Test />, { concurrent: true, debug: true, stdin, stdout });

            unmount = result.unmount;
        });

        currentUnmount = unmount;

        await delay(50);

        expect((stdout.write as any).mock.calls.at(-1)[0]).toBe(["First", "Second", "Third"].join("\n"));
    });

    it("focus component with autoFocus renders in concurrent mode", async () => {
        expect.assertions(1);

        const stdout = createStdout();
        const stdin = createStdin();
        const { act } = await import("react");

        let unmount: (() => void) | undefined;

        await act(() => {
            const result = render(<Test autoFocus />, { concurrent: true, debug: true, stdin, stdout });

            unmount = result.unmount;
        });

        currentUnmount = unmount;

        await delay(50);

        expect((stdout.write as any).mock.calls.at(-1)[0]).toBe(["First ✔", "Second", "Third"].join("\n"));
    });

    const ItemWithId = ({ autoFocus = false, id, label }: { readonly autoFocus?: boolean; readonly id: string; readonly label: string }) => {
        const { isFocused } = useFocus({ autoFocus, id });

        return (
            <Text>
                {label}
{" "}
{isFocused ? "✔" : null}
            </Text>
        );
    };

    const ActiveIdReader = ({ onActiveId }: { readonly onActiveId: (id: string | undefined) => void }) => {
        const { activeId } = useFocusManager();

        onActiveId(activeId);

        return null;
    };

    it("activeId from useFocusManager reflects currently focused component", async () => {
        expect.assertions(3);

        const stdout = createStdout();
        const stdin = createStdin();
        let capturedActiveId: string | undefined;

        const { unmount } = render(
            <Box flexDirection="column">
                <ActiveIdReader
                    onActiveId={(id) => {
                        capturedActiveId = id;
                    }}
                />
                <ItemWithId id="first" label="First" />
                <ItemWithId id="second" label="Second" />
            </Box>,
            { debug: true, stdin, stdout },
        );

        currentUnmount = unmount;

        await delay(50);

        expect(capturedActiveId).toBeUndefined();

        emitReadable(stdin, "\t");
        await delay(50);

        expect(capturedActiveId).toBe("first");

        emitReadable(stdin, "\t");
        await delay(50);

        expect(capturedActiveId).toBe("second");
    });

    it("activeId resets to undefined on Esc", async () => {
        expect.assertions(2);

        const stdout = createStdout();
        const stdin = createStdin();
        let capturedActiveId: string | undefined;

        const { unmount } = render(
            <Box flexDirection="column">
                <ActiveIdReader
                    onActiveId={(id) => {
                        capturedActiveId = id;
                    }}
                />
                <ItemWithId id="first" label="First" />
            </Box>,
            { debug: true, stdin, stdout },
        );

        currentUnmount = unmount;

        await delay(50);
        emitReadable(stdin, "\t");
        await delay(50);

        expect(capturedActiveId).toBe("first");

        emitReadable(stdin, "\u001B");
        await delay(50);

        expect(capturedActiveId).toBeUndefined();
    });

    it("activeId is set immediately when component uses autoFocus", async () => {
        expect.assertions(1);

        const stdout = createStdout();
        const stdin = createStdin();
        let capturedActiveId: string | undefined;

        const { unmount } = render(
            <Box flexDirection="column">
                <ActiveIdReader
                    onActiveId={(id) => {
                        capturedActiveId = id;
                    }}
                />
                <ItemWithId autoFocus id="first" label="First" />
                <ItemWithId id="second" label="Second" />
            </Box>,
            { debug: true, stdin, stdout },
        );

        currentUnmount = unmount;

        await delay(50);

        expect(capturedActiveId).toBe("first");
    });

    it("activeId updates when focus is changed programmatically", async () => {
        expect.assertions(3);

        const stdout = createStdout();
        const stdin = createStdin();
        let capturedActiveId: string | undefined;
        let capturedFocus: ((id: string) => void) | undefined;

        const FocusCapture = () => {
            const { focus } = useFocusManager();

            capturedFocus = focus;

            return null;
        };

        const { unmount } = render(
            <Box flexDirection="column">
                <ActiveIdReader
                    onActiveId={(id) => {
                        capturedActiveId = id;
                    }}
                />
                <FocusCapture />
                <ItemWithId id="first" label="First" />
                <ItemWithId id="second" label="Second" />
            </Box>,
            { debug: true, stdin, stdout },
        );

        currentUnmount = unmount;

        await delay(50);

        expect(capturedActiveId).toBeUndefined();

        capturedFocus!("second");
        await delay(50);

        expect(capturedActiveId).toBe("second");

        capturedFocus!("first");
        await delay(50);

        expect(capturedActiveId).toBe("first");
    });

    it("activeId resets to undefined when focused component unmounts", async () => {
        expect.assertions(2);

        const stdout = createStdout();
        const stdin = createStdin();
        let capturedActiveId: string | undefined;

        const { rerender, unmount } = render(
            <Box flexDirection="column">
                <ActiveIdReader
                    onActiveId={(id) => {
                        capturedActiveId = id;
                    }}
                />
                <ItemWithId autoFocus id="first" label="First" />
                <ItemWithId id="second" label="Second" />
            </Box>,
            { debug: true, stdin, stdout },
        );

        currentUnmount = unmount;

        await delay(50);

        expect(capturedActiveId).toBe("first");

        rerender(
            <Box flexDirection="column">
                <ActiveIdReader
                    onActiveId={(id) => {
                        capturedActiveId = id;
                    }}
                />
                <ItemWithId id="second" label="Second" />
            </Box>,
        );

        await delay(50);

        expect(capturedActiveId).toBeUndefined();
    });
});
