import { cursorTo } from "@visulima/ansi";
import delay from "delay";
import { act, Suspense, useEffect, useState } from "react";
import { expect, it } from "vitest";

import { Box, render, Text, useCursor, useInput, useStdout } from "../../src/ink/index.js";
import { createStdin, emitReadable } from "../helpers/ink-create-stdin.js";
import createStdout from "../helpers/ink-create-stdout.js";

const showCursorEscape = "\u001B[?25h";
const hideCursorEscape = "\u001B[?25l";

const getWriteCalls = (stream: NodeJS.WriteStream): string[] => {
    const writes: string[] = [];
    const { mock } = stream.write as any;

    for (const call of mock.calls) {
        writes.push(call[0] as string);
    }

    return writes;
};

const waitForCondition = async (condition: () => boolean): Promise<void> => {
    if (condition()) {
        return;
    }

    const timeoutMs = 2000;
    const intervalMs = 10;
    const maxAttempts = Math.ceil(timeoutMs / intervalMs);

    await new Promise<void>((resolve, reject) => {
        let attempts = 0;
        const interval = setInterval(() => {
            try {
                if (condition()) {
                    clearInterval(interval);
                    resolve();

                    return;
                }
            } catch (error) {
                clearInterval(interval);
                reject(error instanceof Error ? error : new Error("Condition check threw"));

                return;
            }

            attempts++;

            if (attempts >= maxAttempts) {
                clearInterval(interval);
                reject(new Error(`Condition was not met in ${timeoutMs}ms`));
            }
        }, intervalMs);
    });
};

const InputApp = () => {
    const [text, setText] = useState("");
    const { setCursorPosition } = useCursor();

    useInput((input, key) => {
        if (key.backspace || key.delete) {
            setText((previous) => previous.slice(0, -1));

            return;
        }

        if (!key.ctrl && !key.meta && input) {
            setText((previous) => previous + input);
        }
    });

    setCursorPosition({ x: 2 + text.length, y: 0 });

    return (
        <Box>
            <Text>{`> ${text}`}</Text>
        </Box>
    );
};

it("cursor is shown at specified position after render", async () => {
    const stdout = createStdout();
    const stdin = createStdin();

    const { unmount } = render(<InputApp />, { stdin, stdout });

    await delay(50);

    const firstRenderOutput = getWriteCalls(stdout).join("");

    expect(firstRenderOutput).toContain(showCursorEscape);
    expect(firstRenderOutput).toContain(cursorTo(2));

    unmount();
});

it("cursor is not hidden by useEffect after first render", async () => {
    const stdout = createStdout();
    const stdin = createStdin();

    const { unmount } = render(<InputApp />, { stdin, stdout });

    await delay(50);

    const output = getWriteCalls(stdout).join("");
    const lastShowIndex = output.lastIndexOf(showCursorEscape);
    const lastHideIndex = output.lastIndexOf(hideCursorEscape);

    expect(lastShowIndex).toBeGreaterThan(lastHideIndex);

    unmount();
});

it("cursor follows text input", async () => {
    const stdout = createStdout();
    const stdin = createStdin();

    const { unmount } = render(<InputApp />, { stdin, stdout });

    await delay(50);

    emitReadable(stdin, "a");
    await delay(50);

    const allOutput = getWriteCalls(stdout).join("");

    expect(allOutput).toContain(showCursorEscape);
    expect(allOutput).toContain(cursorTo(3));

    unmount();
});

it("cursor moves on space input even when output is identical", async () => {
    const stdout = createStdout();
    const stdin = createStdin();

    const { unmount } = render(<InputApp />, { stdin, stdout });

    await delay(50);

    emitReadable(stdin, "a");
    await delay(50);
    const afterA = (stdout.write as any).mock.calls.length;

    emitReadable(stdin, " ");
    await delay(50);

    expect((stdout.write as any).mock.calls.length).toBeGreaterThan(afterA);

    const allOutput = getWriteCalls(stdout).join("");

    expect(allOutput).toContain(cursorTo(4));

    unmount();
});

