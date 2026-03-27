import EventEmitter from "node:events";
import { useEffect } from "react";
import delay from "delay";
import { describe, expect, it } from "vitest";
import { vi } from "vitest";
import { render, Box, Text, useFocus, useFocusManager } from "../../src/ink/index.js";
import createStdout from "../helpers/ink-create-stdout.js";

const createStdin = () => {
    const stdin = new EventEmitter() as unknown as NodeJS.WriteStream;
    stdin.isTTY = true;
    stdin.setRawMode = vi.fn();
    stdin.setEncoding = () => {};
    stdin.read = vi.fn();
    stdin.unref = () => {};
    stdin.ref = () => {};
    return stdin;
};

const emitReadable = (stdin: NodeJS.WriteStream, chunk: string) => {
    const read = stdin.read as ReturnType<typeof vi.fn>;
    read.mockReturnValueOnce(chunk);
    read.mockReturnValueOnce(null);
    stdin.emit("readable");
    read.mockReset();
};

type TestProps = {
    readonly showFirst?: boolean;
    readonly disableFirst?: boolean;
    readonly disableSecond?: boolean;
    readonly disableThird?: boolean;
    readonly autoFocus?: boolean;
    readonly disabled?: boolean;
    readonly focusNext?: boolean;
    readonly focusPrevious?: boolean;
    readonly unmountChildren?: boolean;
};

function Test({
    showFirst = true,
    disableFirst = false,
    disableSecond = false,
    disableThird = false,
    autoFocus = false,
    disabled = false,
    focusNext = false,
    focusPrevious = false,
    unmountChildren = false,
}: TestProps) {
    const focusManager = useFocusManager();

    useEffect(() => {
        if (disabled) {
            focusManager.disableFocus();
        } else {
            focusManager.enableFocus();
        }
    }, [disabled]);

    useEffect(() => {
        if (focusNext) {
            focusManager.focusNext();
        }
    }, [focusNext]);

    useEffect(() => {
        if (focusPrevious) {
            focusManager.focusPrevious();
        }
    }, [focusPrevious]);

    if (unmountChildren) {
        return null;
    }

    return (
        <Box flexDirection="column">
            {showFirst ? <Item label="First" autoFocus={autoFocus} disabled={disableFirst} /> : null}
            <Item label="Second" autoFocus={autoFocus} disabled={disableSecond} />
            <Item label="Third" autoFocus={autoFocus} disabled={disableThird} />
        </Box>
    );
}

type ItemProps = {
    readonly label: string;
    readonly autoFocus: boolean;
    readonly disabled?: boolean;
};

function Item({ label, autoFocus, disabled = false }: ItemProps) {
    const { isFocused } = useFocus({
        autoFocus,
        isActive: !disabled,
    });

    return (
        <Text>
            {label} {isFocused ? "✔" : null}
        </Text>
    );
}

it("do not focus on register when auto focus is off", async () => {
    const stdout = createStdout();
    const stdin = createStdin();
    render(<Test />, { stdout, stdin, debug: true });

    await delay(50);

    expect((stdout.write as any).mock.calls.at(-1)[0]).toBe(["First", "Second", "Third"].join("\n"));
});

it("focus the first component to register", async () => {
    const stdout = createStdout();
    const stdin = createStdin();
    render(<Test autoFocus />, { stdout, stdin, debug: true });

    await delay(50);

    expect((stdout.write as any).mock.calls.at(-1)[0]).toBe(["First ✔", "Second", "Third"].join("\n"));
});

it("unfocus active component on Esc", async () => {
    const stdout = createStdout();
    const stdin = createStdin();
    render(<Test />, { stdout, stdin, debug: true });

    await delay(50);
    emitReadable(stdin, "\u001B");
    await delay(50);
    expect((stdout.write as any).mock.calls.at(-1)[0]).toBe(["First", "Second", "Third"].join("\n"));
});

it("switch focus to first component on Tab", async () => {
    const stdout = createStdout();
    const stdin = createStdin();
    render(<Test />, { stdout, stdin, debug: true });

    await delay(50);
    emitReadable(stdin, "\t");
    await delay(50);

    expect((stdout.write as any).mock.calls.at(-1)[0]).toBe(["First ✔", "Second", "Third"].join("\n"));
});

