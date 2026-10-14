import { Suspense, useState } from "react";
import { describe, expect, it } from "vitest";

import { Box, Static, Text, Transform } from "../../src/components/index";
import renderToStringDirect from "../../src/ink/render-to-string";
import { renderToString } from "../helpers/ink-render";
import { renderAsync } from "../helpers/ink-test-renderer";

describe("text characters", () => {
    it("zero-width spaces do not overwrite box borders", () => {
        expect.hasAssertions();

        const output = renderToString(
            <Box borderStyle="single" width={7}>
                <Text>{"he\u200Bllo"}</Text>
            </Box>,
        );

        expect(output.replaceAll("​", "")).toBe("┌─────┐\n│hello│\n└─────┘");
    });

    it("wide characters crossing the left output edge preserve visible columns", () => {
        expect.hasAssertions();

        const output = renderToString(
            <Box height={1} width={4}>
                <Box left={-1} position="absolute">
                    <Text>好AB</Text>
                </Box>
                <Box left={3} position="absolute">
                    <Text>!</Text>
                </Box>
            </Box>,
        );

        expect(output).toBe(" AB!");
    });

    it("tabs are measured and rendered without overwriting adjacent text", () => {
        expect.hasAssertions();

        const output = renderToString(
            <Box width={20}>
                <Text>
                    A
<Text>{"\tB"}</Text>
                </Text>
                <Text>!</Text>
            </Box>,
        );

        // Tabs render as four spaces in this renderer; measurement must count the same columns.
        expect(output).toBe("A    B!");
    });

    it("expanded tabs participate in text wrapping", () => {
        expect.hasAssertions();

        const output = renderToString(
            <Box flexDirection="column" width={5}>
                <Text>{"A\tB"}</Text>
                <Text>!</Text>
            </Box>,
        );

        expect(output).toBe("A\nB\n!");
    });
});

describe("static layout", () => {
    it("static preserves its margins and all items", () => {
        expect.hasAssertions();

        const output = renderToStringDirect(
            <Static items={["A", "B"]} style={{ marginBottom: 1, marginLeft: 2, marginTop: 1 }}>
                {(item: string) => <Text key={item}>{item}</Text>}
            </Static>,
        );

        expect(output).toBe("\n  A\n  B\n");
    });
});

describe("truncated text width", () => {
    for (const [wrap, expected] of [
        ["truncate", "你…"],
        ["truncate-end", "你…"],
        ["truncate-middle", "你…"],
        ["truncate-start", "…界"],
    ] as const) {
        it(`${wrap} keeps wide characters that fit`, () => {
            expect.hasAssertions();

            const output = renderToString(
                <Box width={4}>
                    <Text wrap={wrap}>你好世界</Text>
                </Box>,
            );

            expect(output).toBe(expected);
        });

        it(`${wrap} preserves the adjacent column`, () => {
            expect.hasAssertions();

            const output = renderToString(
                <Box width={5}>
                    <Text wrap={wrap}>你好世界</Text>
                    <Box flexShrink={0}>
                        <Text>|</Text>
                    </Box>
                </Box>,
            );

            expect(output).toBe(`${expected} |`);
        });
    }

    it("text that fits does not reserve extra width", () => {
        expect.hasAssertions();

        const output = renderToString(
            <Box width={10}>
                <Text wrap="truncate-middle">你好</Text>
                <Text>|</Text>
            </Box>,
        );

        expect(output).toBe("你好|");
    });
});

describe("visibility and remeasurement", () => {
    it("resuming Suspense preserves display none", async () => {
        expect.hasAssertions();

        let resolvePromise: () => void = () => {};
        const promise = new Promise<void>((resolve) => {
            resolvePromise = resolve;
        });

        const Suspendable = ({ pending }: { readonly pending: boolean }) => {
            if (pending) {
                // eslint-disable-next-line @typescript-eslint/only-throw-error
                throw promise;
            }

            return <Text>Visible</Text>;
        };

        const Test = ({ pending }: { readonly pending: boolean }) => (
            <Suspense fallback={<Text>Loading</Text>}>
                <Box display="none">
                    <Text>Hidden</Text>
                </Box>
                <Suspendable pending={pending} />
            </Suspense>
        );

        const { rerenderAsync, stdout, unmount } = await renderAsync(<Test pending={false} />);

        try {
            expect(stdout.get()).toBe("Visible");

            await rerenderAsync(<Test pending />);

            expect(stdout.get()).toBe("Loading");

            await rerenderAsync(<Test pending={false} />);

            expect(stdout.get()).toBe("Visible");
        } finally {
            resolvePromise();
            unmount();
        }
    });
});

describe("wide characters at clip edges", () => {
    const blue = (text: string): string => `\u001B[44m${text}\u001B[49m`;

    for (const nested of [false, true]) {
        for (const [offset, width, expected] of [
            [1, 3, " 好"],
            [0, 3, "你 "],
            [1, 2, "  "],
            [0, 4, "你好"],
        ] as const) {
            it(`clipping wide text preserves its background (nested: ${String(nested)}, offset: ${String(offset)}, width: ${String(width)})`, () => {
                expect.hasAssertions();

                const content = <Text backgroundColor="blue">你好</Text>;
                const output = renderToString(
                    <Box contentOffsetX={offset} height={1} overflowX="hidden" width={width}>
                        <Box flexShrink={0} width={4}>
                            {nested ? <Text>{content}</Text> : content}
                        </Box>
                    </Box>,
                );

                expect(output).toBe(blue(expected));
            });
        }
    }

    it("clipping a joined emoji preserves its background and adjacent text", () => {
        expect.hasAssertions();

        const output = renderToString(
            <Box contentOffsetX={1} height={1} overflowX="hidden" width={2}>
                <Box flexShrink={0} width={3}>
                    <Text>
                        <Text backgroundColor="blue">👩‍💻X</Text>
                    </Text>
                </Box>
            </Box>,
        );

        expect(output).toBe(blue(" X"));
    });
});

