import { describe, expect, it } from "vitest";

import { formatChangeFile, parseChangeFile } from "../../../src/release/core/change-file";

/**
 * Coverage for the two changeset/release-please features that landed
 * together:
 *
 *   - Empty change files (changesets-style `--empty` for docs-only
 *     PRs satisfying a "at least one change file" CI gate)
 *   - `releaseAs: &lt;version>` in nested frontmatter (release-please-style
 *     manual version pin)
 */

describe("change-file: empty frontmatter", () => {
    it("parses a fully-empty frontmatter as an empty-bumps payload", () => {
        const file = parseChangeFile("---\n{}\n---\nbody\n", "/repo/.vis/release/x.md");

        expect(file.payload).toEqual({ bumps: {} });
        expect(file.body).toBe("body");
    });

    it("parses a literal-null frontmatter as an empty-bumps payload", () => {
        // Authored as `---\n\n---` (only whitespace between delimiters).
        // YAML parses this as null; the reader must coerce to {}.
        const file = parseChangeFile("---\n\n---\nbody\n", "/repo/.vis/release/x.md");

        expect(file.payload).toEqual({ bumps: {} });
    });

    it("round-trips via formatChangeFile → parseChangeFile with no bumps", () => {
        const serialised = formatChangeFile({ bumps: {} }, "body");

        // Must contain explicit `{}` so the YAML parser produces an
        // object, not null.
        expect(serialised).toContain("{}");

        const parsed = parseChangeFile(serialised, "/x.md");

        expect(parsed.payload).toEqual({ bumps: {} });
    });
});

describe("change-file: releaseAs override (nested frontmatter)", () => {
    it("parses a valid semver string in releaseAs", () => {
        const file = parseChangeFile(
            "---\n\"@scope/pkg\":\n  bump: minor\n  releaseAs: 2.0.0\n---\nbody\n",
            "/x.md",
        );

        if (!("releaseAs" in file.payload)) {
            throw new Error("expected nested payload with releaseAs");
        }

        expect(file.payload.releaseAs).toBe("2.0.0");
        expect(file.payload.bump).toBe("minor");
    });

    it("accepts semver with prerelease + build metadata", () => {
        const file = parseChangeFile(
            "---\n\"@scope/pkg\":\n  bump: patch\n  releaseAs: 2.0.0-rc.1\n---\nbody\n",
            "/x.md",
        );

        if (!("releaseAs" in file.payload)) {
            throw new Error("expected nested payload");
        }

        expect(file.payload.releaseAs).toBe("2.0.0-rc.1");
    });

    it("rejects non-semver strings with BUMP_FILE_INVALID", () => {
        expect(() =>
            parseChangeFile(
                "---\n\"@scope/pkg\":\n  bump: minor\n  releaseAs: not-a-version\n---\nbody\n",
                "/x.md",
            ),
        ).toThrow(/Invalid releaseAs/);
    });

    it("rejects non-string releaseAs values", () => {
        expect(() =>
            parseChangeFile(
                "---\n\"@scope/pkg\":\n  bump: minor\n  releaseAs: 200\n---\nbody\n",
                "/x.md",
            ),
        ).toThrow(/Invalid releaseAs/);
    });

    it("round-trips via formatChangeFile → parseChangeFile with releaseAs", () => {
        const serialised = formatChangeFile(
            { bump: "minor", package: "@scope/pkg", releaseAs: "2.0.0" },
            "body",
        );

        expect(serialised).toContain("releaseAs: 2.0.0");

        const parsed = parseChangeFile(serialised, "/x.md");

        if (!("releaseAs" in parsed.payload)) {
            throw new Error("expected nested payload");
        }

        expect(parsed.payload.releaseAs).toBe("2.0.0");
    });
});
