import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { applyGitignoreMigration, ensureVisGitignore, VIS_IGNORE_ENTRIES } from "../../src/io/gitignore";

describe(ensureVisGitignore, () => {
    let directory: string;

    beforeEach(() => {
        directory = mkdtempSync(join(tmpdir(), "vis-gitignore-"));
    });

    afterEach(() => {
        rmSync(directory, { force: true, recursive: true });
    });

    const gitignore = (): string => readFileSync(join(directory, ".gitignore"), "utf8");

    it("should append only vis's ephemeral run-state entries", () => {
        expect.assertions(3);

        writeFileSync(join(directory, ".gitignore"), "node_modules\ndist\n");

        const result = ensureVisGitignore(directory);

        expect(result.added).toStrictEqual([...VIS_IGNORE_ENTRIES]);
        expect(gitignore()).toMatch(/^node_modules\ndist\n/);
        expect(gitignore()).toContain(".vis/last-summary.json");
    });

    it("should never ignore the .vis directory wholesale", () => {
        expect.assertions(2);

        // `.vis/` holds tracked source: templates/, hooks/, and the release
        // notes the documented workflow requires to be committed.
        writeFileSync(join(directory, ".gitignore"), "node_modules\n");

        ensureVisGitignore(directory);

        expect(gitignore()).not.toMatch(/^\.vis\/?$/m);
        expect(gitignore()).not.toMatch(/^\.vis\/\*$/m);
    });

    it("should be idempotent once the entries are present", () => {
        expect.assertions(2);

        writeFileSync(join(directory, ".gitignore"), `node_modules\n${VIS_IGNORE_ENTRIES.join("\n")}\n`);

        const result = ensureVisGitignore(directory);

        expect(result.changed).toBe(false);
        expect(gitignore()).toBe(`node_modules\n${VIS_IGNORE_ENTRIES.join("\n")}\n`);
    });

    it("should never delete an existing entry", () => {
        expect.assertions(2);

        // A user pairing `.vis/*` with negations is expressing intent that
        // collapsing to `.vis/` would silently destroy — git cannot
        // re-include a path whose parent directory is excluded.
        writeFileSync(join(directory, ".gitignore"), "node_modules\n.vis/*\n!.vis/templates\n!.vis/hooks\n");

        const result = ensureVisGitignore(directory);

        expect(gitignore()).toContain("!.vis/templates");
        // `.vis/*` already covers the run state, so nothing is added either.
        expect(result.changed).toBe(false);
    });

    it("should respect a broader .vis rule the user already wrote", () => {
        expect.assertions(1);

        writeFileSync(join(directory, ".gitignore"), ".vis/\n");

        expect(ensureVisGitignore(directory).changed).toBe(false);
    });

    it("should preserve CRLF line endings", () => {
        expect.assertions(2);

        writeFileSync(join(directory, ".gitignore"), "node_modules\r\ndist\r\n");

        ensureVisGitignore(directory);

        expect(gitignore()).toContain(".vis/last-summary.json\r\n");
        expect(gitignore()).not.toMatch(/[^\r]\n/);
    });

    it("should create the file when asked to", () => {
        expect.assertions(1);

        ensureVisGitignore(directory, { create: true });

        expect(gitignore()).toContain(".vis/last-summary.json");
    });

    it("should not create a file when create is false", () => {
        expect.assertions(2);

        const result = ensureVisGitignore(directory, { create: false });

        expect(result.changed).toBe(false);
        expect(() => gitignore()).toThrow(/ENOENT/);
    });

    it("should not leave a run of blank lines before the appended entries", () => {
        expect.assertions(1);

        writeFileSync(join(directory, ".gitignore"), "dist\n\n\n\n");

        ensureVisGitignore(directory);

        // Exactly one blank separating the original content from the block,
        // and no run of consecutive blanks anywhere.
        expect(gitignore()).not.toMatch(/\n\n\n/);
    });
});

describe(applyGitignoreMigration, () => {
    let directory: string;

    beforeEach(() => {
        directory = mkdtempSync(join(tmpdir(), "vis-gitignore-mig-"));
    });

    afterEach(() => {
        rmSync(directory, { force: true, recursive: true });
    });

    it("should leave the migrated-from tool's entries in place", () => {
        expect.assertions(2);

        // nx keeps running — and writing to `.nx` — until the user removes
        // nx.json, which the migrator deliberately does not do by default.
        writeFileSync(join(directory, ".gitignore"), "node_modules\n.nx\n.turbo\n");

        applyGitignoreMigration(directory, {}, { info: () => {} });

        const content = readFileSync(join(directory, ".gitignore"), "utf8");

        expect(content).toContain(".nx");
        expect(content).toContain(".turbo");
    });

    it("should stay silent on an already-correct repo in dry-run", () => {
        expect.assertions(1);

        writeFileSync(join(directory, ".gitignore"), `node_modules\n${VIS_IGNORE_ENTRIES.join("\n")}\n`);

        const messages: string[] = [];

        applyGitignoreMigration(directory, { dryRun: true }, { info: (message) => messages.push(message) });

        // An unconditional "would add" makes --dry-run useless as an audit.
        expect(messages).toStrictEqual([]);
    });

    it("should report what it would add in dry-run without writing", () => {
        expect.assertions(2);

        writeFileSync(join(directory, ".gitignore"), "node_modules\n");

        const messages: string[] = [];

        applyGitignoreMigration(directory, { dryRun: true }, { info: (message) => messages.push(message) });

        expect(messages.join("\n")).toContain(".vis/last-summary.json");
        expect(readFileSync(join(directory, ".gitignore"), "utf8")).toBe("node_modules\n");
    });
});
