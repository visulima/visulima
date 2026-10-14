import { Suspense, useState } from "react";
import { describe, expect, it } from "vitest";

import { Box, Static, Text, Transform } from "../../src/components/index";
import { render } from "../../src/ink/index";
import renderToStringDirect from "../../src/ink/render-to-string";
import wrapText from "../../src/ink/wrap-text";
import createStdout from "../helpers/ink-create-stdout";
import { renderToString } from "../helpers/ink-render";
import { renderAsync } from "../helpers/ink-test-renderer";

describe("text width and wrapping", () => {
    it("keeps text at its natural width when there is no room to wrap", () => {
        expect.hasAssertions();

        expect(wrapText("hello", 0, "wrap")).toBe("hello");
        expect(wrapText("hello", 0, "hard")).toBe("hello");
        expect(wrapText("hello", -1, "wrap")).toBe("hello");
    });

    it("wraps a fraction of a column like one column", () => {
        expect.hasAssertions();

        expect(wrapText("hello", 0.5, "wrap")).toBe("h\ne\nl\nl\no");
        expect(wrapText("hello", 0.5, "hard")).toBe("h\ne\nl\nl\no");
    });

    it("leaves truncation at zero columns alone", () => {
        expect.hasAssertions();

        expect(wrapText("hello", 0, "truncate")).toBe("");
    });

    it("set width to zero", () => {
        expect.hasAssertions();

        const output = renderToString(
            <Box>
                <Box width={0}>
                    <Text>hello</Text>
                </Box>
                <Text>|</Text>
            </Box>,
        );

        expect(output).toBe("|ello");
    });

    it("set width to zero with text below", () => {
        expect.hasAssertions();

        const output = renderToString(
            <Box flexDirection="column">
                <Box>
                    <Box width={0}>
                        <Text>hello</Text>
                    </Box>
                    <Text>|</Text>
                </Box>
                <Text>next</Text>
            </Box>,
        );

        expect(output).toBe("|ello\nnext");
    });

    it("padding leaves no room for text", () => {
        expect.hasAssertions();

        const output = renderToString(
            <Box>
                <Box paddingX={1} width={2}>
                    <Text>hello</Text>
                </Box>
                <Text>|</Text>
            </Box>,
        );

        expect(output).toBe(" h|llo");
    });
});

describe("text width edge cases", () => {
    it("shrink text to zero width", () => {
        expect.hasAssertions();

        const output = renderToString(
            <Box width={5}>
                <Box flexBasis={0} flexShrink={1}>
                    <Text>hello</Text>
                </Box>
                <Box width={5}>
                    <Text>world</Text>
                </Box>
            </Box>,
        );

        expect(output).toBe("world");
    });

    it("truncated text at a positive fractional width keeps its row", () => {
        expect.hasAssertions();

        const output = renderToString(
            <Box flexDirection="column" width={10}>
                <Box width={0.5}>
                    <Text wrap="truncate">hello</Text>
                </Box>
                <Text>next</Text>
            </Box>,
        );

        expect(output).toBe("…\nnext");
    });

    it("zero-width overflow container keeps the text beside it", () => {
        expect.hasAssertions();

        const output = renderToString(
            <Box>
                <Box overflowX="hidden" width={0}>
                    <Text>hello</Text>
                </Box>
                <Text>|</Text>
            </Box>,
        );

        expect(output).toBe("|");
    });

    it("set width to a fraction of a column", () => {
        expect.hasAssertions();

        const output = renderToString(
            <Box flexDirection="column" width={10}>
                <Box>
                    <Box width={0.25}>
                        <Text>hello</Text>
                    </Box>
                    <Text>|</Text>
                </Box>
                <Text>next</Text>
            </Box>,
        );

        expect(output).toBe("|\ne\nl\nl\no\nnext");
    });
});

