import { describe, expect, it } from "vitest";
import colorizeDefault from "@visulima/colorize";
import { Box, Text } from "../../src/ink/index.js";
import { renderToString } from "../helpers/ink-render.js";

it("row - align text to center", () => {
    const output = renderToString(
        <Box justifyContent="center" width={10}>
            <Text>Test</Text>
        </Box>,
    );

    expect(output).toBe("   Test");
});

it("row - align multiple text nodes to center", () => {
    const output = renderToString(
        <Box justifyContent="center" width={10}>
            <Text>A</Text>
            <Text>B</Text>
        </Box>,
    );

    expect(output).toBe("    AB");
});

it("row - align text to right", () => {
    const output = renderToString(
        <Box justifyContent="flex-end" width={10}>
            <Text>Test</Text>
        </Box>,
    );

    expect(output).toBe("      Test");
});

it("row - align multiple text nodes to right", () => {
    const output = renderToString(
        <Box justifyContent="flex-end" width={10}>
            <Text>A</Text>
            <Text>B</Text>
        </Box>,
    );

    expect(output).toBe("        AB");
});

it("row - align two text nodes on the edges", () => {
    const output = renderToString(
        <Box justifyContent="space-between" width={4}>
            <Text>A</Text>
            <Text>B</Text>
        </Box>,
    );

    expect(output).toBe("A  B");
});

it("row - space evenly two text nodes", () => {
    const output = renderToString(
        <Box justifyContent="space-evenly" width={10}>
            <Text>A</Text>
            <Text>B</Text>
        </Box>,
    );

    expect(output).toBe("  A   B");
});

it.fails("row - align two text nodes with equal space around them", () => {
    const output = renderToString(
        <Box justifyContent="space-around" width={5}>
            <Text>A</Text>
            <Text>B</Text>
        </Box>,
    );

    expect(output).toBe(" A B");
});

it("row - align colored text node when text is squashed", () => {
    const output = renderToString(
        <Box justifyContent="flex-end" width={5}>
            <Text color="green">X</Text>
        </Box>,
    );

    expect(output).toBe(`    ${colorizeDefault.green("X")}`);
});

it("column - align text to center", () => {
    const output = renderToString(
        <Box flexDirection="column" justifyContent="center" height={3}>
            <Text>Test</Text>
        </Box>,
    );

    expect(output).toBe("\nTest\n");
});

it("column - align text to bottom", () => {
    const output = renderToString(
        <Box flexDirection="column" justifyContent="flex-end" height={3}>
            <Text>Test</Text>
        </Box>,
    );

    expect(output).toBe("\n\nTest");
});

it("column - align two text nodes on the edges", () => {
    const output = renderToString(
        <Box flexDirection="column" justifyContent="space-between" height={4}>
            <Text>A</Text>
            <Text>B</Text>
        </Box>,
    );

    expect(output).toBe("A\n\n\nB");
});

it.fails("column - align two text nodes with equal space around them", () => {
    const output = renderToString(
        <Box flexDirection="column" justifyContent="space-around" height={5}>
            <Text>A</Text>
            <Text>B</Text>
        </Box>,
    );

    expect(output).toBe("\nA\n\nB\n");
});
