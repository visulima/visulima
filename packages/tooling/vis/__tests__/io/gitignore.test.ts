import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ensureVisGitignore, VIS_IGNORE_ENTRY } from "../../src/io/gitignore";

describe(ensureVisGitignore, () => {
    let directory: string;

    beforeEach(() => {
        directory = mkdtempSync(join(tmpdir(), "vis-gitignore-"));
    });

    afterEach(() => {
        rmSync(directory, { force: true, recursive: true });
    });

    const gitignore = (): string => readFileSync(join(directory, ".gitignore"), "utf8");

    it("should append the entry to an existing file", () => {
        expect.assertions(3);

        writeFileSync(join(directory, ".gitignore"), "node_modules\ndist\n");

        const result = ensureVisGitignore(directory);

        expect(result.added).toStrictEqual([VIS_IGNORE_ENTRY]);
        expect(gitignore()).toMatch(/^node_modules\ndist\n/);
        expect(gitignore()).toContain(VIS_IGNORE_ENTRY);
    });

    it("should be idempotent when the entry is already present", () => {
        expect.assertions(2);

        writeFileSync(join(directory, ".gitignore"), `node_modules\n${VIS_IGNORE_ENTRY}\n`);

        const result = ensureVisGitignore(directory);

        expect(result.changed).toBe(false);
        expect(gitignore()).toBe(`node_modules\n${VIS_IGNORE_ENTRY}\n`);
    });

    it("should replace narrow .vis entries that leave the cache directory uncovered", () => {
        expect.assertions(3);

        // The exact shape that let `.vis/cache` get staged: the two small
        // files ignored, the megabyte-scale directory beside them not.
        writeFileSync(join(directory, ".gitignore"), "node_modules\n.vis/last-summary.json\n.vis/last-failures\n");

        const result = ensureVisGitignore(directory);

        expect(result.removed).toStrictEqual([".vis/last-summary.json", ".vis/last-failures"]);
        expect(gitignore()).toContain(VIS_IGNORE_ENTRY);
        expect(gitignore()).not.toContain("last-summary");
    });

    it("should drop entries owned by the migrated-from tool", () => {
        expect.assertions(2);

        writeFileSync(join(directory, ".gitignore"), "node_modules\n.nx\n.nx/cache\n");

        const result = ensureVisGitignore(directory, { dropEntries: [".nx", ".nx/cache"] });

        expect(result.removed).toStrictEqual([".nx", ".nx/cache"]);
        expect(gitignore()).not.toContain(".nx");
    });

    it("should leave a user's own broader pattern alone", () => {
        expect.assertions(1);

        writeFileSync(join(directory, ".gitignore"), "**/.vis/**\n");

        ensureVisGitignore(directory);

        expect(gitignore()).toContain("**/.vis/**");
    });

    it("should create the file when asked to", () => {
        expect.assertions(1);

        ensureVisGitignore(directory, { create: true });

        expect(gitignore()).toContain(VIS_IGNORE_ENTRY);
    });

    it("should not create a file when create is false", () => {
        expect.assertions(2);

        const result = ensureVisGitignore(directory, { create: false });

        expect(result.changed).toBe(false);
        expect(() => gitignore()).toThrow(/ENOENT/);
    });

    it("should not leave a run of blank lines before the appended entry", () => {
        expect.assertions(1);

        writeFileSync(join(directory, ".gitignore"), "dist\n\n\n\n");

        ensureVisGitignore(directory);

        expect(gitignore()).toBe(`dist\n\n# vis task runner cache and run state\n${VIS_IGNORE_ENTRY}\n`);
    });
});