describe("text positioning and offsets", () => {
    it("negative margin top with multiline string", () => {
        expect.hasAssertions();

        const output = renderToString(
            <Box flexDirection="column">
                <Box flexDirection="column" marginTop={-1}>
                    <Text>{"Line 1\nLine 2\nLine 3"}</Text>
                </Box>
            </Box>,
        );

        expect(output).toBe("Line 2\nLine 3");
    });

    it("contentOffsetY keeps the visible lines of a multi-line text node", () => {
        expect.hasAssertions();

        const output = renderToString(
            <Box contentOffsetY={1} flexDirection="column" height={2}>
                <Box flexDirection="column" flexShrink={0}>
                    <Text>{"Line 1\nLine 2\nLine 3"}</Text>
                </Box>
            </Box>,
        );

        expect(output).toBe("Line 2\nLine 3");
    });

    it("contentOffsetY keeps visible lines with only horizontal clipping", () => {
        expect.hasAssertions();

        const output = renderToString(
            <Box contentOffsetY={1} flexDirection="column" height={2} overflowX="hidden">
                <Box flexDirection="column" flexShrink={0}>
                    <Text>{"Line 1\nLine 2\nLine 3"}</Text>
                </Box>
            </Box>,
        );

        expect(output).toBe("Line 2\nLine 3");
    });

    it("clipped content keeps its visible lines when the clip starts above the top", () => {
        expect.hasAssertions();

        const output = renderToString(
            <Box flexDirection="column">
                <Box flexDirection="column" height={3} marginTop={-1} overflowY="hidden">
                    <Box flexDirection="column" flexShrink={0}>
                        <Text>{"Line 1\nLine 2\nLine 3"}</Text>
                    </Box>
                </Box>
            </Box>,
        );

        expect(output).toBe("Line 2\nLine 3");
    });

    it("renders visible lines of text positioned above the output area", () => {
        expect.hasAssertions();

        const output = renderToString(
            <Box height={2} width={6}>
                <Box position="absolute" top={-1}>
                    <Text>{"Hidden\nFirst\nSecond"}</Text>
                </Box>
            </Box>,
        );

        expect(output).toBe("First\nSecond");
    });
});

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

    it("zero-width overlay does not erase wide characters", () => {
        expect.hasAssertions();

        const output = renderToString(
            <Box height={1} width={4}>
                <Text>你好</Text>
                <Box left={1} position="absolute">
                    <Text>{"\u200B"}</Text>
                </Box>
            </Box>,
        );

        expect(output.replaceAll("​", "")).toBe("你好");
    });

    it("combining marks and joined emoji retain their graphemes", () => {
        expect.hasAssertions();

        const output = renderToString(
            <Box borderStyle="single" width={5}>
                <Text>é👩‍💻</Text>
            </Box>,
        );

        expect(output).toBe("┌───┐\n│é👩‍💻│\n└───┘");
    });

    it("cRLF line endings do not overwrite box borders", () => {
        expect.hasAssertions();

        const output = renderToString(
            <Box borderStyle="single" width={7}>
                <Text>{"hello\r\nworld"}</Text>
            </Box>,
        );

        expect(output).toBe("┌─────┐\n│hello│\n│world│\n└─────┘");
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
    it("static padding is not emitted again when there are no new items", () => {
        expect.hasAssertions();

        // Mirrors the upstream rerender sequence: padding only appears on the render that mounts items.
        const output = renderToStringDirect(
            <>
                <Static items={["A"]} style={{ padding: 1 }}>
                    {(item: string) => <Text key={item}>{item}</Text>}
                </Static>
                <Text>Waiting</Text>
            </>,
        );

        expect(output).toBe("\n A\n\nWaiting");
    });

    it("static padding is not emitted again across rerenders", () => {
        expect.hasAssertions();

        const stdout = createStdout();
        const defaultItems = ["A"];
        const Test = ({ items = defaultItems, status }: { readonly items?: string[]; readonly status: string }) => (
            <>
                <Static items={items} style={{ padding: 1 }}>
                    {(item: string) => <Text key={item}>{item}</Text>}
                </Static>
                <Text>{status}</Text>
            </>
        );

        const instance = render(<Test status="Waiting" />, { debug: true, stdout });

        expect(stdout.get()).toBe("\n A\n\nWaiting");

        instance.rerender(<Test status="Ready" />);

        expect(stdout.get()).toBe("\n A\n\nReady");

        instance.rerender(<Test items={["A", "B"]} status="Done" />);

        expect(stdout.get()).toBe("\n A\n\n\n B\n\nDone");

        instance.unmount();
    });

    it("static preserves its margins and all items", () => {
        expect.hasAssertions();

        const output = renderToStringDirect(
            <Static items={["A", "B"]} style={{ marginBottom: 1, marginLeft: 2, marginTop: 1 }}>
                {(item: string) => <Text key={item}>{item}</Text>}
            </Static>,
        );

        expect(output).toBe("\n  A\n  B\n");
    });

    it("skips Static content inside a hidden ancestor", () => {
        expect.hasAssertions();

        const output = renderToStringDirect(
            <>
                <Box display="none">
                    <Static items={["Hidden"]}>
{(item: string) => (
<Box borderStyle="single" key={item}>
                        <Text>{item}</Text>
</Box>
)}
                    </Static>
                </Box>
                <Text>Visible</Text>
            </>,
        );

        expect(output).toBe("Visible");
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
    it("suspense hides nested text while showing its fallback", async () => {
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

            return <Text>Ready</Text>;
        };

        const Example = ({ pending, showFallback = true }: { readonly pending: boolean; readonly showFallback?: boolean }) => (
            <Box>
                <Text>
                    Status:
{" "}
<Suspense fallback={showFallback ? <Text>Loading</Text> : null}><Suspendable pending={pending} /></Suspense>
                </Text>
                <Text>!</Text>
            </Box>
        );

        const { rerenderAsync, stdout, unmount } = await renderAsync(<Example pending={false} />);

        try {
            expect(stdout.get()).toBe("Status: Ready!");

            await rerenderAsync(<Example pending />);

            expect(stdout.get()).toBe("Status: Loading!");

            await rerenderAsync(<Example pending={false} />);

            expect(stdout.get()).toBe("Status: Ready!");

            await rerenderAsync(<Example pending showFallback={false} />);

            expect(stdout.get()).toBe("Status: !");

            await rerenderAsync(<Example pending={false} showFallback={false} />);

            expect(stdout.get()).toBe("Status: Ready!");
        } finally {
            resolvePromise();
            unmount();
        }
    });

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

    it("changing text wrapping recalculates the container height", async () => {
        expect.hasAssertions();

        const Example = ({ truncate }: { readonly truncate: boolean }) => (
            <Box borderStyle="single" width={7}>
                <Text wrap={truncate ? "truncate" : "wrap"}>abcdefghij</Text>
            </Box>
        );

        const { rerenderAsync, stdout, unmount } = await renderAsync(<Example truncate={false} />);

        try {
            expect(stdout.get()).toBe("┌─────┐\n│abcde│\n│fghij│\n└─────┘");

            await rerenderAsync(<Example truncate />);

            expect(stdout.get()).toBe("┌─────┐\n│abcd…│\n└─────┘");

            await rerenderAsync(<Example truncate={false} />);

            expect(stdout.get()).toBe("┌─────┐\n│abcde│\n│fghij│\n└─────┘");
        } finally {
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
    it("vertical clipping preserves Transform line indices", () => {
        expect.hasAssertions();

        const output = renderToString(
            <Box contentOffsetY={1} height={2} overflow="hidden">
                <Box flexDirection="column" flexShrink={0}>
                    <Transform transform={(line, index) => line.replaceAll("x", String(index))}>
                        <Text>{"xx\nxx\nxx"}</Text>
                    </Transform>
                </Box>
            </Box>,
        );

        expect(output).toBe("11\n22");
    });

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

    it("overflowX visible overrides overflow hidden while preserving vertical clipping", () => {
        expect.hasAssertions();

        const output = renderToString(
            <Box height={2} width={6}>
                <Box height={1} overflow="hidden" overflowX="visible" width={3}>
                    <Box flexShrink={0} height={2} width={6}>
                        <Text>{"ABCDEF\nGHIJKL"}</Text>
                    </Box>
                </Box>
            </Box>,
        );

        expect(output).toBe("ABCDEF\n");
    });

    it("overflowY visible overrides overflow hidden while preserving horizontal clipping", () => {
        expect.hasAssertions();

        const output = renderToString(
            <Box height={2} width={6}>
                <Box height={1} overflow="hidden" overflowY="visible" width={3}>
                    <Box flexShrink={0} height={2} width={6}>
                        <Text>{"ABCDEF\nGHIJKL"}</Text>
                    </Box>
                </Box>
            </Box>,
        );

        expect(output).toBe("ABC\nGHI");
    });
});

describe("text cache keys", () => {
    it("different texts and widths do not share a wrapped result", () => {
        expect.hasAssertions();

        expect(wrapText("ab", 12, "wrap")).toBe("ab");
        expect(wrapText("ab1", 2, "wrap")).toBe("ab\n1");
    });
});

describe("static unmount", () => {
    it("static output stops accumulating after Static unmounts", () => {
        expect.hasAssertions();

        const stdout = createStdout();
        const items = ["A", "B"];
        const App = ({ show }: { readonly show: boolean }) => (
            <Box>
                {show ? <Static items={items}>{(item: string) => <Text key={item}>{item}</Text>}</Static> : null}
                <Text>Dynamic</Text>
            </Box>
        );

        const instance = render(<App show />, { debug: true, stdout });

        instance.rerender(<App show={false} />);

        const outputAfterUnmount = stdout.get();

        for (let index = 0; index < 10; index++) {
            instance.rerender(<App show={false} />);
        }

        expect(stdout.get()).toHaveLength(outputAfterUnmount.length);
        expect(stdout.get()).toContain("Dynamic");

        instance.unmount();
    });
});
