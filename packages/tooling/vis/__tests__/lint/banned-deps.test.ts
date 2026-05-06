import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { lintBannedDeps } from "../../src/lint/banned-deps";
import { iterateWorkspaceDeps } from "../../src/util/workspace-deps";

let workspaceRoot: string;

const writeJson = (path: string, data: unknown): void => {
    mkdirSync(join(workspaceRoot, path, ".."), { recursive: true });
    writeFileSync(join(workspaceRoot, path), `${JSON.stringify(data, null, 2)}\n`);
};

describe("banned-deps-lint", () => {
    beforeEach(() => {
        workspaceRoot = mkdtempSync(join(tmpdir(), "vis-banned-deps-"));
    });

    afterEach(() => {
        rmSync(workspaceRoot, { force: true, recursive: true });
    });

    describe(lintBannedDeps, () => {
        it("returns empty when config is empty", () => {
            expect.assertions(1);

            writeJson("package.json", { name: "root", workspaces: ["packages/*"] });
            writeJson("packages/app/package.json", {
                dependencies: { request: "^2.0.0" },
                name: "app",
            });

            expect(lintBannedDeps(iterateWorkspaceDeps(workspaceRoot), {})).toStrictEqual([]);
        });

        it("flags an exact-name match with the configured reason", () => {
            expect.assertions(2);

            writeJson("package.json", { name: "root", workspaces: ["packages/*"] });
            writeJson("packages/app/package.json", {
                dependencies: { react: "^18.0.0", request: "^2.0.0" },
                name: "app",
            });

            const issues = lintBannedDeps(iterateWorkspaceDeps(workspaceRoot), {
                request: "deprecated; use undici",
            });

            expect(issues).toHaveLength(1);
            expect(issues[0]).toMatchObject({
                depName: "request",
                matchedPattern: "request",
                packageName: "app",
                reason: "deprecated; use undici",
                specifier: "^2.0.0",
            });
        });

        it("supports the object form with reason + replacement", () => {
            expect.assertions(1);

            writeJson("package.json", { name: "root", workspaces: ["packages/*"] });
            writeJson("packages/app/package.json", {
                dependencies: { moment: "^2.0.0" },
                name: "app",
            });

            const issues = lintBannedDeps(iterateWorkspaceDeps(workspaceRoot), {
                moment: { reason: "huge bundle, frozen upstream", replacement: "date-fns" },
            });

            expect(issues[0]).toMatchObject({
                depName: "moment",
                replacement: "date-fns",
            });
        });

        it("matches via glob patterns", () => {
            expect.assertions(1);

            writeJson("package.json", { name: "root", workspaces: ["packages/*"] });
            writeJson("packages/app/package.json", {
                dependencies: { "@radix-ui/themes": "^1.0.0", react: "^18.0.0" },
                name: "app",
            });

            const issues = lintBannedDeps(iterateWorkspaceDeps(workspaceRoot), {
                "@radix-ui/*": "we standardized on shadcn instead",
            });

            expect(issues.map((i) => i.depName)).toStrictEqual(["@radix-ui/themes"]);
        });

        it("prefers exact match over glob when both are set", () => {
            expect.assertions(2);

            writeJson("package.json", { name: "root", workspaces: ["packages/*"] });
            writeJson("packages/app/package.json", {
                dependencies: { "@radix-ui/themes": "^1.0.0" },
                name: "app",
            });

            const issues = lintBannedDeps(iterateWorkspaceDeps(workspaceRoot), {
                "@radix-ui/*": "blanket ban",
                "@radix-ui/themes": "themes-specific reason",
            });

            expect(issues).toHaveLength(1);
            expect(issues[0]?.reason).toBe("themes-specific reason");
        });

        it("skips internal/workspace deps", () => {
            expect.assertions(1);

            writeJson("package.json", { name: "root", workspaces: ["packages/*"] });
            writeJson("packages/lib/package.json", { name: "@scope/lib" });
            writeJson("packages/app/package.json", {
                dependencies: { "@scope/lib": "workspace:*" },
                name: "@scope/app",
            });

            const issues = lintBannedDeps(iterateWorkspaceDeps(workspaceRoot), {
                "@scope/*": "shouldn't flag internal",
            });

            expect(issues).toStrictEqual([]);
        });

        it("captures depType so reports can group by block kind", () => {
            expect.assertions(1);

            writeJson("package.json", { name: "root", workspaces: ["packages/*"] });
            writeJson("packages/app/package.json", {
                dependencies: { request: "^2.0.0" },
                devDependencies: { request: "^2.0.0" },
                name: "app",
            });

            const issues = lintBannedDeps(iterateWorkspaceDeps(workspaceRoot), { request: "banned" });

            expect(new Set(issues.map((i) => i.depType))).toStrictEqual(new Set(["dependencies", "devDependencies"]));
        });

        it("scopes a rule to matching package names via `packages`", () => {
            expect.assertions(1);

            writeJson("package.json", { name: "root", workspaces: ["packages/*", "apps/*"] });
            writeJson("apps/web/package.json", {
                dependencies: { react: "^18.0.0" },
                name: "@app/web",
            });
            writeJson("packages/shared/package.json", {
                dependencies: { react: "^18.0.0" },
                name: "@scope/shared",
            });

            const issues = lintBannedDeps(iterateWorkspaceDeps(workspaceRoot), {
                react: { packages: ["@scope/*"], reason: "no react in shared libs" },
            });

            expect(issues.map((i) => i.packageName)).toStrictEqual(["@scope/shared"]);
        });

        it("scopes a rule to matching directories via `paths`", () => {
            expect.assertions(1);

            writeJson("package.json", { name: "root", workspaces: ["packages/*", "apps/*"] });
            writeJson("apps/web/package.json", {
                dependencies: { lodash: "^4.0.0" },
                name: "@app/web",
            });
            writeJson("packages/shared/package.json", {
                dependencies: { lodash: "^4.0.0" },
                name: "@scope/shared",
            });

            const issues = lintBannedDeps(iterateWorkspaceDeps(workspaceRoot), {
                lodash: { paths: ["packages/shared/**"], reason: "shared libs only" },
            });

            expect(issues.map((i) => i.packageDir)).toStrictEqual(["packages/shared"]);
        });

        it("matches when either `packages` or `paths` glob hits", () => {
            expect.assertions(1);

            writeJson("package.json", { name: "root", workspaces: ["apps/*", "tools/*"] });
            // Matches via name.
            writeJson("apps/web/package.json", {
                dependencies: { next: "^14.0.0" },
                name: "@app/web",
            });
            // Matches via path (name does not match `@app/*`).
            writeJson("tools/cli/package.json", {
                dependencies: { next: "^14.0.0" },
                name: "@tools/cli",
            });
            // Neither match.
            writeJson("apps/admin/package.json", {
                dependencies: { next: "^14.0.0" },
                name: "@admin/web",
            });

            const issues = lintBannedDeps(iterateWorkspaceDeps(workspaceRoot), {
                next: { packages: ["@app/*"], paths: ["tools/**"], reason: "scoped" },
            });

            expect(new Set(issues.map((i) => i.packageDir))).toStrictEqual(new Set(["apps/web", "tools/cli"]));
        });

        it("falls back to no-match when scope is `packages`-only and packageName is undefined", () => {
            expect.assertions(1);

            // Root package has no `name` field — packageName is undefined there.
            writeJson("package.json", { workspaces: ["packages/*"] });
            writeJson("packages/app/package.json", {
                dependencies: { rimraf: "^5.0.0" },
                name: "@scope/app",
            });

            const issues = lintBannedDeps(iterateWorkspaceDeps(workspaceRoot), {
                // Root would pick up `rimraf` if we banned globally; with a packages-scope
                // it cannot — root has no name to match against.
                rimraf: { packages: ["@scope/*"], reason: "scoped" },
            });

            expect(issues.map((i) => i.packageName)).toStrictEqual(["@scope/app"]);
        });

        it("treats empty `packages` and `paths` arrays as no-scope (apply everywhere)", () => {
            expect.assertions(1);

            writeJson("package.json", { name: "root", workspaces: ["packages/*"] });
            writeJson("packages/app/package.json", {
                dependencies: { request: "^2.0.0" },
                name: "@scope/app",
            });

            const issues = lintBannedDeps(iterateWorkspaceDeps(workspaceRoot), {
                request: { packages: [], paths: [], reason: "anywhere" },
            });

            expect(issues).toHaveLength(1);
        });

        it("skips a glob rule whose scope misses, even when an exact-name rule has no scope", () => {
            expect.assertions(2);

            writeJson("package.json", { name: "root", workspaces: ["apps/*", "packages/*"] });
            writeJson("apps/web/package.json", {
                dependencies: { "@radix-ui/themes": "^1.0.0" },
                name: "@app/web",
            });
            writeJson("packages/shared/package.json", {
                dependencies: { "@radix-ui/themes": "^1.0.0" },
                name: "@scope/shared",
            });

            const issues = lintBannedDeps(iterateWorkspaceDeps(workspaceRoot), {
                "@radix-ui/*": { packages: ["@app/*"], reason: "apps only" },
            });

            expect(issues).toHaveLength(1);
            expect(issues[0]?.packageName).toBe("@app/web");
        });
    });
});
