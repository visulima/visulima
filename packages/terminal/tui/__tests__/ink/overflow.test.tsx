import { describe, expect, it } from "vitest";
import boxen, { type Options } from "boxen";
import { slice as sliceAnsi } from "@visulima/string";
import { Box, Text } from "../../src/ink/index.js";
import { renderToString, renderToStringAsync } from "../helpers/ink-render.js";

const box = (text: string, options?: Options): string => {
    return boxen(text, {
        ...options,
        borderStyle: "round",
    });
};

const clipX = (text: string, columns: number): string => {
    return text
        .split("\n")
        .map((line) => sliceAnsi(line, 0, columns).trim())
        .join("\n");
};

it("overflowX - single text node in a box inside overflow container", () => {
    const output = renderToString(
        <Box width={6} overflowX="hidden">
            <Box width={16} flexShrink={0}>
                <Text>Hello World</Text>
            </Box>
        </Box>,
    );
    expect(output).toBe("Hello");
});

it("overflowX - single text node inside overflow container with border", () => {
    const output = renderToString(
        <Box width={6} overflowX="hidden" borderStyle="round">
            <Box width={16} flexShrink={0}>
                <Text>Hello World</Text>
            </Box>
        </Box>,
    );
    expect(output).toBe(box("Hell"));
});

it("overflowX - single text node in a box with border inside overflow container", () => {
    const output = renderToString(
        <Box width={6} overflowX="hidden">
            <Box width={16} flexShrink={0} borderStyle="round">
                <Text>Hello World</Text>
            </Box>
        </Box>,
    );
    expect(output).toBe(clipX(box("Hello"), 6));
});

it("overflowX - multiple text nodes in a box inside overflow container", () => {
    const output = renderToString(
        <Box width={6} overflowX="hidden">
            <Box width={12} flexShrink={0}>
                <Text>Hello </Text>
                <Text>World</Text>
            </Box>
        </Box>,
    );
    expect(output).toBe("Hello");
});

it("overflowX - multiple text nodes in a box inside overflow container with border", () => {
    const output = renderToString(
        <Box width={8} overflowX="hidden" borderStyle="round">
            <Box width={12} flexShrink={0}>
                <Text>Hello </Text>
                <Text>World</Text>
            </Box>
        </Box>,
    );
    expect(output).toBe(box("Hello "));
});

it("overflowX - multiple text nodes in a box with border inside overflow container", () => {
    const output = renderToString(
        <Box width={8} overflowX="hidden">
            <Box width={12} flexShrink={0} borderStyle="round">
                <Text>Hello </Text>
                <Text>World</Text>
            </Box>
        </Box>,
    );
    expect(output).toBe(clipX(box("HelloWo\n"), 8));
});

it("overflowX - multiple boxes inside overflow container", () => {
    const output = renderToString(
        <Box width={6} overflowX="hidden">
            <Box width={6} flexShrink={0}>
                <Text>Hello </Text>
            </Box>
            <Box width={6} flexShrink={0}>
                <Text>World</Text>
            </Box>
        </Box>,
    );
    expect(output).toBe("Hello");
});

it("overflowX - multiple boxes inside overflow container with border", () => {
    const output = renderToString(
        <Box width={8} overflowX="hidden" borderStyle="round">
            <Box width={6} flexShrink={0}>
                <Text>Hello </Text>
            </Box>
            <Box width={6} flexShrink={0}>
                <Text>World</Text>
            </Box>
        </Box>,
    );
    expect(output).toBe(box("Hello "));
});

it("overflowX - box before left edge of overflow container", () => {
    const output = renderToString(
        <Box width={6} overflowX="hidden">
            <Box marginLeft={-12} width={6} flexShrink={0}>
                <Text>Hello</Text>
            </Box>
        </Box>,
    );
    expect(output).toBe("");
});

it("overflowX - box before left edge of overflow container with border", () => {
    const output = renderToString(
        <Box width={6} overflowX="hidden" borderStyle="round">
            <Box marginLeft={-12} width={6} flexShrink={0}>
                <Text>Hello</Text>
            </Box>
        </Box>,
    );
    expect(output).toBe(box(" ".repeat(4)));
});

