import { describe, expect, it } from "vitest";

import { collectExplicitBumps, findChangeFilesFor, formatChangeFile, parseChangeFile } from "../../../src/release/core/change-file";
import { VisReleaseError } from "../../../src/release/errors";

describe("change-file: parseChangeFile (simple shape)", () => {
    it("parses a single-package simple change file", () => {
        expect.hasAssertions();

        const result = parseChangeFile(`---\n"@scope/pkg-a": minor\n---\nAdded a feature.\n`, ".vis/release/abc123.md");

        expect(result.id).toBe("abc123");
        expect(result.path).toBe(".vis/release/abc123.md");

        if (!("bumps" in result.payload)) {
            throw new Error("expected simple shape");
        }

        expect(result.payload.bumps).toStrictEqual({ "@scope/pkg-a": "minor" });
        expect(result.body).toBe("Added a feature.");
        expect(result.meta).toBeUndefined();
    });

    it("parses a multi-package simple change file", () => {
        expect.hasAssertions();

        const result = parseChangeFile(`---\n"@scope/pkg-a": minor\n"@scope/pkg-b": patch\npkg-c: major\n---\nMulti-package changelog body.\n`, "f.md");

        if (!("bumps" in result.payload)) {
            throw new Error("expected simple shape");
        }

        expect(result.payload.bumps).toStrictEqual({
            "@scope/pkg-a": "minor",
            "@scope/pkg-b": "patch",
            "pkg-c": "major",
        });
    });

    it("accepts an empty body", () => {
        expect.hasAssertions();

        const result = parseChangeFile(`---\npkg-a: patch\n---\n`, "f.md");

        expect(result.body).toBe("");
    });

    it("derives id from filename without extension", () => {
        expect.hasAssertions();

        const result = parseChangeFile(`---\npkg-a: patch\n---\n`, "/some/long/path/to/witty-frog.md");

        expect(result.id).toBe("witty-frog");
    });
});

describe("change-file: parseChangeFile (nested shape)", () => {
    it("parses a nested change file with cascade", () => {
        expect.hasAssertions();

        const result = parseChangeFile(
            `---\n"@scope/core":\n  bump: minor\n  cascade:\n    "@scope/plugin-*": patch\n    "@scope/react": minor\n---\nBody.\n`,
            "f.md",
        );

        if (!("package" in result.payload)) {
            throw new Error("expected nested shape");
        }

        expect(result.payload.package).toBe("@scope/core");
        expect(result.payload.bump).toBe("minor");
        expect(result.payload.cascade).toStrictEqual({
            "@scope/plugin-*": "patch",
            "@scope/react": "minor",
        });
    });

    it("parses a nested change file without cascade", () => {
        expect.hasAssertions();

        const result = parseChangeFile(`---\npkg-a:\n  bump: major\n---\nBody.\n`, "f.md");

        if (!("package" in result.payload)) {
            throw new Error("expected nested shape");
        }

        expect(result.payload.package).toBe("pkg-a");
        expect(result.payload.bump).toBe("major");
        expect(result.payload.cascade).toBeUndefined();
    });

    it("rejects mixed simple+nested entries (multiple top-level)", () => {
        expect.hasAssertions();
        expect(() => parseChangeFile(`---\npkg-a:\n  bump: minor\npkg-b: patch\n---\n`, "f.md")).toThrow(/Mixed simple/);
    });
});

describe("change-file: parseChangeFile (validation)", () => {
    it("rejects missing frontmatter", () => {
        expect.hasAssertions();
        expect(() => parseChangeFile("Just a body, no frontmatter.", "f.md")).toThrow(/missing YAML frontmatter/);
    });

    it("rejects invalid bump level", () => {
        expect.hasAssertions();
        expect(() => parseChangeFile(`---\npkg-a: huge\n---\n`, "f.md")).toThrow(/Invalid bump level/);
    });

    it("accepts empty frontmatter as a no-bump (changesets-style empty) change file", () => {
        // Blank frontmatter is a deliberate signal — the author recorded that
        // the PR was considered for release but should not bump anything
        // (docs-only changes, CI gates requiring a change file). It parses to
        // empty bumps rather than throwing.
        expect.hasAssertions();

        const parsed = parseChangeFile(`---\n\n---\n`, "f.md");

        expect(parsed.payload.bumps).toStrictEqual({});
    });

    it("rejects array frontmatter", () => {
        expect.hasAssertions();
        expect(() => parseChangeFile(`---\n- pkg-a: minor\n---\n`, "f.md")).toThrow(/must be a YAML object/);
    });

    it("rejects invalid package name (leading hyphen)", () => {
        expect.hasAssertions();
        expect(() => parseChangeFile(`---\n"-bad-pkg": minor\n---\n`, "f.md")).toThrow(/Invalid package name/);
    });

    it("rejects invalid package name (control char)", () => {
        expect.hasAssertions();
        expect(() => parseChangeFile(`---\n"bad pkg": minor\n---\n`, "f.md")).toThrow(/Invalid package name/);
    });

    it("rejects invalid YAML in frontmatter", () => {
        expect.hasAssertions();
        expect(() => parseChangeFile(`---\n: : :\n---\n`, "f.md")).toThrow(/YAML parse failed|Invalid/);
    });

    it("attaches file path to thrown error", () => {
        expect.hasAssertions();

        let caught: unknown;

        try {
            parseChangeFile(`---\npkg-a: bogus\n---\n`, "/a/b.md");
        } catch (error) {
            caught = error;
        }

        expect(caught).toBeInstanceOf(VisReleaseError);
        expect((caught as VisReleaseError).file).toBe("/a/b.md");
        expect((caught as VisReleaseError).code).toBe("BUMP_FILE_INVALID");
    });
});

