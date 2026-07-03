import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";

import { join } from "@visulima/path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { shellcheckAdapter } from "../../../src/lint-fmt/adapters/shellcheck";
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
        adapter: "shellcheck",
        declared: false,
        root: workspaceRoot,
    };
};

describe("shellcheckAdapter", () => {
    beforeEach(() => {
        workspaceRoot = mkdtempSync(join(tmpdir(), "vis-shellcheck-adapter-"));
    });

    afterEach(() => {
        rmSync(workspaceRoot, { force: true, recursive: true });
    });

    it("detects via .shellcheckrc", () => {
        expect.assertions(2);

        writeFileSync(join(workspaceRoot, ".shellcheckrc"), "");
        const result = shellcheckAdapter.detect(workspaceRoot, {});

        expect(result).toBeDefined();
        expect(result?.declared).toBe(false);
    });

    it("detects via package.json shellcheck declaration", () => {
        expect.assertions(2);

        const result = shellcheckAdapter.detect(workspaceRoot, { devDependencies: { shellcheck: "^2.0.0" } });

        expect(result).toBeDefined();
        expect(result?.declared).toBe(true);
    });

    it("returns undefined when neither config nor dep is present", () => {
        expect.assertions(1);

        expect(shellcheckAdapter.detect(workspaceRoot, {})).toBeUndefined();
    });

    it("requests json1 reporter", () => {
        expect.assertions(1);

        const args = shellcheckAdapter.argsCheck(["script.sh"], {});

        expect(args).toContain("--format=json1");
    });

    it("uses the same args for check and fix (shellcheck has no fix mode)", () => {
        expect.assertions(1);

        const check = shellcheckAdapter.argsCheck(["a.sh"], {});
        const fix = shellcheckAdapter.argsFix(["a.sh"], {});

        expect(fix).toStrictEqual(check);
    });

    it("parses json1 comments into findings", () => {
        expect.assertions(2);

        const stdout = JSON.stringify({
            comments: [
                {
                    code: 2086,
                    column: 5,
                    endColumn: 19,
                    endLine: 3,
                    file: "script.sh",
                    fix: null,
                    level: "warning",
                    line: 3,
                    message: "Double quote to prevent globbing and word splitting.",
                },
                {
                    code: 2034,
                    column: 1,
                    file: "/repo/other.sh",
                    fix: { replacements: [] },
                    level: "info",
                    line: 1,
                    message: "VAR appears unused.",
                },
            ],
        });

        const findings = shellcheckAdapter.parse(stubResult({ exitCode: 1, stdout }), presence());

        expect(findings[0]).toMatchObject({
            adapter: "shellcheck",
            column: 5,
            endColumn: 19,
            endLine: 3,
            file: `${workspaceRoot}/script.sh`,
            fixable: false,
            line: 3,
            ruleId: "SC2086",
            severity: "warning",
        });
        expect(findings[1]).toMatchObject({
            file: "/repo/other.sh",
            fixable: true,
            ruleId: "SC2034",
            severity: "info",
        });
    });

    it("maps the style level to info", () => {
        expect.assertions(1);

        const stdout = JSON.stringify({ comments: [{ code: 1, file: "a.sh", level: "style", line: 1, message: "x" }] });
        const findings = shellcheckAdapter.parse(stubResult({ exitCode: 1, stdout }), presence());

        expect(findings[0]?.severity).toBe("info");
    });

    it("returns no findings when stdout is empty", () => {
        expect.assertions(1);

        expect(shellcheckAdapter.parse(stubResult({}), presence())).toStrictEqual([]);
    });

    it("falls back to a synthetic error when stdout is not valid JSON", () => {
        expect.assertions(2);

        const findings = shellcheckAdapter.parse(stubResult({ exitCode: 2, stdout: "{not json" }), presence());

        expect(findings).toHaveLength(1);
        expect(findings[0]?.severity).toBe("error");
    });

    it("produces a stable 16-char cache key", () => {
        expect.assertions(2);

        const key = shellcheckAdapter.cacheKey(presence(), {});

        expect(key).toHaveLength(16);
        expect(shellcheckAdapter.cacheKey(presence(), {})).toBe(key);
    });
});
