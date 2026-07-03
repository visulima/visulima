import { green } from "@visulima/colorize";
import { describe, expect, it } from "vitest";

import { Box, Text } from "../../src/components/index";
import { renderToString } from "../helpers/ink-render";

describe("flex-justify-content", () => {
    it("row - align text to center", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box justifyContent="center" width={10}>
                <Text>Test</Text>
            </Box>,
        );

        expect(output).toBe("   Test");
    });

    it("row - align multiple text nodes to center", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box justifyContent="center" width={10}>
                <Text>A</Text>
                <Text>B</Text>
            </Box>,
        );

        expect(output).toBe("    AB");
    });

    it("row - align text to right", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box justifyContent="flex-end" width={10}>
                <Text>Test</Text>
            </Box>,
        );

        expect(output).toBe("      Test");
    });

    it("row - align multiple text nodes to right", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box justifyContent="flex-end" width={10}>
                <Text>A</Text>
                <Text>B</Text>
            </Box>,
        );

        expect(output).toBe("        AB");
    });

    it("row - align two text nodes on the edges", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box justifyContent="space-between" width={4}>
                <Text>A</Text>
                <Text>B</Text>
            </Box>,
        );

        expect(output).toBe("A  B");
    });

    it("row - space evenly two text nodes", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box justifyContent="space-evenly" width={10}>
                <Text>A</Text>
                <Text>B</Text>
            </Box>,
        );

        expect(output).toBe("  A   B");
    });

    it.fails("row - align two text nodes with equal space around them", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box justifyContent="space-around" width={5}>
                <Text>A</Text>
                <Text>B</Text>
            </Box>,
        );

        expect(output).toBe(" A B");
    });

    it("row - align colored text node when text is squashed", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box justifyContent="flex-end" width={5}>
                <Text color="green">X</Text>
            </Box>,
        );

        expect(output).toBe(`    ${green("X")}`);
    });

    it("column - align text to center", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box flexDirection="column" height={3} justifyContent="center">
                <Text>Test</Text>
            </Box>,
        );

        expect(output).toBe("\nTest\n");
    });

    it("column - align text to bottom", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box flexDirection="column" height={3} justifyContent="flex-end">
                <Text>Test</Text>
            </Box>,
        );

        expect(output).toBe("\n\nTest");
    });

    it("column - align two text nodes on the edges", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box flexDirection="column" height={4} justifyContent="space-between">
                <Text>A</Text>
                <Text>B</Text>
            </Box>,
        );

        expect(output).toBe("A\n\n\nB");
    });

    it.fails("column - align two text nodes with equal space around them", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box flexDirection="column" height={5} justifyContent="space-around">
                <Text>A</Text>
                <Text>B</Text>
            </Box>,
        );

        expect(output).toBe("\nA\n\nB\n");
    });
});
