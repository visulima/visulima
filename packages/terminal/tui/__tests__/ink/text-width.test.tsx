import { describe, expect, it } from "vitest";
import stripAnsi from "strip-ansi";
import { Box, Text } from "../../src/ink/index.js";
import { renderToString } from "../helpers/ink-render.js";

it("wide characters do not add extra space inside fixed-width Box", () => {
    const output = renderToString(
        <Box flexDirection="column">
            <Box>
                <Box width={2}>
                    <Text>🍔</Text>
                </Box>
                <Text>|</Text>
            </Box>
            <Box>
                <Box width={2}>
                    <Text>⏳</Text>
                </Box>
                <Text>|</Text>
            </Box>
        </Box>,
    );

    const lines = output.split("\n");
    expect(lines.length).toBe(2);
    expect(lines[0]).toBe("🍔|");
    expect(lines[1]).toBe("⏳|");
});

it("CJK characters occupy correct width in fixed-width Box", () => {
    const output = renderToString(
        <Box>
            <Box width={4}>
                <Text>你好</Text>
            </Box>
            <Text>|</Text>
        </Box>,
    );

    expect(output).toBe("你好|");
});

it("mixed ASCII and wide characters align correctly", () => {
    const output = renderToString(
        <Box flexDirection="column">
            <Box>
                <Box width={6}>
                    <Text>ab🍔cd</Text>
                </Box>
                <Text>|</Text>
            </Box>
            <Box>
                <Box width={6}>
                    <Text>abcdef</Text>
                </Box>
                <Text>|</Text>
            </Box>
        </Box>,
    );

    const lines = output.split("\n");
    expect(lines.length).toBe(2);
    expect(lines[0]).toBe("ab🍔cd|");
    expect(lines[1]).toBe("abcdef|");
});

it("ANSI styled text does not affect layout width", () => {
    const output = renderToString(
        <Box>
            <Box width={5}>
                <Text color="red">hello</Text>
            </Box>
            <Text>|</Text>
        </Box>,
    );

    const stripped = stripAnsi(output);
    expect(stripped).toBe("hello|");
});

it("empty Text does not affect sibling layout", () => {
    const output = renderToString(
        <Box>
            <Text />
            <Text>hello</Text>
        </Box>,
    );

    expect(output).toBe("hello");
});
