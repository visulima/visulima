import { cursorTo } from "@visulima/ansi";
import delay from "delay";
import { act, Suspense, useEffect, useState } from "react";
import { afterEach, describe, expect, it } from "vitest";

import { Box, Cursor, render, Text, useCursor, useInput, useStdout } from "../../src/ink/index.js";
import { createStdin, emitReadable } from "../helpers/ink-create-stdin.js";
import createStdout from "../helpers/ink-create-stdout.js";

const showCursorEscape = "\u001B[?25h";
const hideCursorEscape = "\u001B[?25l";

// React Suspense requires throwing a Promise/thenable — helper to satisfy only-throw-error
const throwForSuspense = (thenable: Promise<unknown>): never => {
    // eslint-disable-next-line @typescript-eslint/only-throw-error -- React Suspense requires throwing a Promise
    throw thenable;
};

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

            attempts += 1;

            if (attempts >= maxAttempts) {
                clearInterval(interval);
                reject(new Error(`Condition was not met in ${String(timeoutMs)}ms`));
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

describe("cursor", () => {
    let currentUnmount: (() => void) | undefined;

    afterEach(async () => {
        currentUnmount?.();
        currentUnmount = undefined;
        await delay(50);
    });

    it("cursor is shown at specified position after render", async () => {
        expect.hasAssertions();

        const stdout = createStdout();
        const stdin = createStdin();

        const { unmount } = render(<InputApp />, { stdin, stdout });
        currentUnmount = unmount;

        await delay(50);

        const firstRenderOutput = getWriteCalls(stdout).join("");

        expect(firstRenderOutput).toContain(showCursorEscape);
        expect(firstRenderOutput).toContain(cursorTo(2));
    });

    it("cursor is not hidden by useEffect after first render", async () => {
        expect.hasAssertions();

        const stdout = createStdout();
        const stdin = createStdin();

        const { unmount } = render(<InputApp />, { stdin, stdout });
        currentUnmount = unmount;

        await delay(50);

        const output = getWriteCalls(stdout).join("");
        const lastShowIndex = output.lastIndexOf(showCursorEscape);
        const lastHideIndex = output.lastIndexOf(hideCursorEscape);

        expect(lastShowIndex).toBeGreaterThan(lastHideIndex);
    });

    it("cursor follows text input", async () => {
        expect.hasAssertions();

        const stdout = createStdout();
        const stdin = createStdin();

        const { unmount } = render(<InputApp />, { stdin, stdout });
        currentUnmount = unmount;

        await delay(50);

        emitReadable(stdin, "a");
        await delay(50);

        const allOutput = getWriteCalls(stdout).join("");

        expect(allOutput).toContain(showCursorEscape);
        expect(allOutput).toContain(cursorTo(3));
    });

    it("cursor moves on space input even when output is identical", async () => {
        expect.hasAssertions();

        const stdout = createStdout();
        const stdin = createStdin();

        const { unmount } = render(<InputApp />, { stdin, stdout });
        currentUnmount = unmount;

        await delay(100);

        emitReadable(stdin, "a");
        await delay(100);
        const afterA = (stdout.write as any).mock.calls.length;

        emitReadable(stdin, " ");
        await delay(100);

        expect((stdout.write as any).mock.calls.length).toBeGreaterThan(afterA);

        const allOutput = getWriteCalls(stdout).join("");

        expect(allOutput).toContain(cursorTo(4));
    });

    it("cursor is cleared when component using useCursor unmounts", async () => {
        expect.hasAssertions();

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
        currentUnmount = unmount;

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
    });

    it("cursor position does not leak from suspended concurrent render to fallback", async () => {
        expect.hasAssertions();

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
                throwForSuspense(promise);
            }

            return <Text>loaded</Text>;
        };

        const Test = () => (
            <Suspense fallback={<Text>loading</Text>}>
                <CursorChild />
            </Suspense>
        );

        await act(() => {
            const result = render(<Test />, { concurrent: true, stdin, stdout });
            currentUnmount = result.unmount;
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
        expect.hasAssertions();

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
        currentUnmount = unmount;

        await delay(50);

        const writesBeforeInput = (stdout.write as any).mock.calls.length;

        emitReadable(stdin, "x");
        await delay(50);

        const secondRenderOutput = getWriteCalls(stdout).slice(writesBeforeInput).join("");

        expect(secondRenderOutput).toContain(hideCursorEscape);
        expect(secondRenderOutput).toContain("x");
    });

    it("debug mode: useStdout().write() replays latest frame", async () => {
        expect.hasAssertions();

        const DebugStdoutWriteApp = () => {
            const { write } = useStdout();

            useEffect(() => {
                write("from stdout hook\n");
            }, [write]);

            return <Text>Hello</Text>;
        };

        const stdout = createStdout();
        const { unmount } = render(<DebugStdoutWriteApp />, { debug: true, stdout });
        currentUnmount = unmount;

        await waitForCondition(() => getWriteCalls(stdout).some((write) => write.includes("from stdout hook\nHello")));

        const writes = getWriteCalls(stdout);
        const hookWrite = writes.find((write) => write.includes("from stdout hook\nHello"));

        expect(hookWrite).toBeDefined();
        expect(writes).not.toContain("");
    });

    it("inline cursor positions at end of preceding text", async () => {
        expect.hasAssertions();

        const stdout = createStdout();
        const stdin = createStdin();

        const InlineApp = () => (
            <Box>
                <Text>hello</Text>
                <Cursor />
            </Box>
        );

        const { unmount } = render(<InlineApp />, { stdin, stdout });
        currentUnmount = unmount;

        await delay(50);

        const output = getWriteCalls(stdout).join("");

        expect(output).toContain(showCursorEscape);
        // "hello" is 5 chars wide, cursor should be at column 5
        expect(output).toContain(cursorTo(5));
    });

    it("inline cursor positions between text nodes", async () => {
        expect.hasAssertions();

        const stdout = createStdout();
        const stdin = createStdin();

        const InlineApp = () => (
            <Box>
                <Text>he</Text>
                <Cursor />
                <Text>llo</Text>
            </Box>
        );

        const { unmount } = render(<InlineApp />, { stdin, stdout });
        currentUnmount = unmount;

        await delay(50);

        const output = getWriteCalls(stdout).join("");

        expect(output).toContain(showCursorEscape);
        // "he" is 2 chars, cursor should be at column 2
        expect(output).toContain(cursorTo(2));
    });

    it("inline cursor follows text input", async () => {
        expect.hasAssertions();

        const stdout = createStdout();
        const stdin = createStdin();

        const InlineInputApp = () => {
            const [text, setText] = useState("");

            useInput((input, key) => {
                if (!key.ctrl && !key.meta && input) {
                    setText((previous) => previous + input);
                }
            });

            return (
                <Box>
                    <Text>{`> ${text}`}</Text>
                    <Cursor />
                </Box>
            );
        };

        const { unmount } = render(<InlineInputApp />, { stdin, stdout });
        currentUnmount = unmount;

        await delay(50);

        // Initial: "> " is 2 chars, cursor at column 2
        let output = getWriteCalls(stdout).join("");

        expect(output).toContain(cursorTo(2));

        emitReadable(stdin, "ab");
        await delay(50);

        // After "ab": "> ab" is 4 chars, cursor at column 4
        output = getWriteCalls(stdout).join("");

        expect(output).toContain(cursorTo(4));
    });

    it("inline cursor with no preceding text falls back to parent origin", async () => {
        expect.hasAssertions();

        const stdout = createStdout();
        const stdin = createStdin();

        const InlineApp = () => (
            <Box>
                <Cursor />
                <Text>hello</Text>
            </Box>
        );

        const { unmount } = render(<InlineApp />, { stdin, stdout });
        currentUnmount = unmount;

        await delay(50);

        const output = getWriteCalls(stdout).join("");

        expect(output).toContain(showCursorEscape);
        // No preceding text, cursor falls back to parent origin (column 0)
        expect(output).toContain(cursorTo(0));
    });

    it("inline cursor handles text wrapping correctly", async () => {
        expect.hasAssertions();

        const stdout = createStdout(10);
        const stdin = createStdin();

        // "hello world" is 11 chars, wraps at column 10
        const InlineApp = () => (
            <Box width={10}>
                <Text>hello world</Text>
                <Cursor />
            </Box>
        );

        const { unmount } = render(<InlineApp />, { stdin, stdout });
        currentUnmount = unmount;

        await delay(50);

        const output = getWriteCalls(stdout).join("");

        expect(output).toContain(showCursorEscape);
        // After wrapping "hello world" in a 10-col box, text wraps to 2 lines.
        // The cursor should NOT be at column 11 (unwrapped), but rather on the
        // second line after the wrapped portion. This verifies wrapping awareness.
        // With word-wrap, "hello" stays on line 0 and "world" goes to line 1.
        // Cursor should be at the end of "world" (column 5) on line 1.
        expect(output).toContain(cursorTo(5));
    });
});
