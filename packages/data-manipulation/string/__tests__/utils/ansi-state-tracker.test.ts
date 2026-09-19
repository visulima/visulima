import { describe, expect, it } from "vitest";

import AnsiStateTracker from "../../src/utils/ansi-state-tracker";

const ESC = "";
const RED = `${ESC}[31m`;
const GREEN_BG = `${ESC}[42m`;
const BOLD = `${ESC}[1m`;
const ITALIC = `${ESC}[3m`;
const UNDERLINE = `${ESC}[4m`;

describe(AnsiStateTracker, () => {
    it("returns empty escape strings before any sequence is processed", () => {
        expect.assertions(2);

        const tracker = new AnsiStateTracker();

        expect(tracker.getStartEscapesForAllActiveAttributes()).toBe("");
        expect(tracker.getEndEscapesForAllActiveAttributes()).toBe("");
    });

    it("ignores non-SGR sequences (no numeric code match)", () => {
        expect.assertions(1);

        const tracker = new AnsiStateTracker();

        tracker.processEscape("not-an-escape");

        expect(tracker.getStartEscapesForAllActiveAttributes()).toBe("");
    });

    it("tracks foreground, background, and a single formatting attribute together", () => {
        expect.assertions(2);

        const tracker = new AnsiStateTracker();

        tracker.processEscape(RED);
        tracker.processEscape(GREEN_BG);
        tracker.processEscape(BOLD);

        // Start escapes: background, then foreground, then formatting
        expect(tracker.getStartEscapesForAllActiveAttributes()).toBe(`${GREEN_BG}${RED}${BOLD}`);
        // End escapes: formatting resets (reverse order), then foreground reset, then background reset
        expect(tracker.getEndEscapesForAllActiveAttributes()).toBe(`${ESC}[22m${ESC}[39m${ESC}[49m`);
    });

    it("emits reverse-order resets for multiple stacked formatting attributes", () => {
        expect.assertions(1);

        const tracker = new AnsiStateTracker();

        tracker.processEscape(BOLD);
        tracker.processEscape(ITALIC);
        tracker.processEscape(UNDERLINE);

        // Reverse order: underline (24), italic (23), bold (22)
        expect(tracker.getEndEscapesForAllActiveAttributes()).toBe(`${ESC}[24m${ESC}[23m${ESC}[22m`);
    });

    it("clears specific formatting when its reset SGR is processed", () => {
        expect.assertions(1);

        const tracker = new AnsiStateTracker();

        tracker.processEscape(BOLD);
        tracker.processEscape(ITALIC);
        // Reset italic only (code 23)
        tracker.processEscape(`${ESC}[23m`);

        expect(tracker.getEndEscapesForAllActiveAttributes()).toBe(`${ESC}[22m`);
    });

    it("clears foreground or background when 39/49 is processed", () => {
        expect.assertions(2);

        const tracker = new AnsiStateTracker();

        tracker.processEscape(RED);
        tracker.processEscape(GREEN_BG);
        tracker.processEscape(`${ESC}[39m`);

        expect(tracker.getEndEscapesForAllActiveAttributes()).toBe(`${ESC}[49m`);

        tracker.processEscape(`${ESC}[49m`);

        expect(tracker.getEndEscapesForAllActiveAttributes()).toBe("");
    });

    it("fully resets on a 0 reset code", () => {
        expect.assertions(2);

        const tracker = new AnsiStateTracker();

        tracker.processEscape(RED);
        tracker.processEscape(BOLD);
        tracker.processEscape(GREEN_BG);
        tracker.processEscape(`${ESC}[0m`);

        expect(tracker.getStartEscapesForAllActiveAttributes()).toBe("");
        expect(tracker.getEndEscapesForAllActiveAttributes()).toBe("");
    });

    it("handles bright color ranges (90-97 and 100-107)", () => {
        expect.assertions(1);

        const tracker = new AnsiStateTracker();

        tracker.processEscape(`${ESC}[91m`); // bright red foreground
        tracker.processEscape(`${ESC}[101m`); // bright red background

        expect(tracker.getEndEscapesForAllActiveAttributes()).toBe(`${ESC}[39m${ESC}[49m`);
    });

    it("tracks a compound sequence as separate attributes", () => {
        expect.assertions(2);

        const tracker = new AnsiStateTracker();

        // chalk and friends collapse styles into one sequence; a single-parameter pattern sees
        // nothing here and drops the styling entirely.
        tracker.processEscape(`${ESC}[1;31m`);

        expect(tracker.getStartEscapesForAllActiveAttributes()).toBe(`${ESC}[31m${ESC}[1m`);
        expect(tracker.getEndEscapesForAllActiveAttributes()).toBe(`${ESC}[22m${ESC}[39m`);
    });

    it("tracks 256-colour foreground and background", () => {
        expect.assertions(2);

        const tracker = new AnsiStateTracker();

        tracker.processEscape(`${ESC}[38;5;196m`);
        tracker.processEscape(`${ESC}[48;5;21m`);

        expect(tracker.getStartEscapesForAllActiveAttributes()).toBe(`${ESC}[48;5;21m${ESC}[38;5;196m`);
        expect(tracker.getEndEscapesForAllActiveAttributes()).toBe(`${ESC}[39m${ESC}[49m`);
    });

    it("tracks truecolour foreground without mistaking its parameters for attributes", () => {
        expect.assertions(2);

        const tracker = new AnsiStateTracker();

        // Splitting on ";" alone would read 2, 255, 0 and 0 as four separate attributes.
        tracker.processEscape(`${ESC}[38;2;255;0;0m`);

        expect(tracker.getStartEscapesForAllActiveAttributes()).toBe(`${ESC}[38;2;255;0;0m`);
        expect(tracker.getEndEscapesForAllActiveAttributes()).toBe(`${ESC}[39m`);
    });

    it("tracks a truecolour run mixed with attributes in one sequence", () => {
        expect.assertions(1);

        const tracker = new AnsiStateTracker();

        tracker.processEscape(`${ESC}[1;38;2;10;20;30;48;5;9;4m`);

        expect(tracker.getStartEscapesForAllActiveAttributes()).toBe(`${ESC}[48;5;9m${ESC}[38;2;10;20;30m${ESC}[1m${ESC}[4m`);
    });

    it("accepts the sub-parameter colour spelling", () => {
        expect.assertions(1);

        const tracker = new AnsiStateTracker();

        tracker.processEscape(`${ESC}[38:2::10:20:30m`);

        expect(tracker.getStartEscapesForAllActiveAttributes()).toBe(`${ESC}[38:2::10:20:30m`);
    });

    it("replaces rather than stacks a repeated attribute", () => {
        expect.assertions(2);

        const tracker = new AnsiStateTracker();

        tracker.processEscape(BOLD);
        tracker.processEscape(BOLD);

        expect(tracker.getStartEscapesForAllActiveAttributes()).toBe(BOLD);
        // One 22 closes bold once — a duplicate would leave a stray reset behind.
        expect(tracker.getEndEscapesForAllActiveAttributes()).toBe(`${ESC}[22m`);
    });

    it("clears bold and dim with the single reset they share", () => {
        expect.assertions(1);

        const tracker = new AnsiStateTracker();

        tracker.processEscape(BOLD);
        tracker.processEscape(`${ESC}[2m`);
        tracker.processEscape(`${ESC}[22m`);

        expect(tracker.getStartEscapesForAllActiveAttributes()).toBe("");
    });

    it("ignores a non-SGR CSI sequence", () => {
        expect.assertions(1);

        const tracker = new AnsiStateTracker();

        tracker.processEscape(RED);
        tracker.processEscape(`${ESC}[1D`);

        expect(tracker.getStartEscapesForAllActiveAttributes()).toBe(RED);
    });

    it("treats an empty parameter list as a full reset", () => {
        expect.assertions(1);

        const tracker = new AnsiStateTracker();

        tracker.processEscape(RED);
        // ECMA-48: an omitted parameter defaults to 0.
        tracker.processEscape(`${ESC}[m`);

        expect(tracker.getStartEscapesForAllActiveAttributes()).toBe("");
    });

    it("tracks the underline colour separately from the foreground", () => {
        expect.assertions(2);

        const tracker = new AnsiStateTracker();

        tracker.processEscape(RED);
        tracker.processEscape(`${ESC}[58;5;42m`);

        expect(tracker.getStartEscapesForAllActiveAttributes()).toBe(`${ESC}[31m${ESC}[58;5;42m`);
        expect(tracker.getEndEscapesForAllActiveAttributes()).toBe(`${ESC}[59m${ESC}[39m`);
    });

    it("reads the mixed `38;2:r:g:b` spelling as one colour", () => {
        expect.assertions(2);

        const tracker = new AnsiStateTracker();

        // The selector arrives inside the colon token, so nothing after `38` is a separate
        // attribute. Consuming none of it stored a bare `CSI 38 m` and read the leading 2 as dim.
        tracker.processEscape(`${ESC}[38;2:255:0:0m`);

        expect(tracker.getStartEscapesForAllActiveAttributes()).toBe(`${ESC}[38;2:255:0:0m`);
        expect(tracker.getEndEscapesForAllActiveAttributes()).toBe(`${ESC}[39m`);
    });

    it("ignores a bare extended-colour introducer", () => {
        expect.assertions(1);

        const tracker = new AnsiStateTracker();

        // `CSI 38 m` names no colour; reopening it on the next line writes a malformed sequence.
        tracker.processEscape(`${ESC}[38m`);

        expect(tracker.getStartEscapesForAllActiveAttributes()).toBe("");
    });
});
