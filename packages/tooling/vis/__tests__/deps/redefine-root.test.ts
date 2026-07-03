import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { lintRedefineRoot } from "../../src/deps/redefine-root";
import { iterateWorkspaceDeps } from "../../src/util/workspace-deps";

let workspaceRoot: string;

const writeJson = (path: string, data: unknown): void => {
    mkdirSync(join(workspaceRoot, path, ".."), { recursive: true });
    writeFileSync(join(workspaceRoot, path), `${JSON.stringify(data, null, 2)}\n`);
};

describe("redefine-root-lint", () => {
    beforeEach(() => {
        workspaceRoot = mkdtempSync(join(tmpdir(), "vis-redefine-root-"));
    });

    afterEach(() => {
        rmSync(workspaceRoot, { force: true, recursive: true });
    });

    describe(lintRedefineRoot, () => {
        it("flags a child dep that shadows a root dep", () => {
            expect.assertions(2);

            writeJson("package.json", {
                devDependencies: { eslint: "^9.0.0" },
                name: "root",
                workspaces: ["packages/*"],
            });
            writeJson("packages/app/package.json", {
                devDependencies: { eslint: "^8.0.0" },
                name: "@scope/app",
            });

            const issues = lintRedefineRoot(iterateWorkspaceDeps(workspaceRoot));

            expect(issues).toHaveLength(1);
            expect(issues[0]).toMatchObject({
                childSpecifier: "^8.0.0",
                depName: "eslint",
                depType: "devDependencies",
                packageName: "@scope/app",
                rootDepType: "devDependencies",
                rootSpecifier: "^9.0.0",
            });
        });

        it("flags cross-block duplication (root devDeps vs child deps)", () => {
            expect.assertions(1);

            writeJson("package.json", {
                devDependencies: { typescript: "^5.0.0" },
                name: "root",
                workspaces: ["packages/*"],
            });
            writeJson("packages/app/package.json", {
                dependencies: { typescript: "^5.0.0" },
                name: "app",
            });

            const issues = lintRedefineRoot(iterateWorkspaceDeps(workspaceRoot));

            expect(issues[0]?.rootDepType).toBe("devDependencies");
        });

        it("does not flag deps unique to a child", () => {
            expect.assertions(1);

            writeJson("package.json", {
                devDependencies: { eslint: "^9.0.0" },
                name: "root",
                workspaces: ["packages/*"],
            });
            writeJson("packages/app/package.json", {
                dependencies: { react: "^18.0.0" },
                name: "app",
            });

            expect(lintRedefineRoot(iterateWorkspaceDeps(workspaceRoot))).toStrictEqual([]);
        });

        it("respects the ignoreDeps list", () => {
            expect.assertions(1);

            writeJson("package.json", {
                devDependencies: { eslint: "^9.0.0", typescript: "^5.0.0" },
                name: "root",
                workspaces: ["packages/*"],
            });
            writeJson("packages/app/package.json", {
                devDependencies: { eslint: "^9.0.0", typescript: "^5.0.0" },
                name: "app",
            });

            const issues = lintRedefineRoot(iterateWorkspaceDeps(workspaceRoot), { ignoreDeps: ["typescript"] });

            expect(issues.map((i) => i.depName)).toStrictEqual(["eslint"]);
        });

        it("ignores overrides/resolutions blocks by default", () => {
            expect.assertions(1);

            writeJson("package.json", {
                name: "root",
                pnpm: { overrides: { lodash: "^4.17.21" } },
                workspaces: ["packages/*"],
            });
            writeJson("packages/app/package.json", {
                dependencies: { lodash: "^4.17.21" },
                name: "app",
            });

            expect(lintRedefineRoot(iterateWorkspaceDeps(workspaceRoot))).toStrictEqual([]);
        });

        it("returns empty when root has no comparable deps", () => {
            expect.assertions(1);

            writeJson("package.json", { name: "root", workspaces: ["packages/*"] });
            writeJson("packages/app/package.json", {
                dependencies: { react: "^18.0.0" },
                name: "app",
            });

            expect(lintRedefineRoot(iterateWorkspaceDeps(workspaceRoot))).toStrictEqual([]);
        });
    });
});
