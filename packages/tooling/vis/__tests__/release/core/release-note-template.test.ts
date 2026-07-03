/**
 * Tests for `expandReleaseNoteTemplate` — single-pass `{token}`
 * interpolation for the per-package `releaseNoteTemplate` header /
 * footer (F20 — defensive rewrite of the sequential `replaceAll` chain
 * currently in orchestrator.ts).
 */

import { describe, expect, it } from "vitest";

import { collectContributors, expandReleaseNoteTemplate } from "../../../src/release/core/release-note-template";

describe(expandReleaseNoteTemplate, () => {
    it("interpolates every supported token in a single pass", () => {
        expect.hasAssertions();

        const template = "Release {name} v{version} on {date} ({repo}) — was {previousVersion}";

        const result = expandReleaseNoteTemplate(template, {
            date: "2026-05-24",
            name: "@scope/pkg",
            previousVersion: "1.0.0",
            repo: "visulima/visulima",
            version: "1.1.0",
        });

        expect(result).toBe("Release @scope/pkg v1.1.0 on 2026-05-24 (visulima/visulima) — was 1.0.0");
    });

    it("renders missing tokens as the empty string (no leftover braces)", () => {
        // Only `name` and `version` supplied — `previousVersion`, `date`,
        // and `repo` should render empty (NOT leave their `{token}` text
        // visible in the output).
        expect.hasAssertions();

        const template = "Release {name} v{version} prev={previousVersion} date={date} repo={repo}";

        const result = expandReleaseNoteTemplate(template, {
            name: "@scope/pkg",
            version: "1.0.0",
        });

        expect(result).toBe("Release @scope/pkg v1.0.0 prev= date= repo=");
    });

    it("returns a template with no tokens unchanged", () => {
        expect.hasAssertions();

        const template = "Just a plain header — no interpolation tokens here.";

        const result = expandReleaseNoteTemplate(template, {
            date: "2026-01-01",
            name: "ignored",
            previousVersion: "0",
            repo: "x/y",
            version: "1",
        });

        expect(result).toBe(template);
    });

    it("returns the empty string for an empty template", () => {
        expect.hasAssertions();
        expect(
            expandReleaseNoteTemplate("", {
                date: "2026-01-01",
                name: "@scope/pkg",
                previousVersion: "1.0.0",
                repo: "visulima/visulima",
                version: "1.1.0",
            }),
        ).toBe("");
    });

    // F20: a malformed brace sequence (open brace, partial token name,
    // no closing brace — e.g. operator typo of `{previousVer`) must NOT
    // be interpolated by the partial match `{version}`. Single-pass
    // regex with full-name alternation guarantees that.
    it("f20: leaves malformed `{previousVer` (no closing brace) untouched", () => {
        expect.hasAssertions();

        const template = "Header {previousVer with {version} inline";

        const result = expandReleaseNoteTemplate(template, {
            previousVersion: "1.0.0",
            version: "1.1.0",
        });

        // `{previousVer` is verbatim — only the full `{version}` token
        // is substituted.
        expect(result).toBe("Header {previousVer with 1.1.0 inline");
    });

    it("f20: leaves unknown tokens (e.g. `{author}`) untouched", () => {
        expect.hasAssertions();

        const template = "Released by {author} as {name} v{version}";

        const result = expandReleaseNoteTemplate(template, {
            name: "@scope/pkg",
            version: "1.0.0",
        });

        expect(result).toBe("Released by {author} as @scope/pkg v1.0.0");
    });

    it("f20: token values containing token-like substrings are NOT re-interpolated", () => {
        // Pathological case the sequential `replaceAll` chain would
        // mis-handle if ordering changed: a name value containing
        // literal `{version}` text. Single-pass replace ignores the
        // already-substituted value.
        expect.hasAssertions();

        const template = "{name} v{version}";

        const result = expandReleaseNoteTemplate(template, {
            name: "evil-{version}-name",
            version: "1.0.0",
        });

        expect(result).toBe("evil-{version}-name v1.0.0");
    });

    it("substitutes the same token multiple times within one template", () => {
        expect.hasAssertions();

        const template = "{name}: {name}@{version} — see https://npm.im/{name}";

        const result = expandReleaseNoteTemplate(template, {
            name: "@scope/pkg",
            version: "1.0.0",
        });

        expect(result).toBe("@scope/pkg: @scope/pkg@1.0.0 — see https://npm.im/@scope/pkg");
    });

    // release-please #292 parity — the new `{contributors}` token.
    it("substitutes the {contributors} token verbatim", () => {
        expect.hasAssertions();

        const template = "## Thanks\n\n{contributors}\n";

        const result = expandReleaseNoteTemplate(template, {
            contributors: "- @alice\n- @bob",
        });

        expect(result).toBe("## Thanks\n\n- @alice\n- @bob\n");
    });

    it("renders {contributors} as empty when not supplied", () => {
        expect.hasAssertions();

        const template = "Header\n{contributors}Footer";

        const result = expandReleaseNoteTemplate(template, {
            name: "@scope/pkg",
            version: "1.0.0",
        });

        expect(result).toBe("Header\nFooter");
    });
});

