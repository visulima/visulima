import { describe, expect, it } from "vitest";

import { Box, Text } from "../../src/components/index";
import { renderToString, renderToStringAsync } from "../helpers/ink-render";

describe("gap", () => {
    it("gap", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box flexWrap="wrap" gap={1} width={3}>
                <Text>A</Text>
                <Text>B</Text>
                <Text>C</Text>
            </Box>,
        );

        expect(output).toBe("A B\n\nC");
    });

    it("column gap", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box gap={1}>
                <Text>A</Text>
                <Text>B</Text>
            </Box>,
        );

        expect(output).toBe("A B");
    });

    it("row gap", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box flexDirection="column" gap={1}>
                <Text>A</Text>
                <Text>B</Text>
            </Box>,
        );

        expect(output).toBe("A\n\nB");
    });

    it("gap - concurrent", async () => {
        expect.assertions(1);

        const output = await renderToStringAsync(
            <Box flexWrap="wrap" gap={1} width={3}>
                <Text>A</Text>
                <Text>B</Text>
                <Text>C</Text>
            </Box>,
        );

        expect(output).toBe("A B\n\nC");
    });

    it("column gap - concurrent", async () => {
        expect.assertions(1);

        const output = await renderToStringAsync(
            <Box gap={1}>
                <Text>A</Text>
                <Text>B</Text>
            </Box>,
        );

        expect(output).toBe("A B");
    });

    it("row gap - concurrent", async () => {
        expect.assertions(1);

        const output = await renderToStringAsync(
            <Box flexDirection="column" gap={1}>
                <Text>A</Text>
                <Text>B</Text>
            </Box>,
        );

        expect(output).toBe("A\n\nB");
    });
});
