import { describe, expect, it } from "vitest";

import { Box, Newline, Text } from "../../src/components/index";
import { renderToString } from "../helpers/ink-render";

describe("flex-align-items", () => {
    it("row - align text to center", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box alignItems="center" height={3}>
                <Text>Test</Text>
            </Box>,
        );

        expect(output).toBe("\nTest\n");
    });

    it("row - align multiple text nodes to center", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box alignItems="center" height={3}>
                <Text>A</Text>
                <Text>B</Text>
            </Box>,
        );

        expect(output).toBe("\nAB\n");
    });

    it("row - align text to bottom", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box alignItems="flex-end" height={3}>
                <Text>Test</Text>
            </Box>,
        );

        expect(output).toBe("\n\nTest");
    });

    it("row - align multiple text nodes to bottom", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box alignItems="flex-end" height={3}>
                <Text>A</Text>
                <Text>B</Text>
            </Box>,
        );

        expect(output).toBe("\n\nAB");
    });

    it("column - align text to center", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box alignItems="center" flexDirection="column" width={10}>
                <Text>Test</Text>
            </Box>,
        );

        expect(output).toBe("   Test");
    });

    it("column - align text to right", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box alignItems="flex-end" flexDirection="column" width={10}>
                <Text>Test</Text>
            </Box>,
        );

        expect(output).toBe("      Test");
    });

    it("row - align items stretch", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box alignItems="stretch" height={5}>
                <Box borderStyle="single">
                    <Text>X</Text>
                </Box>
            </Box>,
        );

        expect(output).toBe("┌─┐\n│X│\n│ │\n│ │\n└─┘");
    });

    it("row - default align items stretches children", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box height={5}>
                <Box borderStyle="single">
                    <Text>X</Text>
                </Box>
            </Box>,
        );

        expect(output).toBe("┌─┐\n│X│\n│ │\n│ │\n└─┘");
    });

    it("row - align text to baseline", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box alignItems="baseline" height={3}>
                <Text>
                    A
                    <Newline />B
                </Text>
                <Text>X</Text>
            </Box>,
        );

        expect(output).toBe("A\nBX\n");
    });
});
