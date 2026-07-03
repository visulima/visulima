import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";

import { join } from "@visulima/path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { denoFmtAdapter, denoLintAdapter } from "../../../src/lint-fmt/adapters/deno";
import type { AdapterId, RunResult, ToolPresence } from "../../../src/lint-fmt/config-types";

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

const presence = (id: AdapterId): ToolPresence => {
    return {
        adapter: id,
        declared: false,
        root: workspaceRoot,
    };
};

describe("denoLintAdapter", () => {
    beforeEach(() => {
        workspaceRoot = mkdtempSync(join(tmpdir(), "vis-deno-lint-adapter-"));
    });

    afterEach(() => {
        rmSync(workspaceRoot, { force: true, recursive: true });
    });

    it("detects only when deno.json is present (no fallback dep)", () => {
        expect.assertions(2);

        expect(denoLintAdapter.detect(workspaceRoot, { devDependencies: { deno: "*" } })).toBeUndefined();

        writeFileSync(join(workspaceRoot, "deno.json"), "{}");
        const result = denoLintAdapter.detect(workspaceRoot, {});

        expect(result?.declared).toBe(false);
    });

    it("calls `deno lint` directly (no pnpm exec)", () => {
        expect.assertions(1);

        expect(denoLintAdapter.bin(presence("deno-lint"))).toStrictEqual(["deno", "lint"]);
    });

    it("appends --fix in fix mode and --json in both modes", () => {
        expect.assertions(3);

        const check = denoLintAdapter.argsCheck(["src/a.ts"], {});
        const fix = denoLintAdapter.argsFix(["src/a.ts"], {});

        expect(check).toContain("--json");
        expect(check).not.toContain("--fix");
        expect(fix).toContain("--fix");
    });

    it("parses 0-based diagnostics into 1-based findings", () => {
        expect.assertions(3);

        // A drive-less URL like `file:///repo/src/a.ts` makes fileURLToPath throw
        // "File URL path must be absolute" on Windows, so derive a platform-valid absolute
        // file URL (real `deno` emits drive-qualified URLs on Windows anyway).
        const sourceFileUrl = pathToFileURL(join(workspaceRoot, "src", "a.ts")).href;
        const stdout = JSON.stringify({
            diagnostics: [
                {
                    code: "no-unused-vars",
                    filename: sourceFileUrl,
                    message: "`x` is never used",
                    range: { end: { col: 6, line: 0 }, start: { col: 5, line: 0 } },
                },
            ],
            errors: [],
        });

        const findings = denoLintAdapter.parse(stubResult({ exitCode: 1, stdout }), presence("deno-lint"));

        expect(findings).toHaveLength(1);
        // The adapter resolves `file://` URLs to native paths (back-slashes on Windows), so compute
        // the expected value the same way rather than hard-coding the POSIX form.
        expect(findings[0]).toMatchObject({ column: 6, file: fileURLToPath(sourceFileUrl), line: 1, ruleId: "no-unused-vars" });
        expect(findings[0]?.severity).toBe("warning");
    });

    it("returns a synthetic error finding when stdout is not valid JSON", () => {
        expect.assertions(2);

        const findings = denoLintAdapter.parse(stubResult({ exitCode: 2, stdout: "{not json" }), presence("deno-lint"));

        expect(findings).toHaveLength(1);
        expect(findings[0]?.severity).toBe("error");
    });
});

describe("denoFmtAdapter", () => {
    beforeEach(() => {
        workspaceRoot = mkdtempSync(join(tmpdir(), "vis-deno-fmt-adapter-"));
    });

    afterEach(() => {
        rmSync(workspaceRoot, { force: true, recursive: true });
    });

    it("detects only when deno.json[c] is present", () => {
        expect.assertions(2);

        expect(denoFmtAdapter.detect(workspaceRoot, {})).toBeUndefined();

        writeFileSync(join(workspaceRoot, "deno.jsonc"), "{}");

        expect(denoFmtAdapter.detect(workspaceRoot, {})?.adapter).toBe("deno-fmt");
    });

    it("adds --check only in check mode and uses `deno fmt` as bin", () => {
        expect.assertions(3);

        expect(denoFmtAdapter.bin(presence("deno-fmt"))).toStrictEqual(["deno", "fmt"]);
        expect(denoFmtAdapter.argsCheck(["src/a.ts"], {})).toContain("--check");
        expect(denoFmtAdapter.argsFix(["src/a.ts"], {})).not.toContain("--check");
    });

    it("turns each `from <path>:` header into one info finding (deduped)", () => {
        expect.assertions(3);

        const stdout = "from /repo/a.ts:\n- old\n+ new\nfrom /repo/b.ts:\n- old\n+ new\nfrom /repo/a.ts:\n";
        const findings = denoFmtAdapter.parse(stubResult({ exitCode: 1, stdout }), presence("deno-fmt"));

        expect(findings).toHaveLength(2);
        expect(findings[0]?.file).toBe("/repo/a.ts");
        expect(findings[0]?.severity).toBe("info");
    });

    it("returns no findings when deno fmt exits 0", () => {
        expect.assertions(1);

        expect(denoFmtAdapter.parse(stubResult({ stdout: "" }), presence("deno-fmt"))).toStrictEqual([]);
    });
});
