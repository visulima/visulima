import { describe, expect, it } from "vitest";

import { Box, Text } from "../../src/components/index";
import { renderToString, renderToStringAsync } from "../helpers/ink-render";

describe("display", () => {
    it("display flex", () => {
        expect.assertions(1);

        const output = renderToString(
            <Box display="flex">
                <Text>X</Text>
            </Box>,
        );

        expect(output).toBe("X");
    });

    it("display none", () => {
        expect.assertions(1);

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
        expect.assertions(1);

        const output = await renderToStringAsync(
            <Box display="flex">
                <Text>X</Text>
            </Box>,
        );

        expect(output).toBe("X");
    });

    it("display none - concurrent", async () => {
        expect.assertions(1);

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
