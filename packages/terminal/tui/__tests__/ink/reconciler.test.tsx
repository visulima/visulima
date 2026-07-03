import { green } from "@visulima/colorize";
import { Suspense } from "react";
import { describe, expect, it } from "vitest";

import { Box, Text } from "../../src/components/index";
import { render } from "../../src/ink/index";
import createStdout from "../helpers/ink-create-stdout";

describe("reconciler", () => {
    it("update child", () => {
        expect.assertions(2);

        const Test = ({ update }: { readonly update?: boolean }) => <Text>{update ? "B" : "A"}</Text>;

        const stdoutActual = createStdout();
        const stdoutExpected = createStdout();

        const actual = render(<Test />, {
            debug: true,
            stdout: stdoutActual,
        });

        const expected = render(<Text>A</Text>, {
            debug: true,
            stdout: stdoutExpected,
        });

        expect((stdoutActual.write as any).mock.calls.at(-1)[0]).toBe((stdoutExpected.write as any).mock.calls.at(-1)[0]);

        actual.rerender(<Test update />);
        expected.rerender(<Text>B</Text>);

        expect((stdoutActual.write as any).mock.calls.at(-1)[0]).toBe((stdoutExpected.write as any).mock.calls.at(-1)[0]);
    });

    it("update text node", () => {
        expect.assertions(2);

        const Test = ({ update }: { readonly update?: boolean }) => (
            <Box>
                <Text>Hello </Text>
                <Text>{update ? "B" : "A"}</Text>
            </Box>
        );

        const stdoutActual = createStdout();
        const stdoutExpected = createStdout();

        const actual = render(<Test />, {
            debug: true,
            stdout: stdoutActual,
        });

        const expected = render(<Text>Hello A</Text>, {
            debug: true,
            stdout: stdoutExpected,
        });

        expect((stdoutActual.write as any).mock.calls.at(-1)[0]).toBe((stdoutExpected.write as any).mock.calls.at(-1)[0]);

        actual.rerender(<Test update />);
        expected.rerender(<Text>Hello B</Text>);

        expect((stdoutActual.write as any).mock.calls.at(-1)[0]).toBe((stdoutExpected.write as any).mock.calls.at(-1)[0]);
    });

    it("remove style prop from intrinsic node", () => {
        expect.assertions(2);

        const Test = ({ withStyle }: { readonly withStyle: boolean }) => (
            <ink-box style={withStyle ? { marginLeft: 1 } : undefined}>
                <ink-text>X</ink-text>
            </ink-box>
        );

        const stdout = createStdout();

        const { rerender } = render(<Test withStyle />, {
            debug: true,
            stdout,
        });

        expect((stdout.write as any).mock.calls.at(-1)[0]).toBe(" X");

        rerender(<Test withStyle={false} />);

        expect((stdout.write as any).mock.calls.at(-1)[0]).toBe("X");
    });

    it("append child", () => {
        expect.assertions(2);

        const Test = ({ append }: { readonly append?: boolean }) => {
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
        };

        const stdoutActual = createStdout();
        const stdoutExpected = createStdout();

        const actual = render(<Test />, {
            debug: true,
            stdout: stdoutActual,
        });

        const expected = render(
            <Box flexDirection="column">
                <Text>A</Text>
            </Box>,
            {
                debug: true,
                stdout: stdoutExpected,
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
        expect.assertions(2);

        const Test = ({ insert }: { readonly insert?: boolean }) => {
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
        };

        const stdoutActual = createStdout();
        const stdoutExpected = createStdout();

        const actual = render(<Test />, {
            debug: true,
            stdout: stdoutActual,
        });

        const expected = render(
            <Box flexDirection="column">
                <Text>A</Text>
                <Text>C</Text>
            </Box>,
            {
                debug: true,
                stdout: stdoutExpected,
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
        expect.assertions(2);

        const Test = ({ remove }: { readonly remove?: boolean }) => {
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
        };

        const stdoutActual = createStdout();
        const stdoutExpected = createStdout();

        const actual = render(<Test />, {
            debug: true,
            stdout: stdoutActual,
        });

        const expected = render(
            <Box flexDirection="column">
                <Text>A</Text>
                <Text>B</Text>
            </Box>,
            {
                debug: true,
                stdout: stdoutExpected,
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
        expect.assertions(2);

        const Test = ({ reorder }: { readonly reorder?: boolean }) => {
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
        };

        const stdoutActual = createStdout();
        const stdoutExpected = createStdout();

        const actual = render(<Test />, {
            debug: true,
            stdout: stdoutActual,
        });

        const expected = render(
            <Box flexDirection="column">
                <Text>A</Text>
                <Text>B</Text>
            </Box>,
            {
                debug: true,
                stdout: stdoutExpected,
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
        expect.assertions(2);

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

    it("support suspense", async () => {
        expect.assertions(2);

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

                void promise.then(() => {
                    state = "done";
                    value = "Hello World";
                });
            }

            if (state === "done") {
                return value;
            }

            // eslint-disable-next-line @typescript-eslint/only-throw-error -- React Suspense requires throwing a Promise
            throw promise;
        };

        const Suspendable = () => <Text>{read()}</Text>;

        const Test = () => (
            <Suspense fallback={<Text>Loading</Text>}>
                <Suspendable />
            </Suspense>
        );

        const out = render(<Test />, {
            debug: true,
            stdout,
        });

        expect((stdout.write as any).mock.calls.at(-1)[0]).toBe("Loading");

        await promise;
        out.rerender(<Test />);

        expect((stdout.write as any).mock.calls.at(-1)[0]).toBe("Hello World");
    });

    it("support suspense with concurrent mode", async () => {
        expect.assertions(2);

        const stdout = createStdout();

        let resolvePromise: () => void;
        const promise = new Promise<void>((resolve) => {
            resolvePromise = resolve;
        });

        let data: string | undefined;

        const Suspendable = () => {
            if (data === undefined) {
                // eslint-disable-next-line @typescript-eslint/only-throw-error -- React Suspense requires throwing a Promise
                throw promise;
            }

            return <Text>{data}</Text>;
        };

        const Test = () => (
            <Suspense fallback={<Text>Loading</Text>}>
                <Suspendable />
            </Suspense>
        );

        const { act } = await import("react");

        await act(() => {
            render(<Test />, {
                concurrent: true,
                debug: true,
                stdout,
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
});
