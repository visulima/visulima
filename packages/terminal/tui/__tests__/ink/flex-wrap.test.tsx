import { describe, expect, it } from "vitest";

import { Box, Text } from "../../src/components/index";
import { renderToString } from "../helpers/ink-render";

describe("flex-wrap", () => {
    it("row - no wrap", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box width={2}>
                <Text>A</Text>
                <Text>BC</Text>
            </Box>,
        );

        expect(output).toBe("BC\n");
    });

    it("column - no wrap", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box flexDirection="column" height={2}>
                <Text>A</Text>
                <Text>B</Text>
                <Text>C</Text>
            </Box>,
        );

        expect(output).toBe("B\nC");
    });

    it("row - wrap content", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box flexWrap="wrap" width={2}>
                <Text>A</Text>
                <Text>BC</Text>
            </Box>,
        );

        expect(output).toBe("A\nBC");
    });

    it("column - wrap content", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box flexDirection="column" flexWrap="wrap" height={2}>
                <Text>A</Text>
                <Text>B</Text>
                <Text>C</Text>
            </Box>,
        );

        expect(output).toBe("AC\nB");
    });

    it("column - wrap content reverse", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box flexDirection="column" flexWrap="wrap-reverse" height={2} width={3}>
                <Text>A</Text>
                <Text>B</Text>
                <Text>C</Text>
            </Box>,
        );

        expect(output).toBe(" CA\n  B");
    });

    it("row - wrap content reverse", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box flexWrap="wrap-reverse" height={3} width={2}>
                <Text>A</Text>
                <Text>B</Text>
                <Text>C</Text>
            </Box>,
        );

        expect(output).toBe("\nC\nAB");
    });
});
