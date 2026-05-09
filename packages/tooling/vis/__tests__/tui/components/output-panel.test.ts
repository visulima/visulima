import { describe, expect, it } from "vitest";

import { deriveBottomTitle } from "../../../src/tui/components/output-panel";

describe("deriveBottomTitle", () => {
    const baseInput = {
        autoScroll: true,
        focused: true,
        interactiveMode: false,
        showFullscreenHint: false,
        statusValue: "running" as const,
        supportsInteractive: true,
        taskId: "web:serve",
    };

    it("returns undefined when no task is selected", () => {
        expect.assertions(1);

        expect(deriveBottomTitle({ ...baseInput, taskId: null })).toBeUndefined();
    });

    it("hides scroll/input hints while interactive mode is active", () => {
        expect.assertions(1);

        expect(deriveBottomTitle({ ...baseInput, interactiveMode: true })).toBe("Esc cancel | Enter send");
    });

    it("includes f FOLLOW when focused on a running task", () => {
        expect.assertions(1);

        const title = deriveBottomTitle(baseInput);

        expect(title).toMatch(/f FOLLOW/);
    });

    it("appends PAUSED (f resume) when auto-scroll is off", () => {
        expect.assertions(2);

        const title = deriveBottomTitle({ ...baseInput, autoScroll: false });

        expect(title).toMatch(/PAUSED \(f resume\)/);
        // The unfocused-but-paused branch still surfaces the hint so the
        // user sees *why* the stream looks stalled even when not focused.
        expect(deriveBottomTitle({ ...baseInput, autoScroll: false, focused: false, statusValue: "success" })).toBe("<tab> or <enter> to focus");
    });

    it("omits i INPUT when supportsInteractive is false (service log views)", () => {
        expect.assertions(2);

        const title = deriveBottomTitle({ ...baseInput, supportsInteractive: false });

        expect(title).not.toMatch(/i INPUT/);
        expect(title).toMatch(/f FOLLOW/);
    });

    it("includes ⏎ FULLSCREEN when showFullscreenHint is true on running tasks", () => {
        expect.assertions(1);

        const title = deriveBottomTitle({ ...baseInput, showFullscreenHint: true });

        expect(title).toMatch(/⏎ FULLSCREEN/);
    });

    it("falls back to the focus prompt when blurred and not paused", () => {
        expect.assertions(1);

        expect(deriveBottomTitle({ ...baseInput, focused: false })).toBe("<tab> or <enter> to focus");
    });

    it("collapses to undefined when focused-running has nothing to surface (paused off, no fullscreen)", () => {
        expect.assertions(1);

        // Non-running status, focused, no fullscreen hint, auto-scroll on:
        // there's nothing meaningful to display — undefined keeps the
        // border tight rather than showing an empty bar.
        expect(deriveBottomTitle({ ...baseInput, statusValue: "success" })).toBeUndefined();
    });

    it("only shows PAUSED on a focused non-running pane", () => {
        expect.assertions(2);

        // Focused, success status, auto-scroll off → PAUSED is meaningful
        // (the user can press f to resume — nothing else to say here).
        expect(deriveBottomTitle({ ...baseInput, autoScroll: false, statusValue: "success" })).toBe("  PAUSED (f resume)");
        // Same scenario but auto-scroll on → no hint at all.
        expect(deriveBottomTitle({ ...baseInput, statusValue: "success" })).toBeUndefined();
    });
});
