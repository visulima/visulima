import { clearScreenAndHomeCursor } from "@visulima/ansi";
import { describe, expect, it } from "vitest";

import { Box, Text } from "../../src/components/index";
import { render } from "../../src/ink/index";
import createStdout from "../helpers/ink-create-stdout";
import waitFor from "../helpers/wait-for";

/**
 * Regression coverage for vadimdemedes/ink#974.
 *
 * On a full-clear frame the renderer wrote the live region as `output` (no
 * trailing newline) but told `log.sync()` it had written `outputToRender`
 * (which appends one in non-fullscreen mode). `sync` derives `previousLineCount`
 * from that string, so the log believed the live region was one line taller than
 * it was, and the next frame's `log.clear()` erased one row too many — eating the
 * bottom line of the `&lt;Static>` block sitting above it.
 *
 * Only non-fullscreen full-clear frames are affected: when the frame fills the
 * viewport `outputToRender === output`, so there is no discrepancy.
 */
const ROWS = 6;

const Frame = ({ height, label }: { readonly height: number; readonly label: string }) => (
    <Box flexDirection="column" height={height}>
        <Text>{label}</Text>
    </Box>
);

describe("full clear + static accounting (ink#974)", () => {
    it("writes the same live region it reports to the log on a full-clear frame", async () => {
        expect.assertions(2);

        const stdout = createStdout(20, true, ROWS);

        // Start fullscreen so that shrinking below the viewport triggers the
        // `isLeavingFullscreen` full-clear path.
        const { rerender, unmount } = render(<Frame height={ROWS} label="first" />, { interactive: true, stdout });

        await waitFor(() => stdout.getWrites().join("").includes("first"));

        const before = stdout.getWrites().length;

        rerender(<Frame height={1} label="second" />);

        await waitFor(() => stdout.getWrites().join("").includes("second"));

        const clearWrite = stdout
            .getWrites()
            .slice(before)
            .find((write) => write.includes(clearScreenAndHomeCursor));

        expect(clearWrite).toBeDefined();

        // The payload must end with the trailing newline that log.sync() counts.
        // Without it the log over-counts the live region by one line and the next
        // clear() eats the row above.
        expect(clearWrite?.endsWith("\n")).toBe(true);

        unmount();
    });
});
