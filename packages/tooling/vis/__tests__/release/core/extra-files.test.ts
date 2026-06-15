import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { applyExtraFilesForRelease, compileRule } from "../../../src/release/core/extra-files";
import { VisReleaseError } from "../../../src/release/errors";

/**
 * Coverage for the extra-files applier — the feature that lets users
 * bump version strings in non-package.json files (README badges,
 * version constants, Cargo.toml, etc.) alongside the regular package
 * version bump.
 */

describe("extra-files: compileRule", () => {
    it("compiles a valid pattern with default `g` flag", () => {
        const re = compileRule({ path: "x", search: String.raw`v\d+\.\d+\.\d+` }, "test");

        expect(re.flags).toBe("g");
        expect([..."v1.2.3 v4.5.6".matchAll(re)]).toHaveLength(2);
    });

    it("honours explicit flags", () => {
        const re = compileRule({ flags: "gmi", path: "x", search: "version" }, "test");

        // RegExp.prototype.flags always reports flags in canonical order
        // (d, g, i, m, s, u, v, y), so "gmi" normalises to "gim".
        expect(re.flags).toBe("gim");
    });

    it("throws CONFIG_INVALID on syntactically invalid regex", () => {
        expect(() => compileRule({ path: "x", search: "(unbalanced" }, "test")).toThrow(VisReleaseError);
    });
});

describe("extra-files: applyExtraFilesForRelease", () => {
    let cwd: string;

    beforeEach(async () => {
        cwd = await mkdtemp(join(tmpdir(), "vis-extra-files-"));
        await mkdir(join(cwd, "packages", "a"), { recursive: true });
    });

    afterEach(async () => {
        await rm(cwd, { force: true, recursive: true });
    });

    it("substitutes the bare match when no `replace` template is given", async () => {
        await writeFile(join(cwd, "README.md"), "Stable release: v1.0.0 (was v0.9.0).\n");

        const result = await applyExtraFilesForRelease(
            cwd,
            join(cwd, "packages", "a"),
            "1.1.0",
            "@scope/a",
            [{ path: "README.md", search: String.raw`v\d+\.\d+\.\d+` }],
            [],
        );

        expect(result.writes).toHaveLength(1);
        expect(result.writes[0]!.content).toBe("Stable release: 1.1.0 (was 1.1.0).\n");
    });

    it("expands `{version}` token in the replace template", async () => {
        await writeFile(join(cwd, "src.ts"), "export const VERSION = \"0.9.0\";\n");

        const result = await applyExtraFilesForRelease(
            cwd,
            join(cwd, "packages", "a"),
            "1.0.0",
            "@scope/a",
            [{ path: "src.ts", replace: "VERSION = \"{version}\"", search: "VERSION = \"[^\"]+\"" }],
            [],
        );

        expect(result.writes[0]!.content).toContain("VERSION = \"1.0.0\"");
    });

    it("supports regex backreferences in the replace template", async () => {
        await writeFile(join(cwd, "config.toml"), "name = \"pkg\"\nversion = \"0.9.0\"\n");

        const result = await applyExtraFilesForRelease(
            cwd,
            join(cwd, "packages", "a"),
            "1.0.0",
            "@scope/a",
            [{
                flags: "m",
                path: "config.toml",
                replace: "$1{version}$3",
                search: "^(version = \")([^\"]+)(\")",
            }],
            [],
        );

        expect(result.writes[0]!.content).toContain("version = \"1.0.0\"");
    });

    it("resolves per-package rules relative to the package directory", async () => {
        await writeFile(join(cwd, "packages", "a", "VERSION.txt"), "0.9.0\n");

        const result = await applyExtraFilesForRelease(
            cwd,
            join(cwd, "packages", "a"),
            "1.0.0",
            "@scope/a",
            [],
            [{ path: "VERSION.txt", search: String.raw`\d+\.\d+\.\d+` }],
        );

        expect(result.writes[0]!.path).toBe(join(cwd, "packages", "a", "VERSION.txt"));
        expect(result.writes[0]!.content).toBe("1.0.0\n");
    });

    it("warns (does not throw) on missing files", async () => {
        const result = await applyExtraFilesForRelease(
            cwd,
            join(cwd, "packages", "a"),
            "1.0.0",
            "@scope/a",
            [{ path: "missing.md", search: String.raw`v\d+` }],
            [],
        );

        expect(result.writes).toHaveLength(0);
        expect(result.warnings[0]).toContain("does not exist");
    });

    it("warns on stale rules (regex matched nothing)", async () => {
        await writeFile(join(cwd, "stable.md"), "no version here\n");

        const result = await applyExtraFilesForRelease(
            cwd,
            join(cwd, "packages", "a"),
            "1.0.0",
            "@scope/a",
            [{ path: "stable.md", search: String.raw`v\d+\.\d+\.\d+` }],
            [],
        );

        expect(result.warnings[0]).toContain("matched nothing");
        expect(result.warnings[0]).toContain("stale");
    });

    it("returns no writes when content is unchanged (idempotent)", async () => {
        // File already at the target version — a no-`replace` regex rule
        // substitutes the matched version with the version literal, so when
        // the file is already at that literal the content is identical and no
        // write is emitted.
        await writeFile(join(cwd, "README.md"), "1.0.0\n");

        const result = await applyExtraFilesForRelease(
            cwd,
            join(cwd, "packages", "a"),
            "1.0.0",
            "@scope/a",
            [{ path: "README.md", search: String.raw`\d+\.\d+\.\d+` }],
            [],
        );

        expect(result.writes).toHaveLength(0);
    });

    it("composes multiple rules against the same file in one read", async () => {
        await writeFile(join(cwd, "README.md"), "[![v0.9.0](badge.svg)](url)\nversion: 0.9.0\n");

        const result = await applyExtraFilesForRelease(
            cwd,
            join(cwd, "packages", "a"),
            "1.0.0",
            "@scope/a",
            [
                // First rule keeps the `v` prefix via an explicit replace;
                // a no-`replace` rule would drop the whole match to the bare
                // version literal (covered by other cases).
                { path: "README.md", replace: "v{version}", search: String.raw`v\d+\.\d+\.\d+` },
                { path: "README.md", replace: "version: {version}", search: String.raw`version: \d+\.\d+\.\d+` },
            ],
            [],
        );

        expect(result.writes).toHaveLength(1);
        expect(result.writes[0]!.content).toContain("v1.0.0");
        expect(result.writes[0]!.content).toContain("version: 1.0.0");
    });

    it("expands `{packageName}` as an alias for `{name}` (release-please parity)", async () => {
        await writeFile(join(cwd, "id.txt"), "old-name\n");

        const result = await applyExtraFilesForRelease(
            cwd,
            join(cwd, "packages", "a"),
            "1.0.0",
            "@scope/a",
            [{ flags: "m", path: "id.txt", replace: "{packageName}", search: "^old-name" }],
            [],
        );

        expect(result.writes[0]!.content).toContain("@scope/a");
    });

    it("handles absolute paths as-is", async () => {
        const absolute = join(cwd, "ABS.md");

        await writeFile(absolute, "v0.0.1\n");

        const result = await applyExtraFilesForRelease(
            cwd,
            join(cwd, "packages", "a"),
            "1.0.0",
            "@scope/a",
            [{ path: absolute, search: String.raw`v\d+\.\d+\.\d+` }],
            [],
        );

        expect(result.writes[0]!.path).toBe(absolute);
    });
});

