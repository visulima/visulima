/**
 * Terminal-scrollback overflow (`overflowToBackbuffer`).
 *
 * When a scrollable box has `overflowToBackbuffer` enabled in inline /
 * non-alternate-screen mode, lines that scroll off the TOP of the box are
 * flushed into the terminal's real scrollback history (emitted above the live
 * region) instead of being clipped and discarded. These tests assert the
 * scrolled-off slice is emitted exactly once, never re-emitted on scroll-up,
 * bounded by `maxScrollbackLength`, and is a no-op in alternate-screen mode.
 */
import { strip as stripAnsi } from "@visulima/ansi";
import { describe, expect, it } from "vitest";

import { Box, Text } from "../../src/components/index";
import { render } from "../../src/ink/index";
import type { FakeStdout } from "../helpers/ink-create-stdout";
import createStdout from "../helpers/ink-create-stdout";
import waitFor from "../helpers/wait-for";

// Zero-padded so no token is a substring of another (ROW0001 ⊄ ROW0010).
const ROWS = Array.from({ length: 40 }, (_, index) => `ROW${String(index).padStart(4, "0")}`);
const CONTENT = ROWS.join("\n");

const occurrences = (stdout: FakeStdout, token: string): number => {
    const haystack = stripAnsi(stdout.getWrites().join(""));

    return haystack.split(token).length - 1;
};

type AppProperties = { alternateScreen?: boolean; maxScrollbackLength?: number; scrollTop: number };

const ScrollApp = ({ maxScrollbackLength, scrollTop }: AppProperties) => (
    <Box flexDirection="column" height={5} maxScrollbackLength={maxScrollbackLength} overflowToBackbuffer overflowY="scroll" scrollTop={scrollTop} stableScrollback width={20}>
        <Box flexDirection="column" flexShrink={0}>
            <Text>{CONTENT}</Text>
        </Box>
    </Box>
);

describe("overflowToBackbuffer", () => {
    it("emits scrolled-off lines into scrollback exactly once, above the live frame", async () => {
        expect.assertions(4);

        // Start already scrolled so ROW0000–ROW0004 are NEVER inside a visible
        // window — their only possible source of output is the backbuffer.
        const stdout = createStdout();
        const { rerender, unmount } = render(<ScrollApp scrollTop={5} />, { interactive: true, stdout });

        await waitFor(() => occurrences(stdout, "ROW0000") >= 1);

        rerender(<ScrollApp scrollTop={8} />);
        await waitFor(() => occurrences(stdout, "ROW0007") >= 1);

        // First frame flushed rows [0,5); the rerender flushed [5,8). None of
        // these rows are in any visible window, so each appears exactly once.
        expect(occurrences(stdout, "ROW0000")).toBe(1);
        expect(occurrences(stdout, "ROW0004")).toBe(1);
        expect(occurrences(stdout, "ROW0007")).toBe(1);
        // The final live frame must not contain a scrolled-off line.
        expect(stripAnsi(stdout.getWrites().at(-1) ?? "")).not.toContain("ROW0000");

        unmount();
    });

    it("is a no-op in alternate-screen mode (no scrollback to write to)", async () => {
        expect.assertions(1);

        const stdout = createStdout();
        const { unmount } = render(<ScrollApp scrollTop={5} />, { alternateScreen: true, interactive: true, stdout });

        await waitFor(() => stripAnsi(stdout.getWrites().join("")).includes("ROW0006"));

        // ROW0000 scrolled off the top: clipped and discarded, never emitted.
        expect(occurrences(stdout, "ROW0000")).toBe(0);

        unmount();
    });

    it("does not re-emit when scrolling back up (monotonic)", async () => {
        expect.assertions(1);

        const stdout = createStdout();
        const { rerender, unmount } = render(<ScrollApp scrollTop={6} />, { interactive: true, stdout });

        await waitFor(() => occurrences(stdout, "ROW0000") >= 1);

        // Scroll back up and let a frame render. The monotonic guard must
        // prevent a second flush of the already-pushed rows.
        const writesBefore = stdout.getWrites().length;

        rerender(<ScrollApp scrollTop={2} />);
        await waitFor(() => stdout.getWrites().length > writesBefore);

        expect(occurrences(stdout, "ROW0000")).toBe(1);

        unmount();
    });

    it("bounds a single-frame burst to maxScrollbackLength rows on a large jump", async () => {
        expect.assertions(3);

        const stdout = createStdout();
        const { unmount } = render(<ScrollApp maxScrollbackLength={3} scrollTop={30} />, { interactive: true, stdout });

        await waitFor(() => occurrences(stdout, "ROW0029") >= 1);

        // start = max(0, 30 - 3) = 27 ⇒ only ROW0027–ROW0029 flushed.
        expect(occurrences(stdout, "ROW0029")).toBe(1);
        expect(occurrences(stdout, "ROW0000")).toBe(0);
        expect(occurrences(stdout, "ROW0010")).toBe(0);

        unmount();
    });

    it("emits the full slice for a bordered + padded box (no inset clipping)", async () => {
        expect.assertions(4);

        // height 7, round border (1) + padding 1 ⇒ clientHeight 5. paddingTop
        // pushes content down, so at scrollTop=10 the first *visible* content
        // row is ROW0009 and only [0,9) have truly scrolled off. Two bugs this
        // guards: (a) pre-inset-fix the slice was shifted by borderTop+
        // paddingTop and the height-bounded Output dropped the last content
        // lines; (b) flushing through scrollTop (not scrollTop-paddingTop)
        // duplicated the topmost visible line (ROW0009) into history.
        const stdout = createStdout();
        const { unmount } = render(
            <Box borderStyle="round" flexDirection="column" height={7} overflowToBackbuffer overflowY="scroll" padding={1} scrollTop={10} stableScrollback width={20}>
                <Box flexDirection="column" flexShrink={0}>
                    <Text>{CONTENT}</Text>
                </Box>
            </Box>,
            { interactive: true, stdout },
        );

        await waitFor(() => occurrences(stdout, "ROW0008") >= 1);

        // [0,9) scrolled off → flushed exactly once (incl. ROW0008, which the
        // pre-inset-fix Output clipped). ROW0009 is the first visible row: it
        // appears once via the live frame and must NOT be duplicated into the
        // backbuffer. ROW0020 has not scrolled off at all.
        expect(occurrences(stdout, "ROW0000")).toBe(1);
        expect(occurrences(stdout, "ROW0008")).toBe(1);
        expect(occurrences(stdout, "ROW0009")).toBe(1);
        expect(occurrences(stdout, "ROW0020")).toBe(0);

        unmount();
    });

    it("is a no-op in debug mode (full grid is re-dumped, slice never written)", async () => {
        expect.assertions(1);

        const stdout = createStdout();
        const { unmount } = render(<ScrollApp scrollTop={5} />, { debug: true, interactive: true, stdout });

        await waitFor(() => stripAnsi(stdout.getWrites().join("")).includes("ROW0006"));

        // Debug dumps the clipped grid (window [5,10)); the backbuffer path is
        // gated off, so a scrolled-off line is never emitted.
        expect(occurrences(stdout, "ROW0000")).toBe(0);

        unmount();
    });
});
