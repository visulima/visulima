import { isAccessibleSync, readJsonSync } from "@visulima/fs";
import { join } from "@visulima/path";
import { describe, expect, it } from "vitest";

import { lintDeadWorkspacePatterns } from "../../src/deps/dead-workspace-pattern";
import { lintEmptyDeps } from "../../src/deps/empty-deps";
import { lintMissingPackageJson } from "../../src/deps/missing-package-json";
import { lintRootDeps } from "../../src/deps/root-deps";
import { lintRootPackageManager } from "../../src/deps/root-package-manager";
import { lintRootPrivate } from "../../src/deps/root-private";
import { lintSimilarDeps } from "../../src/deps/similar-deps";
import { lintWorkspaceVersions } from "../../src/deps/workspace-versions";
import { collectWorkspaceDirectories, iterateWorkspaceDeps } from "../../src/util/workspace-deps";

/**
 * Fixtures copied verbatim from https://github.com/QuiiBz/sherif (MIT).
 * See `__fixtures__/sherif-lint/LICENSE` and `README.md` for attribution
 * and the note on per-instance vs per-cluster issue counting.
 */
const fixturesRoot = join(__dirname, "..", "..", "__fixtures__", "sherif-lint");

const fixturePath = (name: string): string => join(fixturesRoot, name);

/** Mirrors `detectWorkspaceConfig` from `src/commands/deps/handler.ts`. */
const detectWorkspaceConfig = (workspaceRoot: string): boolean => {
    if (isAccessibleSync(join(workspaceRoot, "pnpm-workspace.yaml"))) {
        return true;
    }

    const pkgPath = join(workspaceRoot, "package.json");

    if (!isAccessibleSync(pkgPath)) {
        return false;
    }

    try {
        const pkg = readJsonSync(pkgPath) as { workspaces?: unknown };

        return pkg.workspaces !== undefined;
    } catch {
        return false;
    }
};

