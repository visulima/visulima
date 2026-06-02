import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";

import { join } from "@visulima/path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { dprintAdapter } from "../../../src/lint-fmt/adapters/dprint";
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
    adapter: "dprint",
    declared: true,
    declaredVersion: "^0.54.0",
    root: workspaceRoot,
});

describe("dprintAdapter", () => {
    beforeEach(() => {
        workspaceRoot = mkdtempSync(join(tmpdir(), "vis-dprint-adapter-"));
    });

    afterEach(() => {
        rmSync(workspaceRoot, { force: true, recursive: true });
    });

    it("detects when package.json declares dprint", () => {
        expect.assertions(2);

        const result = dprintAdapter.detect(workspaceRoot, { devDependencies: { dprint: "^0.54.0" } });

        expect(result).toBeDefined();
        expect(result?.declared).toBe(true);
    });

    it("detects when only a dprint.json file is present", () => {
        expect.assertions(2);

        writeFileSync(join(workspaceRoot, "dprint.json"), "{}");
        const result = dprintAdapter.detect(workspaceRoot, {});

        expect(result).toBeDefined();
        expect(result?.declared).toBe(false);
    });

    it("returns undefined when neither config nor dep is present", () => {
        expect.assertions(1);

        expect(dprintAdapter.detect(workspaceRoot, {})).toBeUndefined();
    });

    it("uses `check --list-different` in check mode and `fmt` in fix mode", () => {
        expect.assertions(4);

        const check = dprintAdapter.argsCheck(["src/a.ts"], {});
        const fix = dprintAdapter.argsFix(["src/a.ts"], {});

        expect(check[0]).toBe("check");
        expect(check).toContain("--list-different");
        expect(fix[0]).toBe("fmt");
        expect(fix.includes("--list-different")).toBe(false);
    });

    it("turns each emitted path into a single info finding", () => {
        expect.assertions(3);

        const stdout = "src/a.ts\nsrc/b.ts\nChecked 2 files\n";
        const findings = dprintAdapter.parse(stubResult({ exitCode: 1, stdout }), presence());

        expect(findings).toHaveLength(2);
        expect(findings[0]?.severity).toBe("info");
        expect(findings[1]?.file.endsWith("src/b.ts")).toBe(true);
    });

    it("returns no findings when dprint exits 0", () => {
        expect.assertions(1);

        expect(dprintAdapter.parse(stubResult({ stdout: "" }), presence())).toStrictEqual([]);
    });
});
