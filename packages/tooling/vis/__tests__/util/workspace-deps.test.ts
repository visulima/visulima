import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { collectWorkspacePackageNames, groupInstancesByDep, iterateWorkspaceDeps } from "../../src/util/workspace-deps";

let workspaceRoot: string;

const writeJson = (path: string, data: unknown): void => {
    mkdirSync(join(workspaceRoot, path, ".."), { recursive: true });
    writeFileSync(join(workspaceRoot, path), `${JSON.stringify(data, null, 2)}\n`);
};

describe("workspace-deps", () => {
    beforeEach(() => {
        workspaceRoot = mkdtempSync(join(tmpdir(), "vis-workspace-deps-"));
    });

    afterEach(() => {
        rmSync(workspaceRoot, { force: true, recursive: true });
    });

    describe(iterateWorkspaceDeps, () => {
        it("yields one record per (package × depType × name) across npm-style workspaces", () => {
            expect.assertions(2);

            writeJson("package.json", {
                devDependencies: { vitest: "^1.0.0" },
                name: "root",
                workspaces: ["packages/*"],
            });
            writeJson("packages/web/package.json", {
                dependencies: { react: "^18.2.0" },
                devDependencies: { vitest: "^1.0.0" },
                name: "@scope/web",
            });
            writeJson("packages/api/package.json", {
                dependencies: { react: "^17.0.0" },
                name: "@scope/api",
            });

            const instances = iterateWorkspaceDeps(workspaceRoot);

            expect(instances).toHaveLength(4);
            expect(instances.find((i) => i.packageName === "@scope/api" && i.depName === "react")).toMatchObject({
                depName: "react",
                depType: "dependencies",
                isInternal: false,
                specifier: "^17.0.0",
            });
        });

        it("flags internal/workspace deps via isInternal", () => {
            expect.assertions(2);

            writeJson("package.json", {
                name: "root",
                workspaces: ["packages/*"],
            });
            writeJson("packages/lib/package.json", { name: "@scope/lib" });
            writeJson("packages/app/package.json", {
                dependencies: { "@scope/lib": "workspace:*", react: "^18.0.0" },
                name: "@scope/app",
            });

            const instances = iterateWorkspaceDeps(workspaceRoot);

            expect(instances.find((i) => i.depName === "@scope/lib")?.isInternal).toBe(true);
            expect(instances.find((i) => i.depName === "react")?.isInternal).toBe(false);
        });

        it("respects depTypes filter", () => {
            expect.assertions(1);

            writeJson("package.json", {
                name: "root",
                workspaces: ["packages/*"],
            });
            writeJson("packages/a/package.json", {
                dependencies: { react: "^18" },
                devDependencies: { vitest: "^1" },
                name: "a",
            });

            const instances = iterateWorkspaceDeps(workspaceRoot, { depTypes: ["dependencies"] });

            expect(instances.map((i) => i.depName)).toStrictEqual(["react"]);
        });

        it("excludes internal deps when includeInternal=false", () => {
            expect.assertions(1);

            writeJson("package.json", {
                name: "root",
                workspaces: ["packages/*"],
            });
            writeJson("packages/lib/package.json", { name: "@scope/lib" });
            writeJson("packages/app/package.json", {
                dependencies: { "@scope/lib": "workspace:*", react: "^18.0.0" },
                name: "@scope/app",
            });

            const instances = iterateWorkspaceDeps(workspaceRoot, { includeInternal: false });

            expect(instances.map((i) => i.depName)).toStrictEqual(["react"]);
        });

        it("reads pnpm-workspace.yaml when no `workspaces` field is present", () => {
            expect.assertions(1);

            writeJson("package.json", { name: "root" });
            writeFileSync(join(workspaceRoot, "pnpm-workspace.yaml"), "packages:\n  - 'packages/*'\n");
            writeJson("packages/api/package.json", {
                dependencies: { fastify: "^4.0.0" },
                name: "api",
            });

            expect(iterateWorkspaceDeps(workspaceRoot).map((i) => i.depName)).toStrictEqual(["fastify"]);
        });

        it("walks `pnpm.overrides` as a synthetic depType", () => {
            expect.assertions(1);

            writeJson("package.json", {
                name: "root",
                pnpm: { overrides: { minimist: "^1.2.8" } },
            });

            const instances = iterateWorkspaceDeps(workspaceRoot);
            const override = instances.find((i) => i.depType === "pnpm.overrides");

            expect(override).toMatchObject({ depName: "minimist", specifier: "^1.2.8" });
        });

        it("survives a malformed package.json silently (skips it)", () => {
            expect.assertions(1);

            writeJson("package.json", {
                name: "root",
                workspaces: ["packages/*"],
            });
            mkdirSync(join(workspaceRoot, "packages/broken"), { recursive: true });
            writeFileSync(join(workspaceRoot, "packages/broken/package.json"), "{not valid json");
            writeJson("packages/ok/package.json", {
                dependencies: { react: "^18" },
                name: "ok",
            });

            expect(iterateWorkspaceDeps(workspaceRoot).map((i) => i.depName)).toStrictEqual(["react"]);
        });
    });

    describe(collectWorkspacePackageNames, () => {
        it("includes the root package and every workspace package", () => {
            expect.assertions(1);

            writeJson("package.json", {
                name: "root",
                workspaces: ["packages/*"],
            });
            writeJson("packages/a/package.json", { name: "@scope/a" });
            writeJson("packages/b/package.json", { name: "@scope/b" });

            expect([...collectWorkspacePackageNames(workspaceRoot)].sort()).toStrictEqual(["@scope/a", "@scope/b", "root"]);
        });
    });

    describe(groupInstancesByDep, () => {
        it("groups instances of the same dep across packages", () => {
            expect.assertions(2);

            writeJson("package.json", {
                name: "root",
                workspaces: ["packages/*"],
            });
            writeJson("packages/a/package.json", {
                dependencies: { react: "^17" },
                name: "a",
            });
            writeJson("packages/b/package.json", {
                dependencies: { react: "^18" },
                name: "b",
            });

            const grouped = groupInstancesByDep(iterateWorkspaceDeps(workspaceRoot));

            expect(grouped.get("react")).toHaveLength(2);
            expect(
                grouped
                    .get("react")
                    ?.map((i) => i.specifier)
                    .sort(),
            ).toStrictEqual(["^17", "^18"]);
        });
    });

    describe("pnpm-workspace.yaml#overrides (pnpm v9+)", () => {
        it("emits one synthetic pnpm.overrides DepInstance per entry, pointing at pnpm-workspace.yaml", () => {
            expect.assertions(4);

            writeJson("package.json", { name: "root" });
            writeFileSync(
                join(workspaceRoot, "pnpm-workspace.yaml"),
                "packages:\n  - 'packages/*'\noverrides:\n  react: '18.2.0'\n  '@types/node': '22.0.0'\n",
            );

            const overrides = iterateWorkspaceDeps(workspaceRoot).filter((i) => i.depType === "pnpm.overrides");

            expect(overrides).toHaveLength(2);

            const react = overrides.find((i) => i.depName === "react");

            expect(react).toMatchObject({
                depType: "pnpm.overrides",
                isInternal: false,
                packageDir: ".",
                packageName: undefined,
                specifier: "18.2.0",
            });
            expect(react?.packageJsonPath.endsWith("pnpm-workspace.yaml")).toBe(true);
            expect(overrides.find((i) => i.depName === "@types/node")?.specifier).toBe("22.0.0");
        });

        it("flags overrides that point at workspace packages as internal", () => {
            expect.assertions(1);

            writeJson("package.json", { name: "root" });
            writeJson("packages/lib/package.json", { name: "@scope/lib" });
            writeFileSync(join(workspaceRoot, "pnpm-workspace.yaml"), "packages:\n  - 'packages/*'\noverrides:\n  '@scope/lib': 'workspace:*'\n");

            const internal = iterateWorkspaceDeps(workspaceRoot).find((i) => i.depType === "pnpm.overrides" && i.depName === "@scope/lib");

            expect(internal?.isInternal).toBe(true);
        });

        it("returns no synthetic rows when pnpm-workspace.yaml has no overrides block", () => {
            expect.assertions(1);

            writeJson("package.json", { name: "root" });
            writeFileSync(join(workspaceRoot, "pnpm-workspace.yaml"), "packages:\n  - 'packages/*'\n");

            expect(iterateWorkspaceDeps(workspaceRoot).filter((i) => i.depType === "pnpm.overrides")).toStrictEqual([]);
        });

        it("silently ignores a malformed pnpm-workspace.yaml instead of throwing", () => {
            expect.assertions(1);

            writeJson("package.json", { name: "root" });
            writeFileSync(join(workspaceRoot, "pnpm-workspace.yaml"), "packages:\n  - 'packages/*'\noverrides: : :\n");

            // Best-effort parsing — drift detection should never crash
            // a `vis lint` invocation just because the YAML is broken.
            expect(() => iterateWorkspaceDeps(workspaceRoot)).not.toThrow();
        });

        it("skips overrides scan when depTypes filter excludes pnpm.overrides", () => {
            expect.assertions(1);

            writeJson("package.json", { dependencies: { react: "^18" }, name: "root" });
            writeFileSync(join(workspaceRoot, "pnpm-workspace.yaml"), "overrides:\n  react: '18.2.0'\n");

            const instances = iterateWorkspaceDeps(workspaceRoot, { depTypes: ["dependencies"] });

            expect(instances.filter((i) => i.depType === "pnpm.overrides")).toStrictEqual([]);
        });
    });
});