it("switch focus to the next component on Tab", async () => {
    const stdout = createStdout();
    const stdin = createStdin();
    render(<Test />, { stdout, stdin, debug: true });

    await delay(50);
    emitReadable(stdin, "\t");
    emitReadable(stdin, "\t");
    await delay(50);

    expect((stdout.write as any).mock.calls.at(-1)[0]).toBe(["First", "Second ✔", "Third"].join("\n"));
});

it("switch focus to the first component if currently focused component is the last one on Tab", async () => {
    const stdout = createStdout();
    const stdin = createStdin();
    render(<Test autoFocus />, { stdout, stdin, debug: true });

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
    const stdout = createStdout();
    const stdin = createStdin();
    render(<Test autoFocus disableSecond />, { stdout, stdin, debug: true });

    await delay(50);
    emitReadable(stdin, "\t");
    await delay(50);

    expect((stdout.write as any).mock.calls.at(-1)[0]).toBe(["First", "Second", "Third ✔"].join("\n"));
});

it("switch focus to the previous component on Shift+Tab", async () => {
    const stdout = createStdout();
    const stdin = createStdin();
    render(<Test autoFocus />, { stdout, stdin, debug: true });

    await delay(50);
    emitReadable(stdin, "\t");
    await delay(50);

    expect((stdout.write as any).mock.calls.at(-1)[0]).toBe(["First", "Second ✔", "Third"].join("\n"));

    emitReadable(stdin, "\u001B[Z");
    await delay(50);

    expect((stdout.write as any).mock.calls.at(-1)[0]).toBe(["First ✔", "Second", "Third"].join("\n"));
});

it("switch focus to the last component if currently focused component is the first one on Shift+Tab", async () => {
    const stdout = createStdout();
    const stdin = createStdin();
    render(<Test autoFocus />, { stdout, stdin, debug: true });

    await delay(50);
    emitReadable(stdin, "\u001B[Z");
    await delay(50);

    expect((stdout.write as any).mock.calls.at(-1)[0]).toBe(["First", "Second", "Third ✔"].join("\n"));
});

it("skip disabled component on Shift+Tab", async () => {
    const stdout = createStdout();
    const stdin = createStdin();
    render(<Test autoFocus disableSecond />, { stdout, stdin, debug: true });

    await delay(50);
    emitReadable(stdin, "\u001B[Z");
    emitReadable(stdin, "\u001B[Z");
    await delay(50);

    expect((stdout.write as any).mock.calls.at(-1)[0]).toBe(["First ✔", "Second", "Third"].join("\n"));
});

it("reset focus when focused component unregisters", async () => {
    const stdout = createStdout();
    const stdin = createStdin();
    const { rerender } = render(<Test autoFocus />, { stdout, stdin, debug: true });

    await delay(50);
    rerender(<Test autoFocus showFirst={false} />);
    await delay(50);

    expect((stdout.write as any).mock.calls.at(-1)[0]).toBe(["Second", "Third"].join("\n"));
});

it("focus first component after focused component unregisters", async () => {
    const stdout = createStdout();
    const stdin = createStdin();
    const { rerender } = render(<Test autoFocus />, { stdout, stdin, debug: true });

    await delay(50);
    rerender(<Test autoFocus showFirst={false} />);
    await delay(50);

    expect((stdout.write as any).mock.calls.at(-1)[0]).toBe(["Second", "Third"].join("\n"));

    emitReadable(stdin, "\t");
    await delay(50);

    expect((stdout.write as any).mock.calls.at(-1)[0]).toBe(["Second ✔", "Third"].join("\n"));
});

it("toggle focus management", async () => {
    const stdout = createStdout();
    const stdin = createStdin();
    const { rerender } = render(<Test autoFocus />, { stdout, stdin, debug: true });

    await delay(50);
    rerender(<Test autoFocus disabled />);
    await delay(50);
    emitReadable(stdin, "\t");
    await delay(50);

    expect((stdout.write as any).mock.calls.at(-1)[0]).toBe(["First ✔", "Second", "Third"].join("\n"));

    rerender(<Test autoFocus />);
    await delay(50);
    emitReadable(stdin, "\t");
    await delay(50);

    expect((stdout.write as any).mock.calls.at(-1)[0]).toBe(["First", "Second ✔", "Third"].join("\n"));
});

