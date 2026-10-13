import { PassThrough } from "node:stream";

import delay from "delay";
import { useEffect, useRef } from "react";
import { afterEach, describe, expect, it } from "vitest";

import { Box, Text } from "../../src/components/index";
import { useBoxMetrics } from "../../src/ink/hooks/use-box-metrics";
import { useFocus } from "../../src/ink/hooks/use-focus";
import { useFocusManager } from "../../src/ink/hooks/use-focus-manager";
import { useInput } from "../../src/ink/hooks/use-input";
import { measureElement, render } from "../../src/ink/index";
import renderToStringSync from "../../src/ink/render-to-string";
import wrapText from "../../src/ink/wrap-text";
import { createStdin, emitReadable } from "../helpers/ink-create-stdin";
import createStdout from "../helpers/ink-create-stdout";
import { renderToString } from "../helpers/ink-render";

const lastFrame = (stdout: ReturnType<typeof createStdout>): string => (stdout.write as any).mock.calls.at(-1)[0];

describe("contentOffset", () => {
    it("shifts children up by contentOffsetY", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box contentOffsetY={1} flexDirection="column" height={2} overflow="hidden">
                <Box flexDirection="column" flexShrink={0}>
                    <Text>A</Text>
                    <Text>B</Text>
                    <Text>C</Text>
                </Box>
            </Box>,
        );

        expect(output).toBe("B\nC");
    });

    it("shifts children left by contentOffsetX", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box contentOffsetX={2} overflow="hidden" width={3}>
                <Box flexShrink={0} width={6}>
                    <Text>ABCDEF</Text>
                </Box>
            </Box>,
        );

        expect(output).toBe("CDE");
    });

    it("truncates fractional offsets and ignores non-finite ones", () => {
        expect.assertions(2);

        const tree = (offset: number) => (
            <Box contentOffsetY={offset} flexDirection="column" height={2} overflow="hidden">
                <Box flexDirection="column" flexShrink={0}>
                    <Text>A</Text>
                    <Text>B</Text>
                    <Text>C</Text>
                </Box>
            </Box>
        );

        expect(renderToString(tree(1.9))).toBe("B\nC");
        expect(renderToString(tree(Number.NaN))).toBe("A\nB");
    });
});

describe("clientWidth / clientHeight", () => {
    it("measureElement excludes borders", async () => {
        expect.assertions(1);

        let measured: ReturnType<typeof measureElement> | undefined;

        const Probe = () => {
            const reference = useRef<any>(null);

            useEffect(() => {
                measured = measureElement(reference.current);
            });

            return (
                <Box borderStyle="single" height={5} ref={reference} width={10}>
                    <Text>x</Text>
                </Box>
            );
        };

        const { unmount } = render(<Probe />, { debug: true, stdin: createStdin(), stdout: createStdout() });

        await delay(50);
        unmount();

        expect(measured).toMatchObject({ clientHeight: 3, clientWidth: 8, height: 5, width: 10 });
    });

    it("useBoxMetrics reports the client size", async () => {
        expect.assertions(1);

        const Probe = () => {
            const reference = useRef<any>(null);
            const { clientHeight, clientWidth } = useBoxMetrics(reference);

            return (
                <Box borderStyle="single" height={5} ref={reference} width={10}>
                    <Text>{`${clientWidth}x${clientHeight}`}</Text>
                </Box>
            );
        };

        const stdout = createStdout();
        const { unmount } = render(<Probe />, { debug: true, stdin: createStdin(), stdout });

        await delay(50);

        const frame = lastFrame(stdout);

        unmount();

        expect(frame).toContain("8x3");
    });
});

describe("useInput control sequences", () => {
    let currentUnmount: (() => void) | undefined;

    afterEach(async () => {
        currentUnmount?.();
        currentUnmount = undefined;
        await delay(100);
    });

    const run = async (chunks: string[]) => {
        const received: { input: string; key: Record<string, unknown> }[] = [];
        const stdin = createStdin();

        const Probe = () => {
            useInput((input, key) => {
                received.push({ input, key });
            });

            return <Text>probe</Text>;
        };

        const { unmount } = render(<Probe />, { debug: true, stdin, stdout: createStdout() });

        currentUnmount = unmount;

        await delay(50);

        for (const chunk of chunks) {
            emitReadable(stdin, chunk);

            await delay(20);
        }

        return received;
    };

    it("drops focus, cursor-position and mouse reports", async () => {
        expect.assertions(1);

        const received = await run(["\u001B[I", "\u001B[O", "\u001B[12;40R", "\u001B[<0;10;5M"]);

        expect(received).toStrictEqual([]);
    });

    it("keeps Alt+letter, arrows and function keys", async () => {
        expect.assertions(3);

        const received = await run(["\u001Bx", "\u001B[A", "\u001B[15~"]);

        expect(received[0]).toMatchObject({ input: "x", key: { meta: true } });
        expect(received[1]?.key).toMatchObject({ upArrow: true });
        expect(received).toHaveLength(3);
    });

    it("treats application keypad Enter like Return", async () => {
        expect.assertions(2);

        const received = await run(["\r", "\u001BOM"]);

        expect(received[0]).toMatchObject({ input: "\r", key: { return: true } });
        expect(received[1]).toStrictEqual(received[0]);
    });

    it("reports Backspace and Delete as different keys", async () => {
        expect.assertions(2);

        const received = await run(["\u007F", "\u001B[3~"]);

        expect(received[0]?.key).toMatchObject({ backspace: true, delete: false });
        expect(received[1]?.key).toMatchObject({ backspace: false, delete: true });
    });
});