// ── collectContributors (release-please #292) ───────────────────────

describe(collectContributors, () => {
    it("returns the empty string when no change files declare an author", () => {
        expect.hasAssertions();
        expect(collectContributors([])).toBe("");
        expect(collectContributors([{}, { meta: {} }, { meta: { author: "" } }])).toBe("");
    });

    it("renders a bullet list with one author per line, in input order", () => {
        expect.hasAssertions();

        const result = collectContributors([{ meta: { author: "@alice" } }, { meta: { author: "@bob" } }]);

        expect(result).toBe("- @alice\n- @bob");
    });

    it("de-duplicates authors case-insensitively across multiple change files", () => {
        expect.hasAssertions();

        const result = collectContributors([
            { meta: { author: "@alice" } },
            { meta: { author: "@Alice" } }, // duplicate (case-insensitive)
            { meta: { author: "@bob" } },
            { meta: { author: "@alice" } }, // duplicate
        ]);

        expect(result).toBe("- @alice\n- @bob");
    });

    it("trims surrounding whitespace and ignores blank author fields", () => {
        expect.hasAssertions();

        const result = collectContributors([
            { meta: { author: "  @alice  " } },
            { meta: { author: "   " } }, // blank → skip
            { meta: { author: "@bob" } },
        ]);

        expect(result).toBe("- @alice\n- @bob");
    });

    it("tolerates missing `meta` and missing `author` keys", () => {
        expect.hasAssertions();

        const result = collectContributors([{ meta: { author: "@alice" } }, {}, { meta: {} }, { meta: { author: "@bob" } }]);

        expect(result).toBe("- @alice\n- @bob");
    });

    // Audit V9: comma-separated handles on a single `author:` line.
    it("splits a comma-separated `author:` line into one bullet per handle", () => {
        expect.hasAssertions();

        const result = collectContributors([{ meta: { author: "@alice, @bob,@carol" } }]);

        expect(result).toBe("- @alice\n- @bob\n- @carol");
    });

    // Audit V2: a bare `@` (handle missing) must not render as a stray
    // `- @` bullet.
    it("rejects a bare `@` with no handle attached", () => {
        expect.hasAssertions();

        const result = collectContributors([{ meta: { author: "@" } }, { meta: { author: "@   " } }, { meta: { author: "@alice" } }]);

        expect(result).toBe("- @alice");
    });

    // Audit V5: author handles flow into rendered release notes —
    // escape so a malicious or accidental frontmatter value can't
    // inject HTML / break out of the bullet syntax.
    it("escapes markdown / HTML in author handles (audit V5)", () => {
        expect.hasAssertions();

        const result = collectContributors([
            { meta: { author: "@alice<img src=x>" } },
            { meta: { author: "@bob & friends" } },
            { meta: { author: "@`carol`" } },
        ]);

        expect(result).toBe("- @alice&lt;img src=x&gt;\n- @bob &amp; friends\n- @\\`carol\\`");
    });

    // Audit V2 + dedup across `@`-prefixed and bare forms.
    it("treats `@alice` and `alice` as the same handle for dedup", () => {
        expect.hasAssertions();

        const result = collectContributors([
            { meta: { author: "@alice" } },
            { meta: { author: "alice" } }, // duplicate (bare form)
            { meta: { author: "@Bob" } },
        ]);

        expect(result).toBe("- @alice\n- @Bob");
    });

    // Audit S-1: internalAuthors filter mirrors the github-formatter
    // option so {contributors} and CHANGELOG.md agree on which bots
    // to hide.
    it("suppresses handles listed in `internalAuthors` (case-insensitive, with or without `@`)", () => {
        expect.hasAssertions();

        const result = collectContributors(
            [{ meta: { author: "@alice" } }, { meta: { author: "@renovate[bot]" } }, { meta: { author: "@DependaBot" } }, { meta: { author: "@bob" } }],
            { internalAuthors: ["renovate[bot]", "@dependabot"] },
        );

        expect(result).toBe("- @alice\n- @bob");
    });
});
