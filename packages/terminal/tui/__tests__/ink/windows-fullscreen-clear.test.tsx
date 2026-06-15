import process from "node:process";

import { clearScreenAndHomeCursor, strip as stripAnsi } from "@visulima/ansi";
import { describe, expect, it } from "vitest";

import { Box, Text } from "../../src/components/index";
import { render } from "../../src/ink/index";
import createStdout from "../helpers/ink-create-stdout";
import waitFor from "../helpers/wait-for";

// Spoofing process.platform mirrors ink's own test for vadimdemedes/ink#971:
// Windows consoles scroll immediately on a bottom-right write, so the
// incremental eraseLines redraw drifts one row per frame and leaks stale
// fullscreen frames. On Windows we must fall back to a full clear per frame.
const ROWS = 6;

const Fullscreen = ({ label }: { label: string }) => (
    <Box flexDirection="column" height={ROWS}>
        <Text>{label}</Text>
    </Box>
);

const withPlatform = (platform: NodeJS.Platform, run: () => Promise<void>): Promise<void> => {
    const descriptor = Object.getOwnPropertyDescriptor(process, "platform");

    Object.defineProperty(process, "platform", { configurable: true, value: platform });

    return run().finally(() => {
        if (descriptor) {
            Object.defineProperty(process, "platform", descriptor);
        }
    });
};

describe("windows fullscreen clear (ink#971)", () => {
    it("forces a full clear on every fullscreen redraw on win32", async () => {
        expect.assertions(2);

        await withPlatform("win32", async () => {
            const stdout = createStdout(20, true, ROWS);

            const { rerender } = render(<Fullscreen label="first" />, { interactive: true, stdout });

            await waitFor(() => stripAnsi(stdout.getWrites().join("")).includes("first"));

            const writesBeforeRerender = stdout.getWrites().length;

            rerender(<Fullscreen label="second" />);

            await waitFor(() => stripAnsi(stdout.getWrites().join("")).includes("second"));

            const redrawOutput = stdout
                .getWrites()
                .slice(writesBeforeRerender)
                .join("");

            // The fullscreen redraw must clear the terminal rather than emit an
            // incremental eraseLines diff.
            expect(redrawOutput).toContain(clearScreenAndHomeCursor);
            expect(stripAnsi(redrawOutput)).toContain("second");
        });
    });

    it("uses incremental redraw (no full clear) on non-win32 fullscreen", async () => {
        expect.assertions(2);

        await withPlatform("linux", async () => {
            const stdout = createStdout(20, true, ROWS);

            const { rerender } = render(<Fullscreen label="first" />, { interactive: true, stdout });

            await waitFor(() => stripAnsi(stdout.getWrites().join("")).includes("first"));

            const writesBeforeRerender = stdout.getWrites().length;

            rerender(<Fullscreen label="second" />);

            await waitFor(() => stripAnsi(stdout.getWrites().join("")).includes("second"));

            const redrawOutput = stdout
                .getWrites()
                .slice(writesBeforeRerender)
                .join("");

            // Steady fullscreen redraws on Unix keep the incremental path: no clear.
            expect(redrawOutput).not.toContain(clearScreenAndHomeCursor);
            expect(stripAnsi(redrawOutput)).toContain("second");
        });
    });
});