describe("change-file: inline metadata extraction", () => {
    it("extracts pr / commit / author from body header", () => {
        expect.hasAssertions();

        const result = parseChangeFile(`---\npkg-a: minor\n---\npr: 42\ncommit: abc1234\nauthor: @prisis\n\nThe actual changelog body.\n`, "f.md");

        expect(result.meta).toStrictEqual({ author: "@prisis", commit: "abc1234", pr: 42 });
        expect(result.body).toBe("The actual changelog body.");
    });

    it("auto-prepends @ to author handles", () => {
        expect.hasAssertions();

        const result = parseChangeFile(`---\npkg-a: minor\n---\nauthor: someone\nBody.\n`, "f.md");

        expect(result.meta?.author).toBe("@someone");
    });

    it("returns no meta when none present", () => {
        expect.hasAssertions();

        const result = parseChangeFile(`---\npkg-a: minor\n---\nJust body.\n`, "f.md");

        expect(result.meta).toBeUndefined();
    });

    it("ignores invalid pr numbers", () => {
        expect.hasAssertions();

        const result = parseChangeFile(`---\npkg-a: minor\n---\npr: not-a-number\nBody.\n`, "f.md");

        expect(result.meta).toBeUndefined();
    });

    it("stops scanning meta at the first non-meta non-blank line", () => {
        expect.hasAssertions();

        const result = parseChangeFile(`---\npkg-a: minor\n---\npr: 1\nactual body line\nauthor: @foo\nmore body\n`, "f.md");

        expect(result.meta).toStrictEqual({ pr: 1 });
        expect(result.body).toBe("actual body line\nauthor: @foo\nmore body");
    });
});

describe("change-file: formatChangeFile (round-trip)", () => {
    it("formats then re-parses a simple file", () => {
        expect.hasAssertions();

        const formatted = formatChangeFile({ bumps: { "@scope/pkg-a": "minor", "pkg-b": "patch" } }, "Body text.");
        const parsed = parseChangeFile(formatted, "x.md");

        if (!("bumps" in parsed.payload)) {
            throw new Error("expected simple shape");
        }

        expect(parsed.payload.bumps).toStrictEqual({ "@scope/pkg-a": "minor", "pkg-b": "patch" });
        expect(parsed.body).toBe("Body text.");
    });

    it("formats then re-parses a nested file with cascade", () => {
        expect.hasAssertions();

        const formatted = formatChangeFile({ bump: "minor", cascade: { "@scope/plugin-*": "patch" }, package: "@scope/core" }, "Body.");
        const parsed = parseChangeFile(formatted, "x.md");

        if (!("package" in parsed.payload)) {
            throw new Error("expected nested shape");
        }

        expect(parsed.payload.package).toBe("@scope/core");
        expect(parsed.payload.bump).toBe("minor");
        expect(parsed.payload.cascade).toStrictEqual({ "@scope/plugin-*": "patch" });
    });

    it("emits empty body cleanly when body is empty", () => {
        expect.hasAssertions();

        const formatted = formatChangeFile({ bumps: { "pkg-a": "patch" } }, "");

        expect(formatted).toBe(`---\npkg-a: patch\n---\n`);
    });
});

