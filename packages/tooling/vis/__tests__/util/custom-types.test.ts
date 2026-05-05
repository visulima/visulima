import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

import { join } from "@visulima/path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { applyCustomTypeFixes, iterateCustomTypeDeps, lintCustomTypes } from "../../src/util/custom-types";
import { cleanupTemporaryDirectory, createTemporaryDirectory } from "../test-helpers";

let workspaceRoot: string;

const writeJson = (relativePath: string, data: unknown): void => {
    mkdirSync(join(workspaceRoot, relativePath, ".."), { recursive: true });
    writeFileSync(join(workspaceRoot, relativePath), `${JSON.stringify(data, undefined, 2)}\n`);
};

const DEFAULT_ROOT_JSON = { name: "root", workspaces: ["packages/*"] };

const writeWorkspaceRoot = (rootJson: unknown = DEFAULT_ROOT_JSON): void => {
    writeFileSync(join(workspaceRoot, "pnpm-workspace.yaml"), "packages:\n  - 'packages/*'\n");
    writeFileSync(join(workspaceRoot, "package.json"), `${JSON.stringify(rootJson, undefined, 2)}\n`);
};

const readJson = (relativePath: string): Record<string, unknown> =>
    JSON.parse(readFileSync(join(workspaceRoot, relativePath), "utf8")) as Record<string, unknown>;