describe("focus", () => {
    let currentUnmount: (() => void) | undefined;

    afterEach(async () => {
        currentUnmount?.();
        currentUnmount = undefined;
        await delay(100);
    });

    const Item = ({ id, label }: { readonly id?: string; readonly label: string }) => {
        const { isFocused } = useFocus({ id });

        return <Text>{`${label}${isFocused ? "*" : ""}`}</Text>;
    };

    it("treats components sharing an ID as one Tab stop", async () => {
        expect.assertions(3);

        let manager: ReturnType<typeof useFocusManager> | undefined;

        const Tree = () => {
            manager = useFocusManager();

            return (
                <Box flexDirection="column">
                    <Item id="same" label="a" />
                    <Item id="same" label="b" />
                    <Item id="other" label="c" />
                </Box>
            );
        };

        const stdout = createStdout();
        const { unmount } = render(<Tree />, { debug: true, stdin: createStdin(), stdout });

        currentUnmount = unmount;
        await delay(50);

        manager!.focusNext();
        await delay(50);

        expect(lastFrame(stdout)).toBe("a*\nb*\nc");

        manager!.focusNext();
        await delay(50);

        expect(lastFrame(stdout)).toBe("a\nb\nc*");

        manager!.focusNext();
        await delay(50);

        expect(lastFrame(stdout)).toBe("a*\nb*\nc");
    });

    it("keeps a shared Tab stop when one of its holders unmounts", async () => {
        expect.assertions(1);

        const Tree = ({ showSecond }: { readonly showSecond: boolean }) => {
            const manager = useFocusManager();

            useEffect(() => {
                manager.focus("same");
            }, [manager]);

            return (
                <Box flexDirection="column">
                    <Item id="same" label="a" />
                    {showSecond ? <Item id="same" label="b" /> : null}
                </Box>
            );
        };

        const stdout = createStdout();
        const stdin = createStdin();
        const { rerender, unmount } = render(<Tree showSecond />, { debug: true, stdin, stdout });

        currentUnmount = unmount;
        await delay(50);

        rerender(<Tree showSecond={false} />);
        await delay(50);

        expect(lastFrame(stdout)).toBe("a*");
    });

    it("accepts an empty string as a focus ID", async () => {
        expect.assertions(1);

        const Tree = () => {
            const manager = useFocusManager();

            useEffect(() => {
                manager.focus("");
            }, [manager]);

            return <Item id="" label="a" />;
        };

        const stdout = createStdout();
        const { unmount } = render(<Tree />, { debug: true, stdin: createStdin(), stdout });

        currentUnmount = unmount;
        await delay(50);

        expect(lastFrame(stdout)).toBe("a*");
    });

    it("blurs the focused component on disableFocus and skips auto focus while disabled", async () => {
        expect.assertions(2);

        let manager: ReturnType<typeof useFocusManager> | undefined;

        const AutoItem = ({ label }: { readonly label: string }) => {
            const { isFocused } = useFocus({ autoFocus: true });

            return <Text>{`${label}${isFocused ? "*" : ""}`}</Text>;
        };

        const Tree = ({ showLate }: { readonly showLate: boolean }) => {
            manager = useFocusManager();

            return (
                <Box flexDirection="column">
                    <AutoItem label="a" />
                    {showLate ? <AutoItem label="b" /> : null}
                </Box>
            );
        };

        const stdout = createStdout();
        const { rerender, unmount } = render(<Tree showLate={false} />, { debug: true, stdin: createStdin(), stdout });

        currentUnmount = unmount;
        await delay(50);

        expect(lastFrame(stdout)).toBe("a*");

        manager!.disableFocus();
        await delay(50);
        rerender(<Tree showLate />);
        await delay(50);

        expect(lastFrame(stdout)).toBe("a\nb");
    });

    it("generates distinct IDs for components without one", async () => {
        expect.assertions(1);

        let manager: ReturnType<typeof useFocusManager> | undefined;

        const Tree = () => {
            manager = useFocusManager();

            return (
                <Box flexDirection="column">
                    <Item label="a" />
                    <Item label="b" />
                </Box>
            );
        };

        const stdout = createStdout();
        const { unmount } = render(<Tree />, { debug: true, stdin: createStdin(), stdout });

        currentUnmount = unmount;
        await delay(50);

        manager!.focusNext();
        await delay(50);
        manager!.focusNext();
        await delay(50);

        expect(lastFrame(stdout)).toBe("a\nb*");
    });
});

