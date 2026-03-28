import EventEmitter from "node:events";
import { createRequire as createRequireForPty } from "node:module";

import { eraseLines, hyperlink as createHyperlink, strip } from "@visulima/ansi";
import { green, red } from "@visulima/colorize";
import React, { Component, useEffect, useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { Box, Newline, render, Spacer, Static, Text, Transform, useInput, useStdin } from "../../src/ink/index.js";
import { emitReadable } from "../helpers/ink-create-stdin.js";
import createStdout from "../helpers/ink-create-stdout.js";
import { renderToString, renderToStringAsync } from "../helpers/ink-render.js";
import { run } from "../helpers/ink-run.js";
import { renderAsync } from "../helpers/ink-test-renderer.js";

const TRAILING_NEWLINE_RE = /\n$/;

const ptyRequest = createRequireForPty(import.meta.url);
const ptyAvailable = (() => {
    try {
        ptyRequest("node-pty");

        return true;
    } catch {
        return false;
    }
})();

describe("components", () => {
    it("text", () => {
        expect.hasAssertions();

        const output = renderToString(<Text>Hello World</Text>);

        expect(output).toBe("Hello World");
    });

    it("text with variable", () => {
        expect.hasAssertions();

        const output = renderToString(
            <Text>
                Count:
                {1}
            </Text>,
        );

        expect(output).toBe("Count:1");
    });

    it("multiple text nodes", () => {
        expect.hasAssertions();

        const output = renderToString(
            <Text>
                Hello
                {" World"}
            </Text>,
        );

        expect(output).toBe("Hello World");
    });

    it("text with component", () => {
        expect.hasAssertions();

        const World = () => <Text>World</Text>;

        const output = renderToString(
            <Text>
                Hello
                {" "}
                <World />
            </Text>,
        );

        expect(output).toBe("Hello World");
    });

    it("text with fragment", () => {
        expect.hasAssertions();

        const output = renderToString(
            <Text>
                Hello
                {" "}
                <>World</>
                {" "}
                {}
            </Text>,
        );

        expect(output).toBe("Hello World");
    });

    it("wrap text", () => {
        expect.hasAssertions();

        const output = renderToString(
            <Box width={7}>
                <Text wrap="wrap">Hello World</Text>
            </Box>,
        );

        expect(output).toBe("Hello\nWorld");
    });

    it("don't wrap text if there is enough space", () => {
        expect.hasAssertions();

        const output = renderToString(
            <Box width={20}>
                <Text wrap="wrap">Hello World</Text>
            </Box>,
        );

        expect(output).toBe("Hello World");
    });

    it("truncate text in the end", () => {
        expect.hasAssertions();

        const output = renderToString(
            <Box width={7}>
                <Text wrap="truncate">Hello World</Text>
            </Box>,
        );

        expect(output).toBe("Hello …");
    });

    it("truncate text in the middle", () => {
        expect.hasAssertions();

        const output = renderToString(
            <Box width={7}>
                <Text wrap="truncate-middle">Hello World</Text>
            </Box>,
        );

        expect(output).toBe("Hel…rld");
    });

    it("truncate text in the beginning", () => {
        expect.hasAssertions();

        const output = renderToString(
            <Box width={7}>
                <Text wrap="truncate-start">Hello World</Text>
            </Box>,
        );

        expect(output).toBe("… World");
    });

    it("do not wrap text with BEL-terminated OSC hyperlinks", () => {
        expect.hasAssertions();

        const hyperlinkBel = "\u001B]8;;https://example.com\u0007Click here\u001B]8;;\u0007";
        const output = renderToString(
            <Box width={20}>
                <Text wrap="wrap">{hyperlinkBel}</Text>
            </Box>,
        );

        expect(strip(output)).toBe("Click here");
    });

    it("do not wrap text with ST-terminated OSC hyperlinks", () => {
        expect.hasAssertions();

        const hyperlinkSt = "\u001B]8;;https://example.com\u001B\\Click here\u001B]8;;\u001B\\";
        const output = renderToString(
            <Box width={20}>
                <Text wrap="wrap">{hyperlinkSt}</Text>
            </Box>,
        );

        expect(strip(output)).toBe("Click here");
    });

    it("do not wrap text with non-hyperlink OSC sequences", () => {
        expect.hasAssertions();

        const text = "\u001B]0;My Title\u0007Some text";
        const output = renderToString(
            <Box width={20}>
                <Text wrap="wrap">{text}</Text>
            </Box>,
        );

        expect(strip(output)).toBe("Some text");
    });

    it("hard-wrap single-word BEL-terminated OSC hyperlink", () => {
        expect.hasAssertions();

        const hyperlinkLong = "\u001B]8;;https://example.com\u0007abcdefghij\u001B]8;;\u0007";
        const output = renderToString(
            <Box width={5}>
                <Text wrap="wrap">{hyperlinkLong}</Text>
            </Box>,
        );

        expect(strip(output).replace(TRAILING_NEWLINE_RE, "")).toBe("abcde\nfghij");
    });

    // TODO: ST-terminated OSC hyperlinks are not yet hard-wrapped correctly by @visulima/string wordWrap
    it.skip("hard-wrap single-word ST-terminated OSC hyperlink", () => {
        expect.hasAssertions();

        const hyperlinkStLong = "\u001B]8;;https://example.com\u001B\\abcdefghij\u001B]8;;\u001B\\";
        const output = renderToString(
            <Box width={5}>
                <Text wrap="wrap">{hyperlinkStLong}</Text>
            </Box>,
        );

        expect(strip(output)).toBe("abcde\nfghij");
    });

    it("ignore empty text node", () => {
        expect.hasAssertions();

        const output = renderToString(
            <Box flexDirection="column">
                <Box>
                    <Text>Hello World</Text>
                </Box>
                <Text />
            </Box>,
        );

        expect(output).toBe("Hello World");
    });

    it("render a single empty text node", () => {
        expect.hasAssertions();

        const output = renderToString(<Text />);

        expect(output).toBe("");
    });

    it("number", () => {
        expect.hasAssertions();

        const output = renderToString(<Text>{1}</Text>);

        expect(output).toBe("1");
    });

    it("fail when text nodes are not within <Text> component", () => {
        expect.hasAssertions();

        let error: Error | undefined;

        class ErrorBoundary extends Component<{ children?: React.ReactNode }, { hasError: boolean }> {
            public static getDerivedStateFromError(): { hasError: boolean } {
                return { hasError: true };
            }

            public override state = { hasError: false };

            public override componentDidCatch(reactError: Error): void {
                error = reactError;
            }

            public override render(): React.ReactNode {
                const { hasError } = this.state;
                const { children } = this.props;

                return hasError ? undefined : children;
            }
        }

        renderToString(
            <ErrorBoundary>
                <Box>
                    Hello
                    <Text>World</Text>
                </Box>
            </ErrorBoundary>,
        );

        expect(error).toBeInstanceOf(Error);
        expect(error?.message).toBe("Text string \"Hello\" must be rendered inside <Text> component");
    });

    it("fail when text node is not within <Text> component", () => {
        expect.hasAssertions();

        let error: Error | undefined;

        class ErrorBoundary extends Component<{ children?: React.ReactNode }, { hasError: boolean }> {
            public static getDerivedStateFromError(): { hasError: boolean } {
                return { hasError: true };
            }

            public override state = { hasError: false };

            public override componentDidCatch(reactError: Error): void {
                error = reactError;
            }

            public override render(): React.ReactNode {
                const { hasError } = this.state;
                const { children } = this.props;

                return hasError ? undefined : children;
            }
        }

        renderToString(
            <ErrorBoundary>
                <Box>Hello World</Box>
            </ErrorBoundary>,
        );

        expect(error).toBeInstanceOf(Error);
        expect(error?.message).toBe("Text string \"Hello World\" must be rendered inside <Text> component");
    });

    it("fail when <Box> is inside <Text> component", () => {
        expect.hasAssertions();

        let error: Error | undefined;

        class ErrorBoundary extends Component<{ children?: React.ReactNode }, { hasError: boolean }> {
            public static getDerivedStateFromError(): { hasError: boolean } {
                return { hasError: true };
            }

            public override state = { hasError: false };

            public override componentDidCatch(reactError: Error): void {
                error = reactError;
            }

            public override render(): React.ReactNode {
                const { hasError } = this.state;
                const { children } = this.props;

                return hasError ? undefined : children;
            }
        }

        renderToString(
            <ErrorBoundary>
                <Text>
                    Hello World
                    <Box />
                </Text>
            </ErrorBoundary>,
        );

        expect(error).toBeInstanceOf(Error);
        expect((error as any).message).toBe("<Box> can’t be nested inside <Text> component");
    });

    it("remeasure text dimensions on text change", () => {
        expect.hasAssertions();

        const stdout = createStdout();

        const { rerender } = render(
            <Box>
                <Text>Hello</Text>
            </Box>,
            { debug: true, stdout },
        );

        expect((stdout.write as any).mock.calls.at(-1)[0]).toBe("Hello");

        rerender(
            <Box>
                <Text>Hello World</Text>
            </Box>,
        );

        expect((stdout.write as any).mock.calls.at(-1)[0]).toBe("Hello World");
    });

    it("fragment", () => {
        expect.hasAssertions();

        const output = renderToString(
            <>
                <Text>Hello World</Text>
            </>,
        );

        expect(output).toBe("Hello World");
    });

    it("transform children", () => {
        expect.hasAssertions();

        const output = renderToString(
            <Transform transform={(string: string, index: number) => `[${String(index)}: ${string}]`}>
                <Text>
                    <Transform transform={(string: string, index: number) => `{${String(index)}: ${string}}`}>
                        <Text>test</Text>
                    </Transform>
                </Text>
            </Transform>,
        );

        expect(output).toBe("[0: {0: test}]");
    });

    it("squash multiple text nodes", () => {
        expect.hasAssertions();

        const output = renderToString(
            <Transform transform={(string: string, index: number) => `[${String(index)}: ${string}]`}>
                <Text>
                    <Transform transform={(string: string, index: number) => `{${String(index)}: ${string}}`}>
                        {/* prettier-ignore */}
                        <Text>
                            hello
                            {" "}
                            world
                        </Text>
                    </Transform>
                </Text>
            </Transform>,
        );

        expect(output).toBe("[0: {0: hello world}]");
    });

    it("transform with multiple lines", () => {
        expect.hasAssertions();

        const output = renderToString(
            <Transform transform={(string: string, index: number) => `[${String(index)}: ${string}]`}>
                {/* prettier-ignore */}
                <Text>
                    hello
                    {" "}
                    world
                    {"\n"}
                    goodbye
                    {" "}
                    world
                </Text>
            </Transform>,
        );

        expect(output).toBe("[0: hello world]\n[1: goodbye world]");
    });

    it("squash multiple nested text nodes", () => {
        expect.hasAssertions();

        const output = renderToString(
            <Transform transform={(string: string, index: number) => `[${String(index)}: ${string}]`}>
                <Text>
                    <Transform transform={(string: string, index: number) => `{${String(index)}: ${string}}`}>
                        hello
                        <Text> world</Text>
                    </Transform>
                </Text>
            </Transform>,
        );

        expect(output).toBe("[0: {0: hello world}]");
    });

    it("squash empty `<Text>` nodes", () => {
        expect.hasAssertions();

        const output = renderToString(
            <Transform transform={(string: string) => `[${string}]`}>
                <Text>
                    <Transform transform={(string: string) => `{${string}}`}>
                        <Text>{[]}</Text>
                    </Transform>
                </Text>
            </Transform>,
        );

        expect(output).toBe("");
    });

    it("<Transform> with undefined children", () => {
        expect.hasAssertions();

        const output = renderToString(<Transform transform={(children) => children} />);

        expect(output).toBe("");
    });

    it("<Transform> with null children", () => {
        expect.hasAssertions();

        const output = renderToString(<Transform transform={(children) => children} />);

        expect(output).toBe("");
    });

    it("hooks", () => {
        expect.hasAssertions();

        const WithHooks = () => {
            expect.hasAssertions();

            const [value] = useState("Hello");

            return <Text>{value}</Text>;
        };

        const output = renderToString(<WithHooks />);

        expect(output).toBe("Hello");
    });

    it("static output", () => {
        expect.hasAssertions();

        const output = renderToString(
            <Box>
                <Static items={["A", "B", "C"]} style={{ paddingBottom: 1 }}>
                    {(letter) => <Text key={letter}>{letter}</Text>}
                </Static>

                <Box marginTop={1}>
                    <Text>X</Text>
                </Box>
            </Box>,
        );

        expect(output).toBe("A\nB\nC\n\n\nX");
    });

    it("skip previous output when rendering new static output", () => {
        expect.hasAssertions();

        const stdout = createStdout();

        const Dynamic = ({ items }: { readonly items: string[] }) => <Static items={items}>{(item) => <Text key={item}>{item}</Text>}</Static>;

        const { rerender } = render(<Dynamic items={["A"]} />, {
            debug: true,
            stdout,
        });

        expect((stdout.write as any).mock.calls.at(-1)[0]).toBe("A\n");

        rerender(<Dynamic items={["A", "B"]} />);

        expect((stdout.write as any).mock.calls.at(-1)[0]).toBe("A\nB\n");
    });

    it("render only new items in static output on final render", () => {
        expect.hasAssertions();

        const stdout = createStdout();

        const Dynamic = ({ items }: { readonly items: string[] }) => <Static items={items}>{(item) => <Text key={item}>{item}</Text>}</Static>;

        const { rerender, unmount } = render(<Dynamic items={[]} />, {
            debug: true,
            stdout,
        });

        expect((stdout.write as any).mock.calls.at(-1)[0]).toBe("");

        rerender(<Dynamic items={["A"]} />);

        expect((stdout.write as any).mock.calls.at(-1)[0]).toBe("A\n");

        rerender(<Dynamic items={["A", "B"]} />);
        unmount();

        const allWrites = stdout.getWrites();
        const lastContentWrite = allWrites.findLast((w) => !w.startsWith("\u001B[?25"));

        expect(lastContentWrite).toBe("A\nB\n");
    });

    it("ensure wrap-ansi doesn't trim leading whitespace", () => {
        expect.hasAssertions();

        const output = renderToString(<Text color="red">{" ERROR "}</Text>);

        expect(output).toBe(red(" ERROR "));
    });

    it("replace child node with text", () => {
        expect.hasAssertions();

        const stdout = createStdout();

        const Dynamic = ({ replace }: { readonly replace?: boolean }) => <Text>{replace ? "x" : <Text color="green">test</Text>}</Text>;

        const { rerender } = render(<Dynamic />, {
            debug: true,
            stdout,
        });

        expect((stdout.write as any).mock.calls.at(-1)[0]).toBe(green("test"));

        rerender(<Dynamic replace />);

        expect((stdout.write as any).mock.calls.at(-1)[0]).toBe("x");
    });

    it("disable raw mode when all input components are unmounted", () => {
        expect.hasAssertions();

        const stdout = createStdout();

        const stdin = new EventEmitter() as NodeJS.WriteStream;

        stdin.setEncoding = () => stdin;
        (stdin as Record<string, unknown>).setRawMode = () => stdin;
        (stdin as Record<string, unknown>).ref = () => stdin;
        (stdin as Record<string, unknown>).unref = () => stdin;
        vi.spyOn(stdin, "setRawMode").mockImplementation(() => stdin);
        stdin.isTTY = true;
        vi.spyOn(stdin, "ref").mockImplementation();
        vi.spyOn(stdin, "unref").mockImplementation();

        const options = {
            debug: true,
            stdin,
            stdout,
        };

        class Input extends React.Component<{ setRawMode: (mode: boolean) => void }> {
            public override render() {
                return <Text>Test</Text>;
            }

            public override componentDidMount() {
                const { setRawMode } = this.props;

                setRawMode(true);
            }

            public override componentWillUnmount() {
                const { setRawMode } = this.props;

                setRawMode(false);
            }
        }

        const Test = ({ renderFirstInput, renderSecondInput }: { readonly renderFirstInput?: boolean; readonly renderSecondInput?: boolean }) => {
            const { setRawMode } = useStdin();

            return (
                <>
                    {renderFirstInput ? <Input setRawMode={setRawMode} /> : null}
                    {renderSecondInput ? <Input setRawMode={setRawMode} /> : null}
                </>
            );
        };

        const { rerender } = render(<Test renderFirstInput renderSecondInput />, options as any);

        expect(stdin.setRawMode as any).toHaveBeenCalledTimes(1);
        expect(stdin.ref as any).toHaveBeenCalledTimes(1);
        expect((stdin.setRawMode as any).mock.calls[0]).toStrictEqual([true]);

        rerender(<Test renderFirstInput />);

        expect(stdin.setRawMode as any).toHaveBeenCalledTimes(1);
        expect(stdin.ref as any).toHaveBeenCalledTimes(1);
        expect(stdin.unref as any).toHaveBeenCalledTimes(0);

        rerender(<Test />);

        expect(stdin.setRawMode as any).toHaveBeenCalledTimes(2);
        expect(stdin.ref as any).toHaveBeenCalledTimes(1);
        expect(stdin.unref as any).toHaveBeenCalledTimes(1);
        expect((stdin.setRawMode as any).mock.calls.at(-1)).toStrictEqual([false]);
    });

    it("re-ref stdin when input is used after previous unmount", () => {
        expect.hasAssertions();

        const stdin = new EventEmitter() as NodeJS.WriteStream;

        stdin.setEncoding = () => stdin;
        (stdin as Record<string, unknown>).read = () => undefined;
        (stdin as Record<string, unknown>).setRawMode = () => stdin;
        (stdin as Record<string, unknown>).ref = () => stdin;
        (stdin as Record<string, unknown>).unref = () => stdin;

        vi.spyOn(stdin, "read").mockImplementation();
        vi.spyOn(stdin, "setRawMode").mockImplementation(() => stdin);
        stdin.isTTY = true;
        vi.spyOn(stdin, "ref").mockImplementation();
        vi.spyOn(stdin, "unref").mockImplementation();

        const options = {
            debug: true,
            stdin,
            stdout: createStdout(),
        };

        class Input extends React.Component<{ setRawMode: (mode: boolean) => void }> {
            public override render() {
                return <Text>Test</Text>;
            }

            public override componentDidMount() {
                const { setRawMode } = this.props;

                setRawMode(true);
            }

            public override componentWillUnmount() {
                const { setRawMode } = this.props;

                setRawMode(false);
            }
        }

        const onFirstMountInput = vi.fn<(input: string) => void>();
        const onSecondMountInput = vi.fn<(input: string) => void>();

        const Test = ({ onInput }: { readonly onInput: (input: string) => void }) => {
            const { setRawMode } = useStdin();

            useInput((input) => {
                onInput(input);
            });

            return <Input setRawMode={setRawMode} />;
        };

        const { unmount } = render(<Test onInput={onFirstMountInput} />, options as any);

        expect(stdin.ref as any).toHaveBeenCalledTimes(1);
        expect(stdin.setRawMode as any).toHaveBeenCalledTimes(1);
        expect((stdin.setRawMode as any).mock.calls[0]).toStrictEqual([true]);

        emitReadable(stdin, "a");

        expect(onFirstMountInput).toHaveBeenCalledTimes(1);
        expect(onFirstMountInput.mock.calls[0]).toStrictEqual(["a"]);

        unmount();

        expect(stdin.unref as any).toHaveBeenCalledTimes(1);
        expect(stdin.setRawMode as any).toHaveBeenCalledTimes(2);
        expect((stdin.setRawMode as any).mock.calls.at(-1)).toStrictEqual([false]);

        const { unmount: unmount2 } = render(<Test onInput={onSecondMountInput} />, options as any);

        expect(stdin.ref as any).toHaveBeenCalledTimes(2);
        expect(stdin.setRawMode as any).toHaveBeenCalledTimes(3);
        expect((stdin.setRawMode as any).mock.calls.at(-1)).toStrictEqual([true]);

        emitReadable(stdin, "b");

        expect(onSecondMountInput).toHaveBeenCalledTimes(1);
        expect(onSecondMountInput.mock.calls[0]).toStrictEqual(["b"]);
        expect(onFirstMountInput).toHaveBeenCalledTimes(1);

        unmount2();

        expect(stdin.unref as any).toHaveBeenCalledTimes(2);
        expect(stdin.setRawMode as any).toHaveBeenCalledTimes(4);
        expect((stdin.setRawMode as any).mock.calls.at(-1)).toStrictEqual([false]);
    });

    it("setRawMode() should throw if raw mode is not supported", () => {
        expect.hasAssertions();

        const stdout = createStdout();

        const stdin = new EventEmitter() as NodeJS.ReadStream;

        stdin.setEncoding = () => stdin;
        (stdin as Record<string, unknown>).setRawMode = () => stdin;
        vi.spyOn(stdin, "setRawMode").mockImplementation(() => stdin);
        stdin.isTTY = false;

        const didCatchInMount = vi.fn<(error: unknown) => void>();
        const didCatchInUnmount = vi.fn<(error: unknown) => void>();

        const options = {
            debug: true,
            stdin,
            stdout,
        };

        class Input extends React.Component<{ setRawMode: (mode: boolean) => void }> {
            public override render() {
                return <Text>Test</Text>;
            }

            public override componentDidMount() {
                const { setRawMode } = this.props;

                try {
                    setRawMode(true);
                } catch (error: unknown) {
                    didCatchInMount(error);
                }
            }

            public override componentWillUnmount() {
                const { setRawMode } = this.props;

                try {
                    setRawMode(false);
                } catch (error: unknown) {
                    didCatchInUnmount(error);
                }
            }
        }

        const Test = () => {
            const { setRawMode } = useStdin();

            return <Input setRawMode={setRawMode} />;
        };

        const { unmount } = render(<Test />, options);

        unmount();

        expect(didCatchInMount).toHaveBeenCalledTimes(1);
        expect(didCatchInUnmount).toHaveBeenCalledTimes(1);
        expect(stdin.setRawMode as any).toHaveBeenCalledTimes(0);
    });

    it("render different component based on whether stdin is a TTY or not", () => {
        expect.hasAssertions();

        const stdout = createStdout();

        const stdin = new EventEmitter() as NodeJS.WriteStream;

        stdin.setEncoding = () => stdin;
        (stdin as Record<string, unknown>).setRawMode = () => stdin;
        vi.spyOn(stdin, "setRawMode").mockImplementation(() => stdin);
        stdin.isTTY = false;

        const options = {
            debug: true,
            stdin,
            stdout,
        };

        class Input extends React.Component<{ setRawMode: (mode: boolean) => void }> {
            public override render() {
                return <Text>Test</Text>;
            }

            public override componentDidMount() {
                const { setRawMode } = this.props;

                setRawMode(true);
            }

            public override componentWillUnmount() {
                const { setRawMode } = this.props;

                setRawMode(false);
            }
        }

        const Test = ({ renderFirstInput, renderSecondInput }: { readonly renderFirstInput?: boolean; readonly renderSecondInput?: boolean }) => {
            const { isRawModeSupported, setRawMode } = useStdin();

            return (
                <>
                    {isRawModeSupported && renderFirstInput ? <Input setRawMode={setRawMode} /> : null}
                    {isRawModeSupported && renderSecondInput ? <Input setRawMode={setRawMode} /> : null}
                </>
            );
        };

        const { rerender } = render(<Test renderFirstInput renderSecondInput />, options as any);

        expect(stdin.setRawMode as any).toHaveBeenCalledTimes(0);

        rerender(<Test renderFirstInput />);

        expect(stdin.setRawMode as any).toHaveBeenCalledTimes(0);

        rerender(<Test />);

        expect(stdin.setRawMode as any).toHaveBeenCalledTimes(0);
    });

    it.skipIf(!ptyAvailable)("render only last frame when run in CI", async () => {
        expect.hasAssertions();

        const output = await run("ci", {
            columns: 0,
            env: { CI: "true" },
        });

        [0, 1, 2, 3, 4].forEach((counter) => {
            expect(output).not.toContain(`Counter: ${String(counter)}`);
        });

        expect(output).toContain("Counter: 5");
    });

    it.skipIf(!ptyAvailable)("render all frames if CI environment variable equals false", async () => {
        expect.hasAssertions();

        const output = await run("ci", {
            columns: 0,
            env: { CI: "false" },
        });

        [0, 1, 2, 3, 4, 5].forEach((counter) => {
            expect(output).toContain(`Counter: ${String(counter)}`);
        });
    });

    it.skipIf(!ptyAvailable)("debug mode in CI does not replay final frame during unmount teardown", async () => {
        expect.hasAssertions();

        const output = await run("ci-debug", {
            columns: 0,
            env: { CI: "true" },
        });

        const plainOutput = strip(output).replaceAll("\r", "");
        const helloCount = plainOutput.match(/Hello/g)?.length ?? 0;

        expect(helloCount).toBe(2);
    });

    it.skipIf(!ptyAvailable)("debug mode in CI keeps final newline separation after waitUntilExit", async () => {
        expect.hasAssertions();

        const output = await run("ci-debug-after-exit", {
            columns: 0,
            env: { CI: "true" },
        });

        const plainOutput = strip(output).replaceAll("\r", "");

        expect(plainOutput).toBe("HelloHello\nDONE");
    });

    it.skipIf(!ptyAvailable)("render only last frame when stdout is not a TTY", async () => {
        expect.hasAssertions();

        const stdout = createStdout(100, false);

        const Counter = () => {
            expect.hasAssertions();

            const [count, setCount] = useState(0);

            useEffect(() => {
                // eslint-disable-next-line react-you-might-not-need-an-effect/no-event-handler -- Test intentionally uses effect for timer-based counting
                if (count < 3) {
                    const timer = setTimeout(() => {
                        setCount((c) => c + 1);
                    }, 10);

                    return () => {
                        clearTimeout(timer);
                    };
                }

                return undefined;
            }, [count]);

            return (
                <Text>
                    Count:
                    {count}
                </Text>
            );
        };

        const { unmount, waitUntilExit } = render(<Counter />, {
            debug: false,
            stdout,
        });

        await new Promise((resolve) => {
            setTimeout(resolve, 200);
        });

        unmount();
        await waitUntilExit();

        const allWrites = stdout.getWrites();

        const contentWrites = allWrites.map((w) => strip(w));

        ["Count:0", "Count:1", "Count:2"].forEach((intermediate) => {
            expect(contentWrites.some((w) => w.includes(intermediate))).toBe(false);
        });

        const hasEraseSequence = allWrites.some((w) => w.includes(eraseLines(1)));

        expect(hasEraseSequence).toBe(false);

        const lastWrite = allWrites.at(-1) ?? "";

        expect(lastWrite).toContain("Count:3");
    });

    it("reset prop when it's removed from the element", () => {
        expect.hasAssertions();

        const stdout = createStdout();

        const Dynamic = ({ remove }: { readonly remove?: boolean }) => (
            <Box flexDirection="column" height={remove ? undefined : 4} justifyContent="flex-end">
                <Text>x</Text>
            </Box>
        );

        const { rerender } = render(<Dynamic />, {
            debug: true,
            stdout,
        });

        expect((stdout.write as any).mock.calls.at(-1)[0]).toBe("\n\n\nx");

        rerender(<Dynamic remove />);

        expect((stdout.write as any).mock.calls.at(-1)[0]).toBe("x");
    });

    it("newline", () => {
        expect.hasAssertions();

        const output = renderToString(
            <Text>
                Hello
                <Newline />
                World
            </Text>,
        );

        expect(output).toBe("Hello\nWorld");
    });

    it("multiple newlines", () => {
        expect.hasAssertions();

        const output = renderToString(
            <Text>
                Hello
                <Newline count={2} />
                World
            </Text>,
        );

        expect(output).toBe("Hello\n\nWorld");
    });

    it("horizontal spacer", () => {
        expect.hasAssertions();

        const output = renderToString(
            <Box width={20}>
                <Text>Left</Text>
                <Spacer />
                <Text>Right</Text>
            </Box>,
        );

        expect(output).toBe("Left           Right");
    });

    it("vertical spacer", () => {
        expect.hasAssertions();

        const output = renderToString(
            <Box flexDirection="column" height={6}>
                <Text>Top</Text>
                <Spacer />
                <Text>Bottom</Text>
            </Box>,
        );

        expect(output).toBe("Top\n\n\n\n\nBottom");
    });

    it("link ansi escapes are closed properly", () => {
        expect.hasAssertions();

        const output = renderToString(<Text>{createHyperlink("Example", "https://example.com")}</Text>);

        expect(output).toBe("\u001B]8;;https://example.com\u0007Example\u001B]8;;\u0007");
    });

    // Concurrent mode tests
    it("text - concurrent", async () => {
        expect.hasAssertions();

        const output = await renderToStringAsync(<Text>Hello World</Text>);

        expect(output).toBe("Hello World");
    });

    it("multiple text nodes - concurrent", async () => {
        expect.hasAssertions();

        const output = await renderToStringAsync(
            <Text>
                Hello
                {" World"}
            </Text>,
        );

        expect(output).toBe("Hello World");
    });

    it("wrap text - concurrent", async () => {
        expect.hasAssertions();

        const output = await renderToStringAsync(
            <Box width={7}>
                <Text wrap="wrap">Hello World</Text>
            </Box>,
        );

        expect(output).toBe("Hello\nWorld");
    });

    it("truncate text in the end - concurrent", async () => {
        expect.hasAssertions();

        const output = await renderToStringAsync(
            <Box width={7}>
                <Text wrap="truncate">Hello World</Text>
            </Box>,
        );

        expect(output).toBe("Hello …");
    });

    it("transform children - concurrent", async () => {
        expect.hasAssertions();

        const output = await renderToStringAsync(
            <Transform transform={(string: string, index: number) => `[${String(index)}: ${string}]`}>
                <Text>
                    <Transform transform={(string: string, index: number) => `{${String(index)}: ${string}}`}>
                        <Text>test</Text>
                    </Transform>
                </Text>
            </Transform>,
        );

        expect(output).toBe("[0: {0: test}]");
    });

    it("static output - concurrent", async () => {
        expect.hasAssertions();

        const output = await renderToStringAsync(
            <Box>
                <Static items={["A", "B", "C"]} style={{ paddingBottom: 1 }}>
                    {(letter) => <Text key={letter}>{letter}</Text>}
                </Static>

                <Box marginTop={1}>
                    <Text>X</Text>
                </Box>
            </Box>,
        );

        expect(output).toBe("A\nB\nC\n\n\nX");
    });

    it("remeasure text dimensions on text change - concurrent", async () => {
        expect.hasAssertions();

        const { getOutput, rerenderAsync } = await renderAsync(
            <Box>
                <Text>Hello</Text>
            </Box>,
        );

        expect(getOutput()).toBe("Hello");

        await rerenderAsync(
            <Box>
                <Text>Hello World</Text>
            </Box>,
        );

        expect(getOutput()).toBe("Hello World");
    });

    it("newline - concurrent", async () => {
        expect.hasAssertions();

        const output = await renderToStringAsync(
            <Text>
                Hello
                <Newline />
                World
            </Text>,
        );

        expect(output).toBe("Hello\nWorld");
    });

    it("horizontal spacer - concurrent", async () => {
        expect.hasAssertions();

        const output = await renderToStringAsync(
            <Box width={20}>
                <Text>Left</Text>
                <Spacer />
                <Text>Right</Text>
            </Box>,
        );

        expect(output).toBe("Left           Right");
    });

    it("vertical spacer - concurrent", async () => {
        expect.hasAssertions();

        const output = await renderToStringAsync(
            <Box flexDirection="column" height={6}>
                <Text>Top</Text>
                <Spacer />
                <Text>Bottom</Text>
            </Box>,
        );

        expect(output).toBe("Top\n\n\n\n\nBottom");
    });
});
