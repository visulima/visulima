import { strip as stripAnsi } from "@visulima/ansi";
import { describe, expect, it } from "vitest";

import { Box, Text } from "../../src/ink/index";
import { renderToString } from "../helpers/ink-render";

describe("text-width", () => {
    it("wide characters do not add extra space inside fixed-width Box", () => {
        expect.hasAssertions();

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

        expect(lines).toHaveLength(2);
        expect(lines[0]).toBe("🍔|");
        expect(lines[1]).toBe("⏳|");
    });

    it("cJK characters occupy correct width in fixed-width Box", () => {
        expect.hasAssertions();

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
        expect.hasAssertions();

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

        expect(lines).toHaveLength(2);
        expect(lines[0]).toBe("ab🍔cd|");
        expect(lines[1]).toBe("abcdef|");
    });

    it("aNSI styled text does not affect layout width", () => {
        expect.hasAssertions();

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
        expect.hasAssertions();

        const output = renderToString(
            <Box>
                <Text />
                <Text>hello</Text>
            </Box>,
        );

        expect(output).toBe("hello");
    });
});
