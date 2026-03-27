import { describe, expect, it } from "vitest";
import { Suspense } from "react";
import colorizeDefault from "@visulima/colorize";
import { Box, Text, render } from "../../src/ink/index.js";
import createStdout from "../helpers/ink-create-stdout.js";

it("update child", () => {
    function Test({ update }: { readonly update?: boolean }) {
        return <Text>{update ? "B" : "A"}</Text>;
    }

    const stdoutActual = createStdout();
    const stdoutExpected = createStdout();

    const actual = render(<Test />, {
        stdout: stdoutActual,
        debug: true,
    });

    const expected = render(<Text>A</Text>, {
        stdout: stdoutExpected,
        debug: true,
    });

    expect((stdoutActual.write as any).mock.calls.at(-1)[0]).toBe((stdoutExpected.write as any).mock.calls.at(-1)[0]);

    actual.rerender(<Test update />);
    expected.rerender(<Text>B</Text>);

    expect((stdoutActual.write as any).mock.calls.at(-1)[0]).toBe((stdoutExpected.write as any).mock.calls.at(-1)[0]);
});

it("update text node", () => {
    function Test({ update }: { readonly update?: boolean }) {
        return (
            <Box>
                <Text>Hello </Text>
                <Text>{update ? "B" : "A"}</Text>
            </Box>
        );
    }

    const stdoutActual = createStdout();
    const stdoutExpected = createStdout();

    const actual = render(<Test />, {
        stdout: stdoutActual,
        debug: true,
    });

    const expected = render(<Text>Hello A</Text>, {
        stdout: stdoutExpected,
        debug: true,
    });

    expect((stdoutActual.write as any).mock.calls.at(-1)[0]).toBe((stdoutExpected.write as any).mock.calls.at(-1)[0]);

    actual.rerender(<Test update />);
    expected.rerender(<Text>Hello B</Text>);

    expect((stdoutActual.write as any).mock.calls.at(-1)[0]).toBe((stdoutExpected.write as any).mock.calls.at(-1)[0]);
});

it("remove style prop from intrinsic node", () => {
    function Test({ withStyle }: { readonly withStyle: boolean }) {
        return (
            <ink-box style={withStyle ? { marginLeft: 1 } : undefined}>
                <ink-text>X</ink-text>
            </ink-box>
        );
    }

    const stdout = createStdout();

    const { rerender } = render(<Test withStyle />, {
        stdout,
        debug: true,
    });

    expect((stdout.write as any).mock.calls.at(-1)[0]).toBe(" X");

    rerender(<Test withStyle={false} />);
    expect((stdout.write as any).mock.calls.at(-1)[0]).toBe("X");
});

it("append child", () => {
    function Test({ append }: { readonly append?: boolean }) {
        if (append) {
            return (
                <Box flexDirection="column">
                    <Text>A</Text>
                    <Text>B</Text>
                </Box>
            );
        }

        return (
            <Box flexDirection="column">
                <Text>A</Text>
            </Box>
        );
    }

    const stdoutActual = createStdout();
    const stdoutExpected = createStdout();

    const actual = render(<Test />, {
        stdout: stdoutActual,
        debug: true,
    });

    const expected = render(
        <Box flexDirection="column">
            <Text>A</Text>
        </Box>,
        {
            stdout: stdoutExpected,
            debug: true,
        },
    );

    expect((stdoutActual.write as any).mock.calls.at(-1)[0]).toBe((stdoutExpected.write as any).mock.calls.at(-1)[0]);

    actual.rerender(<Test append />);

    expected.rerender(
        <Box flexDirection="column">
            <Text>A</Text>
            <Text>B</Text>
        </Box>,
    );

    expect((stdoutActual.write as any).mock.calls.at(-1)[0]).toBe((stdoutExpected.write as any).mock.calls.at(-1)[0]);
});

it("insert child between other children", () => {
    function Test({ insert }: { readonly insert?: boolean }) {
        if (insert) {
            return (
                <Box flexDirection="column">
                    <Text key="a">A</Text>
                    <Text key="b">B</Text>
                    <Text key="c">C</Text>
                </Box>
            );
        }

        return (
            <Box flexDirection="column">
                <Text key="a">A</Text>
                <Text key="c">C</Text>
            </Box>
        );
    }

    const stdoutActual = createStdout();
    const stdoutExpected = createStdout();

    const actual = render(<Test />, {
        stdout: stdoutActual,
        debug: true,
    });

    const expected = render(
        <Box flexDirection="column">
            <Text>A</Text>
            <Text>C</Text>
        </Box>,
        {
            stdout: stdoutExpected,
            debug: true,
        },
    );

    expect((stdoutActual.write as any).mock.calls.at(-1)[0]).toBe((stdoutExpected.write as any).mock.calls.at(-1)[0]);

    actual.rerender(<Test insert />);

    expected.rerender(
        <Box flexDirection="column">
            <Text>A</Text>
            <Text>B</Text>
            <Text>C</Text>
        </Box>,
    );

    expect((stdoutActual.write as any).mock.calls.at(-1)[0]).toBe((stdoutExpected.write as any).mock.calls.at(-1)[0]);
});