/**
 * Annotation-comment mode — release-please parity. Marks lines with
 * `x-release-please-version` (or a custom marker) and lets the engine
 * find the semver-shaped substring itself, so users don't author a
 * regex for the common case.
 */
describe("extra-files: annotation-comment mode", () => {
    let cwd: string;

    beforeEach(async () => {
        cwd = await mkdtemp(join(tmpdir(), "vis-extra-files-anno-"));
        await mkdir(join(cwd, "packages", "a"), { recursive: true });
    });

    afterEach(async () => {
        await rm(cwd, { force: true, recursive: true });
    });

    it("replaces the semver on the same line when the marker is inline", async () => {
        await writeFile(
            join(cwd, "src.ts"),
            "export const VERSION = \"0.1.0\"; // x-release-please-version\nexport const OTHER = \"1.0.0\";\n",
        );

        const result = await applyExtraFilesForRelease(
            cwd,
            join(cwd, "packages", "a"),
            "1.2.3",
            "@scope/a",
            [{ path: "src.ts", type: "annotation" }],
            [],
        );

        expect(result.writes).toHaveLength(1);
        expect(result.writes[0]!.content).toContain("VERSION = \"1.2.3\";");
        // Only the marked line is touched — the other version line is untouched.
        expect(result.writes[0]!.content).toContain("OTHER = \"1.0.0\"");
    });

    it("replaces the semver on the next line when the marker sits on its own line (Dockerfile style)", async () => {
        await writeFile(
            join(cwd, "Dockerfile"),
            "FROM node:18-alpine\n# x-release-please-version\nENV APP_VERSION=\"0.1.0\"\n",
        );

        const result = await applyExtraFilesForRelease(
            cwd,
            join(cwd, "packages", "a"),
            "2.0.0",
            "@scope/a",
            [{ path: "Dockerfile", type: "annotation" }],
            [],
        );

        expect(result.writes).toHaveLength(1);
        expect(result.writes[0]!.content).toContain("APP_VERSION=\"2.0.0\"");
        // The marker line is preserved verbatim — it stays in the file
        // so the next release still sees it.
        expect(result.writes[0]!.content).toContain("# x-release-please-version");
    });

    it("honours a custom marker via `marker:` option", async () => {
        await writeFile(
            join(cwd, "CUSTOM.txt"),
            "foo = \"0.1.0\" // x-release-vis-version\n",
        );

        const result = await applyExtraFilesForRelease(
            cwd,
            join(cwd, "packages", "a"),
            "9.9.9",
            "@scope/a",
            [{ marker: "x-release-vis-version", path: "CUSTOM.txt", type: "annotation" }],
            [],
        );

        expect(result.writes[0]!.content).toContain("foo = \"9.9.9\"");
    });

    it("treats legacy rules without `type` as regex (backwards compat)", async () => {
        await writeFile(join(cwd, "README.md"), "v0.9.0\n");

        const result = await applyExtraFilesForRelease(
            cwd,
            join(cwd, "packages", "a"),
            "1.0.0",
            "@scope/a",
            [{ path: "README.md", search: String.raw`v\d+\.\d+\.\d+` }],
            [],
        );

        // The result is identical to what we'd get from an explicit
        // `type: "regex"` rule — the omitted discriminator is the legacy
        // shape.
        expect(result.writes[0]!.content).toBe("1.0.0\n");
    });

    it("warns (does not throw) when the marker is not found in the file", async () => {
        await writeFile(join(cwd, "plain.txt"), "no markers here\nversion 1.2.3\n");

        const result = await applyExtraFilesForRelease(
            cwd,
            join(cwd, "packages", "a"),
            "9.9.9",
            "@scope/a",
            [{ path: "plain.txt", type: "annotation" }],
            [],
        );

        expect(result.writes).toHaveLength(0);
        expect(result.warnings[0]).toContain("not found");
        expect(result.warnings[0]).toContain("stale");
        // version 1.2.3 was NOT touched — the marker has to be present
        // to opt the line in.
    });

    it("warns when the marker is present but no semver is on the marked line", async () => {
        await writeFile(
            join(cwd, "weird.ts"),
            "const NOT_A_VERSION = \"hello\"; // x-release-please-version\n",
        );

        const result = await applyExtraFilesForRelease(
            cwd,
            join(cwd, "packages", "a"),
            "1.0.0",
            "@scope/a",
            [{ path: "weird.ts", type: "annotation" }],
            [],
        );

        expect(result.writes).toHaveLength(0);
        expect(result.warnings.length).toBeGreaterThan(0);
        expect(result.warnings.some((w) => w.includes("no semver-shaped substring"))).toBe(true);
    });

    it("rewrites multiple occurrences of the marker in one pass", async () => {
        await writeFile(
            join(cwd, "multi.ts"),
            "export const A = \"0.1.0\"; // x-release-please-version\n"
            + "export const B = \"0.1.0\"; // x-release-please-version\n",
        );

        const result = await applyExtraFilesForRelease(
            cwd,
            join(cwd, "packages", "a"),
            "2.0.0",
            "@scope/a",
            [{ path: "multi.ts", type: "annotation" }],
            [],
        );

        expect(result.writes[0]!.content).toContain("A = \"2.0.0\"");
        expect(result.writes[0]!.content).toContain("B = \"2.0.0\"");
    });

    it("supports an explicit `type: \"regex\"` discriminator (mirror of the legacy default)", async () => {
        await writeFile(join(cwd, "explicit.md"), "v0.0.1\n");

        const result = await applyExtraFilesForRelease(
            cwd,
            join(cwd, "packages", "a"),
            "1.0.0",
            "@scope/a",
            [{ path: "explicit.md", search: String.raw`v\d+\.\d+\.\d+`, type: "regex" }],
            [],
        );

        expect(result.writes[0]!.content).toBe("1.0.0\n");
    });
});

