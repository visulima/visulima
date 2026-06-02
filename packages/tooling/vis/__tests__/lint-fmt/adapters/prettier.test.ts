import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";

import { join } from "@visulima/path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { prettierAdapter } from "../../../src/lint-fmt/adapters/prettier";
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
    adapter: "prettier",
    declared: true,
    declaredVersion: "^3.0.0",
    root: workspaceRoot,
});

describe("prettierAdapter", () => {
    beforeEach(() => {
        workspaceRoot = mkdtempSync(join(tmpdir(), "vis-prettier-adapter-"));
    });

    afterEach(() => {
        rmSync(workspaceRoot, { force: true, recursive: true });
    });

    it("detects when package.json declares prettier", () => {
        expect.assertions(2);

        const result = prettierAdapter.detect(workspaceRoot, { devDependencies: { prettier: "^3.0.0" } });

        expect(result).toBeDefined();
        expect(result?.declared).toBe(true);
    });

    it("detects when only a config file is present", () => {
        expect.assertions(2);

        writeFileSync(join(workspaceRoot, ".prettierrc"), "{}");
        const result = prettierAdapter.detect(workspaceRoot, {});

        expect(result).toBeDefined();
        expect(result?.declared).toBe(false);
    });

    it("returns undefined when neither config nor dep is present", () => {
        expect.assertions(1);

        expect(prettierAdapter.detect(workspaceRoot, {})).toBeUndefined();
    });

    it("uses --list-different in check mode and --write in fix mode", () => {
        expect.assertions(2);

        expect(prettierAdapter.argsCheck(["src/a.ts"], {})).toContain("--list-different");
        expect(prettierAdapter.argsFix(["src/a.ts"], {})).toContain("--write");
    });

    it("turns each `would change` path into a single info finding", () => {
        expect.assertions(3);

        const stdout = "src/a.ts\nsrc/b.ts\n[warn] Code style issues found\n";
        const findings = prettierAdapter.parse(stubResult({ exitCode: 1, stdout }), presence());

        expect(findings).toHaveLength(2);
        expect(findings[0]?.severity).toBe("info");
        expect(findings[1]?.file.endsWith("src/b.ts")).toBe(true);
    });

    it("returns no findings when prettier exits 0 (everything formatted or fixed)", () => {
        expect.assertions(1);

        expect(prettierAdapter.parse(stubResult({ stdout: "src/a.ts 4ms\n" }), presence())).toStrictEqual([]);
    });
});