describe("wide characters overwritten by overlays", () => {
    for (const glyph of ["你", "👩‍💻"]) {
        for (const left of [0, 1]) {
            it(`overwriting ${glyph} cell ${String(left)} preserves the other cell's background`, () => {
                expect.hasAssertions();

                const output = renderToString(
                    <Box height={1} width={3}>
                        <Text backgroundColor="blue">
{glyph}
Z
                        </Text>
                        <Box left={left} position="absolute" top={0}>
                            <Text>X</Text>
                        </Box>
                    </Box>,
                );
                const expected = renderToString(
                    <Text>
                        {left === 0
                            ? (
                            <>
                                <Text>X</Text>
                                <Text backgroundColor="blue"> Z</Text>
                            </>
                            )
                            : (
                            <>
                                <Text backgroundColor="blue"> </Text>
                                <Text>X</Text>
                                <Text backgroundColor="blue">Z</Text>
                            </>
                            )}
                    </Text>,
                );

                expect(output).toBe(expected);
            });
        }
    }

    for (const replacement of ["XY", "好"]) {
        it(`fully overwriting a wide character with ${replacement} replaces its styles`, () => {
            expect.hasAssertions();

            const output = renderToString(
                <Box height={1} width={3}>
                    <Text backgroundColor="blue">你Z</Text>
                    <Box left={0} position="absolute" top={0}>
                        <Text backgroundColor="red">{replacement}</Text>
                    </Box>
                </Box>,
            );
            const expected = renderToString(
                <Text>
                    <Text backgroundColor="red">{replacement}</Text>
                    <Text backgroundColor="blue">Z</Text>
                </Text>,
            );

            expect(output).toBe(expected);
        });
    }

    it("an overlay crossing two wide characters preserves both exposed backgrounds", () => {
        expect.hasAssertions();

        const output = renderToString(
            <Box height={1} width={4}>
                <Text>
                    <Text backgroundColor="blue">你</Text>
                    <Text backgroundColor="green">好</Text>
                </Text>
                <Box left={1} position="absolute" top={0}>
                    <Text backgroundColor="red">XY</Text>
                </Box>
            </Box>,
        );
        const expected = renderToString(
            <Text>
                <Text backgroundColor="blue"> </Text>
                <Text backgroundColor="red">XY</Text>
                <Text backgroundColor="green"> </Text>
            </Text>,
        );

        expect(output).toBe(expected);
    });
});

describe("background inheritance", () => {
    it("static background color is inherited by its text", () => {
        expect.hasAssertions();

        const output = renderToString(
            <Static items={["A"]} style={{ backgroundColor: "blue", width: 3 }}>
                {(item: string) => <Text key={item}>{item}</Text>}
            </Static>,
        );

        expect(output).toBe("\u001B[44mA  \u001B[49m\n");
    });

    it("box preserves child state when a background color is added or removed", async () => {
        expect.hasAssertions();

        const Child = ({ initialValue }: { readonly initialValue: string }) => {
            const [value] = useState(initialValue);

            return <Text>{value}</Text>;
        };

        const { rerenderAsync, stdout, unmount } = await renderAsync(
            <Box backgroundColor="red">
                <Child initialValue="original" />
            </Box>,
        );

        try {
            expect(stdout.get()).toContain("original");

            await rerenderAsync(
                <Box>
                    <Child initialValue="reset" />
                </Box>,
            );

            expect(stdout.get()).toContain("original");
            expect(stdout.get()).not.toContain("reset");
        } finally {
            unmount();
        }
    });

    it("nested Text inherits the nearest Text background instead of the Box background", () => {
        expect.hasAssertions();

        const output = renderToString(
            <Box alignSelf="flex-start" backgroundColor="red">
                <Text backgroundColor="blue">
                    Hello
{" "}
<Text>World</Text>
                </Text>
            </Box>,
        );

        expect(output).toBe("\u001B[44mHello World\u001B[49m");
    });
});

describe("overflow clipping and transforms", () => {
    it("nested transforms receive each explicit line with its line index", () => {
        expect.hasAssertions();

        const output = renderToString(
            <Text>
                <Transform transform={(line, index) => line.replaceAll("x", String(index))}>
                    <Text>{"xx\nxx"}</Text>
                </Transform>
            </Text>,
        );

        expect(output).toBe("00\n11");
    });

    it("nested transform line indices do not depend on preceding siblings", () => {
        expect.hasAssertions();

        const output = renderToString(
            <Text>
                prefix
                <Transform transform={(line, index) => line.replaceAll("x", String(index))}>
                    <Text>xx</Text>
                </Transform>
            </Text>,
        );

        expect(output).toBe("prefix00");
    });
});