it("manually focus next component", async () => {
    const stdout = createStdout();
    const stdin = createStdin();
    const { rerender } = render(<Test autoFocus />, { stdout, stdin, debug: true });

    await delay(50);
    rerender(<Test autoFocus focusNext />);
    await delay(50);

    expect((stdout.write as any).mock.calls.at(-1)[0]).toBe(["First", "Second ✔", "Third"].join("\n"));
});

it("manually focus previous component", async () => {
    const stdout = createStdout();
    const stdin = createStdin();
    const { rerender } = render(<Test autoFocus />, { stdout, stdin, debug: true });

    await delay(50);
    rerender(<Test autoFocus focusPrevious />);
    await delay(50);

    expect((stdout.write as any).mock.calls.at(-1)[0]).toBe(["First", "Second", "Third ✔"].join("\n"));
});

it("does not crash when focusing next on unmounted children", async () => {
    const stdout = createStdout();
    const stdin = createStdin();
    const { rerender } = render(<Test autoFocus />, { stdout, stdin, debug: true });

    await delay(50);
    rerender(<Test focusNext unmountChildren />);
    await delay(50);

    expect((stdout.write as any).mock.calls.at(-1)[0]).toBe("");
});

it("does not crash when focusing previous on unmounted children", async () => {
    const stdout = createStdout();
    const stdin = createStdin();
    const { rerender } = render(<Test autoFocus />, { stdout, stdin, debug: true });

    await delay(50);
    rerender(<Test focusPrevious unmountChildren />);
    await delay(50);

    expect((stdout.write as any).mock.calls.at(-1)[0]).toBe("");
});

it("focuses first non-disabled component", async () => {
    const stdout = createStdout();
    const stdin = createStdin();
    render(<Test autoFocus disableFirst disableSecond />, { stdout, stdin, debug: true });

    await delay(50);

    expect((stdout.write as any).mock.calls.at(-1)[0]).toBe(["First", "Second", "Third ✔"].join("\n"));
});

it("skips disabled elements when wrapping around", async () => {
    const stdout = createStdout();
    const stdin = createStdin();
    render(<Test autoFocus disableFirst />, { stdout, stdin, debug: true });

    await delay(50);
    emitReadable(stdin, "\t");
    await delay(50);
    emitReadable(stdin, "\t");
    await delay(50);

    expect((stdout.write as any).mock.calls.at(-1)[0]).toBe(["First", "Second ✔", "Third"].join("\n"));
});

it("skips disabled elements when wrapping around from the front", async () => {
    const stdout = createStdout();
    const stdin = createStdin();
    render(<Test autoFocus disableThird />, { stdout, stdin, debug: true });

    await delay(50);
    emitReadable(stdin, "\u001B[Z");
    await delay(50);

    expect((stdout.write as any).mock.calls.at(-1)[0]).toBe(["First", "Second ✔", "Third"].join("\n"));
});

it("focus component renders in concurrent mode", async () => {
    const stdout = createStdout();
    const stdin = createStdin();
    const { act } = await import("react");

    await act(async () => {
        render(<Test />, { stdout, stdin, debug: true, concurrent: true });
    });

    await delay(50);

    expect((stdout.write as any).mock.calls.at(-1)[0]).toBe(["First", "Second", "Third"].join("\n"));
});

it("focus component with autoFocus renders in concurrent mode", async () => {
    const stdout = createStdout();
    const stdin = createStdin();
    const { act } = await import("react");

    await act(async () => {
        render(<Test autoFocus />, { stdout, stdin, debug: true, concurrent: true });
    });

    await delay(50);

    expect((stdout.write as any).mock.calls.at(-1)[0]).toBe(["First ✔", "Second", "Third"].join("\n"));
});

function ItemWithId({ label, id, autoFocus = false }: { readonly label: string; readonly id: string; readonly autoFocus?: boolean }) {
    const { isFocused } = useFocus({ id, autoFocus });
    return (
        <Text>
            {label} {isFocused ? "✔" : null}
        </Text>
    );
}