/**
 * M-6 — anchor field for annotation rules. Files with multiple
 * version-shaped substrings on the same marked line (Dockerfiles
 * referencing both APP_VERSION and a base-image tag, lockfiles,
 * compose files) would have the FIRST semver naively rewritten without
 * an anchor. The `anchor:` field opts the rule into "replace the
 * semver AFTER this literal prefix only" behaviour.
 */
describe("extra-files: annotation-comment mode — anchor (M-6)", () => {
    let cwd: string;

    beforeEach(async () => {
        cwd = await mkdtemp(join(tmpdir(), "vis-extra-files-anchor-"));
        await mkdir(join(cwd, "packages", "a"), { recursive: true });
    });

    afterEach(async () => {
        await rm(cwd, { force: true, recursive: true });
    });

    it("with `anchor` set, only the semver AFTER the anchor is rewritten — other versions on the same line are untouched", async () => {
        // A Dockerfile with TWO semver-shaped substrings on the marked
        // line: the base image tag (1.21.0) and APP_VERSION (0.1.0).
        // Without an anchor, the first one would be incorrectly replaced.
        await writeFile(
            join(cwd, "Dockerfile"),

            "FROM nginx:1.21.0\nENV APP_VERSION=\"0.1.0\" # x-release-please-version\n",
        );

        const result = await applyExtraFilesForRelease(
            cwd,
            join(cwd, "packages", "a"),
            "2.0.0",
            "@scope/a",
            [{ anchor: "APP_VERSION", path: "Dockerfile", type: "annotation" }],
            [],
        );

        expect(result.writes).toHaveLength(1);
        // The APP_VERSION is bumped...
        expect(result.writes[0]!.content).toContain("APP_VERSION=\"2.0.0\"");
        // ...but the base image tag is left alone.

        expect(result.writes[0]!.content).toContain("FROM nginx:1.21.0");
        // Sanity — `2.0.0` only appears once.
        expect((result.writes[0]!.content.match(/2\.0\.0/g) ?? [])).toHaveLength(1);
    });

    it("without `anchor`, the FIRST semver on the marked line wins (documents the footgun)", async () => {
        // Same Dockerfile, but no anchor — the legacy behaviour
        // rewrites the FIRST semver substring (base-image tag), which
        // is the documented footgun the anchor field is designed to
        // mitigate. This test pins that legacy behaviour so a future
        // accidental change to the default semver-search bound is
        // caught.
        await writeFile(
            join(cwd, "Dockerfile"),

            "ENV APP_VERSION=\"0.1.0\" BASE_TAG=\"1.21.0\" # x-release-please-version\n",
        );

        const result = await applyExtraFilesForRelease(
            cwd,
            join(cwd, "packages", "a"),
            "2.0.0",
            "@scope/a",
            [{ path: "Dockerfile", type: "annotation" }],
            [],
        );

        // First semver = APP_VERSION's 0.1.0 → 2.0.0; BASE_TAG untouched.
        expect(result.writes[0]!.content).toContain("APP_VERSION=\"2.0.0\"");
        expect(result.writes[0]!.content).toContain("BASE_TAG=\"1.21.0\"");
    });

    it("with `anchor` set on a preceding-line marker, the anchor applies to the FOLLOWING line", async () => {
        // Dockerfile-style: own-line marker followed by a line with two
        // semvers. The anchor scopes the replacement on the next line.
        await writeFile(
            join(cwd, "Dockerfile"),

            "# x-release-please-version\nFROM nginx:1.21.0\nENV APP_VERSION=\"0.1.0\"\n",
        );

        // The semver-on-next-line is the FROM line's `1.21.0` by
        // default, but with `anchor: "APP_VERSION"` the next line
        // doesn't contain that anchor at all → no replacement, warning
        // surfaces. This is the safe failure mode: better to warn than
        // to silently rewrite the wrong thing.
        const result = await applyExtraFilesForRelease(
            cwd,
            join(cwd, "packages", "a"),
            "2.0.0",
            "@scope/a",
            [{ anchor: "APP_VERSION", path: "Dockerfile", type: "annotation" }],
            [],
        );

        expect(result.writes).toHaveLength(0);
        expect(result.warnings.length).toBeGreaterThan(0);
        expect(result.warnings.some((w) => w.includes("APP_VERSION"))).toBe(true);
    });

    it("with `anchor` set inline and a lockfile-like line, only the anchored version is bumped", async () => {
        // Simulates a `package-lock.json`-shaped line where the marker
        // sits in a comment and the anchor scopes the rewrite to a
        // specific `"version":` substring — the kind of file where
        // anchorless annotation rules are the documented footgun.
        await writeFile(
            join(cwd, "manifest.json"),

            "{ \"dependencies\": { \"foo\": \"1.0.0\" }, \"version\": \"0.1.0\" } // x-release-please-version\n",
        );

        const result = await applyExtraFilesForRelease(
            cwd,
            join(cwd, "packages", "a"),
            "3.0.0",
            "@scope/a",
            [{ anchor: "\"version\":", path: "manifest.json", type: "annotation" }],
            [],
        );

        expect(result.writes).toHaveLength(1);
        // The package's own version was bumped...
        expect(result.writes[0]!.content).toContain("\"version\": \"3.0.0\"");
        // ...but the nested dep was left alone.
        expect(result.writes[0]!.content).toContain("\"foo\": \"1.0.0\"");
    });
});
