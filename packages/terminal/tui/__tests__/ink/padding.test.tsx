import { describe, expect, it } from "vitest";

import { Box, Text } from "../../src/components/index";
import { renderToString, renderToStringAsync } from "../helpers/ink-render";

describe("padding", () => {
    it("padding", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box padding={2}>
                <Text>X</Text>
            </Box>,
        );

        expect(output).toBe("\n\n  X\n\n");
    });

    it("padding X", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box>
                <Box paddingX={2}>
                    <Text>X</Text>
                </Box>
                <Text>Y</Text>
            </Box>,
        );

        expect(output).toBe("  X  Y");
    });

    it("padding Y", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box paddingY={2}>
                <Text>X</Text>
            </Box>,
        );

        expect(output).toBe("\n\nX\n\n");
    });

    it("padding top", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box paddingTop={2}>
                <Text>X</Text>
            </Box>,
        );

        expect(output).toBe("\n\nX");
    });

    it("padding bottom", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box paddingBottom={2}>
                <Text>X</Text>
            </Box>,
        );

        expect(output).toBe("X\n\n");
    });

    it("padding left", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box paddingLeft={2}>
                <Text>X</Text>
            </Box>,
        );

        expect(output).toBe("  X");
    });

    it("padding right", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box>
                <Box paddingRight={2}>
                    <Text>X</Text>
                </Box>
                <Text>Y</Text>
            </Box>,
        );

        expect(output).toBe("X  Y");
    });

    it("nested padding", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box padding={2}>
                <Box padding={2}>
                    <Text>X</Text>
                </Box>
            </Box>,
        );

        expect(output).toBe("\n\n\n\n    X\n\n\n\n");
    });

    it("padding with multiline string", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box padding={2}>
                <Text>{"A\nB"}</Text>
            </Box>,
        );

        expect(output).toBe("\n\n  A\n  B\n\n");
    });

    it("apply padding to text with newlines", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box padding={1}>
                <Text>
                    Hello
                    {"\n"}
                    World
                </Text>
            </Box>,
        );

        expect(output).toBe("\n Hello\n World\n");
    });

    it("apply padding to wrapped text", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box padding={1} width={5}>
                <Text>Hello World</Text>
            </Box>,
        );

        expect(output).toBe("\n Hel\n lo\n Wor\n ld\n");
    });

    it("text wrapping respects paddingX with flexGrow", () => {
        expect.assertions(4);

        const output = renderToString(
            <Box borderStyle="round" width={40}>
                <Box paddingX={2}>
                    <Box marginLeft={2}>
                        <Text>•</Text>
                        <Box flexGrow={1} marginLeft={1}>
                            <Text>Lorem ipsum dolor sit amet, consectetur adipiscing elit</Text>
                        </Box>
                    </Box>
                </Box>
            </Box>,
        );

        const lines = output.split("\n");

        for (const line of lines) {
            expect(line.length).toBeLessThanOrEqual(40);
        }
    });

    it("padding - concurrent", async () => {
        expect.assertions(1);

        const output = await renderToStringAsync(
            <Box padding={2}>
                <Text>X</Text>
            </Box>,
        );

        expect(output).toBe("\n\n  X\n\n");
    });

    it("nested padding - concurrent", async () => {
        expect.assertions(1);

        const output = await renderToStringAsync(
            <Box padding={2}>
                <Box padding={2}>
                    <Text>X</Text>
                </Box>
            </Box>,
        );

        expect(output).toBe("\n\n\n\n    X\n\n\n\n");
    });
});
