import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";

import { join } from "@visulima/path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { stylelintAdapter } from "../../../src/lint-fmt/adapters/stylelint";
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
        adapter: "stylelint",
        declared: true,
        declaredVersion: "^16.0.0",
        root: workspaceRoot,
    };
};

describe("stylelintAdapter", () => {
    beforeEach(() => {
        workspaceRoot = mkdtempSync(join(tmpdir(), "vis-stylelint-adapter-"));
    });

    afterEach(() => {
        rmSync(workspaceRoot, { force: true, recursive: true });
    });

    it("detects when package.json declares stylelint", () => {
        expect.assertions(2);

        const result = stylelintAdapter.detect(workspaceRoot, { devDependencies: { stylelint: "^16.0.0" } });

        expect(result).toBeDefined();
        expect(result?.declared).toBe(true);
    });

    it("detects when only a .stylelintrc.json file is present", () => {
        expect.assertions(2);

        writeFileSync(join(workspaceRoot, ".stylelintrc.json"), "{}");
        const result = stylelintAdapter.detect(workspaceRoot, {});

        expect(result).toBeDefined();
        expect(result?.declared).toBe(false);
    });

    it("returns undefined when neither config nor dep is present", () => {
        expect.assertions(1);

        expect(stylelintAdapter.detect(workspaceRoot, {})).toBeUndefined();
    });

    it("appends --fix in fix mode and --formatter json in both modes", () => {
        expect.assertions(3);

        const check = stylelintAdapter.argsCheck(["src/a.css"], {});
        const fix = stylelintAdapter.argsFix(["src/a.css"], {});

        expect(check).toContain("--formatter");
        expect(check).not.toContain("--fix");
        expect(fix).toContain("--fix");
    });

    it("threads --max-warnings as a separate arg pair", () => {
        expect.assertions(2);

        const args = stylelintAdapter.argsCheck(["src/a.css"], { maxWarnings: 0 });
        const index = args.indexOf("--max-warnings");

        expect(index).toBeGreaterThanOrEqual(0);
        expect(args[index + 1]).toBe("0");
    });

    it("parses the JSON reporter into findings", () => {
        expect.assertions(3);

        const stdout = JSON.stringify([
            {
                deprecations: [],
                errored: true,
                invalidOptionWarnings: [],
                parseErrors: [],
                source: "/repo/src/a.css",
                warnings: [
                    { column: 5, endColumn: 8, endLine: 1, line: 1, rule: "color-named", severity: "error", text: "Disallowed" },
                    { column: 2, line: 4, rule: "indentation", severity: "warning", text: "Bad indent" },
                ],
            },
        ]);

        const findings = stylelintAdapter.parse(stubResult({ exitCode: 2, stdout }), presence());

        expect(findings).toHaveLength(2);
        expect(findings[0]).toMatchObject({ adapter: "stylelint", file: "/repo/src/a.css", ruleId: "color-named", severity: "error" });
        expect(findings[1]?.severity).toBe("warning");
    });

    it("falls back to a synthetic error when stdout is not valid JSON", () => {
        expect.assertions(2);

        const findings = stylelintAdapter.parse(stubResult({ exitCode: 2, stdout: "{not json" }), presence());

        expect(findings).toHaveLength(1);
        expect(findings[0]?.severity).toBe("error");
    });

    it("returns no findings when stdout is empty", () => {
        expect.assertions(1);

        expect(stylelintAdapter.parse(stubResult({}), presence())).toStrictEqual([]);
    });
});
