import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";

import { join } from "@visulima/path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ruffCheckAdapter, ruffFmtAdapter } from "../../../src/lint-fmt/adapters/ruff";
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

const checkPresence = (): ToolPresence => {
    return {
        adapter: "ruff-check",
        declared: true,
        declaredVersion: "^0.7.0",
        root: workspaceRoot,
    };
};

const fmtPresence = (): ToolPresence => {
    return {
        adapter: "ruff-fmt",
        declared: true,
        declaredVersion: "^0.7.0",
        root: workspaceRoot,
    };
};

describe("ruffCheckAdapter", () => {
    beforeEach(() => {
        workspaceRoot = mkdtempSync(join(tmpdir(), "vis-ruff-check-adapter-"));
    });

    afterEach(() => {
        rmSync(workspaceRoot, { force: true, recursive: true });
    });

    it("detects when package.json declares ruff", () => {
        expect.assertions(2);

        const result = ruffCheckAdapter.detect(workspaceRoot, { devDependencies: { ruff: "^0.7.0" } });

        expect(result).toBeDefined();
        expect(result?.declared).toBe(true);
    });

    it("detects via ruff.toml", () => {
        expect.assertions(2);

        writeFileSync(join(workspaceRoot, "ruff.toml"), "");
        const result = ruffCheckAdapter.detect(workspaceRoot, {});

        expect(result).toBeDefined();
        expect(result?.declared).toBe(false);
    });

    it("detects via pyproject.toml [tool.ruff] section", () => {
        expect.assertions(2);

        writeFileSync(join(workspaceRoot, "pyproject.toml"), "[tool.ruff]\nline-length = 100\n");
        const result = ruffCheckAdapter.detect(workspaceRoot, {});

        expect(result).toBeDefined();
        expect(result?.configFile).toContain("pyproject.toml");
    });

    it("detects via pyproject.toml [tool.ruff.lint] subsection", () => {
        expect.assertions(1);

        writeFileSync(join(workspaceRoot, "pyproject.toml"), "[tool.ruff.lint]\nselect = [\"E\"]\n");

        expect(ruffCheckAdapter.detect(workspaceRoot, {})).toBeDefined();
    });

    it("ignores pyproject.toml without [tool.ruff]", () => {
        expect.assertions(1);

        writeFileSync(join(workspaceRoot, "pyproject.toml"), "[tool.poetry]\nname = \"foo\"\n");

        expect(ruffCheckAdapter.detect(workspaceRoot, {})).toBeUndefined();
    });

    it("returns undefined when neither config nor dep is present", () => {
        expect.assertions(1);

        expect(ruffCheckAdapter.detect(workspaceRoot, {})).toBeUndefined();
    });

    it("appends --fix in fix mode and omits it in check mode", () => {
        expect.assertions(2);

        expect(ruffCheckAdapter.argsCheck(["src/a.py"], {})).not.toContain("--fix");
        expect(ruffCheckAdapter.argsFix(["src/a.py"], {})).toContain("--fix");
    });

    it("requests JSON output", () => {
        expect.assertions(1);

        const args = ruffCheckAdapter.argsCheck(["src/a.py"], {});

        expect(args).toContain("--output-format=json");
    });

    it("parses the JSON diagnostics shape into findings", () => {
        expect.assertions(4);

        const stdout = JSON.stringify([
            {
                code: "E501",
                end_location: { column: 100, row: 7 },
                filename: "/repo/src/a.py",
                fix: null,
                location: { column: 80, row: 7 },
                message: "Line too long",
            },
            {
                code: "F401",
                filename: "/repo/src/b.py",
                fix: { applicability: "safe" },
                location: { column: 1, row: 1 },
                message: "imported but unused",
            },
        ]);

        const findings = ruffCheckAdapter.parse(stubResult({ exitCode: 1, stdout }), checkPresence());

        expect(findings).toHaveLength(2);
        expect(findings[0]).toMatchObject({
            adapter: "ruff-check",
            column: 80,
            endColumn: 100,
            endLine: 7,
            file: "/repo/src/a.py",
            fixable: false,
            line: 7,
            ruleId: "E501",
        });
        expect(findings[1]?.fixable).toBe(true);
        expect(findings[1]?.ruleId).toBe("F401");
    });

    it("falls back to a synthetic error when stdout is not valid JSON", () => {
        expect.assertions(2);

        const findings = ruffCheckAdapter.parse(stubResult({ exitCode: 2, stdout: "{not json" }), checkPresence());

        expect(findings).toHaveLength(1);
        expect(findings[0]?.severity).toBe("error");
    });

    it("returns no findings when stdout is empty", () => {
        expect.assertions(1);

        expect(ruffCheckAdapter.parse(stubResult({}), checkPresence())).toStrictEqual([]);
    });

    it("produces a stable 16-char cache key", () => {
        expect.assertions(2);

        const key = ruffCheckAdapter.cacheKey(checkPresence(), {});

        expect(key).toHaveLength(16);
        expect(ruffCheckAdapter.cacheKey(checkPresence(), {})).toBe(key);
    });
});

describe("ruffFmtAdapter", () => {
    beforeEach(() => {
        workspaceRoot = mkdtempSync(join(tmpdir(), "vis-ruff-fmt-adapter-"));
    });

    afterEach(() => {
        rmSync(workspaceRoot, { force: true, recursive: true });
    });

    it("adds --check in check mode and omits it in fix mode", () => {
        expect.assertions(2);

        expect(ruffFmtAdapter.argsCheck(["src/a.py"], {})).toContain("--check");
        expect(ruffFmtAdapter.argsFix(["src/a.py"], {})).not.toContain("--check");
    });

    it("returns no findings on zero exit code", () => {
        expect.assertions(1);

        expect(ruffFmtAdapter.parse(stubResult({ exitCode: 0, stdout: "" }), fmtPresence())).toStrictEqual([]);
    });

    it("parses 'Would reformat:' lines into one finding per file", () => {
        expect.assertions(3);

        const stdout = ["Would reformat: /repo/src/a.py", "Would reformat: /repo/src/b.py", ""].join("\n");

        const findings = ruffFmtAdapter.parse(stubResult({ exitCode: 1, stdout }), fmtPresence());

        expect(findings).toHaveLength(2);
        expect(findings[0]).toMatchObject({
            adapter: "ruff-fmt",
            file: "/repo/src/a.py",
            fixable: true,
            severity: "info",
        });
        expect(findings[1]?.file).toBe("/repo/src/b.py");
    });

    it("deduplicates repeated reformat lines", () => {
        expect.assertions(1);

        const stdout = ["Would reformat: /repo/src/a.py", "Would reformat: /repo/src/a.py"].join("\n");

        expect(ruffFmtAdapter.parse(stubResult({ exitCode: 1, stdout }), fmtPresence())).toHaveLength(1);
    });

    it("joins relative paths against the workspace root", () => {
        expect.assertions(1);

        const stdout = "Would reformat: src/a.py";
        const findings = ruffFmtAdapter.parse(stubResult({ exitCode: 1, stdout }), fmtPresence());

        expect(findings[0]?.file).toBe(join(workspaceRoot, "src/a.py"));
    });
});
