import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";

import { join } from "@visulima/path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { oxfmtAdapter } from "../../../src/lint-fmt/adapters/oxfmt";
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
        adapter: "oxfmt",
        declared: true,
        declaredVersion: "^0.1.0",
        root: workspaceRoot,
    };
};

describe("oxfmtAdapter", () => {
    beforeEach(() => {
        workspaceRoot = mkdtempSync(join(tmpdir(), "vis-oxfmt-adapter-"));
    });

    afterEach(() => {
        rmSync(workspaceRoot, { force: true, recursive: true });
    });

    it("detects when package.json declares oxfmt", () => {
        expect.assertions(2);

        const result = oxfmtAdapter.detect(workspaceRoot, { devDependencies: { oxfmt: "^0.1.0" } });

        expect(result).toBeDefined();
        expect(result?.declared).toBe(true);
    });

    it("detects when only an .oxfmtrc file is present", () => {
        expect.assertions(2);

        writeFileSync(join(workspaceRoot, ".oxfmtrc.json"), "{}");
        const result = oxfmtAdapter.detect(workspaceRoot, {});

        expect(result).toBeDefined();
        expect(result?.declared).toBe(false);
    });

    it("returns undefined when neither config nor dep is present", () => {
        expect.assertions(1);

        expect(oxfmtAdapter.detect(workspaceRoot, {})).toBeUndefined();
    });

    it("uses --list-different in check mode and --write in fix mode", () => {
        expect.assertions(2);

        expect(oxfmtAdapter.argsCheck(["src/a.ts"], {})).toContain("--list-different");
        expect(oxfmtAdapter.argsFix(["src/a.ts"], {})).toContain("--write");
    });

    it("turns each emitted path into a single info finding", () => {
        expect.assertions(3);

        const stdout = "src/a.ts\nsrc/b.ts\n[info] processed 2 files\n";
        const findings = oxfmtAdapter.parse(stubResult({ exitCode: 1, stdout }), presence());

        expect(findings).toHaveLength(2);
        expect(findings[0]?.severity).toBe("info");
        expect(findings[1]?.file.endsWith("src/b.ts")).toBe(true);
    });

    it("returns no findings when oxfmt exits 0", () => {
        expect.assertions(1);

        expect(oxfmtAdapter.parse(stubResult({ stdout: "" }), presence())).toStrictEqual([]);
    });
});
