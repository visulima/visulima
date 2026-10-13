import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";

import { join } from "@visulima/path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { typecheckAdapter } from "../../../src/lint-fmt/adapters/typecheck";
import type { RunResult, ToolPresence } from "../../../src/lint-fmt/config-types";

let workspaceRoot: string;

const result = (overrides: Partial<RunResult>): RunResult => {
    return { durationMs: 1, exitCode: 0, stderr: "", stdout: "", ...overrides };
};

const presence = (): ToolPresence => {
    return { adapter: "typecheck", configFile: join(workspaceRoot, "tsconfig.json"), declared: true, root: workspaceRoot };
};

const writePackageJson = (devDependencies: Record<string, string>): Record<string, unknown> => {
    const packageJson = { devDependencies, name: "x" };

    writeFileSync(join(workspaceRoot, "package.json"), JSON.stringify(packageJson));

    return packageJson;
};

describe("typecheckAdapter", () => {
    beforeEach(() => {
        workspaceRoot = mkdtempSync(join(tmpdir(), "vis-typecheck-adapter-"));
    });

    afterEach(() => {
        rmSync(workspaceRoot, { force: true, recursive: true });
    });

    describe("detect", () => {
        it("needs both a tsconfig.json and a TypeScript dependency", () => {
            expect.assertions(4);

            // No tsconfig at all: must be "not detected", never a throw (detect runs on every lint).
            expect(typecheckAdapter.detect(workspaceRoot, writePackageJson({ typescript: "^5.0.0" }))).toBeUndefined();

            writeFileSync(join(workspaceRoot, "tsconfig.json"), "{}");

            expect(typecheckAdapter.detect(workspaceRoot, {})).toBeUndefined();
            expect(typecheckAdapter.detect(workspaceRoot, writePackageJson({ typescript: "^5.0.0" }))).toMatchObject({
                adapter: "typecheck",
                configFile: join(workspaceRoot, "tsconfig.json"),
                declaredVersion: "^5.0.0",
            });
            expect(typecheckAdapter.detect(workspaceRoot, writePackageJson({ "@typescript/native-preview": "7.0.0" }))).toBeDefined();
        });

        it("does not adopt a tsconfig from a parent directory", () => {
            expect.assertions(1);

            writeFileSync(join(workspaceRoot, "tsconfig.json"), "{}");

            const child = join(workspaceRoot, "packages", "child");

            mkdirSync(child, { recursive: true });

            expect(typecheckAdapter.detect(child, { devDependencies: { typescript: "^5.0.0" } })).toBeUndefined();
        });

        it("is opt-in and project-scoped", () => {
            expect.assertions(2);

            expect(typecheckAdapter.optIn).toBe(true);
            expect(typecheckAdapter.scope).toBe("project");
        });
    });

    describe("bin", () => {
        it("checks a plain project with -p", () => {
            expect.assertions(1);

            writePackageJson({ typescript: "^5.0.0" });
            writeFileSync(join(workspaceRoot, "tsconfig.json"), JSON.stringify({ include: ["src"] }));

            expect(typecheckAdapter.bin(presence())).toStrictEqual(["pnpm", "exec", "tsc", "-p", "tsconfig.json", "--noEmit", "--pretty", "false"]);
        });

        it("uses build mode for a solution-style tsconfig, which plain tsc would pass without checking anything", () => {
            expect.assertions(1);

            writePackageJson({ typescript: "^5.0.0" });
            // JSONC: comments and a trailing comma must not hide the references.
            writeFileSync(join(workspaceRoot, "tsconfig.json"), "{\n  // solution\n  \"files\": [],\n  \"references\": [{ \"path\": \"./a\" },],\n}\n");

            expect(typecheckAdapter.bin(presence())).toStrictEqual(["pnpm", "exec", "tsc", "-b", "--noEmit", "--pretty", "false", "tsconfig.json"]);
        });

        it("picks tsgo only when the native preview is the sole TypeScript declared", () => {
            expect.assertions(2);

            writeFileSync(join(workspaceRoot, "tsconfig.json"), "{}");
            writePackageJson({ "@typescript/native-preview": "7.0.0" });

            expect(typecheckAdapter.bin(presence())[2]).toBe("tsgo");

            writePackageJson({ "@typescript/native-preview": "7.0.0", typescript: "^5.0.0" });

            expect(typecheckAdapter.bin(presence())[2]).toBe("tsc");
        });
    });

    describe("args", () => {
        it("ignores the file list and forwards only extra args, in check and fix mode", () => {
            expect.assertions(3);

            expect(typecheckAdapter.argsCheck(["src/a.ts"], {})).toStrictEqual([]);
            expect(typecheckAdapter.argsCheck(["."], { extraArgs: ["--incremental"] })).toStrictEqual(["--incremental"]);
            expect(typecheckAdapter.argsFix(["src/a.ts"], { extraArgs: ["--incremental"] })).toStrictEqual(["--incremental"]);
        });
    });

    describe("parse", () => {
        it("parses real tsc output", () => {
            expect.assertions(1);

            const stdout = [
                "p/src/y.ts(1,14): error TS2322: Type 'string' is not assignable to type 'number'.",
                "p/src/y.ts(2,14): error TS2322: Type 'number' is not assignable to type 'string'.",
            ].join("\n");

            expect(typecheckAdapter.parse(result({ exitCode: 2, stdout }), presence())).toStrictEqual([
                {
                    adapter: "typecheck",
                    column: 14,
                    file: `${workspaceRoot}/p/src/y.ts`,
                    fixable: false,
                    line: 1,
                    message: "Type 'string' is not assignable to type 'number'.",
                    ruleId: "TS2322",
                    severity: "error",
                },
                {
                    adapter: "typecheck",
                    column: 14,
                    file: `${workspaceRoot}/p/src/y.ts`,
                    fixable: false,
                    line: 2,
                    message: "Type 'number' is not assignable to type 'string'.",
                    ruleId: "TS2322",
                    severity: "error",
                },
            ]);
        });

        it("anchors on the last (line,col) so route-group paths with parentheses survive", () => {
            expect.assertions(3);

            const [finding] = typecheckAdapter.parse(result({ exitCode: 2, stdout: "app/(marketing)/page.tsx(3,5): error TS2322: nope" }), presence());

            expect(finding?.file).toBe(`${workspaceRoot}/app/(marketing)/page.tsx`);
            expect(finding?.line).toBe(3);
            expect(finding?.column).toBe(5);
        });

        it("keeps absolute and Windows drive paths as they are", () => {
            expect.assertions(2);

            const findings = typecheckAdapter.parse(result({ exitCode: 2, stdout: "/abs/a.ts(1,2): error TS1: x\nC:\\proj\\b.ts(4,5): error TS2: y" }), presence());

            expect(findings[0]?.file).toBe("/abs/a.ts");
            expect(findings[1]?.file).toBe(String.raw`C:\proj\b.ts`);
        });

        it("appends indented continuation lines to the previous message", () => {
            expect.assertions(2);

            const stdout = ["a.ts(1,1): error TS2345: Argument of type 'X' is not assignable.", "  Types of property 'a' are incompatible.", "    Type 'string' is not assignable to type 'number'."].join("\n");
            const findings = typecheckAdapter.parse(result({ exitCode: 2, stdout }), presence());

            expect(findings).toHaveLength(1);
            expect(findings[0]?.message).toBe("Argument of type 'X' is not assignable.\nTypes of property 'a' are incompatible.\nType 'string' is not assignable to type 'number'.");
        });

        it("attributes config diagnostics without a file to the workspace root", () => {
            expect.assertions(2);

            const findings = typecheckAdapter.parse(result({ exitCode: 2, stdout: "error TS18003: No inputs were found in config file." }), presence());

            expect(findings).toHaveLength(1);
            expect(findings[0]).toMatchObject({ file: workspaceRoot, ruleId: "TS18003", severity: "error" });
        });

        it("is empty only for a clean exit", () => {
            expect.assertions(1);

            expect(typecheckAdapter.parse(result({ exitCode: 0 }), presence())).toStrictEqual([]);
        });

        it("never lets a failed run with unrecognised output read as clean", () => {
            expect.assertions(3);

            const failed = typecheckAdapter.parse(result({ exitCode: 1, stderr: "pnpm: command not found: tsc" }), presence());

            expect(failed).toHaveLength(1);
            expect(failed[0]?.message).toContain("pnpm: command not found: tsc");
            expect(failed[0]?.severity).toBe("error");
        });

        it("treats a killed process as a failure", () => {
            expect.assertions(1);

            expect(typecheckAdapter.parse(result({ exitCode: null }), presence())[0]?.message).toContain("did not complete");
        });
    });
});
