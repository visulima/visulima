import { describe, expect, it } from "vitest";
import { Box, Text } from "../../src/ink/index.js";
import { renderToString } from "../helpers/ink-render.js";

it("grow equally", () => {
    const output = renderToString(
        <Box width={6}>
            <Box flexGrow={1}>
                <Text>A</Text>
            </Box>
            <Box flexGrow={1}>
                <Text>B</Text>
            </Box>
        </Box>,
    );

    expect(output).toBe("A  B");
});

it("grow one element", () => {
    const output = renderToString(
        <Box width={6}>
            <Box flexGrow={1}>
                <Text>A</Text>
            </Box>
            <Text>B</Text>
        </Box>,
    );

    expect(output).toBe("A    B");
});

it("do not shrink", () => {
    const output = renderToString(
        <Box width={16}>
            <Box flexShrink={0} width={6}>
                <Text>A</Text>
            </Box>
            <Box flexShrink={0} width={6}>
                <Text>B</Text>
            </Box>
            <Box width={6}>
                <Text>C</Text>
            </Box>
        </Box>,
    );

    expect(output).toBe("A     B     C");
});

it("shrink equally", () => {
    const output = renderToString(
        <Box width={10}>
            <Box flexShrink={1} width={6}>
                <Text>A</Text>
            </Box>
            <Box flexShrink={1} width={6}>
                <Text>B</Text>
            </Box>
            <Text>C</Text>
        </Box>,
    );

    expect(output).toBe("A    B   C");
});

it('set flex basis with flexDirection="row" container', () => {
    const output = renderToString(
        <Box width={6}>
            <Box flexBasis={3}>
                <Text>A</Text>
            </Box>
            <Text>B</Text>
        </Box>,
    );

    expect(output).toBe("A  B");
});

it('set flex basis in percent with flexDirection="row" container', () => {
    const output = renderToString(
        <Box width={6}>
            <Box flexBasis="50%">
                <Text>A</Text>
            </Box>
            <Text>B</Text>
        </Box>,
    );

    expect(output).toBe("A  B");
});

it('set flex basis with flexDirection="column" container', () => {
    const output = renderToString(
        <Box height={6} flexDirection="column">
            <Box flexBasis={3}>
                <Text>A</Text>
            </Box>
            <Text>B</Text>
        </Box>,
    );

    expect(output).toBe("A\n\n\nB\n\n");
});

it('set flex basis in percent with flexDirection="column" container', () => {
    const output = renderToString(
        <Box height={6} flexDirection="column">
            <Box flexBasis="50%">
                <Text>A</Text>
            </Box>
            <Text>B</Text>
        </Box>,
    );

    expect(output).toBe("A\n\n\nB\n\n");
});
