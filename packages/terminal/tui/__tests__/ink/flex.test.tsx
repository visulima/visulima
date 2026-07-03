import { describe, expect, it } from "vitest";

import { Box, Text } from "../../src/components/index";
import { renderToString } from "../helpers/ink-render";

describe("flex", () => {
    it("grow equally", () => {
        expect.assertions(1);

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
        expect.assertions(1);

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
        expect.assertions(1);

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
        expect.assertions(1);

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

    it("set flex basis with flexDirection=\"row\" container", () => {
        expect.assertions(1);

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

    it("set flex basis in percent with flexDirection=\"row\" container", () => {
        expect.assertions(1);

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

    it("set flex basis with flexDirection=\"column\" container", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box flexDirection="column" height={6}>
                <Box flexBasis={3}>
                    <Text>A</Text>
                </Box>
                <Text>B</Text>
            </Box>,
        );

        expect(output).toBe("A\n\n\nB\n\n");
    });

    it("set flex basis in percent with flexDirection=\"column\" container", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box flexDirection="column" height={6}>
                <Box flexBasis="50%">
                    <Text>A</Text>
                </Box>
                <Text>B</Text>
            </Box>,
        );

        expect(output).toBe("A\n\n\nB\n\n");
    });
});
