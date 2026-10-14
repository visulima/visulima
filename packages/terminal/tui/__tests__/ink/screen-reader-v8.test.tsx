import { describe, expect, it } from "vitest";

import { Text, Transform } from "../../src/components/index";
import type createStdout from "../helpers/ink-create-stdout";
import { renderToString } from "../helpers/ink-render";

const CURSOR_HIDE = "\u001B[?25l";
const CSI_PATTERN = new RegExp(String.raw`(${String.fromCodePoint(0x1b)}\[[0-9;?]*[a-z])`, "i");

/**
 * Replays the bytes written to a terminal into the visible lines they leave behind. Only the
 * sequences the screen-reader renderer emits are modelled: erase-line (`ESC[2K`), cursor-up
 * (`ESC[1A`), cursor-left (`ESC[G`) and newlines. Everything else (sync markers, cursor
 * visibility) is ignored.
 */
const visibleLines = (writes: string[]): string[] => {
    const lines: string[] = [""];
    let row = 0;

    for (const token of writes.join("").split(CSI_PATTERN)) {
        if (token === "\u001B[2K") {
            lines[row] = "";
        } else if (token === "\u001B[1A") {
            row = Math.max(0, row - 1);
        } else if (token.startsWith("\u001B[")) {
            // Cursor-left and synchronized-output markers do not change the visible text.
        } else {
            for (const character of token) {
                if (character === "\n") {
                    row += 1;
                    lines[row] ??= "";
                } else if (character !== "\r") {
                    lines[row] = (lines[row] ?? "") + character;
                }
            }
        }
    }

    return lines.map((line) => line.trimEnd()).filter(Boolean);
};

const contentWrites = (stdout: ReturnType<typeof createStdout>): string[] => stdout.getWrites().filter((write) => write.length > 0);

describe("screen-reader output (upstream parity)", () => {
    it("omits nested Text styling from screen-reader output", () => {
        expect.hasAssertions();

        const element = (
            <Text>
                Status:
{" "}
<Text color="green">Ready</Text>
            </Text>
        );

        expect(renderToString(element, { isScreenReaderEnabled: true })).toBe("Status: Ready");
    });

    it("preserves nested Transform accessibility labels for screen readers", () => {
        expect.hasAssertions();

        const element = (
            <Text>
                Status:
{" "}
                <Transform accessibilityLabel="Ready" transform={(text) => "*".repeat(text.length)}>
                    <Text>ready</Text>
                </Transform>
            </Text>
        );

        expect(renderToString(element, { isScreenReaderEnabled: true })).toBe("Status: Ready");
        expect(renderToString(element)).toBe("Status: *****");
    });

    it("honors empty Transform accessibility labels for screen readers", () => {
        expect.hasAssertions();

        const element = (
            <Text>
                <Transform accessibilityLabel="" transform={(text) => text.toUpperCase()}>
                    <Text>decorative</Text>
                </Transform>
                Ready
            </Text>
        );

        expect(renderToString(element, { isScreenReaderEnabled: true })).toBe("Ready");
        expect(renderToString(element)).toBe("DECORATIVEReady");
    });

    it("renders an accessibilityLabel-only Transform for screen readers", () => {
        expect.hasAssertions();

        const element = <Transform accessibilityLabel="Screen-reader only" transform={(text) => text.toUpperCase()} />;

        expect(renderToString(element, { isScreenReaderEnabled: true })).toBe("Screen-reader only");
        expect(renderToString(element)).toBe("");
    });
});
