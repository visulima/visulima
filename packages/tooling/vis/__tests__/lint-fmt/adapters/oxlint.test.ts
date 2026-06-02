import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";

import { join } from "@visulima/path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { oxlintAdapter } from "../../../src/lint-fmt/adapters/oxlint";
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
    adapter: "oxlint",
    declared: true,
    declaredVersion: "^0.10.0",
    root: workspaceRoot,
});

describe("oxlintAdapter", () => {
    beforeEach(() => {
        workspaceRoot = mkdtempSync(join(tmpdir(), "vis-oxlint-adapter-"));
    });

    afterEach(() => {
        rmSync(workspaceRoot, { force: true, recursive: true });
    });

    it("detects when package.json declares oxlint", () => {
        expect.assertions(2);

        const result = oxlintAdapter.detect(workspaceRoot, { devDependencies: { oxlint: "^0.10.0" } });

        expect(result).toBeDefined();
        expect(result?.declared).toBe(true);
    });

    it("detects when only an .oxlintrc.json file is present", () => {
        expect.assertions(2);

        writeFileSync(join(workspaceRoot, ".oxlintrc.json"), "{}");
        const result = oxlintAdapter.detect(workspaceRoot, {});

        expect(result).toBeDefined();
        expect(result?.declared).toBe(false);
    });

    it("returns undefined when neither config nor dep is present", () => {
        expect.assertions(1);

        expect(oxlintAdapter.detect(workspaceRoot, {})).toBeUndefined();
    });

    it("appends --fix in fix mode and omits it in check mode", () => {
        expect.assertions(2);

        expect(oxlintAdapter.argsCheck(["src/a.ts"], {}).includes("--fix")).toBe(false);
        expect(oxlintAdapter.argsFix(["src/a.ts"], {}).includes("--fix")).toBe(true);
    });

    it("threads --max-warnings as a `=` separated flag", () => {
        expect.assertions(1);

        const args = oxlintAdapter.argsCheck(["src/a.ts"], { maxWarnings: 5 });

        expect(args).toContain("--max-warnings=5");
    });

    it("parses the JSON diagnostics shape into findings", () => {
        expect.assertions(3);

        const stdout = JSON.stringify({
            diagnostics: [
                {
                    code: "no-unused-vars",
                    filename: "/repo/src/a.ts",
                    labels: [{ span: { column: 4, line: 7 } }],
                    message: "Unused",
                    severity: "warning",
                },
                {
                    code: "no-debugger",
                    filename: "/repo/src/b.ts",
                    message: "Debugger",
                    severity: "error",
                },
            ],
        });

        const findings = oxlintAdapter.parse(stubResult({ exitCode: 1, stdout }), presence());

        expect(findings).toHaveLength(2);
        expect(findings[0]).toMatchObject({ adapter: "oxlint", column: 4, file: "/repo/src/a.ts", line: 7, severity: "warning" });
        expect(findings[1]?.severity).toBe("error");
    });

    it("falls back to a synthetic error finding when stdout is not valid JSON", () => {
        expect.assertions(2);

        const findings = oxlintAdapter.parse(stubResult({ exitCode: 2, stdout: "{not json" }), presence());

        expect(findings).toHaveLength(1);
        expect(findings[0]?.severity).toBe("error");
    });

    it("returns no findings when stdout is empty", () => {
        expect.assertions(1);

        expect(oxlintAdapter.parse(stubResult({}), presence())).toStrictEqual([]);
    });

    it("produces a stable 16-char cache key", () => {
        expect.assertions(2);

        const key = oxlintAdapter.cacheKey(presence(), { maxWarnings: 0 });

        expect(key).toHaveLength(16);
        expect(oxlintAdapter.cacheKey(presence(), { maxWarnings: 0 })).toBe(key);
    });
});