it("overflowX - box intersecting with left edge of overflow container", () => {
    const output = renderToString(
        <Box width={6} overflowX="hidden">
            <Box marginLeft={-3} width={12} flexShrink={0}>
                <Text>Hello World</Text>
            </Box>
        </Box>,
    );
    expect(output).toBe("lo Wor");
});

it("overflowX - box intersecting with left edge of overflow container with border", () => {
    const output = renderToString(
        <Box width={8} overflowX="hidden" borderStyle="round">
            <Box marginLeft={-3} width={12} flexShrink={0}>
                <Text>Hello World</Text>
            </Box>
        </Box>,
    );
    expect(output).toBe(box("lo Wor"));
});

it("overflowX - box after right edge of overflow container", () => {
    const output = renderToString(
        <Box width={6} overflowX="hidden">
            <Box marginLeft={6} width={6} flexShrink={0}>
                <Text>Hello</Text>
            </Box>
        </Box>,
    );
    expect(output).toBe("");
});

it("overflowX - box intersecting with right edge of overflow container", () => {
    const output = renderToString(
        <Box width={6} overflowX="hidden">
            <Box marginLeft={3} width={6} flexShrink={0}>
                <Text>Hello</Text>
            </Box>
        </Box>,
    );
    expect(output).toBe("   Hel");
});

it("overflowY - single text node inside overflow container", () => {
    const output = renderToString(
        <Box height={1} overflowY="hidden">
            <Text>Hello{"\n"}World</Text>
        </Box>,
    );
    expect(output).toBe("Hello");
});

it("overflowY - single text node inside overflow container with border", () => {
    const output = renderToString(
        <Box width={20} height={3} overflowY="hidden" borderStyle="round">
            <Text>Hello{"\n"}World</Text>
        </Box>,
    );
    expect(output).toBe(box("Hello".padEnd(18, " ")));
});

it("overflowY - multiple boxes inside overflow container", () => {
    const output = renderToString(
        <Box height={2} overflowY="hidden" flexDirection="column">
            <Box flexShrink={0}>
                <Text>Line #1</Text>
            </Box>
            <Box flexShrink={0}>
                <Text>Line #2</Text>
            </Box>
            <Box flexShrink={0}>
                <Text>Line #3</Text>
            </Box>
            <Box flexShrink={0}>
                <Text>Line #4</Text>
            </Box>
        </Box>,
    );
    expect(output).toBe("Line #1\nLine #2");
});

it("overflowY - multiple boxes inside overflow container with border", () => {
    const output = renderToString(
        <Box width={9} height={4} overflowY="hidden" flexDirection="column" borderStyle="round">
            <Box flexShrink={0}>
                <Text>Line #1</Text>
            </Box>
            <Box flexShrink={0}>
                <Text>Line #2</Text>
            </Box>
            <Box flexShrink={0}>
                <Text>Line #3</Text>
            </Box>
            <Box flexShrink={0}>
                <Text>Line #4</Text>
            </Box>
        </Box>,
    );
    expect(output).toBe(box("Line #1\nLine #2"));
});

it("overflowY - box above top edge of overflow container", () => {
    const output = renderToString(
        <Box height={1} overflowY="hidden">
            <Box marginTop={-2} height={2} flexShrink={0}>
                <Text>Hello{"\n"}World</Text>
            </Box>
        </Box>,
    );
    expect(output).toBe("");
});

it("overflowY - box above top edge of overflow container with border", () => {
    const output = renderToString(
        <Box width={7} height={3} overflowY="hidden" borderStyle="round">
            <Box marginTop={-3} height={2} flexShrink={0}>
                <Text>Hello{"\n"}World</Text>
            </Box>
        </Box>,
    );
    expect(output).toBe(box(" ".repeat(5)));
});

it("overflowY - box intersecting with top edge of overflow container", () => {
    const output = renderToString(
        <Box height={1} overflowY="hidden">
            <Box marginTop={-1} height={2} flexShrink={0}>
                <Text>Hello{"\n"}World</Text>
            </Box>
        </Box>,
    );
    expect(output).toBe("World");
});

