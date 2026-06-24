/**
 * Tests for `mergeProtectedContent` — preserves operator edits inside
 * `&lt;!-- vis:user-content -->…&lt;!-- /vis:user-content -->` regions when
 * the version-PR body is regenerated (release-please #877).
 */

import { describe, expect, it } from "vitest";

import { mergeProtectedContent } from "../../../src/release/core/version-pr-merge";
import { VisReleaseError } from "../../../src/release/errors";

describe(mergeProtectedContent, () => {
    it("returns the new body unchanged when there is no existing body", () => {
        expect.hasAssertions();

        const next = "## Pending releases\n\n- pkg: 1.0 -> 1.1";

        expect(mergeProtectedContent(undefined, next)).toBe(next);
    });

    it("returns the new body unchanged when the existing body has no markers", () => {
        expect.hasAssertions();

        const existing = "Plain text I edited — but no markers.";
        const next = "## Pending releases\n\n- pkg: 1.0 -> 1.1";

        expect(mergeProtectedContent(existing, next)).toBe(next);
    });

    it("preserves a single operator-edited block verbatim", () => {
        expect.hasAssertions();

        const existing = [
            "## Pending releases (old)",
            "",
            "<!-- vis:user-content -->",
            "## Notes from the operator",
            "Important context the bot can't autogenerate.",
            "<!-- /vis:user-content -->",
        ].join("\n");

        const next = ["## Pending releases", "", "- pkg: 1.0 -> 1.1"].join("\n");

        const merged = mergeProtectedContent(existing, next);

        expect(merged).toContain("- pkg: 1.0 -> 1.1");
        expect(merged).toContain("<!-- vis:user-content -->");
        expect(merged).toContain("## Notes from the operator");
        expect(merged).toContain("Important context the bot can't autogenerate.");
        expect(merged).toContain("<!-- /vis:user-content -->");
    });

    it("preserves multiple operator-edited blocks in order", () => {
        expect.hasAssertions();

        const existing = [
            "<!-- vis:user-content -->",
            "BLOCK ONE",
            "<!-- /vis:user-content -->",
            "Plain text in the middle.",
            "<!-- vis:user-content -->",
            "BLOCK TWO",
            "<!-- /vis:user-content -->",
        ].join("\n");

        const next = "## Pending releases\n\n- pkg: 1.0 -> 1.1";
        const merged = mergeProtectedContent(existing, next);

        expect(merged).toContain("BLOCK ONE");
        expect(merged).toContain("BLOCK TWO");
        // Order preserved: BLOCK ONE appears before BLOCK TWO in the
        // tail-appended remainder.
        expect(merged.indexOf("BLOCK ONE")).toBeLessThan(merged.indexOf("BLOCK TWO"));
    });

    it("fills empty marker pairs in the new body before appending the rest", () => {
        expect.hasAssertions();

        const existing = ["<!-- vis:user-content -->", "PRESERVED", "<!-- /vis:user-content -->"].join("\n");

        const next = ["## Pending releases", "", "<!-- vis:user-content --><!-- /vis:user-content -->", "", "## Footer"].join("\n");

        const merged = mergeProtectedContent(existing, next);

        // The preserved block landed in the placeholder slot, NOT at
        // the end. We assert by index — the preserved content shows up
        // BEFORE the footer marker.
        expect(merged).toContain("PRESERVED");
        expect(merged.indexOf("PRESERVED")).toBeLessThan(merged.indexOf("## Footer"));
        expect(merged.indexOf("PRESERVED")).toBeGreaterThan(merged.indexOf("## Pending releases"));
    });

    it("rejects nested markers up-front (silent data loss otherwise)", () => {
        expect.hasAssertions();

        const nested = [
            "<!-- vis:user-content -->",
            "outer",
            "<!-- vis:user-content -->",
            "inner",
            "<!-- /vis:user-content -->",
            "<!-- /vis:user-content -->",
        ].join("\n");

        expect(() => mergeProtectedContent(nested, "anything")).toThrow(/nested/i);
    });

    // F7: nested-marker rejection must use the typed VisReleaseError so
    // the CI handler can surface a clean CI-tail diagnostic instead of a
    // bare `Error`. Code is `CONFIG_INVALID` (RFC §19.4).
    it("f7: throws VisReleaseError with CONFIG_INVALID for nested markers", () => {
        expect.hasAssertions();

        const nested = [
            "<!-- vis:user-content -->",
            "outer",
            "<!-- vis:user-content -->",
            "inner",
            "<!-- /vis:user-content -->",
            "<!-- /vis:user-content -->",
        ].join("\n");

        try {
            mergeProtectedContent(nested, "anything");

            expect.fail("expected mergeProtectedContent to throw");
        } catch (error) {
            expect(error).toBeInstanceOf(VisReleaseError);
            expect((error as VisReleaseError).code).toBe("CONFIG_INVALID");
            expect((error as VisReleaseError).hint).toMatch(/Flatten/i);
            expect((error as Error).message).toMatch(/Nested/i);
        }
    });

    // F18: an unclosed open marker would silently lose the operator's
    // partial edit because BLOCK_RE only matches well-formed pairs. We
    // count opens vs closes and refuse to merge when they're unbalanced.
    it("f18: rejects unbalanced markers (more opens than closes)", () => {
        expect.hasAssertions();

        const orphan = [
            "<!-- vis:user-content -->",
            "first block — closed",
            "<!-- /vis:user-content -->",
            "<!-- vis:user-content -->",
            "second block — operator forgot the close tag",
        ].join("\n");

        try {
            mergeProtectedContent(orphan, "## New body");

            expect.fail("expected mergeProtectedContent to throw");
        } catch (error) {
            expect(error).toBeInstanceOf(VisReleaseError);
            expect((error as VisReleaseError).code).toBe("CONFIG_INVALID");
            expect((error as Error).message).toMatch(/unbalanced/i);
            expect((error as Error).message).toMatch(/2 opens, 1 closes/);
        }
    });

    it("f18: rejects unbalanced markers (more closes than opens)", () => {
        expect.hasAssertions();

        const orphan = [
            "<!-- vis:user-content -->",
            "first",
            "<!-- /vis:user-content -->",
            "stray close that was never opened:",
            "<!-- /vis:user-content -->",
        ].join("\n");

        try {
            mergeProtectedContent(orphan, "## New body");

            expect.fail("expected mergeProtectedContent to throw");
        } catch (error) {
            expect(error).toBeInstanceOf(VisReleaseError);
            expect((error as VisReleaseError).code).toBe("CONFIG_INVALID");
            expect((error as Error).message).toMatch(/unbalanced/i);
            expect((error as Error).message).toMatch(/1 opens, 2 closes/);
        }
    });

    // F18 follow-up: marker syntax inside a fenced code block (e.g. a
    // PR description that DOCUMENTS the marker convention) must NOT
    // trip the balance check. The fenced occurrences are documentation,
    // not real markers — strip fences before counting.
    it("f18: ignores marker tokens inside fenced code blocks (``` fence)", () => {
        expect.hasAssertions();

        const documented = [
            "## How protected blocks work",
            "",
            "Wrap your operator notes in:",
            "",
            "```",
            "<!-- vis:user-content -->",
            "your notes here",
            "<!-- /vis:user-content -->",
            "```",
            "",
            "<!-- vis:user-content -->",
            "REAL OPERATOR NOTE",
            "<!-- /vis:user-content -->",
        ].join("\n");

        // Without the fence-strip there are 2 opens / 2 closes on raw
        // text — but if the fenced documentation block ever shifts to
        // an odd marker count (e.g. operator pastes a snippet that
        // only shows the open tag) the balance check would falsely
        // throw. We assert the merger accepts this body AND preserves
        // the REAL operator note.
        const next = "## Pending releases\n\n- pkg: 1.0 -> 1.1";
        const merged = mergeProtectedContent(documented, next);

        expect(merged).toContain("REAL OPERATOR NOTE");
        expect(merged).toContain("- pkg: 1.0 -> 1.1");
    });

    it("f18: ignores marker tokens inside fenced code blocks (~~~ fence)", () => {
        // Operator pasted only the OPEN marker inside a tilde fence as
        // part of a tutorial — raw counts would be 2 opens / 1 close
        // and the pre-strip code would throw. With the strip, the
        // fence is treated as documentation and only the real
        // well-formed pair below counts.
        expect.hasAssertions();

        const documented = [
            "Example of the open marker:",
            "",
            "~~~markdown",
            "<!-- vis:user-content -->",
            "~~~",
            "",
            "<!-- vis:user-content -->",
            "REAL CONTENT",
            "<!-- /vis:user-content -->",
        ].join("\n");

        const merged = mergeProtectedContent(documented, "## New body");

        expect(merged).toContain("REAL CONTENT");
    });

    it("f18: still throws on real unbalanced markers even when fences are present", () => {
        // Fence contains a balanced documentation pair; the body
        // OUTSIDE the fence is genuinely unbalanced (orphan open).
        // The strip must not mask the real imbalance.
        expect.hasAssertions();

        const orphan = [
            "```",
            "<!-- vis:user-content -->",
            "doc snippet",
            "<!-- /vis:user-content -->",
            "```",
            "",
            "<!-- vis:user-content -->",
            "real open with no close",
        ].join("\n");

        expect(() => mergeProtectedContent(orphan, "## New body")).toThrow(/unbalanced/i);
    });
});