function ActiveIdReader({ onActiveId }: { readonly onActiveId: (id: string | undefined) => void }) {
    const { activeId } = useFocusManager();
    onActiveId(activeId);
    return null;
}

it("activeId from useFocusManager reflects currently focused component", async () => {
    const stdout = createStdout();
    const stdin = createStdin();
    let capturedActiveId: string | undefined;

    render(
        <Box flexDirection="column">
            <ActiveIdReader
                onActiveId={(id) => {
                    capturedActiveId = id;
                }}
            />
            <ItemWithId label="First" id="first" />
            <ItemWithId label="Second" id="second" />
        </Box>,
        { stdout, stdin, debug: true },
    );

    await delay(50);
    expect(capturedActiveId).toBe(undefined);

    emitReadable(stdin, "\t");
    await delay(50);
    expect(capturedActiveId).toBe("first");

    emitReadable(stdin, "\t");
    await delay(50);
    expect(capturedActiveId).toBe("second");
});

it("activeId resets to undefined on Esc", async () => {
    const stdout = createStdout();
    const stdin = createStdin();
    let capturedActiveId: string | undefined;

    render(
        <Box flexDirection="column">
            <ActiveIdReader
                onActiveId={(id) => {
                    capturedActiveId = id;
                }}
            />
            <ItemWithId label="First" id="first" />
        </Box>,
        { stdout, stdin, debug: true },
    );

    await delay(50);
    emitReadable(stdin, "\t");
    await delay(50);
    expect(capturedActiveId).toBe("first");

    emitReadable(stdin, "\u001B");
    await delay(50);
    expect(capturedActiveId).toBe(undefined);
});

it("activeId is set immediately when component uses autoFocus", async () => {
    const stdout = createStdout();
    const stdin = createStdin();
    let capturedActiveId: string | undefined;

    render(
        <Box flexDirection="column">
            <ActiveIdReader
                onActiveId={(id) => {
                    capturedActiveId = id;
                }}
            />
            <ItemWithId autoFocus label="First" id="first" />
            <ItemWithId label="Second" id="second" />
        </Box>,
        { stdout, stdin, debug: true },
    );

    await delay(50);
    expect(capturedActiveId).toBe("first");
});

it("activeId updates when focus is changed programmatically", async () => {
    const stdout = createStdout();
    const stdin = createStdin();
    let capturedActiveId: string | undefined;
    let capturedFocus: ((id: string) => void) | undefined;

    function FocusCapture() {
        const { focus } = useFocusManager();
        capturedFocus = focus;
        return null;
    }

    render(
        <Box flexDirection="column">
            <ActiveIdReader
                onActiveId={(id) => {
                    capturedActiveId = id;
                }}
            />
            <FocusCapture />
            <ItemWithId label="First" id="first" />
            <ItemWithId label="Second" id="second" />
        </Box>,
        { stdout, stdin, debug: true },
    );

    await delay(50);
    expect(capturedActiveId).toBe(undefined);

    capturedFocus!("second");
    await delay(50);
    expect(capturedActiveId).toBe("second");

    capturedFocus!("first");
    await delay(50);
    expect(capturedActiveId).toBe("first");
});

it("activeId resets to undefined when focused component unmounts", async () => {
    const stdout = createStdout();
    const stdin = createStdin();
    let capturedActiveId: string | undefined;

    const { rerender } = render(
        <Box flexDirection="column">
            <ActiveIdReader
                onActiveId={(id) => {
                    capturedActiveId = id;
                }}
            />
            <ItemWithId autoFocus label="First" id="first" />
            <ItemWithId label="Second" id="second" />
        </Box>,
        { stdout, stdin, debug: true },
    );

    await delay(50);
    expect(capturedActiveId).toBe("first");

    rerender(
        <Box flexDirection="column">
            <ActiveIdReader
                onActiveId={(id) => {
                    capturedActiveId = id;
                }}
            />
            <ItemWithId label="Second" id="second" />
        </Box>,
    );

    await delay(50);
    expect(capturedActiveId).toBe(undefined);
});