it("cursor is cleared when component using useCursor unmounts", async () => {
    const stdout = createStdout();
    const stdin = createStdin();

    const CursorChild = () => {
        const { setCursorPosition } = useCursor();

        setCursorPosition({ x: 5, y: 0 });

        return <Text>child</Text>;
    };

    const Parent = () => {
        const [showChild, setShowChild] = useState(true);

        useInput((_input, key) => {
            if (key.return) {
                setShowChild(false);
            }
        });

        return <Box>{showChild ? <CursorChild /> : <Text>no cursor</Text>}</Box>;
    };

    const { unmount } = render(<Parent />, { stdin, stdout });

    await delay(50);

    const initialRenderOutput = getWriteCalls(stdout).join("");

    expect(initialRenderOutput).toContain(showCursorEscape);

    const writesBeforeEnter = (stdout.write as any).mock.calls.length;

    emitReadable(stdin, "\r");
    await delay(50);

    const outputAfterChildUnmount = getWriteCalls(stdout).slice(writesBeforeEnter).join("");
    const lastShowIndex = outputAfterChildUnmount.lastIndexOf(showCursorEscape);
    const lastHideIndex = outputAfterChildUnmount.lastIndexOf(hideCursorEscape);

    expect(lastHideIndex).toBeGreaterThan(lastShowIndex);

    unmount();
});

it("cursor position does not leak from suspended concurrent render to fallback", async () => {
    const stdout = createStdout();
    const stdin = createStdin();

    let resolvePromise: () => void;
    const promise = new Promise<void>((resolve) => {
        resolvePromise = resolve;
    });

    let suspended = true;

    const CursorChild = () => {
        const { setCursorPosition } = useCursor();

        setCursorPosition({ x: 5, y: 0 });

        if (suspended) {
            throw promise;
        }

        return <Text>loaded</Text>;
    };

    const Test = () => (
        <Suspense fallback={<Text>loading</Text>}>
            <CursorChild />
        </Suspense>
    );

    await act(async () => {
        render(<Test />, { concurrent: true, stdin, stdout });
    });

    const fallbackOutput = getWriteCalls(stdout).join("");

    expect(fallbackOutput).toContain("loading");
    expect(fallbackOutput).not.toContain(showCursorEscape);

    suspended = false;
    resolvePromise!();
    await act(async () => {
        await delay(50);
    });
});

it("screen does not scroll up on subsequent renders", async () => {
    const stdout = createStdout();
    const stdin = createStdin();

    const MultiLineApp = () => {
        const [text, setText] = useState("");
        const { setCursorPosition } = useCursor();

        useInput((input, key) => {
            if (!key.ctrl && !key.meta && input) {
                setText((previous) => previous + input);
            }
        });

        setCursorPosition({ x: 2 + text.length, y: 1 });

        return (
            <Box flexDirection="column">
                <Text>Header</Text>
                <Text>{`> ${text}`}</Text>
            </Box>
        );
    };

    const { unmount } = render(<MultiLineApp />, { stdin, stdout });

    await delay(50);

    const writesBeforeInput = (stdout.write as any).mock.calls.length;

    emitReadable(stdin, "x");
    await delay(50);

    const secondRenderOutput = getWriteCalls(stdout).slice(writesBeforeInput).join("");

    expect(secondRenderOutput).toContain(hideCursorEscape);
    expect(secondRenderOutput).toContain("x");

    unmount();
});

it("debug mode: useStdout().write() replays latest frame", async () => {
    const DebugStdoutWriteApp = () => {
        const { write } = useStdout();

        useEffect(() => {
            write("from stdout hook\n");
        }, [write]);

        return <Text>Hello</Text>;
    };

    const stdout = createStdout();
    const { unmount } = render(<DebugStdoutWriteApp />, { debug: true, stdout });

    await waitForCondition(() => getWriteCalls(stdout).some((write) => write.includes("from stdout hook\nHello")));

    const writes = getWriteCalls(stdout);
    const hookWrite = writes.find((write) => write.includes("from stdout hook\nHello"));

    expect(hookWrite).toBe(true);
    expect(writes).not.toContain("");

    unmount();
});
