import { describe, expect, it } from "vitest";

import { Box, Text } from "../../src/components/index";
import { renderToString, renderToStringAsync } from "../helpers/ink-render";

describe("margin", () => {
    it("margin", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box margin={2}>
                <Text>X</Text>
            </Box>,
        );

        expect(output).toBe("\n\n  X\n\n");
    });

    it("margin X", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box>
                <Box marginX={2}>
                    <Text>X</Text>
                </Box>
                <Text>Y</Text>
            </Box>,
        );

        expect(output).toBe("  X  Y");
    });

    it("margin Y", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box marginY={2}>
                <Text>X</Text>
            </Box>,
        );

        expect(output).toBe("\n\nX\n\n");
    });

    it("margin top", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box marginTop={2}>
                <Text>X</Text>
            </Box>,
        );

        expect(output).toBe("\n\nX");
    });

    it("margin bottom", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box marginBottom={2}>
                <Text>X</Text>
            </Box>,
        );

        expect(output).toBe("X\n\n");
    });

    it("margin left", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box marginLeft={2}>
                <Text>X</Text>
            </Box>,
        );

        expect(output).toBe("  X");
    });

    it("margin right", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box>
                <Box marginRight={2}>
                    <Text>X</Text>
                </Box>
                <Text>Y</Text>
            </Box>,
        );

        expect(output).toBe("X  Y");
    });

    it("nested margin", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box margin={2}>
                <Box margin={2}>
                    <Text>X</Text>
                </Box>
            </Box>,
        );

        expect(output).toBe("\n\n\n\n    X\n\n\n\n");
    });

    it("margin with multiline string", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box margin={2}>
                <Text>{"A\nB"}</Text>
            </Box>,
        );

        expect(output).toBe("\n\n  A\n  B\n\n");
    });

    it("apply margin to text with newlines", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box margin={1}>
                <Text>
                    Hello
                    {"\n"}
                    World
                </Text>
            </Box>,
        );

        expect(output).toBe("\n Hello\n World\n");
    });

    it("apply margin to wrapped text", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box margin={1} width={6}>
                <Text>Hello World</Text>
            </Box>,
        );

        expect(output).toBe("\n Hello\n World\n");
    });

    it("margin - concurrent", async () => {
        expect.assertions(1);

        const output = await renderToStringAsync(
            <Box margin={2}>
                <Text>X</Text>
            </Box>,
        );

        expect(output).toBe("\n\n  X\n\n");
    });

    it("nested margin - concurrent", async () => {
        expect.assertions(1);

        const output = await renderToStringAsync(
            <Box margin={2}>
                <Box margin={2}>
                    <Text>X</Text>
                </Box>
            </Box>,
        );

        expect(output).toBe("\n\n\n\n    X\n\n\n\n");
    });
});
