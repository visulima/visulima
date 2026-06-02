import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";

import { join } from "@visulima/path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { markdownlintAdapter } from "../../../src/lint-fmt/adapters/markdownlint";
import type { RunResult, ToolPresence } from "../../../src/lint-fmt/config-types";

let workspaceRoot: string;

const stubResult = (overrides: Partial<RunResult>): RunResult => {
    return {
        durationMs: 1,
        exitCode: 0,
        stderr: "",
        stdout: "",
        ...overrides,
    };
};

const presence = (): ToolPresence => {
    return {
        adapter: "markdownlint",
        declared: true,
        declaredVersion: "^0.13.0",
        root: workspaceRoot,
    };
};

describe("markdownlintAdapter", () => {
    beforeEach(() => {
        workspaceRoot = mkdtempSync(join(tmpdir(), "vis-markdownlint-adapter-"));
    });

    afterEach(() => {
        rmSync(workspaceRoot, { force: true, recursive: true });
    });

    it("detects when package.json declares markdownlint-cli2", () => {
        expect.assertions(2);

        const result = markdownlintAdapter.detect(workspaceRoot, { devDependencies: { "markdownlint-cli2": "^0.13.0" } });

        expect(result).toBeDefined();
        expect(result?.declared).toBe(true);
    });

    it("detects when only an .markdownlint.json file is present", () => {
        expect.assertions(2);

        writeFileSync(join(workspaceRoot, ".markdownlint.json"), "{}");
        const result = markdownlintAdapter.detect(workspaceRoot, {});

        expect(result).toBeDefined();
        expect(result?.declared).toBe(false);
    });

    it("detects the legacy markdownlint-cli package", () => {
        expect.assertions(1);

        const result = markdownlintAdapter.detect(workspaceRoot, { devDependencies: { "markdownlint-cli": "^0.40.0" } });

        expect(result).toBeDefined();
    });

    it("returns undefined when neither config nor dep is present", () => {
        expect.assertions(1);

        expect(markdownlintAdapter.detect(workspaceRoot, {})).toBeUndefined();
    });

    it("appends --fix in fix mode and omits it in check mode", () => {
        expect.assertions(2);

        expect(markdownlintAdapter.argsCheck(["docs/a.md"], {})).not.toContain("--fix");
        expect(markdownlintAdapter.argsFix(["docs/a.md"], {})).toContain("--fix");
    });

    it("falls back to **/*.md when no files are provided", () => {
        expect.assertions(1);

        expect(markdownlintAdapter.argsCheck([], {})).toContain("**/*.md");
    });

    it("parses line:col rule message into a finding", () => {
        expect.assertions(1);

        const stderr = "docs/a.md:8:4 MD007/ul-indent unordered list indentation [Expected: 2; Actual: 4]";
        const findings = markdownlintAdapter.parse(stubResult({ exitCode: 1, stderr }), presence());

        expect(findings[0]).toMatchObject({
            adapter: "markdownlint",
            column: 4,
            line: 8,
            ruleId: "MD007/ul-indent",
            severity: "warning",
        });
    });

    it("parses line-only findings (no column) and resolves relative paths against root", () => {
        expect.assertions(2);

        const stderr = "docs/b.md:1 MD041/first-line-heading first line in file should be a top-level heading";
        const findings = markdownlintAdapter.parse(stubResult({ exitCode: 1, stderr }), presence());

        expect(findings[0]?.column).toBeUndefined();
        expect(findings[0]?.file).toBe(`${workspaceRoot}/docs/b.md`);
    });

    it("falls back to stdout if stderr is empty", () => {
        expect.assertions(1);

        const stdout = "/abs/path/c.md:3 MD009/no-trailing-spaces trailing spaces";
        const findings = markdownlintAdapter.parse(stubResult({ exitCode: 1, stdout }), presence());

        expect(findings).toHaveLength(1);
    });

    it("keeps absolute paths as-is", () => {
        expect.assertions(1);

        const stderr = "/repo/d.md:2:1 MD022/blanks-around-headings heading needs blanks";
        const findings = markdownlintAdapter.parse(stubResult({ exitCode: 1, stderr }), presence());

        expect(findings[0]?.file).toBe("/repo/d.md");
    });

    it("returns no findings on a clean run", () => {
        expect.assertions(1);

        expect(markdownlintAdapter.parse(stubResult({}), presence())).toStrictEqual([]);
    });

    it("ignores summary lines that don't match the finding pattern", () => {
        expect.assertions(1);

        const stderr = ["Finding 2 errors in 1 file", "docs/a.md:1 MD041/x heading"].join("\n");

        expect(markdownlintAdapter.parse(stubResult({ exitCode: 1, stderr }), presence())).toHaveLength(1);
    });

    it("produces a stable 16-char cache key", () => {
        expect.assertions(2);

        const key = markdownlintAdapter.cacheKey(presence(), {});

        expect(key).toHaveLength(16);
        expect(markdownlintAdapter.cacheKey(presence(), {})).toBe(key);
    });
});
