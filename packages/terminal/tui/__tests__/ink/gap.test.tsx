import { describe, expect, it } from "vitest";
import { Box, Text } from "../../src/ink/index.js";
import { renderToString, renderToStringAsync } from "../helpers/ink-render.js";

it("gap", () => {
    const output = renderToString(
        <Box gap={1} width={3} flexWrap="wrap">
            <Text>A</Text>
            <Text>B</Text>
            <Text>C</Text>
        </Box>,
    );

    expect(output).toBe("A B\n\nC");
});

it("column gap", () => {
    const output = renderToString(
        <Box gap={1}>
            <Text>A</Text>
            <Text>B</Text>
        </Box>,
    );

    expect(output).toBe("A B");
});

it("row gap", () => {
    const output = renderToString(
        <Box flexDirection="column" gap={1}>
            <Text>A</Text>
            <Text>B</Text>
        </Box>,
    );

    expect(output).toBe("A\n\nB");
});

it("gap - concurrent", async () => {
    const output = await renderToStringAsync(
        <Box gap={1} width={3} flexWrap="wrap">
            <Text>A</Text>
            <Text>B</Text>
            <Text>C</Text>
        </Box>,
    );

    expect(output).toBe("A B\n\nC");
});

it("column gap - concurrent", async () => {
    const output = await renderToStringAsync(
        <Box gap={1}>
            <Text>A</Text>
            <Text>B</Text>
        </Box>,
    );

    expect(output).toBe("A B");
});

it("row gap - concurrent", async () => {
    const output = await renderToStringAsync(
        <Box flexDirection="column" gap={1}>
            <Text>A</Text>
            <Text>B</Text>
        </Box>,
    );

    expect(output).toBe("A\n\nB");
});
