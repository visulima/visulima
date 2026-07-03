import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { buildGitignoreMatcher, extractWorkspaceExcludePatterns } from "../../src/util/gitignore-matcher";

let cwd: string;

const writeFile = (relativePath: string, content: string): void => {
    const fullPath = join(cwd, relativePath);

    mkdirSync(join(fullPath, ".."), { recursive: true });
    writeFileSync(fullPath, content);
};

describe(buildGitignoreMatcher, () => {
    beforeEach(() => {
        cwd = mkdtempSync(join(tmpdir(), "vis-gitignore-"));
    });

    afterEach(() => {
        rmSync(cwd, { force: true, recursive: true });
    });

    it("ignores node_modules and .git by default", () => {
        expect.assertions(3);

        const matcher = buildGitignoreMatcher({ cwd });

        expect(matcher.ignores(join(cwd, "node_modules/foo/package.json"))).toBe(true);
        expect(matcher.ignores(join(cwd, ".git/HEAD"))).toBe(true);
        expect(matcher.ignores(join(cwd, "src/index.ts"))).toBe(false);
    });

    it("respects the root .gitignore", () => {
        expect.assertions(2);

        writeFile(".gitignore", "dist/\nbuild/\n");
        const matcher = buildGitignoreMatcher({ cwd });

        expect(matcher.ignores(join(cwd, "dist/index.js"))).toBe(true);
        expect(matcher.ignores(join(cwd, "src/index.ts"))).toBe(false);
    });

    it("loads extra ignore files on top of the root .gitignore", () => {
        expect.assertions(3);

        writeFile(".gitignore", "dist/\n");
        writeFile(".secretsignore", "secrets/\n");
        const matcher = buildGitignoreMatcher({
            cwd,
            extraIgnoreFiles: [".secretsignore"],
        });

        expect(matcher.ignores(join(cwd, "dist/a.js"))).toBe(true);
        expect(matcher.ignores(join(cwd, "secrets/key.pem"))).toBe(true);
        expect(matcher.ignores(join(cwd, "src/index.ts"))).toBe(false);
    });

    it("layers extraPatterns on top of files", () => {
        expect.assertions(2);

        const matcher = buildGitignoreMatcher({
            cwd,
            extraPatterns: ["**/__fixtures__/**"],
        });

        expect(matcher.ignores(join(cwd, "packages/foo/__fixtures__/bar/package.json"))).toBe(true);
        expect(matcher.ignores(join(cwd, "packages/foo/src/index.ts"))).toBe(false);
    });

    it("skips missing extra ignore files silently", () => {
        expect.assertions(1);

        const matcher = buildGitignoreMatcher({
            cwd,
            extraIgnoreFiles: ["does-not-exist.ignore"],
        });

        expect(matcher.ignores(join(cwd, "anywhere/file.ts"))).toBe(false);
    });

    it("treats paths outside cwd as not ignored", () => {
        expect.assertions(1);

        writeFile(".gitignore", "node_modules/\n");
        const matcher = buildGitignoreMatcher({ cwd });

        expect(matcher.ignores("/var/elsewhere/node_modules/x")).toBe(false);
    });

    it("filter() drops ignored files and preserves order", () => {
        expect.assertions(1);

        writeFile(".gitignore", "dist/\n");
        const matcher = buildGitignoreMatcher({ cwd });
        const kept = matcher.filter([
            join(cwd, "package.json"),
            join(cwd, "dist/package.json"),
            join(cwd, "node_modules/x/package.json"),
            join(cwd, "src/package.json"),
        ]);

        expect(kept).toStrictEqual([join(cwd, "package.json"), join(cwd, "src/package.json")]);
    });

    it("can opt out of builtin excludes", () => {
        expect.assertions(2);

        const matcher = buildGitignoreMatcher({ builtinExcludes: false, cwd });

        expect(matcher.ignores(join(cwd, "node_modules/foo"))).toBe(false);
        expect(matcher.ignores(join(cwd, ".git/HEAD"))).toBe(false);
    });

    it("can opt out of the root .gitignore", () => {
        expect.assertions(1);

        writeFile(".gitignore", "dist/\n");
        const matcher = buildGitignoreMatcher({ cwd, rootGitignore: false });

        expect(matcher.ignores(join(cwd, "dist/index.js"))).toBe(false);
    });

    it("add() layers patterns post-construction", () => {
        expect.assertions(2);

        const matcher = buildGitignoreMatcher({ cwd });

        expect(matcher.ignores(join(cwd, "tmp/foo"))).toBe(false);

        matcher.add("tmp/");

        expect(matcher.ignores(join(cwd, "tmp/foo"))).toBe(true);
    });

    it("integrates workspace !-exclusions via extraPatterns", () => {
        expect.assertions(2);

        const workspacePatterns = ["packages/**", "!packages/foo/__fixtures__/**"];
        const matcher = buildGitignoreMatcher({
            cwd,
            extraPatterns: extractWorkspaceExcludePatterns(workspacePatterns),
        });

        expect(matcher.ignores(join(cwd, "packages/foo/__fixtures__/a/package.json"))).toBe(true);
        expect(matcher.ignores(join(cwd, "packages/foo/src/package.json"))).toBe(false);
    });
});

describe(extractWorkspaceExcludePatterns, () => {
    it("returns [] for undefined or empty input", () => {
        expect.assertions(2);

        expect(extractWorkspaceExcludePatterns(undefined)).toStrictEqual([]);
        expect(extractWorkspaceExcludePatterns([])).toStrictEqual([]);
    });

    it("extracts !-prefixed entries with the leading ! stripped", () => {
        expect.assertions(1);

        expect(extractWorkspaceExcludePatterns(["packages/**", "!packages/foo/__fixtures__/**", "apps/*", "!apps/legacy"])).toStrictEqual([
            "packages/foo/__fixtures__/**",
            "apps/legacy",
        ]);
    });

    it("strips trailing slashes and skips empty bangs", () => {
        expect.assertions(1);

        expect(extractWorkspaceExcludePatterns(["!", "!foo/", "!", "!bar/baz/"])).toStrictEqual(["foo", "bar/baz"]);
    });

    it("ignores positive patterns entirely", () => {
        expect.assertions(1);

        expect(extractWorkspaceExcludePatterns(["packages/*", "apps/**"])).toStrictEqual([]);
    });
});
