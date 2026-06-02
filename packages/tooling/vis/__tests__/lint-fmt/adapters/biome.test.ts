import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";

import { join } from "@visulima/path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { biomeAdapter } from "../../../src/lint-fmt/adapters/biome";
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
    adapter: "biome",
    declared: true,
    declaredVersion: "^2.0.0",
    root: workspaceRoot,
});

describe("biomeAdapter", () => {
    beforeEach(() => {
        workspaceRoot = mkdtempSync(join(tmpdir(), "vis-biome-adapter-"));
    });

    afterEach(() => {
        rmSync(workspaceRoot, { force: true, recursive: true });
    });

    it("detects when package.json declares @biomejs/biome", () => {
        expect.assertions(2);

        const result = biomeAdapter.detect(workspaceRoot, { devDependencies: { "@biomejs/biome": "^2.0.0" } });

        expect(result).toBeDefined();
        expect(result?.declared).toBe(true);
    });

    it("detects when only a biome.json file is present", () => {
        expect.assertions(2);

        writeFileSync(join(workspaceRoot, "biome.json"), "{}");
        const result = biomeAdapter.detect(workspaceRoot, {});

        expect(result).toBeDefined();
        expect(result?.declared).toBe(false);
    });

    it("returns undefined when neither config nor dep is present", () => {
        expect.assertions(1);

        expect(biomeAdapter.detect(workspaceRoot, {})).toBeUndefined();
    });

    it("uses `check --reporter=json` and adds --write only in fix mode", () => {
        expect.assertions(4);

        const check = biomeAdapter.argsCheck(["src/a.ts"], {});
        const fix = biomeAdapter.argsFix(["src/a.ts"], {});

        expect(check[0]).toBe("check");
        expect(check).toContain("--reporter=json");
        expect(check.includes("--write")).toBe(false);
        expect(fix.includes("--write")).toBe(true);
    });

    it("threads --max-diagnostics when maxWarnings is set", () => {
        expect.assertions(1);

        const args = biomeAdapter.argsCheck(["src/a.ts"], { maxWarnings: 25 });

        expect(args).toContain("--max-diagnostics=25");
    });

    it("parses lint diagnostics into findings with rule + position", () => {
        expect.assertions(3);

        const stdout = JSON.stringify({
            diagnostics: [
                {
                    category: "lint/correctness/noUnusedVariables",
                    location: { end: { column: 6, line: 1 }, path: "src/a.ts", start: { column: 5, line: 1 } },
                    message: "Unused variable",
                    severity: "warning",
                },
            ],
        });

        const findings = biomeAdapter.parse(stubResult({ exitCode: 1, stdout }), presence());

        expect(findings).toHaveLength(1);
        expect(findings[0]).toMatchObject({ column: 5, line: 1, ruleId: "lint/correctness/noUnusedVariables", severity: "warning" });
        expect(findings[0]?.file.endsWith("src/a.ts")).toBe(true);
    });

    it("rewrites format diagnostics to the shared `would change` message", () => {
        expect.assertions(2);

        const stdout = JSON.stringify({
            diagnostics: [
                {
                    category: "format",
                    location: { end: { column: 0, line: 0 }, path: "src/a.ts", start: { column: 0, line: 0 } },
                    message: "Formatter would have printed the following content:",
                    severity: "error",
                },
            ],
        });

        const findings = biomeAdapter.parse(stubResult({ exitCode: 1, stdout }), presence());

        expect(findings[0]?.message).toBe("Code style issues would be auto-fixed");
        expect(findings[0]?.line).toBeUndefined();
    });

    it("falls back to a synthetic error when stdout is not valid JSON", () => {
        expect.assertions(2);

        const findings = biomeAdapter.parse(stubResult({ exitCode: 2, stdout: "{broken" }), presence());

        expect(findings).toHaveLength(1);
        expect(findings[0]?.severity).toBe("error");
    });

    it("returns no findings when stdout is empty", () => {
        expect.assertions(1);

        expect(biomeAdapter.parse(stubResult({}), presence())).toStrictEqual([]);
    });
});
