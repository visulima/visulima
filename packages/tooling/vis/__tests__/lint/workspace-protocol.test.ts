import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { iterateWorkspaceDeps } from "../../src/util/workspace-deps";
import { applyWorkspaceProtocolFixes, lintWorkspaceProtocol } from "../../src/lint/workspace-protocol";

let workspaceRoot: string;

const writeJson = (path: string, data: unknown): void => {
    mkdirSync(join(workspaceRoot, path, ".."), { recursive: true });
    writeFileSync(join(workspaceRoot, path), `${JSON.stringify(data, null, 2)}\n`);
};

describe("workspace-protocol-lint", () => {
    beforeEach(() => {
        workspaceRoot = mkdtempSync(join(tmpdir(), "vis-workspace-protocol-"));
    });

    afterEach(() => {
        rmSync(workspaceRoot, { force: true, recursive: true });
    });

    describe(lintWorkspaceProtocol, () => {
        it("flags internal deps that don't use the workspace: protocol", () => {
            expect.assertions(2);

            writeJson("package.json", { name: "root", workspaces: ["packages/*"] });
            writeJson("packages/lib/package.json", { name: "@scope/lib", version: "1.0.0" });
            writeJson("packages/app/package.json", {
                dependencies: { "@scope/lib": "^1.0.0", react: "^18.0.0" },
                name: "@scope/app",
            });

            const issues = lintWorkspaceProtocol(iterateWorkspaceDeps(workspaceRoot));

            expect(issues).toHaveLength(1);
            expect(issues[0]).toMatchObject({
                depName: "@scope/lib",
                depType: "dependencies",
                fix: "workspace:*",
                packageName: "@scope/app",
                specifier: "^1.0.0",
            });
        });

        it("ignores internal deps already on workspace:*, workspace:^, workspace:~", () => {
            expect.assertions(1);

            writeJson("package.json", { name: "root", workspaces: ["packages/*"] });
            writeJson("packages/lib/package.json", { name: "@scope/lib" });
            writeJson("packages/a/package.json", {
                dependencies: { "@scope/lib": "workspace:*" },
                name: "@scope/a",
            });
            writeJson("packages/b/package.json", {
                dependencies: { "@scope/lib": "workspace:^" },
                name: "@scope/b",
            });
            writeJson("packages/c/package.json", {
                dependencies: { "@scope/lib": "workspace:~" },
                name: "@scope/c",
            });

            expect(lintWorkspaceProtocol(iterateWorkspaceDeps(workspaceRoot))).toStrictEqual([]);
        });

        it("ignores external deps regardless of specifier", () => {
            expect.assertions(1);

            writeJson("package.json", { name: "root", workspaces: ["packages/*"] });
            writeJson("packages/app/package.json", {
                dependencies: { lodash: "4.17.0", react: "^18.0.0" },
                name: "@scope/app",
            });

            expect(lintWorkspaceProtocol(iterateWorkspaceDeps(workspaceRoot))).toStrictEqual([]);
        });

        it("flags non-workspace protocols (npm:, file:, link:) on internal deps", () => {
            expect.assertions(1);

            writeJson("package.json", { name: "root", workspaces: ["packages/*"] });
            writeJson("packages/lib/package.json", { name: "@scope/lib" });
            writeJson("packages/app/package.json", {
                dependencies: { "@scope/lib": "file:../lib" },
                name: "@scope/app",
            });

            expect(lintWorkspaceProtocol(iterateWorkspaceDeps(workspaceRoot)).map((i) => i.specifier)).toStrictEqual(["file:../lib"]);
        });

        it("uses a custom fixSpecifier when provided", () => {
            expect.assertions(1);

            writeJson("package.json", { name: "root", workspaces: ["packages/*"] });
            writeJson("packages/lib/package.json", { name: "@scope/lib" });
            writeJson("packages/app/package.json", {
                dependencies: { "@scope/lib": "^1.0.0" },
                name: "@scope/app",
            });

            const issues = lintWorkspaceProtocol(iterateWorkspaceDeps(workspaceRoot), { fixSpecifier: "workspace:^" });

            expect(issues[0]?.fix).toBe("workspace:^");
        });

        it("flags violations across every dep block (deps, devDeps, peerDeps, optionalDeps)", () => {
            expect.assertions(1);

            writeJson("package.json", { name: "root", workspaces: ["packages/*"] });
            writeJson("packages/lib/package.json", { name: "@scope/lib" });
            writeJson("packages/app/package.json", {
                dependencies: { "@scope/lib": "^1.0.0" },
                devDependencies: { "@scope/lib": "^1.0.0" },
                name: "@scope/app",
                optionalDependencies: { "@scope/lib": "^1.0.0" },
                peerDependencies: { "@scope/lib": "^1.0.0" },
            });

            const issues = lintWorkspaceProtocol(iterateWorkspaceDeps(workspaceRoot));

            expect(new Set(issues.map((i) => i.depType))).toStrictEqual(
                new Set(["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"]),
            );
        });
    });

    describe(applyWorkspaceProtocolFixes, () => {
        it("rewrites every issue specifier to fix value, preserving indent", () => {
            expect.assertions(3);

            writeJson("package.json", { name: "root", workspaces: ["packages/*"] });
            writeJson("packages/lib/package.json", { name: "@scope/lib" });

            const appPath = join(workspaceRoot, "packages/app/package.json");

            mkdirSync(join(workspaceRoot, "packages/app"), { recursive: true });
            // Non-default 4-space indent — should be preserved by detectIndent.
            writeFileSync(
                appPath,
                `${JSON.stringify(
                    {
                        dependencies: { "@scope/lib": "^1.0.0", react: "^18.0.0" },
                        devDependencies: { "@scope/lib": "^1.0.0" },
                        name: "@scope/app",
                    },
                    null,
                    4,
                )}\n`,
            );

            const issues = lintWorkspaceProtocol(iterateWorkspaceDeps(workspaceRoot));

            expect(issues).toHaveLength(2);

            const written = applyWorkspaceProtocolFixes(issues);

            expect(written).toStrictEqual([appPath]);

            const after = readFileSync(appPath, "utf8");
            const parsed = JSON.parse(after) as {
                dependencies: Record<string, string>;
                devDependencies: Record<string, string>;
            };

            expect(parsed).toMatchObject({
                dependencies: { "@scope/lib": "workspace:*", react: "^18.0.0" },
                devDependencies: { "@scope/lib": "workspace:*" },
            });
        });

        it("groups issues per file so each package.json is written once", () => {
            expect.assertions(1);

            writeJson("package.json", { name: "root", workspaces: ["packages/*"] });
            writeJson("packages/lib/package.json", { name: "@scope/lib" });
            writeJson("packages/app/package.json", {
                dependencies: { "@scope/lib": "^1.0.0" },
                devDependencies: { "@scope/lib": "^1.0.0" },
                name: "@scope/app",
            });

            const issues = lintWorkspaceProtocol(iterateWorkspaceDeps(workspaceRoot));
            const written = applyWorkspaceProtocolFixes(issues);

            expect(written).toHaveLength(1);
        });

        it("handles pnpm.overrides nested writes", () => {
            expect.assertions(1);

            writeJson("package.json", {
                name: "root",
                pnpm: { overrides: { "@scope/lib": "1.0.0" } },
                workspaces: ["packages/*"],
            });
            writeJson("packages/lib/package.json", { name: "@scope/lib" });

            const issues = lintWorkspaceProtocol(iterateWorkspaceDeps(workspaceRoot));

            applyWorkspaceProtocolFixes(issues);

            const after = JSON.parse(readFileSync(join(workspaceRoot, "package.json"), "utf8")) as {
                pnpm: { overrides: Record<string, string> };
            };

            expect(after.pnpm.overrides["@scope/lib"]).toBe("workspace:*");
        });
    });
});
