import { describe, expect, it } from "vitest";

import { Box, Text } from "../../src/ink/index.js";
import { renderToString, renderToStringAsync } from "../helpers/ink-render.js";

describe("flex-direction", () => {
    it("direction row", () => {
        expect.hasAssertions();

        const output = renderToString(
            <Box flexDirection="row">
                <Text>A</Text>
                <Text>B</Text>
            </Box>,
        );

        expect(output).toBe("AB");
    });

    it("direction row reverse", () => {
        expect.hasAssertions();

        const output = renderToString(
            <Box flexDirection="row-reverse" width={4}>
                <Text>A</Text>
                <Text>B</Text>
            </Box>,
        );

        expect(output).toBe("  BA");
    });

    it("direction column", () => {
        expect.hasAssertions();

        const output = renderToString(
            <Box flexDirection="column">
                <Text>A</Text>
                <Text>B</Text>
            </Box>,
        );

        expect(output).toBe("A\nB");
    });

    it("direction column reverse", () => {
        expect.hasAssertions();

        const output = renderToString(
            <Box flexDirection="column-reverse" height={4}>
                <Text>A</Text>
                <Text>B</Text>
            </Box>,
        );

        expect(output).toBe("\n\nB\nA");
    });

    it("don't squash text nodes when column direction is applied", () => {
        expect.hasAssertions();

        const output = renderToString(
            <Box flexDirection="column">
                <Text>A</Text>
                <Text>B</Text>
            </Box>,
        );

        expect(output).toBe("A\nB");
    });

    it("direction row - concurrent", async () => {
        expect.hasAssertions();

        const output = await renderToStringAsync(
            <Box flexDirection="row">
                <Text>A</Text>
                <Text>B</Text>
            </Box>,
        );

        expect(output).toBe("AB");
    });

    it("direction column - concurrent", async () => {
        expect.hasAssertions();

        const output = await renderToStringAsync(
            <Box flexDirection="column">
                <Text>A</Text>
                <Text>B</Text>
            </Box>,
        );

        expect(output).toBe("A\nB");
    });
});