describe("streams and options", () => {
    it("renders to a plain writable stream and a plain readable stream", async () => {
        expect.assertions(1);

        const stdout = new PassThrough();
        const stdin = new PassThrough();
        let written = "";

        stdout.on("data", (chunk: Buffer) => {
            written += chunk.toString();
        });

        const { unmount } = render(<Text>hello</Text>, { debug: true, stdin, stdout });

        await delay(50);
        unmount();

        expect(written).toContain("hello");
    });

    it("falls back to defaults for options set to undefined", async () => {
        expect.assertions(1);

        const stdout = createStdout();
        const { unmount } = render(<Text>hi</Text>, {
            debug: true,
            exitOnCtrlC: undefined,
            maxFps: undefined,
            patchConsole: undefined,
            stdin: createStdin(),
            stdout,
        });

        await delay(30);

        const frame = lastFrame(stdout);

        unmount();

        expect(frame).toBe("hi");
    });

    it("does not keep a beforeExit listener when waitUntilExit() is called after unmount", async () => {
        expect.assertions(1);

        const { unmount, waitUntilExit } = render(<Text>x</Text>, { debug: true, stdin: createStdin(), stdout: createStdout() });
        const before = process.listenerCount("beforeExit");

        await delay(30);
        unmount();
        void waitUntilExit();

        expect(process.listenerCount("beforeExit")).toBe(before);
    });
});

describe("text handling", () => {
    it("truncates every line of multi-line text on its own", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box width={4}>
                <Text wrap="truncate">{"abcdefgh\nijklmnop"}</Text>
            </Box>,
        );

        expect(output).toBe("abc…\nijk…");
    });

    it("drops stray control characters and carriage returns", () => {
        expect.assertions(2);

        expect(renderToString(<Text>{"a\u0007b\u0008c"}</Text>)).toBe("abc");

        const output = renderToString(
            <Box borderStyle="single" width={6}>
                <Text>{"ab\r\ncd"}</Text>
            </Box>,
        );

        expect(output).toBe("┌────┐\n│ab  │\n│cd  │\n└────┘");
    });

    it("keeps an open SGR style across explicit newlines", () => {
        expect.assertions(1);

        const output = renderToString(<Text>{"\u001B[31mred\nstill\u001B[39m"}</Text>);

        expect(output).toBe("\u001B[31mred\u001B[39m\n\u001B[31mstill\u001B[39m");
    });

    it("does not confuse wrap cache entries whose text and width digits run together", () => {
        expect.assertions(2);

        expect(wrapText("a1", 2, "truncate")).toBe("a1");
        expect(wrapText("a", 12, "truncate")).toBe("a");
    });

    it("throws when a component throws undefined during renderToString", () => {
        expect.assertions(1);

        const Bad = () => {
            // eslint-disable-next-line @typescript-eslint/only-throw-error
            throw undefined;
        };

        expect(() => renderToStringSync(<Bad />)).toThrow("undefined");
    });
});

describe("output details", () => {
    it("does not prefix self-contained styled lines", () => {
        expect.assertions(2);

        const lines = Array.from({ length: 1000 }).fill("\u001B[31mx\u001B[39m");
        const output = renderToString(<Text>{lines.join("\n")}</Text>);
        const outputLines = output.split("\n");

        expect(outputLines).toHaveLength(1000);
        expect(outputLines.every((line) => line === "\u001B[31mx\u001B[39m")).toBe(true);
    });

    it("re-renders when contentOffsetY changes", async () => {
        expect.assertions(2);

        const tree = (offset: number) => (
            <Box contentOffsetY={offset} flexDirection="column" height={2} overflow="hidden">
                <Box flexDirection="column" flexShrink={0}>
                    <Text>A</Text>
                    <Text>B</Text>
                    <Text>C</Text>
                </Box>
            </Box>
        );

        const stdout = createStdout();
        const { rerender, unmount } = render(tree(0), { debug: true, stdin: createStdin(), stdout });

        await delay(30);

        expect(lastFrame(stdout)).toBe("A\nB");

        rerender(tree(1));
        await delay(30);

        const frame = lastFrame(stdout);

        unmount();

        expect(frame).toBe("B\nC");
    });
});

describe("layout details", () => {
    it("keeps content visible on an axis that is not clipped", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box height={1} overflow="hidden" overflowX="visible" width={3}>
                <Box flexShrink={0} width={8}>
                    <Text>abcdefgh</Text>
                </Box>
            </Box>,
        );

        expect(output).toBe("abcdefgh");
    });

    it("blanks the hidden half of a wide character split by contentOffsetX", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box contentOffsetX={1} overflow="hidden" width={3}>
                <Box flexShrink={0} width={8}>
                    <Text>中文字</Text>
                </Box>
            </Box>,
        );

        expect(output).toBe(" 文");
    });

    it("keeps fractional percentages", () => {
        expect.assertions(1);

        // 12.5% of 100 columns rounds to 13; truncating the percentage to 12% would give 12.
        const output = renderToString(
            <Box width={100}>
                <Box borderStyle="single" width="12.5%">
                    <Text>x</Text>
                </Box>
            </Box>,
            { columns: 100 },
        );

        expect(output.split("\n")[0]).toHaveLength(13);
    });
});