describe("custom-types", () => {
    beforeEach(() => {
        workspaceRoot = createTemporaryDirectory("vis-custom-types-");
    });

    afterEach(() => {
        cleanupTemporaryDirectory(workspaceRoot);
    });

    describe(iterateCustomTypeDeps, () => {
        it("emits one instance per engines field, one per volta field, one for packageManager, and one per devEngines.runtime entry", () => {
            expect.assertions(2);

            writeWorkspaceRoot({
                devEngines: { runtime: [{ name: "node", version: "22.14.0" }] },
                engines: { node: "22.14.0", pnpm: "10.0.0" },
                name: "root",
                packageManager: "pnpm@10.0.0+sha512.abcdef",
                volta: { node: "22.14.0" },
                workspaces: ["packages/*"],
            });
            writeJson("packages/a/package.json", { name: "@my/a" });

            const instances = iterateCustomTypeDeps(workspaceRoot);

            expect(instances).toHaveLength(5);

            // Verify each customType is represented exactly once in the root.
            const customTypes = instances.map((instance) => instance.customType).sort();

            expect(customTypes).toStrictEqual(["devEngines.runtime", "engines", "engines", "packageManager", "volta"]);
        });

        it("strips the +sha512.<hash> suffix on packageManager so semver compare works", () => {
            expect.assertions(3);

            writeWorkspaceRoot({
                name: "root",
                packageManager: "pnpm@10.32.1+sha512.abc.def",
                workspaces: ["packages/*"],
            });

            const [pm] = iterateCustomTypeDeps(workspaceRoot);

            expect(pm?.depName).toBe("pnpm");
            expect(pm?.specifier).toBe("10.32.1");
            // Raw value is preserved verbatim — the writer needs the original to know whether to drop the hash.
            expect(pm?.rawValue).toBe("pnpm@10.32.1+sha512.abc.def");
        });

        it("tracks engines.node and volta.node as independent (customType, depName) pairs", () => {
            expect.assertions(2);

            writeWorkspaceRoot({ engines: { node: "22.14.0" }, name: "root", volta: { node: "20.0.0" }, workspaces: ["packages/*"] });

            const instances = iterateCustomTypeDeps(workspaceRoot);
            const engines = instances.find((instance) => instance.customType === "engines");
            const volta = instances.find((instance) => instance.customType === "volta");

            expect(engines?.specifier).toBe("22.14.0");
            expect(volta?.specifier).toBe("20.0.0");
        });

        it("drops malformed entries silently (numeric engines.node, version-less packageManager)", () => {
            expect.assertions(1);

            writeWorkspaceRoot({
                engines: { node: 22 } as unknown as Record<string, string>,
                name: "root",
                packageManager: "pnpm",
                workspaces: ["packages/*"],
            });

            const instances = iterateCustomTypeDeps(workspaceRoot);

            // engines block fails the all-strings type guard → dropped wholesale.
            // packageManager has no `@version` → dropped.
            expect(instances).toHaveLength(0);
        });

        it("walks devEngines.packageManager array form", () => {
            expect.assertions(2);

            writeWorkspaceRoot({
                devEngines: { packageManager: [{ name: "pnpm", version: "10.32.1" }] },
                name: "root",
                workspaces: ["packages/*"],
            });

            const instances = iterateCustomTypeDeps(workspaceRoot);
            const dev = instances.find((instance) => instance.customType === "devEngines.packageManager");

            expect(dev?.depName).toBe("pnpm");
            expect(dev?.specifier).toBe("10.32.1");
        });

        it("accepts devEngines.runtime as a single object (not just arrays)", () => {
            expect.assertions(2);

            writeWorkspaceRoot({
                devEngines: { runtime: { name: "node", version: "22.14.0" } },
                name: "root",
                workspaces: ["packages/*"],
            });

            const instances = iterateCustomTypeDeps(workspaceRoot);
            const dev = instances.find((instance) => instance.customType === "devEngines.runtime");

            expect(dev?.depName).toBe("node");
            expect(dev?.specifier).toBe("22.14.0");
        });

        it("walks all packages in the workspace, not just the root", () => {
            expect.assertions(2);

            writeWorkspaceRoot();
            writeJson("packages/a/package.json", { engines: { node: "22.14.0" }, name: "@my/a" });
            writeJson("packages/b/package.json", { engines: { node: "22.14.0" }, name: "@my/b" });

            const instances = iterateCustomTypeDeps(workspaceRoot);

            expect(instances).toHaveLength(2);
            expect(instances.map((instance) => instance.packageName).sort()).toStrictEqual(["@my/a", "@my/b"]);
        });
    });

    describe(lintCustomTypes, () => {
        it("flags drift in engines.node across two packages", () => {
            expect.assertions(3);

            writeWorkspaceRoot();
            writeJson("packages/a/package.json", { engines: { node: "22.14.0" }, name: "@my/a" });
            writeJson("packages/b/package.json", { engines: { node: "20.0.0" }, name: "@my/b" });

            const issues = lintCustomTypes(iterateCustomTypeDeps(workspaceRoot));

            expect(issues).toHaveLength(1);
            expect(issues[0]?.specifier).toBe("20.0.0");
            // Highest is the default → 22.14.0 wins.
            expect(issues[0]?.fix).toBe("22.14.0");
        });

        it("respects resolve: lowest", () => {
            expect.assertions(2);

            writeWorkspaceRoot();
            writeJson("packages/a/package.json", { engines: { node: "22.14.0" }, name: "@my/a" });
            writeJson("packages/b/package.json", { engines: { node: "20.0.0" }, name: "@my/b" });

            const issues = lintCustomTypes(iterateCustomTypeDeps(workspaceRoot), { resolve: "lowest" });

            expect(issues).toHaveLength(1);
            expect(issues[0]?.fix).toBe("20.0.0");
        });

        it("does not couple engines.node with volta.node — they're independent clusters", () => {
            expect.assertions(1);

            writeWorkspaceRoot();
            writeJson("packages/a/package.json", { engines: { node: "22.14.0" }, name: "@my/a", volta: { node: "20.0.0" } });

            const issues = lintCustomTypes(iterateCustomTypeDeps(workspaceRoot));

            // Only one package each → no drift inside either cluster.
            expect(issues).toStrictEqual([]);
        });

        it("ignores deps in ignoreDeps", () => {
            expect.assertions(1);

            writeWorkspaceRoot();
            writeJson("packages/a/package.json", { engines: { node: "22.14.0", pnpm: "10.0.0" }, name: "@my/a" });
            writeJson("packages/b/package.json", { engines: { node: "20.0.0", pnpm: "9.0.0" }, name: "@my/b" });

            const issues = lintCustomTypes(iterateCustomTypeDeps(workspaceRoot), { ignoreDeps: ["node"] });

            // Only pnpm drift is reported.
            expect(issues.every((issue) => issue.depName === "pnpm")).toBe(true);
        });

        it("--dep restricts to a single dep name", () => {
            expect.assertions(2);

            writeWorkspaceRoot();
            writeJson("packages/a/package.json", { engines: { node: "22.14.0", pnpm: "10.0.0" }, name: "@my/a" });
            writeJson("packages/b/package.json", { engines: { node: "20.0.0", pnpm: "9.0.0" }, name: "@my/b" });

            const issues = lintCustomTypes(iterateCustomTypeDeps(workspaceRoot), { dep: "node" });

            expect(issues).toHaveLength(1);
            expect(issues[0]?.depName).toBe("node");
        });

        it("does not flag unparseable specifiers like `engines.node: \"*\"` as drift", () => {
            expect.assertions(1);

            writeWorkspaceRoot();
            writeJson("packages/a/package.json", { engines: { node: "*" }, name: "@my/a" });
            writeJson("packages/b/package.json", { engines: { node: "20.0.0" }, name: "@my/b" });

            const issues = lintCustomTypes(iterateCustomTypeDeps(workspaceRoot));

            // `*` is deliberately permissive — must not be silently rewritten to `20.0.0`.
            expect(issues).toStrictEqual([]);
        });

        it("ignores volta.extends (a config inheritance pointer, not a version pin)", () => {
            expect.assertions(1);

            writeWorkspaceRoot();
            writeJson("packages/a/package.json", { name: "@my/a", volta: { extends: "../base.json", node: "22.14.0" } });
            writeJson("packages/b/package.json", { name: "@my/b", volta: { extends: "../other.json", node: "22.14.0" } });

            const issues = lintCustomTypes(iterateCustomTypeDeps(workspaceRoot));

            // Two different `extends` paths must not show up as drift.
            expect(issues).toStrictEqual([]);
        });

        it("emits per-entry instead of dropping the entire engines block when a sibling is non-string", () => {
            expect.assertions(1);

            writeWorkspaceRoot();
            // `strict: true` is a real npm field. Previously, its presence dropped
            // the whole block — including the legitimate `node` pin.
            writeJson("packages/a/package.json", {
                engines: { node: "22.14.0", strict: true } as unknown as Record<string, string>,
                name: "@my/a",
            });
            writeJson("packages/b/package.json", { engines: { node: "20.0.0" }, name: "@my/b" });

            const issues = lintCustomTypes(iterateCustomTypeDeps(workspaceRoot));

            // node drift is detected even though `strict: true` lives next to it.
            expect(issues).toHaveLength(1);
        });
    });

    describe(applyCustomTypeFixes, () => {
        it("rewrites engines.node in place", () => {
            expect.assertions(1);

            writeWorkspaceRoot();
            writeJson("packages/a/package.json", { engines: { node: "22.14.0" }, name: "@my/a" });
            writeJson("packages/b/package.json", { engines: { node: "20.0.0" }, name: "@my/b" });

            const issues = lintCustomTypes(iterateCustomTypeDeps(workspaceRoot));

            applyCustomTypeFixes(issues);

            const after = readJson("packages/b/package.json");

            expect((after.engines as Record<string, string>).node).toBe("22.14.0");
        });

        it("rewrites packageManager and drops the +sha512 hash (hash is tied to the specific package)", () => {
            expect.assertions(2);

            writeWorkspaceRoot({
                name: "root",
                packageManager: "pnpm@9.0.0+sha512.outdated",
                workspaces: ["packages/*"],
            });
            writeJson("packages/a/package.json", { name: "@my/a", packageManager: "pnpm@10.32.1+sha512.fresh" });

            const issues = lintCustomTypes(iterateCustomTypeDeps(workspaceRoot));

            applyCustomTypeFixes(issues);

            const root = readJson("package.json");

            // Bumped to the highest version.
            expect(root.packageManager).toContain("pnpm@10.32.1");
            // Hash dropped — the user must regenerate via their package manager.
            expect(root.packageManager).not.toContain("+sha512");
        });

        it("rewrites volta.X without touching the parallel engines.X entry", () => {
            expect.assertions(2);

            writeWorkspaceRoot();
            writeJson("packages/a/package.json", { name: "@my/a", volta: { node: "22.14.0" } });
            writeJson("packages/b/package.json", {
                engines: { node: "18.0.0" },
                name: "@my/b",
                volta: { node: "20.0.0" },
            });

            const issues = lintCustomTypes(iterateCustomTypeDeps(workspaceRoot));

            applyCustomTypeFixes(issues);

            const after = readJson("packages/b/package.json");

            // volta drift fixed.
            expect((after.volta as Record<string, string>).node).toBe("22.14.0");
            // engines.node untouched (only one package declared it → no drift).
            expect((after.engines as Record<string, string>).node).toBe("18.0.0");
        });

        it("rewrites devEngines.runtime array entries by name", () => {
            expect.assertions(1);

            writeWorkspaceRoot();
            writeJson("packages/a/package.json", {
                devEngines: { runtime: [{ name: "node", onFail: "error", version: "22.14.0" }] },
                name: "@my/a",
            });
            writeJson("packages/b/package.json", {
                devEngines: { runtime: [{ name: "node", version: "20.0.0" }] },
                name: "@my/b",
            });

            const issues = lintCustomTypes(iterateCustomTypeDeps(workspaceRoot));

            applyCustomTypeFixes(issues);

            const after = readJson("packages/b/package.json");
            const { runtime } = after.devEngines as { runtime: { name: string; version: string }[] };

            expect(runtime[0]?.version).toBe("22.14.0");
        });

        it("rewrites devEngines.runtime single-object form (not just arrays)", () => {
            expect.assertions(1);

            writeWorkspaceRoot();
            writeJson("packages/a/package.json", {
                devEngines: { runtime: { name: "node", version: "22.14.0" } },
                name: "@my/a",
            });
            writeJson("packages/b/package.json", {
                devEngines: { runtime: { name: "node", version: "20.0.0" } },
                name: "@my/b",
            });

            const issues = lintCustomTypes(iterateCustomTypeDeps(workspaceRoot));

            applyCustomTypeFixes(issues);

            const after = readJson("packages/b/package.json");
            const { runtime } = after.devEngines as { runtime: { name: string; version: string } };

            expect(runtime.version).toBe("22.14.0");
        });

        it("emits only the well-formed devEngines.runtime entry when a sibling entry has no version field", () => {
            expect.assertions(2);

            writeWorkspaceRoot();
            writeJson("packages/a/package.json", {
                devEngines: { runtime: [{ name: "node", version: "22.14.0" }, { name: "bun" }] },
                name: "@my/a",
            });

            const instances = iterateCustomTypeDeps(workspaceRoot);

            // Only the node entry survives — bun has no version, so it's dropped.
            expect(instances).toHaveLength(1);
            expect(instances[0]?.depName).toBe("node");
        });

        it("preserves onFail and other sibling fields on a devEngines.runtime entry after fixing version", () => {
            expect.assertions(2);

            writeWorkspaceRoot();
            writeJson("packages/a/package.json", {
                devEngines: { runtime: [{ name: "node", version: "22.14.0" }] },
                name: "@my/a",
            });
            // Drift target carries onFail — it must survive the version mutation.
            writeJson("packages/b/package.json", {
                devEngines: { runtime: [{ name: "node", onFail: "error", version: "20.0.0" }] },
                name: "@my/b",
            });

            const issues = lintCustomTypes(iterateCustomTypeDeps(workspaceRoot));

            applyCustomTypeFixes(issues);

            const after = readJson("packages/b/package.json");
            const entry = (after.devEngines as { runtime: { name: string; onFail?: string; version: string }[] }).runtime[0]!;

            expect(entry.version).toBe("22.14.0");
            // onFail must NOT be wiped — fixer mutates `version` in place, no object replacement.
            expect(entry.onFail).toBe("error");
        });

        it("orders 10.0.0 above 10.0.0-rc.1 when picking the highest canonical (semver prerelease semantics)", () => {
            expect.assertions(4);

            writeWorkspaceRoot();
            writeJson("packages/a/package.json", { engines: { pnpm: "10.0.0-rc.1" }, name: "@my/a" });
            writeJson("packages/b/package.json", { engines: { pnpm: "10.0.0" }, name: "@my/b" });

            const highest = lintCustomTypes(iterateCustomTypeDeps(workspaceRoot));

            // a's prerelease is the drift target; the stable 10.0.0 wins.
            expect(highest).toHaveLength(1);
            expect(highest[0]?.fix).toBe("10.0.0");

            const lowest = lintCustomTypes(iterateCustomTypeDeps(workspaceRoot), { resolve: "lowest" });

            expect(lowest).toHaveLength(1);
            expect(lowest[0]?.fix).toBe("10.0.0-rc.1");
        });

        it('normalises packageManager: "yarn@4.0.0" without a +sha512 hash', () => {
            expect.assertions(1);

            writeWorkspaceRoot({ name: "root", packageManager: "yarn@4.0.0", workspaces: ["packages/*"] });
            writeJson("packages/a/package.json", { name: "@my/a", packageManager: "yarn@4.1.0" });

            const issues = lintCustomTypes(iterateCustomTypeDeps(workspaceRoot));

            applyCustomTypeFixes(issues);

            // Hashless input → hashless output, no spurious "+sha512" tail injected.
            expect(readJson("package.json").packageManager).toBe("yarn@4.1.0");
        });

        it("fixes engines.node and engines.npm in the same file with a single write", () => {
            expect.assertions(3);

            writeWorkspaceRoot();
            writeJson("packages/a/package.json", { engines: { node: "22.14.0", npm: "10.0.0" }, name: "@my/a" });
            writeJson("packages/b/package.json", { engines: { node: "20.0.0", npm: "9.0.0" }, name: "@my/b" });

            const issues = lintCustomTypes(iterateCustomTypeDeps(workspaceRoot));
            const written = applyCustomTypeFixes(issues);

            // byFile groups both issues onto one path → single write call.
            expect(written).toHaveLength(1);

            const after = readJson("packages/b/package.json");

            expect((after.engines as Record<string, string>).node).toBe("22.14.0");
            expect((after.engines as Record<string, string>).npm).toBe("10.0.0");
        });

        it("does not crash and emits no instances for a package with engines: {}", () => {
            expect.assertions(2);

            writeWorkspaceRoot({ engines: {}, name: "root", volta: {}, workspaces: ["packages/*"] });

            const instances = iterateCustomTypeDeps(workspaceRoot);

            expect(instances).toStrictEqual([]);
            // lintCustomTypes is also empty-input safe.
            expect(lintCustomTypes(instances)).toStrictEqual([]);
        });

        it("leaves an unparseable engines.node sibling untouched while fixing a drifting engines.pnpm in the same file", () => {
            expect.assertions(2);

            writeWorkspaceRoot();
            writeJson("packages/a/package.json", { engines: { node: "22.14.0", pnpm: "10.0.0" }, name: "@my/a" });
            // node: "current" is permissive — must survive even though pnpm drifts in the same block.
            writeJson("packages/b/package.json", { engines: { node: "current", pnpm: "9.0.0" }, name: "@my/b" });

            const issues = lintCustomTypes(iterateCustomTypeDeps(workspaceRoot));

            applyCustomTypeFixes(issues);

            const after = readJson("packages/b/package.json");

            expect((after.engines as Record<string, string>).pnpm).toBe("10.0.0");
            // node was unparseable → no issue emitted → fixer never touches the key.
            expect((after.engines as Record<string, string>).node).toBe("current");
        });

        it("clusters devEngines.runtime independently per runtime name (node and bun do not cross-couple)", () => {
            expect.assertions(3);

            writeWorkspaceRoot();
            writeJson("packages/a/package.json", {
                devEngines: { runtime: [{ name: "node", version: "22.14.0" }, { name: "bun", version: "1.0.0" }] },
                name: "@my/a",
            });
            writeJson("packages/b/package.json", {
                devEngines: { runtime: [{ name: "node", version: "22.14.0" }, { name: "bun", version: "1.1.0" }] },
                name: "@my/b",
            });

            const issues = lintCustomTypes(iterateCustomTypeDeps(workspaceRoot));

            // Only bun drifts; node is in agreement → exactly one issue, for bun.
            expect(issues).toHaveLength(1);
            expect(issues[0]?.depName).toBe("bun");

            applyCustomTypeFixes(issues);

            const after = readJson("packages/a/package.json");
            const { runtime } = after.devEngines as { runtime: { name: string; version: string }[] };
            const node = runtime.find((entry) => entry.name === "node");

            // node@22.14.0 in package A must not be touched by the bun fix on package B.
            expect(node?.version).toBe("22.14.0");
        });
    });
});
