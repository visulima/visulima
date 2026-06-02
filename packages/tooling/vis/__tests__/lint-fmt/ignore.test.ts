import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";

import { join } from "@visulima/path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { buildIgnoreRules, filterIgnored, isIgnored, loadIgnoreFile } from "../../src/lint-fmt/ignore";

let workspaceRoot: string;

describe("ignore", () => {
    beforeEach(() => {
        workspaceRoot = mkdtempSync(join(tmpdir(), "vis-ignore-"));
    });

    afterEach(() => {
        rmSync(workspaceRoot, { force: true, recursive: true });
    });

    it("loads patterns from a file and ignores blanks and comments", () => {
        expect.assertions(1);

        const file = join(workspaceRoot, ".gitignore");

        writeFileSync(file, "# header\n\nnode_modules\ndist\n");

        expect(loadIgnoreFile(file)).toHaveLength(2);
    });

    it("returns an empty array when the ignore file is missing", () => {
        expect.assertions(1);

        expect(loadIgnoreFile(join(workspaceRoot, ".gitignore"))).toStrictEqual([]);
    });

    it("merges gitignore, extra files, and extra patterns from config", () => {
        expect.assertions(1);

        writeFileSync(join(workspaceRoot, ".gitignore"), "dist\n");
        writeFileSync(join(workspaceRoot, ".prettierignore"), "build\n");

        const rules = buildIgnoreRules(workspaceRoot, ["coverage"], [join(workspaceRoot, ".prettierignore")]);

        expect(rules).toHaveLength(3);
    });

    it("matches simple patterns against the relative path", () => {
        expect.assertions(2);

        writeFileSync(join(workspaceRoot, ".gitignore"), "dist\n");
        const rules = buildIgnoreRules(workspaceRoot);

        expect(isIgnored(workspaceRoot, join(workspaceRoot, "dist/main.js"), rules)).toBe(true);
        expect(isIgnored(workspaceRoot, join(workspaceRoot, "src/main.ts"), rules)).toBe(false);
    });

    it("respects negation rules in declaration order", () => {
        expect.assertions(2);

        writeFileSync(join(workspaceRoot, ".gitignore"), "*.log\n!keep.log\n");
        const rules = buildIgnoreRules(workspaceRoot);

        expect(isIgnored(workspaceRoot, join(workspaceRoot, "drop.log"), rules)).toBe(true);
        expect(isIgnored(workspaceRoot, join(workspaceRoot, "keep.log"), rules)).toBe(false);
    });

    it("only applies directory-only patterns when the entry is a directory", () => {
        expect.assertions(2);

        writeFileSync(join(workspaceRoot, ".gitignore"), "build/\n");
        const rules = buildIgnoreRules(workspaceRoot);

        expect(isIgnored(workspaceRoot, join(workspaceRoot, "build"), rules, true)).toBe(true);
        expect(isIgnored(workspaceRoot, join(workspaceRoot, "build"), rules, false)).toBe(false);
    });

    it("filters lists while preserving order", () => {
        expect.assertions(1);

        writeFileSync(join(workspaceRoot, ".gitignore"), "skip\n");
        const rules = buildIgnoreRules(workspaceRoot);
        const files = [join(workspaceRoot, "a.ts"), join(workspaceRoot, "skip/x.ts"), join(workspaceRoot, "b.ts")];

        expect(filterIgnored(workspaceRoot, files, rules)).toStrictEqual([join(workspaceRoot, "a.ts"), join(workspaceRoot, "b.ts")]);
    });
});
