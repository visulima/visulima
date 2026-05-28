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
});
