import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { applyWorkspaceVersionsFixes, lintWorkspaceVersions } from "../../src/lint/workspace-versions";
import { iterateWorkspaceDeps } from "../../src/util/workspace-deps";

let workspaceRoot: string;

const writeJson = (path: string, data: unknown): void => {
    mkdirSync(join(workspaceRoot, path, ".."), { recursive: true });
    writeFileSync(join(workspaceRoot, path), `${JSON.stringify(data, null, 2)}\n`);
};

describe("workspace-versions-lint", () => {
    beforeEach(() => {
        workspaceRoot = mkdtempSync(join(tmpdir(), "vis-workspace-versions-"));
    });

    afterEach(() => {
        rmSync(workspaceRoot, { force: true, recursive: true });
    });

    describe(lintWorkspaceVersions, () => {
        it("returns empty when every package agrees on the version", () => {
            expect.assertions(1);

            writeJson("package.json", { name: "root", workspaces: ["packages/*"] });
            writeJson("packages/a/package.json", { dependencies: { react: "^18.0.0" }, name: "a" });
            writeJson("packages/b/package.json", { dependencies: { react: "^18.0.0" }, name: "b" });

            expect(lintWorkspaceVersions(iterateWorkspaceDeps(workspaceRoot))).toStrictEqual([]);
        });

        it("flags drift and picks the highest specifier as canonical (default)", () => {
            expect.assertions(2);

            writeJson("package.json", { name: "root", workspaces: ["packages/*"] });
            writeJson("packages/a/package.json", { dependencies: { react: "^17.0.0" }, name: "a" });
            writeJson("packages/b/package.json", { dependencies: { react: "^18.0.0" }, name: "b" });
            writeJson("packages/c/package.json", { dependencies: { react: "^18.2.0" }, name: "c" });

            const issues = lintWorkspaceVersions(iterateWorkspaceDeps(workspaceRoot));

            expect(issues).toHaveLength(2);
            expect(new Set(issues.map((i) => `${i.packageName}:${i.specifier}->${i.fix}`))).toStrictEqual(
                new Set(["a:^17.0.0->^18.2.0", "b:^18.0.0->^18.2.0"]),
            );
        });

        it("picks the lowest specifier when resolve = lowest", () => {
            expect.assertions(1);

            writeJson("package.json", { name: "root", workspaces: ["packages/*"] });
            writeJson("packages/a/package.json", { dependencies: { lodash: "4.17.21" }, name: "a" });
            writeJson("packages/b/package.json", { dependencies: { lodash: "4.16.0" }, name: "b" });

            const issues = lintWorkspaceVersions(iterateWorkspaceDeps(workspaceRoot), { resolve: "lowest" });

            expect(issues.map((i) => i.fix)).toStrictEqual(["4.16.0"]);
        });

        it("skips internal workspace deps regardless of specifier shape", () => {
            expect.assertions(1);

            writeJson("package.json", { name: "root", workspaces: ["packages/*"] });
            writeJson("packages/lib/package.json", { name: "@scope/lib" });
            writeJson("packages/a/package.json", {
                dependencies: { "@scope/lib": "^1.0.0" },
                name: "a",
            });
            writeJson("packages/b/package.json", {
                dependencies: { "@scope/lib": "workspace:*" },
                name: "b",
            });

            expect(lintWorkspaceVersions(iterateWorkspaceDeps(workspaceRoot))).toStrictEqual([]);
        });

        it("ignores overrides / pnpm.overrides / resolutions blocks (not version-drift territory)", () => {
            expect.assertions(1);

            writeJson("package.json", {
                name: "root",
                pnpm: { overrides: { lodash: "4.17.21" } },
                resolutions: { lodash: "4.17.20" },
                workspaces: ["packages/*"],
            });
            writeJson("packages/app/package.json", {
                dependencies: { lodash: "4.17.21" },
                name: "app",
            });

            expect(lintWorkspaceVersions(iterateWorkspaceDeps(workspaceRoot))).toStrictEqual([]);
        });

        it("respects --dep filter (one-off check)", () => {
            expect.assertions(1);

            writeJson("package.json", { name: "root", workspaces: ["packages/*"] });
            writeJson("packages/a/package.json", {
                dependencies: { lodash: "4.17.21", react: "^17.0.0" },
                name: "a",
            });
            writeJson("packages/b/package.json", {
                dependencies: { lodash: "4.17.20", react: "^18.0.0" },
                name: "b",
            });

            const issues = lintWorkspaceVersions(iterateWorkspaceDeps(workspaceRoot), { dep: "react" });

            expect(issues.map((i) => i.depName)).toStrictEqual(["react"]);
        });

        it("respects ignoreDeps", () => {
            expect.assertions(1);

            writeJson("package.json", { name: "root", workspaces: ["packages/*"] });
            writeJson("packages/a/package.json", { dependencies: { lodash: "4.17.21", react: "^17.0.0" }, name: "a" });
            writeJson("packages/b/package.json", { dependencies: { lodash: "4.17.20", react: "^18.0.0" }, name: "b" });

            const issues = lintWorkspaceVersions(iterateWorkspaceDeps(workspaceRoot), { ignoreDeps: ["lodash"] });

            expect(issues.map((i) => i.depName)).toStrictEqual(["react"]);
        });

        it("flags peerDependencies drift (peers are the most common real-world hit)", () => {
            expect.assertions(1);

            writeJson("package.json", { name: "root", workspaces: ["packages/*"] });
            writeJson("packages/a/package.json", { name: "a", peerDependencies: { react: "^17.0.0" } });
            writeJson("packages/b/package.json", { name: "b", peerDependencies: { react: "^18.0.0" } });

            const issues = lintWorkspaceVersions(iterateWorkspaceDeps(workspaceRoot));

            expect(issues.map((i) => i.depType)).toStrictEqual(["peerDependencies"]);
        });

        it("picks deterministically across machines when versions tie (alphabetical packageName)", () => {
            expect.assertions(2);

            writeJson("package.json", { name: "root", workspaces: ["packages/*"] });
            // Both packages declare react ^17.0.0 and ~17.0.0 — same parsed version, different prefixes.
            // Sort by packageName so "alpha" wins regardless of traversal order.
            writeJson("packages/zulu/package.json", { dependencies: { react: "~17.0.0" }, name: "zulu" });
            writeJson("packages/alpha/package.json", { dependencies: { react: "^17.0.0" }, name: "alpha" });

            const issues = lintWorkspaceVersions(iterateWorkspaceDeps(workspaceRoot));

            expect(issues).toHaveLength(1);
            // alpha (^17.0.0) is canonical → zulu (~17.0.0) is the issue, fix is ^17.0.0
            expect(issues[0]).toMatchObject({ fix: "^17.0.0", packageName: "zulu" });
        });

        it("does not flag when only one package declares the dep (no drift to resolve)", () => {
            expect.assertions(1);

            writeJson("package.json", { name: "root", workspaces: ["packages/*"] });
            writeJson("packages/a/package.json", { dependencies: { react: "^18.0.0" }, name: "a" });
            writeJson("packages/b/package.json", { dependencies: { vue: "^3.0.0" }, name: "b" });

            expect(lintWorkspaceVersions(iterateWorkspaceDeps(workspaceRoot))).toStrictEqual([]);
        });

        describe("pinned (one-off --pin CLI)", () => {
            it("flags every package whose specifier doesn't match the pin", () => {
                expect.assertions(2);

                writeJson("package.json", { name: "root", workspaces: ["packages/*"] });
                writeJson("packages/a/package.json", { dependencies: { react: "^17.0.0" }, name: "a" });
                writeJson("packages/b/package.json", { dependencies: { react: "^18.2.0" }, name: "b" });

                const issues = lintWorkspaceVersions(iterateWorkspaceDeps(workspaceRoot), {
                    pinned: new Map([["react", "^18.2.0"]]),
                });

                expect(issues).toHaveLength(1);
                expect(issues[0]).toMatchObject({ canonicalSource: "cli:--pin", fix: "^18.2.0", packageName: "a" });
            });

            it("flags single-package occurrences that don't match the pin", () => {
                expect.assertions(2);

                writeJson("package.json", { name: "root", workspaces: ["packages/*"] });
                writeJson("packages/a/package.json", { dependencies: { react: "^17.0.0" }, name: "a" });

                const issues = lintWorkspaceVersions(iterateWorkspaceDeps(workspaceRoot), {
                    pinned: new Map([["react", "^18.2.0"]]),
                });

                expect(issues).toHaveLength(1);
                expect(issues[0]?.fix).toBe("^18.2.0");
            });

            it("ignores pinned deps that no package declares", () => {
                expect.assertions(1);

                writeJson("package.json", { name: "root", workspaces: ["packages/*"] });
                writeJson("packages/a/package.json", { dependencies: { vue: "^3.0.0" }, name: "a" });

                const issues = lintWorkspaceVersions(iterateWorkspaceDeps(workspaceRoot), {
                    pinned: new Map([["react", "^18.2.0"]]),
                });

                expect(issues).toStrictEqual([]);
            });

            it("emits no issues when every package already matches the pin", () => {
                expect.assertions(1);

                writeJson("package.json", { name: "root", workspaces: ["packages/*"] });
                writeJson("packages/a/package.json", { dependencies: { react: "^18.2.0" }, name: "a" });
                writeJson("packages/b/package.json", { dependencies: { react: "^18.2.0" }, name: "b" });

                const issues = lintWorkspaceVersions(iterateWorkspaceDeps(workspaceRoot), {
                    pinned: new Map([["react", "^18.2.0"]]),
                });

                expect(issues).toStrictEqual([]);
            });

            it("pin wins over --resolve catalog when both are set for the same dep", () => {
                expect.assertions(2);

                writeJson("package.json", { name: "root", workspaces: ["packages/*"] });
                writeJson("packages/a/package.json", { dependencies: { react: "^18.0.0" }, name: "a" });
                writeJson("packages/b/package.json", { dependencies: { react: "catalog:" }, name: "b" });

                const catalogs = new Map([["default", new Map([["react", "^18.2.0"]])]]);
                const issues = lintWorkspaceVersions(iterateWorkspaceDeps(workspaceRoot), {
                    catalogs,
                    pinned: new Map([["react", "^17.0.0"]]),
                    resolve: "catalog",
                });

                expect(issues.every((i) => i.canonicalSource === "cli:--pin")).toBe(true);
                expect(issues.map((i) => i.fix)).toStrictEqual(["^17.0.0", "^17.0.0"]);
            });

            it("pin overrides the resolve = highest pick", () => {
                expect.assertions(1);

                writeJson("package.json", { name: "root", workspaces: ["packages/*"] });
                writeJson("packages/a/package.json", { dependencies: { react: "^17.0.0" }, name: "a" });
                writeJson("packages/b/package.json", { dependencies: { react: "^18.0.0" }, name: "b" });

                const issues = lintWorkspaceVersions(iterateWorkspaceDeps(workspaceRoot), {
                    pinned: new Map([["react", "^16.0.0"]]),
                });

                expect(issues.map((i) => i.fix)).toStrictEqual(["^16.0.0", "^16.0.0"]);
            });

            it("flags a catalog: reference when its catalog target doesn't match the pin", () => {
                expect.assertions(1);

                writeJson("package.json", { name: "root", workspaces: ["packages/*"] });
                writeJson("packages/a/package.json", { dependencies: { react: "catalog:" }, name: "a" });

                const issues = lintWorkspaceVersions(iterateWorkspaceDeps(workspaceRoot), {
                    pinned: new Map([["react", "^18.2.0"]]),
                });

                expect(issues[0]?.specifier).toBe("catalog:");
            });
        });

        describe("resolve: catalog", () => {
            it("flags every direct version when a catalog already pins the dep", () => {
                expect.assertions(2);

                writeJson("package.json", { name: "root", workspaces: ["packages/*"] });
                writeJson("packages/a/package.json", { dependencies: { react: "^18.0.0" }, name: "a" });
                writeJson("packages/b/package.json", { dependencies: { react: "catalog:" }, name: "b" });

                const catalogs = new Map([["default", new Map([["react", "^18.2.0"]])]]);
                const issues = lintWorkspaceVersions(iterateWorkspaceDeps(workspaceRoot), { catalogs, resolve: "catalog" });

                expect(issues).toHaveLength(1);
                expect(issues[0]).toMatchObject({ canonicalSource: "catalog:default", fix: "catalog:", packageName: "a" });
            });

            it("emits catalog:<name> for non-default catalogs", () => {
                expect.assertions(1);

                writeJson("package.json", { name: "root", workspaces: ["packages/*"] });
                writeJson("packages/a/package.json", { devDependencies: { vitest: "^2.0.0" }, name: "a" });

                const catalogs = new Map([["dev", new Map([["vitest", "^2.0.0"]])]]);
                const issues = lintWorkspaceVersions(iterateWorkspaceDeps(workspaceRoot), { catalogs, resolve: "catalog" });

                expect(issues[0]?.fix).toBe("catalog:dev");
            });

            it("returns empty when catalogs map is missing", () => {
                expect.assertions(1);

                writeJson("package.json", { name: "root", workspaces: ["packages/*"] });
                writeJson("packages/a/package.json", { dependencies: { react: "^17.0.0" }, name: "a" });
                writeJson("packages/b/package.json", { dependencies: { react: "^18.0.0" }, name: "b" });

                expect(lintWorkspaceVersions(iterateWorkspaceDeps(workspaceRoot), { resolve: "catalog" })).toStrictEqual([]);
            });
        });
    });

    describe(applyWorkspaceVersionsFixes, () => {
        it("rewrites every issue's specifier in place", () => {
            expect.assertions(2);

            writeJson("package.json", { name: "root", workspaces: ["packages/*"] });
            writeJson("packages/a/package.json", { dependencies: { react: "^17.0.0" }, name: "a" });
            writeJson("packages/b/package.json", { dependencies: { react: "^18.2.0" }, name: "b" });

            const issues = lintWorkspaceVersions(iterateWorkspaceDeps(workspaceRoot));
            const written = applyWorkspaceVersionsFixes(issues);

            expect(written).toHaveLength(1);

            const after = JSON.parse(readFileSync(join(workspaceRoot, "packages/a/package.json"), "utf8")) as { dependencies: Record<string, string> };

            expect(after.dependencies.react).toBe("^18.2.0");
        });
    });
});
