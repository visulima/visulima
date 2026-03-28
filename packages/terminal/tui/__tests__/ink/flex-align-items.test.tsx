import { describe, expect, it } from "vitest";

import { Box, Newline, Text } from "../../src/ink/index.js";
import { renderToString } from "../helpers/ink-render.js";

describe("flex-align-items", () => {
    it("row - align text to center", () => {
        expect.hasAssertions();

        const output = renderToString(
            <Box alignItems="center" height={3}>
                <Text>Test</Text>
            </Box>,
        );

        expect(output).toBe("\nTest\n");
    });

    it("row - align multiple text nodes to center", () => {
        expect.hasAssertions();

        const output = renderToString(
            <Box alignItems="center" height={3}>
                <Text>A</Text>
                <Text>B</Text>
            </Box>,
        );

        expect(output).toBe("\nAB\n");
    });

    it("row - align text to bottom", () => {
        expect.hasAssertions();

        const output = renderToString(
            <Box alignItems="flex-end" height={3}>
                <Text>Test</Text>
            </Box>,
        );

        expect(output).toBe("\n\nTest");
    });

    it("row - align multiple text nodes to bottom", () => {
        expect.hasAssertions();

        const output = renderToString(
            <Box alignItems="flex-end" height={3}>
                <Text>A</Text>
                <Text>B</Text>
            </Box>,
        );

        expect(output).toBe("\n\nAB");
    });

    it("column - align text to center", () => {
        expect.hasAssertions();

        const output = renderToString(
            <Box alignItems="center" flexDirection="column" width={10}>
                <Text>Test</Text>
            </Box>,
        );

        expect(output).toBe("   Test");
    });

    it("column - align text to right", () => {
        expect.hasAssertions();

        const output = renderToString(
            <Box alignItems="flex-end" flexDirection="column" width={10}>
                <Text>Test</Text>
            </Box>,
        );

        expect(output).toBe("      Test");
    });

    it("row - align items stretch", () => {
        expect.hasAssertions();

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
        expect.hasAssertions();

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
        expect.hasAssertions();

        const output = renderToString(
            <Box alignItems="baseline" height={3}>
                <Text>
                    A
                    <Newline />
                    B
                </Text>
                <Text>X</Text>
            </Box>,
        );

        expect(output).toBe("A\nBX\n");
    });
});
