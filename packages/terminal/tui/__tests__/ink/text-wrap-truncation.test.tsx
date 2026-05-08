import { describe, expect, it } from "vitest";

import { Box, Text } from "../../src/components/index";
import { renderToString } from "../helpers/ink-render";

describe("text wrap truncation", () => {
    it("nested Text: wrapped lines are not truncated after per-line child offset", () => {
        expect.assertions(1);

        const chunk = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        const message = chunk.repeat(3);
        const output = renderToString(
            <Box flexDirection="row">
                <Box width={1}>
                    <Text>#</Text>
                </Box>
                <Box flexDirection="column">
                    <Text wrap="wrap">{message}</Text>
                </Box>
            </Box>,
            { columns: 20 },
        );

        expect(
            output.replaceAll(/\s/g, "").slice(1), // Remove the leading '#' character
            "every character of the message must appear in the output without truncation",
        ).toBe(message);
    });
});