it("overflowY - box intersecting with top edge of overflow container with border", () => {
    const output = renderToString(
        <Box width={7} height={3} overflowY="hidden" borderStyle="round">
            <Box marginTop={-1} height={2} flexShrink={0}>
                <Text>Hello{"\n"}World</Text>
            </Box>
        </Box>,
    );
    expect(output).toBe(box("World"));
});

it("overflowY - box below bottom edge of overflow container", () => {
    const output = renderToString(
        <Box height={1} overflowY="hidden">
            <Box marginTop={1} height={2} flexShrink={0}>
                <Text>Hello{"\n"}World</Text>
            </Box>
        </Box>,
    );
    expect(output).toBe("");
});

it("overflowY - box below bottom edge of overflow container with border", () => {
    const output = renderToString(
        <Box width={7} height={3} overflowY="hidden" borderStyle="round">
            <Box marginTop={2} height={2} flexShrink={0}>
                <Text>Hello{"\n"}World</Text>
            </Box>
        </Box>,
    );
    expect(output).toBe(box(" ".repeat(5)));
});

it("overflowY - box intersecting with bottom edge of overflow container", () => {
    const output = renderToString(
        <Box height={1} overflowY="hidden">
            <Box height={2} flexShrink={0}>
                <Text>Hello{"\n"}World</Text>
            </Box>
        </Box>,
    );
    expect(output).toBe("Hello");
});

it("overflowY - box intersecting with bottom edge of overflow container with border", () => {
    const output = renderToString(
        <Box width={7} height={3} overflowY="hidden" borderStyle="round">
            <Box height={2} flexShrink={0}>
                <Text>Hello{"\n"}World</Text>
            </Box>
        </Box>,
    );
    expect(output).toBe(box("Hello"));
});

it("overflow - single text node inside overflow container", () => {
    const output = renderToString(
        <Box paddingBottom={1}>
            <Box width={6} height={1} overflow="hidden">
                <Box width={12} height={2} flexShrink={0}>
                    <Text>Hello{"\n"}World</Text>
                </Box>
            </Box>
        </Box>,
    );
    expect(output).toBe("Hello\n");
});

it("overflow - single text node inside overflow container with border", () => {
    const output = renderToString(
        <Box paddingBottom={1}>
            <Box width={8} height={3} overflow="hidden" borderStyle="round">
                <Box width={12} height={2} flexShrink={0}>
                    <Text>Hello{"\n"}World</Text>
                </Box>
            </Box>
        </Box>,
    );
    expect(output).toBe(`${box("Hello ")}\n`);
});

it("overflow - multiple boxes inside overflow container", () => {
    const output = renderToString(
        <Box paddingBottom={1}>
            <Box width={4} height={1} overflow="hidden">
                <Box width={2} height={2} flexShrink={0}>
                    <Text>TL{"\n"}BL</Text>
                </Box>
                <Box width={2} height={2} flexShrink={0}>
                    <Text>TR{"\n"}BR</Text>
                </Box>
            </Box>
        </Box>,
    );
    expect(output).toBe("TLTR\n");
});

it("overflow - multiple boxes inside overflow container with border", () => {
    const output = renderToString(
        <Box paddingBottom={1}>
            <Box width={6} height={3} overflow="hidden" borderStyle="round">
                <Box width={2} height={2} flexShrink={0}>
                    <Text>TL{"\n"}BL</Text>
                </Box>
                <Box width={2} height={2} flexShrink={0}>
                    <Text>TR{"\n"}BR</Text>
                </Box>
            </Box>
        </Box>,
    );
    expect(output).toBe(`${box("TLTR")}\n`);
});

it("overflow - box intersecting with top left edge of overflow container", () => {
    const output = renderToString(
        <Box width={4} height={4} overflow="hidden">
            <Box marginTop={-2} marginLeft={-2} width={4} height={4} flexShrink={0}>
                <Text>
                    AAAA{"\n"}BBBB{"\n"}CCCC{"\n"}DDDD
                </Text>
            </Box>
        </Box>,
    );
    expect(output).toBe("CC\nDD\n\n");
});

