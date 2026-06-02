import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";

import { join } from "@visulima/path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { eslintAdapter } from "../../../src/lint-fmt/adapters/eslint";
import type { RunResult, ToolPresence } from "../../../src/lint-fmt/config-types";

let workspaceRoot: string;

const stubResult = (overrides: Partial<RunResult>): RunResult => ({
    durationMs: 1,
    exitCode: 0,
    stderr: "",
    stdout: "",
    ...overrides,
});

const presence = (): ToolPresence => ({
    adapter: "eslint",
    declared: true,
    declaredVersion: "^9.0.0",
    root: workspaceRoot,
});

describe("eslintAdapter", () => {
    beforeEach(() => {
        workspaceRoot = mkdtempSync(join(tmpdir(), "vis-eslint-adapter-"));
    });

    afterEach(() => {
        rmSync(workspaceRoot, { force: true, recursive: true });
    });

    it("detects when package.json declares eslint", () => {
        expect.assertions(2);

        const result = eslintAdapter.detect(workspaceRoot, { devDependencies: { eslint: "^9.0.0" } });

        expect(result).toBeDefined();
        expect(result?.declared).toBe(true);
    });

    it("detects when a flat config file is present even without a dep declaration", () => {
        expect.assertions(2);

        writeFileSync(join(workspaceRoot, "eslint.config.js"), "");

        const result = eslintAdapter.detect(workspaceRoot, {});

        expect(result).toBeDefined();
        expect(result?.declared).toBe(false);
    });

    it("returns undefined when neither config nor dep is present", () => {
        expect.assertions(1);

        expect(eslintAdapter.detect(workspaceRoot, {})).toBeUndefined();
    });

    it("appends --fix in fix mode and omits it in check mode", () => {
        expect.assertions(2);

        const check = eslintAdapter.argsCheck(["src/a.ts"], {});
        const fix = eslintAdapter.argsFix(["src/a.ts"], {});

        expect(check.includes("--fix")).toBe(false);
        expect(fix.includes("--fix")).toBe(true);
    });

    it("includes --max-warnings when set", () => {
        expect.assertions(1);

        const args = eslintAdapter.argsCheck(["src/a.ts"], { maxWarnings: 0 });

        expect(args).toContain("--max-warnings");
    });

    it("parses the JSON reporter into findings", () => {
        expect.assertions(3);

        const stdout = JSON.stringify([
            {
                filePath: "/repo/src/a.ts",
                messages: [
                    { column: 5, fix: undefined, line: 10, message: "Bad", ruleId: "no-bad", severity: 2 },
                    { line: 11, message: "Meh", ruleId: null, severity: 1 },
                ],
            },
        ]);

        const findings = eslintAdapter.parse(stubResult({ exitCode: 1, stdout }), presence());

        expect(findings).toHaveLength(2);
        expect(findings[0]).toMatchObject({ adapter: "eslint", file: "/repo/src/a.ts", ruleId: "no-bad", severity: "error" });
        expect(findings[1]).toMatchObject({ severity: "warning" });
    });

    it("returns an empty list for empty stdout", () => {
        expect.assertions(1);

        expect(eslintAdapter.parse(stubResult({}), presence())).toStrictEqual([]);
    });

    it("emits a single synthetic finding when stdout is not valid JSON", () => {
        expect.assertions(2);

        const findings = eslintAdapter.parse(stubResult({ exitCode: 2, stdout: "not json" }), presence());

        expect(findings).toHaveLength(1);
        expect(findings[0]?.severity).toBe("error");
    });

    it("produces a stable, short cache key", () => {
        expect.assertions(2);

        const key = eslintAdapter.cacheKey(presence(), { maxWarnings: 0 });

        expect(key).toHaveLength(16);
        expect(eslintAdapter.cacheKey(presence(), { maxWarnings: 0 })).toBe(key);
    });
});
