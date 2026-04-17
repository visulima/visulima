import { describe, expect, it, vi } from "vitest";

import { render, Text } from "../../src/ink/index";
import createStdout from "../helpers/ink-create-stdout";
import waitFor from "../helpers/wait-for";

const ALT_SCREEN_ON = "\u001B[?1049h";
const ALT_SCREEN_OFF = "\u001B[?1049l";
const CURSOR_SHOW = "\u001B[?25h";

describe("alternate screen", () => {
    it("should enter alternate screen on render when alternateScreen is true", () => {
        expect.assertions(1);

        const stdout = createStdout();

        const { unmount } = render(<Text>Hello</Text>, {
            alternateScreen: true,
            interactive: true,
            stdout,
        });

        const writes = stdout.getWrites();

        expect(writes.some((w) => w.includes(ALT_SCREEN_ON))).toBe(true);

        unmount();
    });

    it("should leave alternate screen on unmount", async () => {
        expect.assertions(2);

        const stdout = createStdout();

        const { unmount } = render(<Text>Hello</Text>, {
            alternateScreen: true,
            interactive: true,
            stdout,
        });

        unmount();

        // Wait for unmount to complete
        await waitFor(() => stdout.getWrites().join("").includes(ALT_SCREEN_OFF));

        const writes = stdout.getWrites();
        const allOutput = writes.join("");

        expect(allOutput).toContain(ALT_SCREEN_OFF);
        expect(allOutput).toContain(CURSOR_SHOW);
    });

    it("should leave alternate screen when exit() is called via unmount", async () => {
        expect.assertions(2);

        const stdout = createStdout();

        const { unmount, waitUntilExit } = render(<Text>Hello</Text>, {
            alternateScreen: true,
            interactive: true,
            stdout,
        });

        // Simulate the exit flow: unmount triggers finishUnmount which writes ALT_SCREEN_OFF
        unmount();

        await waitUntilExit();

        const writes = stdout.getWrites();
        const allOutput = writes.join("");

        expect(allOutput).toContain(ALT_SCREEN_OFF);
        expect(allOutput).toContain(CURSOR_SHOW);
    });

    it("should not write last frame content after leaving alternate screen", async () => {
        expect.assertions(1);

        const stdout = createStdout();

        const { unmount } = render(<Text>Secret Content</Text>, {
            alternateScreen: true,
            interactive: true,
            stdout,
        });

        // Let at least one render happen
        await waitFor(() => stdout.getWrites().some((w) => w.includes("Secret Content")));

        // Clear the writes so we only see unmount-related output
        (stdout.write as ReturnType<typeof vi.fn>).mockClear();

        unmount();

        await waitFor(() => stdout.getWrites().join("").includes(ALT_SCREEN_OFF));

        const writes = stdout.getWrites();
        const postUnmountOutput = writes.join("");

        // After ALT_SCREEN_OFF, there should be no rendered frame content
        const altScreenOffIndex = postUnmountOutput.indexOf(ALT_SCREEN_OFF);

        if (altScreenOffIndex !== -1) {
            const afterAltScreen = postUnmountOutput.slice(altScreenOffIndex + ALT_SCREEN_OFF.length);

            // Only cursor-show and flush barrier should follow, not frame content
            expect(afterAltScreen).not.toContain("Secret Content");
        }
    });

    it("should not render a final frame when in alternate screen mode", async () => {
        expect.assertions(2);

        const stdout = createStdout();
        let renderCount = 0;

        const CountingApp = () => {
            renderCount++;

            return (
                <Text>
                    Render
                    {renderCount}
                </Text>
            );
        };

        const { unmount } = render(<CountingApp />, {
            alternateScreen: true,
            interactive: true,
            stdout,
        });

        await waitFor(() => renderCount >= 1);

        const rendersBefore = renderCount;

        // Clear writes
        (stdout.write as ReturnType<typeof vi.fn>).mockClear();

        unmount();

        await waitFor(() => stdout.getWrites().join("").includes(ALT_SCREEN_OFF));

        // The final frame render should be skipped in alternate screen mode
        // Only ALT_SCREEN_OFF + cursor show should be written, no frame content
        const writes = stdout.getWrites();
        const allOutput = writes.join("");

        expect(allOutput).toContain(ALT_SCREEN_OFF);
        expect(allOutput).not.toContain(`Render ${rendersBefore + 1}`);
    });
});