it("overflow - box intersecting with top right edge of overflow container", () => {
    const output = renderToString(
        <Box width={4} height={4} overflow="hidden">
            <Box marginTop={-2} marginLeft={2} width={4} height={4} flexShrink={0}>
                <Text>
                    AAAA{"\n"}BBBB{"\n"}CCCC{"\n"}DDDD
                </Text>
            </Box>
        </Box>,
    );
    expect(output).toBe("  CC\n  DD\n\n");
});

it("overflow - box intersecting with bottom left edge of overflow container", () => {
    const output = renderToString(
        <Box width={4} height={4} overflow="hidden">
            <Box marginTop={2} marginLeft={-2} width={4} height={4} flexShrink={0}>
                <Text>
                    AAAA{"\n"}BBBB{"\n"}CCCC{"\n"}DDDD
                </Text>
            </Box>
        </Box>,
    );
    expect(output).toBe("\n\nAA\nBB");
});

it("overflow - box intersecting with bottom right edge of overflow container", () => {
    const output = renderToString(
        <Box width={4} height={4} overflow="hidden">
            <Box marginTop={2} marginLeft={2} width={4} height={4} flexShrink={0}>
                <Text>
                    AAAA{"\n"}BBBB{"\n"}CCCC{"\n"}DDDD
                </Text>
            </Box>
        </Box>,
    );
    expect(output).toBe("\n\n  AA\n  BB");
});

it("nested overflow", () => {
    const output = renderToString(
        <Box paddingBottom={1}>
            <Box width={4} height={4} overflow="hidden" flexDirection="column">
                <Box width={2} height={2} overflow="hidden">
                    <Box width={4} height={4} flexShrink={0}>
                        <Text>
                            AAAA{"\n"}BBBB{"\n"}CCCC{"\n"}DDDD
                        </Text>
                    </Box>
                </Box>

                <Box width={4} height={3}>
                    <Text>
                        XXXX{"\n"}YYYY{"\n"}ZZZZ
                    </Text>
                </Box>
            </Box>
        </Box>,
    );
    expect(output).toBe("AA\nBB\nXXXX\nYYYY\n");
});

it("out of bounds writes do not crash", () => {
    const output = renderToString(<Box width={12} height={10} borderStyle="round" />, { columns: 10 });

    const expected = boxen("", {
        width: 12,
        height: 10,
        borderStyle: "round",
    })
        .split("\n")
        .map((line, index) => {
            return index === 0 || index === 9 ? line : `${line.slice(0, 10)}${line[11] ?? ""}`;
        })
        .join("\n");

    expect(output).toBe(expected);
});

it("overflowX - single text node in a box inside overflow container - concurrent", async () => {
    const output = await renderToStringAsync(
        <Box width={6} overflowX="hidden">
            <Box width={16} flexShrink={0}>
                <Text>Hello World</Text>
            </Box>
        </Box>,
    );
    expect(output).toBe("Hello");
});

it("overflowY - single text node inside overflow container - concurrent", async () => {
    const output = await renderToStringAsync(
        <Box height={1} overflowY="hidden">
            <Text>Hello{"\n"}World</Text>
        </Box>,
    );
    expect(output).toBe("Hello");
});

it("overflow - single text node inside overflow container - concurrent", async () => {
    const output = await renderToStringAsync(
        <Box paddingBottom={1}>
            <Box width={6} height={1} overflow="hidden">
                <Box width={12} height={2} flexShrink={0}>
                    <Text>Hello{"\n"}World</Text>
                </Box>
            </Box>
        </Box>,
    );
    expect(output).toBe("Hello\n");
});

it("nested overflow - concurrent", async () => {
    const output = await renderToStringAsync(
        <Box paddingBottom={1}>
            <Box width={4} height={4} overflow="hidden" flexDirection="column">
                <Box width={2} height={2} overflow="hidden">
                    <Box width={4} height={4} flexShrink={0}>
                        <Text>
                            AAAA{"\n"}BBBB{"\n"}CCCC{"\n"}DDDD
                        </Text>
                    </Box>
                </Box>

                <Box width={4} height={3}>
                    <Text>
                        XXXX{"\n"}YYYY{"\n"}ZZZZ
                    </Text>
                </Box>
            </Box>
        </Box>,
    );
    expect(output).toBe("AA\nBB\nXXXX\nYYYY\n");
});