it("remove child", () => {
    function Test({ remove }: { readonly remove?: boolean }) {
        if (remove) {
            return (
                <Box flexDirection="column">
                    <Text>A</Text>
                </Box>
            );
        }

        return (
            <Box flexDirection="column">
                <Text>A</Text>
                <Text>B</Text>
            </Box>
        );
    }

    const stdoutActual = createStdout();
    const stdoutExpected = createStdout();

    const actual = render(<Test />, {
        stdout: stdoutActual,
        debug: true,
    });

    const expected = render(
        <Box flexDirection="column">
            <Text>A</Text>
            <Text>B</Text>
        </Box>,
        {
            stdout: stdoutExpected,
            debug: true,
        },
    );

    expect((stdoutActual.write as any).mock.calls.at(-1)[0]).toBe((stdoutExpected.write as any).mock.calls.at(-1)[0]);

    actual.rerender(<Test remove />);

    expected.rerender(
        <Box flexDirection="column">
            <Text>A</Text>
        </Box>,
    );

    expect((stdoutActual.write as any).mock.calls.at(-1)[0]).toBe((stdoutExpected.write as any).mock.calls.at(-1)[0]);
});

it("reorder children", () => {
    function Test({ reorder }: { readonly reorder?: boolean }) {
        if (reorder) {
            return (
                <Box flexDirection="column">
                    <Text key="b">B</Text>
                    <Text key="a">A</Text>
                </Box>
            );
        }

        return (
            <Box flexDirection="column">
                <Text key="a">A</Text>
                <Text key="b">B</Text>
            </Box>
        );
    }

    const stdoutActual = createStdout();
    const stdoutExpected = createStdout();

    const actual = render(<Test />, {
        stdout: stdoutActual,
        debug: true,
    });

    const expected = render(
        <Box flexDirection="column">
            <Text>A</Text>
            <Text>B</Text>
        </Box>,
        {
            stdout: stdoutExpected,
            debug: true,
        },
    );

    expect((stdoutActual.write as any).mock.calls.at(-1)[0]).toBe((stdoutExpected.write as any).mock.calls.at(-1)[0]);

    actual.rerender(<Test reorder />);

    expected.rerender(
        <Box flexDirection="column">
            <Text>B</Text>
            <Text>A</Text>
        </Box>,
    );

    expect((stdoutActual.write as any).mock.calls.at(-1)[0]).toBe((stdoutExpected.write as any).mock.calls.at(-1)[0]);
});

it("replace child node with text", () => {
    const stdout = createStdout();

    function Dynamic({ replace }: { readonly replace?: boolean }) {
        return <Text>{replace ? "x" : <Text color="green">test</Text>}</Text>;
    }

    const { rerender } = render(<Dynamic />, {
        stdout,
        debug: true,
    });

    expect((stdout.write as any).mock.calls.at(-1)[0]).toBe(colorizeDefault.green("test"));

    rerender(<Dynamic replace />);
    expect((stdout.write as any).mock.calls.at(-1)[0]).toBe("x");
});

it("support suspense", async () => {
    const stdout = createStdout();

    let promise: Promise<void> | undefined;
    let state: "pending" | "done" | undefined;
    let value: string | undefined;

    const read = () => {
        if (!promise) {
            promise = new Promise((resolve) => {
                setTimeout(resolve, 100);
            });

            state = "pending";

            (async () => {
                await promise;
                state = "done";
                value = "Hello World";
            })();
        }

        if (state === "done") {
            return value;
        }

        // eslint-disable-next-line @typescript-eslint/only-throw-error
        throw promise;
    };

    function Suspendable() {
        return <Text>{read()}</Text>;
    }

    function Test() {
        return (
            <Suspense fallback={<Text>Loading</Text>}>
                <Suspendable />
            </Suspense>
        );
    }

    const out = render(<Test />, {
        stdout,
        debug: true,
    });

    expect((stdout.write as any).mock.calls.at(-1)[0]).toBe("Loading");

    await promise;
    out.rerender(<Test />);

    expect((stdout.write as any).mock.calls.at(-1)[0]).toBe("Hello World");
});

it("support suspense with concurrent mode", async () => {
    const stdout = createStdout();

    let resolvePromise: () => void;
    const promise = new Promise<void>((resolve) => {
        resolvePromise = resolve;
    });

    let data: string | undefined;

    function Suspendable() {
        if (data === undefined) {
            // eslint-disable-next-line @typescript-eslint/only-throw-error
            throw promise;
        }

        return <Text>{data}</Text>;
    }

    function Test() {
        return (
            <Suspense fallback={<Text>Loading</Text>}>
                <Suspendable />
            </Suspense>
        );
    }

    const { act } = await import("react");

    await act(async () => {
        render(<Test />, {
            stdout,
            debug: true,
            concurrent: true,
        });
    });

    expect((stdout.write as any).mock.calls.at(-1)[0]).toBe("Loading");

    data = "Hello Concurrent World";
    await act(async () => {
        resolvePromise();
        await promise;
    });

    expect((stdout.write as any).mock.calls.at(-1)[0]).toBe("Hello Concurrent World");
});
