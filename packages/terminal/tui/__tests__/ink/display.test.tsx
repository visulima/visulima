import { describe, expect, it } from "vitest";

import { Box, Text } from "../../src/ink/index.js";
import { renderToString, renderToStringAsync } from "../helpers/ink-render.js";

describe("display", () => {
    it("display flex", () => {
        expect.hasAssertions();

        const output = renderToString(
            <Box display="flex">
                <Text>X</Text>
            </Box>,
        );

        expect(output).toBe("X");
    });

    it("display none", () => {
        expect.hasAssertions();

        const output = renderToString(
            <Box flexDirection="column">
                <Box display="none">
                    <Text>Kitty!</Text>
                </Box>
                <Text>Doggo</Text>
            </Box>,
        );

        expect(output).toBe("Doggo");
    });

    it("display flex - concurrent", async () => {
        expect.hasAssertions();

        const output = await renderToStringAsync(
            <Box display="flex">
                <Text>X</Text>
            </Box>,
        );

        expect(output).toBe("X");
    });

    it("display none - concurrent", async () => {
        expect.hasAssertions();

        const output = await renderToStringAsync(
            <Box flexDirection="column">
                <Box display="none">
                    <Text>Kitty!</Text>
                </Box>
                <Text>Doggo</Text>
            </Box>,
        );

        expect(output).toBe("Doggo");
    });
});