describe("sherif-fixtures", () => {
    describe("basic (npm-style workspaces array + dead patterns)", () => {
        const root = fixturePath("basic");

        it("detects workspace config and discovers the live packages", () => {
            expect.assertions(2);

            expect(detectWorkspaceConfig(root)).toBe(true);
            expect(collectWorkspaceDirectories(root).sort()).toStrictEqual([".", "docs", "packages/abc", "packages/def"]);
        });

        it("flags `examples/*` and `website` as dead workspace patterns", () => {
            expect.assertions(2);

            const issues = lintDeadWorkspacePatterns(root);
            const patterns = issues.map((i) => i.pattern).sort();

            expect(patterns).toStrictEqual(["examples/*", "website"]);
            expect(issues.every((i) => i.source === "package.json")).toBe(true);
        });
    });

    describe("pnpm (pnpm-workspace.yaml + dead patterns)", () => {
        const root = fixturePath("pnpm");

        it("detects workspace config from pnpm-workspace.yaml", () => {
            expect.assertions(2);

            expect(detectWorkspaceConfig(root)).toBe(true);
            expect(collectWorkspaceDirectories(root).sort()).toStrictEqual([".", "docs", "packages/abc", "packages/def"]);
        });

        it("flags dead patterns from pnpm-workspace.yaml", () => {
            expect.assertions(2);

            const issues = lintDeadWorkspacePatterns(root);

            expect(issues.map((i) => i.pattern).sort()).toStrictEqual(["examples/*", "website"]);
            expect(issues.every((i) => i.source === "pnpm-workspace.yaml")).toBe(true);
        });
    });

    describe("pnpm-glob (scope-glob `@*` workspace pattern)", () => {
        const root = fixturePath("pnpm-glob");

        it("resolves `@*` to scope-prefixed package directories", () => {
            expect.assertions(1);

            // Order isn't guaranteed by the walker — sort to compare.
            expect(collectWorkspaceDirectories(root).sort()).toStrictEqual([".", "@ui", "@web"]);
        });

        it("emits no root-level issues (private + packageManager set)", () => {
            expect.assertions(4);

            const hasConfig = detectWorkspaceConfig(root);

            expect(lintRootPrivate(root, hasConfig)).toStrictEqual([]);
            expect(lintRootPackageManager(root, hasConfig)).toStrictEqual([]);
            expect(lintRootDeps(root, hasConfig)).toStrictEqual([]);
            expect(lintDeadWorkspacePatterns(root)).toStrictEqual([]);
        });
    });

    describe("yarn-nohoist (yarn-style workspaces.packages object)", () => {
        const root = fixturePath("yarn-nohoist");

        it("resolves the object-form workspaces field", () => {
            expect.assertions(2);

            expect(detectWorkspaceConfig(root)).toBe(true);
            expect(collectWorkspaceDirectories(root).sort()).toStrictEqual([".", "docs", "packages/abc", "packages/def"]);
        });

        it("flags the same dead patterns as the array form", () => {
            expect.assertions(1);

            expect(
                lintDeadWorkspacePatterns(root)
                    .map((i) => i.pattern)
                    .sort(),
            ).toStrictEqual(["examples/*", "website"]);
        });
    });

    describe("dependencies (external-dep version drift)", () => {
        const root = fixturePath("dependencies");

        it("detects drift across @eslint/js, eslint, next, react", () => {
            expect.assertions(2);

            const issues = lintWorkspaceVersions(iterateWorkspaceDeps(root));
            // vis emits one issue per drifting *instance*; sherif counts clusters.
            // Clusters here: @eslint/js (abc canonical), eslint (docs canonical),
            // next (abc canonical), react (docs canonical) = 4 clusters; the
            // non-canonical sides total 6 instances.
            const drifted = new Set(issues.map((i) => i.depName));

            expect(drifted).toStrictEqual(new Set(["@eslint/js", "eslint", "next", "react"]));
            expect(issues).toHaveLength(6);
        });

        it("emits no root-level issues when private + packageManager are set", () => {
            expect.assertions(3);

            const hasConfig = detectWorkspaceConfig(root);

            expect(lintRootPrivate(root, hasConfig)).toStrictEqual([]);
            expect(lintRootPackageManager(root, hasConfig)).toStrictEqual([]);
            expect(lintEmptyDeps(root)).toStrictEqual([]);
        });
    });

    describe("dependencies-star (drift with `*` specifier)", () => {
        const root = fixturePath("dependencies-star");

        it("still reports drift even when one side uses `*`", () => {
            expect.assertions(2);

            const issues = lintWorkspaceVersions(iterateWorkspaceDeps(root));
            const drifted = new Set(issues.map((i) => i.depName));

            // Sherif filters `*` early via its own ANY_VERSION sentinel; vis
            // includes `*` in the drift set so the misuse surfaces. The
            // README documents this divergence intentionally.
            expect(drifted.has("react")).toBe(true);
            expect(drifted.size).toBeGreaterThanOrEqual(2);
        });
    });

    describe("dependencies-nested-star (`packages/*/*` workspace pattern)", () => {
        const root = fixturePath("dependencies-nested-star");

        it("resolves the nested glob and detects drift", () => {
            expect.assertions(2);

            const directories = collectWorkspaceDirectories(root);

            // vis simplifies `**` and `*/*` to recursive walks, so the only
            // workspace package `packages/docs` is found.
            expect(directories).toContain("packages/docs");

            const issues = lintWorkspaceVersions(iterateWorkspaceDeps(root));

            expect(issues.length).toBeGreaterThan(0);
        });
    });

    describe("unsync (similar-deps family drift)", () => {
        const root = fixturePath("unsync");

        it("flags react drift via workspace-versions", () => {
            expect.assertions(2);

            const issues = lintWorkspaceVersions(iterateWorkspaceDeps(root));
            const reactIssues = issues.filter((i) => i.depName === "react");

            expect(reactIssues).toHaveLength(1);
            expect(reactIssues[0]?.fix).toBe("2.0.0");
        });

        it("flags react and turborepo families via similar-deps", () => {
            expect.assertions(1);

            const families = lintSimilarDeps(iterateWorkspaceDeps(root))
                .map((i) => i.family)
                .sort();

            expect(families).toStrictEqual(["react", "turborepo"]);
        });
    });

    describe("root-issues (private/packageManager/empty-deps at the root)", () => {
        const root = fixturePath("root-issues");
        const hasConfig = detectWorkspaceConfig(root);

        it("flags missing `private: true`", () => {
            expect.assertions(1);

            expect(lintRootPrivate(root, hasConfig)).toHaveLength(1);
        });

        it("flags missing `packageManager`", () => {
            expect.assertions(1);

            expect(lintRootPackageManager(root, hasConfig)).toHaveLength(1);
        });

        it("does not flag rootDeps when the root isn't private (vis-specific)", () => {
            expect.assertions(1);

            // sherif flags root deps regardless of `private`; vis intentionally
            // requires the publish-block to land first so users don't get a
            // misleading 'these belong elsewhere' error on a public root.
            expect(lintRootDeps(root, hasConfig)).toStrictEqual([]);
        });

        it("flags both empty `dependencies` and `devDependencies` blocks", () => {
            expect.assertions(1);

            expect(
                lintEmptyDeps(root)
                    .map((i) => i.depType)
                    .sort(),
            ).toStrictEqual(["dependencies", "devDependencies"]);
        });
    });

    describe("root-issues-fixed (clean root)", () => {
        const root = fixturePath("root-issues-fixed");
        const hasConfig = detectWorkspaceConfig(root);

        it("emits zero issues from every root lint", () => {
            expect.assertions(4);

            expect(lintRootPrivate(root, hasConfig)).toStrictEqual([]);
            expect(lintRootPackageManager(root, hasConfig)).toStrictEqual([]);
            expect(lintRootDeps(root, hasConfig)).toStrictEqual([]);
            expect(lintEmptyDeps(root)).toStrictEqual([]);
        });
    });

    describe("without-package-json (workspace dirs missing package.json)", () => {
        const root = fixturePath("without-package-json");

        it("flags `docs` and `packages/abc` as missing", () => {
            expect.assertions(1);

            const dirs = lintMissingPackageJson(root)
                .map((i) => i.packageDir)
                .sort();

            expect(dirs).toStrictEqual(["docs", "packages/abc"]);
        });
    });

    describe("ignore-paths (`!` excludes + re-includes)", () => {
        const root = fixturePath("ignore-paths");

        it("honors `!` excludes through the gitignore matcher", () => {
            expect.assertions(1);

            // pnpm-workspace.yaml lists `packages/*`, `docs`, `!packages/abc`,
            // `!packages/d*`, `!packages/a/*`, `packages/a/b/*`. vis treats
            // `!` entries as gitignore patterns layered over the positives,
            // so abc/def are dropped. The `!packages/a/*` exclusion uses
            // gitignore semantics — once a parent directory is excluded,
            // its descendants follow, so `packages/a/b/*` cannot re-include
            // `packages/a/b/d`. This is a known divergence from Sherif's
            // ordered glob semantics, documented in the README.
            expect(collectWorkspaceDirectories(root).sort()).toStrictEqual([".", "docs", "packages/ghi"]);
        });
    });

    describe("no-workspace-pnpm (single-package layout)", () => {
        const root = fixturePath("no-workspace-pnpm");

        it("reports no workspace config", () => {
            expect.assertions(2);

            expect(detectWorkspaceConfig(root)).toBe(false);
            // Root is always returned, even when nothing else is.
            expect(collectWorkspaceDirectories(root)).toStrictEqual(["."]);
        });
    });

    describe("empty (no package.json at all)", () => {
        const root = fixturePath("empty");

        it("reports no workspace config and no deps", () => {
            expect.assertions(3);

            expect(detectWorkspaceConfig(root)).toBe(false);
            expect(collectWorkspaceDirectories(root)).toStrictEqual(["."]);
            expect(iterateWorkspaceDeps(root)).toStrictEqual([]);
        });
    });

    // The `install/` and `unordered/` fixtures are intentionally not
    // covered: install/ tests sherif's runner flow (not a lint), and
    // unordered/ exercises sherif's `unordered_dependencies` which vis
    // delivers via its separate `vis sort-package-json` command.
});
