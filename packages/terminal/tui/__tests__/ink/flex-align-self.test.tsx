import { describe, expect, it } from "vitest";

import { Box, Newline, Text } from "../../src/ink/index";
import { renderToString } from "../helpers/ink-render";

describe("flex-align-self", () => {
    it("row - align text to center", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box height={3}>
                <Box alignSelf="center">
                    <Text>Test</Text>
                </Box>
            </Box>,
        );

        expect(output).toBe("\nTest\n");
    });

    it("row - align multiple text nodes to center", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box height={3}>
                <Box alignSelf="center">
                    <Text>A</Text>
                    <Text>B</Text>
                </Box>
            </Box>,
        );

        expect(output).toBe("\nAB\n");
    });

    it("row - align text to bottom", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box height={3}>
                <Box alignSelf="flex-end">
                    <Text>Test</Text>
                </Box>
            </Box>,
        );

        expect(output).toBe("\n\nTest");
    });

    it("row - align multiple text nodes to bottom", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box height={3}>
                <Box alignSelf="flex-end">
                    <Text>A</Text>
                    <Text>B</Text>
                </Box>
            </Box>,
        );

        expect(output).toBe("\n\nAB");
    });

    it("column - align text to center", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box flexDirection="column" width={10}>
                <Box alignSelf="center">
                    <Text>Test</Text>
                </Box>
            </Box>,
        );

        expect(output).toBe("   Test");
    });

    it("column - align text to right", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box flexDirection="column" width={10}>
                <Box alignSelf="flex-end">
                    <Text>Test</Text>
                </Box>
            </Box>,
        );

        expect(output).toBe("      Test");
    });

    it("column - align self stretch", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box flexDirection="column" width={7}>
                <Box alignSelf="stretch" borderStyle="single">
                    <Text>X</Text>
                </Box>
            </Box>,
        );

        expect(output).toBe("┌─────┐\n│X    │\n└─────┘");
    });

    it("row - align self stretch", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box height={5}>
                <Box alignSelf="stretch" borderStyle="single">
                    <Text>X</Text>
                </Box>
            </Box>,
        );

        expect(output).toBe("┌─┐\n│X│\n│ │\n│ │\n└─┘");
    });

    it("row - align self baseline", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box alignItems="flex-end" height={3}>
                <Text>
                    A
                    <Newline />B
                </Text>
                <Box alignSelf="baseline">
                    <Text>X</Text>
                </Box>
            </Box>,
        );

        expect(output).toBe("AX\nB\n");
    });
});