describe("change-file: collectExplicitBumps", () => {
    it("max-merges multiple files mentioning the same package", () => {
        expect.hasAssertions();

        const files = [
            parseChangeFile(`---\npkg-a: patch\n---\nA.\n`, "1.md"),
            parseChangeFile(`---\npkg-a: minor\n---\nB.\n`, "2.md"),
            parseChangeFile(`---\npkg-a: patch\n---\nC.\n`, "3.md"),
        ];

        const result = collectExplicitBumps(files);

        expect(result.get("pkg-a")).toBe("minor");
    });

    it("collects bumps from nested-shape files", () => {
        expect.hasAssertions();

        const files = [parseChangeFile(`---\npkg-a:\n  bump: major\n---\n`, "1.md")];

        const result = collectExplicitBumps(files);

        expect(result.get("pkg-a")).toBe("major");
    });

    it("preserves none entries (recorded but no direct bump)", () => {
        expect.hasAssertions();

        const files = [parseChangeFile(`---\npkg-a: none\npkg-b: patch\n---\n`, "1.md")];

        const result = collectExplicitBumps(files);

        expect(result.get("pkg-a")).toBe("none");
        expect(result.get("pkg-b")).toBe("patch");
    });
});

describe("change-file: implicit (heading-depth) bump", () => {
    it("infers minor from an H2 heading for a null-valued package", () => {
        expect.hasAssertions();

        const result = parseChangeFile(`---\n"@scope/pkg-a":\n---\n## Add streaming API\n\nDetails.\n`, "f.md");

        if (!("bumps" in result.payload)) {
            throw new Error("expected simple shape");
        }

        expect(result.payload.bumps).toStrictEqual({ "@scope/pkg-a": "minor" });
    });

    it("infers major from an H1 and applies the highest heading found", () => {
        expect.hasAssertions();

        const result = parseChangeFile(`---\npkg-a:\npkg-b:\n---\n### Patch note\n\n# Breaking change\n\n## Feature\n`, "f.md");

        if (!("bumps" in result.payload)) {
            throw new Error("expected simple shape");
        }

        expect(result.payload.bumps).toStrictEqual({ "pkg-a": "major", "pkg-b": "major" });
    });

    it("infers patch from an H3 heading", () => {
        expect.hasAssertions();

        const result = parseChangeFile(`---\npkg-a:\n---\n### Fix off-by-one\n`, "f.md");

        if (!("bumps" in result.payload)) {
            throw new Error("expected simple shape");
        }

        expect(result.payload.bumps).toStrictEqual({ "pkg-a": "patch" });
    });

    it("mixes explicit levels with inferred (null) entries", () => {
        expect.hasAssertions();

        const result = parseChangeFile(`---\npkg-a: major\npkg-b:\n---\n## Feature\n`, "f.md");

        if (!("bumps" in result.payload)) {
            throw new Error("expected simple shape");
        }

        expect(result.payload.bumps).toStrictEqual({ "pkg-a": "major", "pkg-b": "minor" });
    });

    it("ignores headings inside fenced code blocks", () => {
        expect.hasAssertions();

        const result = parseChangeFile(`---\npkg-a:\n---\n## Real heading\n\n\`\`\`sh\n# not a heading\n\`\`\`\n`, "f.md");

        if (!("bumps" in result.payload)) {
            throw new Error("expected simple shape");
        }

        expect(result.payload.bumps).toStrictEqual({ "pkg-a": "minor" });
    });

    it("throws when a null entry has no heading to infer from", () => {
        expect.hasAssertions();

        expect(() => parseChangeFile(`---\npkg-a:\n---\nJust prose, no heading.\n`, "f.md")).toThrow(VisReleaseError);
    });
});

describe("change-file: findChangeFilesFor", () => {
    it("finds files mentioning a given package (simple shape)", () => {
        expect.hasAssertions();

        const files = [
            parseChangeFile(`---\npkg-a: minor\npkg-b: patch\n---\nA.\n`, "1.md"),
            parseChangeFile(`---\npkg-c: patch\n---\nB.\n`, "2.md"),
            parseChangeFile(`---\npkg-a: patch\n---\nC.\n`, "3.md"),
        ];

        const result = findChangeFilesFor("pkg-a", files);

        expect(result.map((f) => f.id)).toStrictEqual(["1", "3"]);
    });

    it("finds files mentioning a given package (nested shape)", () => {
        expect.hasAssertions();

        const files = [parseChangeFile(`---\npkg-a:\n  bump: minor\n---\nA.\n`, "1.md"), parseChangeFile(`---\npkg-b:\n  bump: patch\n---\nB.\n`, "2.md")];

        const result = findChangeFilesFor("pkg-a", files);

        expect(result.map((f) => f.id)).toStrictEqual(["1"]);
    });
});
