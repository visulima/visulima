import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";

import { join } from "@visulima/path";
import { describe, expect, it } from "vitest";

import {
    applyCatalogUpdates,
    applyPackageJsonUpdates,
    collectInternalOutdated,
    hasBackup,
    hasCatalogs,
    hasPackageJsonDeps,
    parseCompositeCatalogName,
    readCatalogs,
    readPackageJsonDeps,
    restoreFromBackup,
} from "../../src/util/catalog";
import { writeChild, writeRoot } from "./catalog-test-helpers";

// --- parseCompositeCatalogName ---

describe(parseCompositeCatalogName, () => {
    it("should parse valid composite name with root path", () => {
        expect.assertions(1);

        expect(parseCompositeCatalogName(".:dependencies")).toStrictEqual({ depType: "dependencies", relativePath: "." });
    });

    it("should parse valid composite name with nested path", () => {
        expect.assertions(1);

        expect(parseCompositeCatalogName("packages/ui:devDependencies")).toStrictEqual({ depType: "devDependencies", relativePath: "packages/ui" });
    });

    it("should parse peerDependencies", () => {
        expect.assertions(1);

        expect(parseCompositeCatalogName("apps/web:peerDependencies")).toStrictEqual({ depType: "peerDependencies", relativePath: "apps/web" });
    });

    it("should parse optionalDependencies", () => {
        expect.assertions(1);

        expect(parseCompositeCatalogName("lib:optionalDependencies")).toStrictEqual({ depType: "optionalDependencies", relativePath: "lib" });
    });

    it("should return undefined for non-composite names", () => {
        expect.assertions(1);

        expect(parseCompositeCatalogName("default")).toBeUndefined();
    });

    it("should return undefined for invalid dep type", () => {
        expect.assertions(1);

        expect(parseCompositeCatalogName("packages/ui:scripts")).toBeUndefined();
    });

    it("should return undefined for empty string", () => {
        expect.assertions(1);

        expect(parseCompositeCatalogName("")).toBeUndefined();
    });
});

// --- readPackageJsonDeps ---

describe(readPackageJsonDeps, () => {
    const createTemporaryWorkspace = (): string => mkdtempSync(join(tmpdir(), "vis-npm-test-"));

    it("should read deps from a single-package root", () => {
        expect.assertions(3);

        const root = createTemporaryWorkspace();

        writeFileSync(
            join(root, "package.json"),
            JSON.stringify({
                dependencies: { lodash: "^4.17.21", react: "^18.2.0" },
                devDependencies: { typescript: "^5.0.0" },
                name: "my-app",
            }),
        );

        const result = readPackageJsonDeps(root);

        expect(result.size).toBe(2);
        expect(result.get(".:dependencies")).toStrictEqual(
            new Map([
                ["lodash", "^4.17.21"],
                ["react", "^18.2.0"],
            ]),
        );
        expect(result.get(".:devDependencies")).toStrictEqual(new Map([["typescript", "^5.0.0"]]));
    });

    it("should read deps from workspace packages", () => {
        expect.assertions(3);

        const root = createTemporaryWorkspace();

        writeFileSync(
            join(root, "package.json"),
            JSON.stringify({
                dependencies: { shared: "^1.0.0" },
                name: "my-monorepo",
                workspaces: ["packages/*"],
            }),
        );

        mkdirSync(join(root, "packages", "ui"), { recursive: true });
        writeFileSync(
            join(root, "packages", "ui", "package.json"),
            JSON.stringify({
                dependencies: { react: "^18.0.0" },
                devDependencies: { vitest: "^1.0.0" },
                name: "@my/ui",
            }),
        );

        const result = readPackageJsonDeps(root);

        expect(result.get(".:dependencies")).toStrictEqual(new Map([["shared", "^1.0.0"]]));
        expect(result.get("packages/ui:dependencies")).toStrictEqual(new Map([["react", "^18.0.0"]]));
        expect(result.get("packages/ui:devDependencies")).toStrictEqual(new Map([["vitest", "^1.0.0"]]));
    });

    it("should skip workspace-internal packages", () => {
        expect.assertions(2);

        const root = createTemporaryWorkspace();

        writeFileSync(
            join(root, "package.json"),
            JSON.stringify({
                name: "my-monorepo",
                workspaces: ["packages/*"],
            }),
        );

        mkdirSync(join(root, "packages", "core"), { recursive: true });
        writeFileSync(join(root, "packages", "core", "package.json"), JSON.stringify({ name: "@my/core" }));

        mkdirSync(join(root, "packages", "app"), { recursive: true });
        writeFileSync(
            join(root, "packages", "app", "package.json"),
            JSON.stringify({
                dependencies: { "@my/core": "workspace:*", react: "^18.0.0" },
                name: "@my/app",
            }),
        );

        const result = readPackageJsonDeps(root);
        const appDeps = result.get("packages/app:dependencies");

        expect(appDeps?.has("react")).toBe(true);
        expect(appDeps?.has("@my/core")).toBe(false);
    });

    it("should skip workspace:, file:, and link: protocols", () => {
        expect.assertions(4);

        const root = createTemporaryWorkspace();

        writeFileSync(
            join(root, "package.json"),
            JSON.stringify({
                dependencies: {
                    "linked-pkg": "link:../linked",
                    "local-pkg": "file:../local",
                    react: "^18.0.0",
                    "ws-pkg": "workspace:^1.0.0",
                },
                name: "my-app",
            }),
        );

        const result = readPackageJsonDeps(root);
        const deps = result.get(".:dependencies");

        expect(deps?.has("react")).toBe(true);
        expect(deps?.has("local-pkg")).toBe(false);
        expect(deps?.has("linked-pkg")).toBe(false);
        expect(deps?.has("ws-pkg")).toBe(false);
    });

    it("should filter by dev option", () => {
        expect.assertions(2);

        const root = createTemporaryWorkspace();

        writeFileSync(
            join(root, "package.json"),
            JSON.stringify({
                dependencies: { react: "^18.0.0" },
                devDependencies: { vitest: "^1.0.0" },
                name: "my-app",
            }),
        );

        const result = readPackageJsonDeps(root, { dev: true });

        expect(result.has(".:devDependencies")).toBe(true);
        expect(result.has(".:dependencies")).toBe(false);
    });

    it("should filter by prod option", () => {
        expect.assertions(2);

        const root = createTemporaryWorkspace();

        writeFileSync(
            join(root, "package.json"),
            JSON.stringify({
                dependencies: { react: "^18.0.0" },
                devDependencies: { vitest: "^1.0.0" },
                name: "my-app",
            }),
        );

        const result = readPackageJsonDeps(root, { prod: true });

        expect(result.has(".:dependencies")).toBe(true);
        expect(result.has(".:devDependencies")).toBe(false);
    });

    it("should return empty map for missing package.json", () => {
        expect.assertions(1);

        const root = createTemporaryWorkspace();

        expect(readPackageJsonDeps(root).size).toBe(0);
    });

    it("should exclude peerDependencies by default", () => {
        expect.assertions(2);

        const root = createTemporaryWorkspace();

        writeFileSync(
            join(root, "package.json"),
            JSON.stringify({
                dependencies: { react: "^18.0.0" },
                name: "my-app",
                peerDependencies: { "react-dom": "^18.0.0" },
            }),
        );

        const result = readPackageJsonDeps(root);

        expect(result.has(".:dependencies")).toBe(true);
        expect(result.has(".:peerDependencies")).toBe(false);
    });

    it("should include peerDependencies when peer:true", () => {
        expect.assertions(2);

        const root = createTemporaryWorkspace();

        writeFileSync(
            join(root, "package.json"),
            JSON.stringify({
                dependencies: { react: "^18.0.0" },
                name: "my-app",
                peerDependencies: { "react-dom": "^18.0.0" },
            }),
        );

        const result = readPackageJsonDeps(root, { peer: true });

        expect(result.has(".:dependencies")).toBe(true);
        expect(result.get(".:peerDependencies")).toStrictEqual(new Map([["react-dom", "^18.0.0"]]));
    });

    it("should keep workspace-internal names when includeInternal:true", () => {
        expect.assertions(2);

        const root = createTemporaryWorkspace();

        writeFileSync(
            join(root, "package.json"),
            JSON.stringify({
                name: "my-monorepo",
                workspaces: ["packages/*"],
            }),
        );

        mkdirSync(join(root, "packages", "core"), { recursive: true });
        writeFileSync(join(root, "packages", "core", "package.json"), JSON.stringify({ name: "@my/core", version: "1.0.0" }));

        mkdirSync(join(root, "packages", "app"), { recursive: true });
        writeFileSync(
            join(root, "packages", "app", "package.json"),
            JSON.stringify({
                dependencies: { "@my/core": "1.0.0", react: "^18.0.0" },
                name: "@my/app",
            }),
        );

        const defaultResult = readPackageJsonDeps(root);
        const includedResult = readPackageJsonDeps(root, { includeInternal: true });

        expect(defaultResult.get("packages/app:dependencies")?.has("@my/core")).toBe(false);
        expect(includedResult.get("packages/app:dependencies")?.has("@my/core")).toBe(true);
    });
});

// --- hasPackageJsonDeps ---

describe(hasPackageJsonDeps, () => {
    it("should return true when package.json has dependencies", () => {
        expect.assertions(1);

        const root = mkdtempSync(join(tmpdir(), "vis-has-deps-"));

        writeFileSync(join(root, "package.json"), JSON.stringify({ dependencies: { react: "^18.0.0" } }));

        expect(hasPackageJsonDeps(root)).toBe(true);
    });

    it("should return true when package.json has devDependencies", () => {
        expect.assertions(1);

        const root = mkdtempSync(join(tmpdir(), "vis-has-deps-"));

        writeFileSync(join(root, "package.json"), JSON.stringify({ devDependencies: { vitest: "^1.0.0" } }));

        expect(hasPackageJsonDeps(root)).toBe(true);
    });

    it("should return false when package.json has no deps", () => {
        expect.assertions(1);

        const root = mkdtempSync(join(tmpdir(), "vis-has-deps-"));

        writeFileSync(join(root, "package.json"), JSON.stringify({ name: "empty" }));

        expect(hasPackageJsonDeps(root)).toBe(false);
    });

    it("should return false when no package.json exists", () => {
        expect.assertions(1);

        const root = mkdtempSync(join(tmpdir(), "vis-has-deps-"));

        expect(hasPackageJsonDeps(root)).toBe(false);
    });
});

// --- applyPackageJsonUpdates ---

describe(applyPackageJsonUpdates, () => {
    it("should update deps in root package.json", () => {
        expect.assertions(2);

        const root = mkdtempSync(join(tmpdir(), "vis-apply-"));

        writeFileSync(join(root, "package.json"), JSON.stringify({ dependencies: { react: "^18.2.0" }, name: "app" }, undefined, 2));

        applyPackageJsonUpdates(root, [
            { catalogName: ".:dependencies", currentRange: "^18.2.0", newRange: "^19.0.0", packageName: "react", targetVersion: "19.0.0", updateType: "major" },
        ]);

        const updated = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));

        expect(updated.dependencies.react).toBe("^19.0.0");
        expect(updated.name).toBe("app");
    });

    it("should update deps in nested workspace package", () => {
        expect.assertions(1);

        const root = mkdtempSync(join(tmpdir(), "vis-apply-"));

        mkdirSync(join(root, "packages", "ui"), { recursive: true });
        writeFileSync(join(root, "packages", "ui", "package.json"), JSON.stringify({ devDependencies: { vitest: "^1.0.0" }, name: "@my/ui" }, undefined, 2));

        applyPackageJsonUpdates(root, [
            {
                catalogName: "packages/ui:devDependencies",
                currentRange: "^1.0.0",
                newRange: "^2.0.0",
                packageName: "vitest",
                targetVersion: "2.0.0",
                updateType: "major",
            },
        ]);

        const updated = JSON.parse(readFileSync(join(root, "packages", "ui", "package.json"), "utf8"));

        expect(updated.devDependencies.vitest).toBe("^2.0.0");
    });

    it("should preserve JSON indentation", () => {
        expect.assertions(1);

        const root = mkdtempSync(join(tmpdir(), "vis-apply-"));

        writeFileSync(join(root, "package.json"), JSON.stringify({ dependencies: { lodash: "^4.17.0" }, name: "app" }, undefined, 4));

        applyPackageJsonUpdates(root, [
            {
                catalogName: ".:dependencies",
                currentRange: "^4.17.0",
                newRange: "^4.18.0",
                packageName: "lodash",
                targetVersion: "4.18.0",
                updateType: "minor",
            },
        ]);

        const content = readFileSync(join(root, "package.json"), "utf8");

        // 4-space indent should be preserved
        expect(content).toContain("    ");
    });

    it("should update multiple files in one call", () => {
        expect.assertions(2);

        const root = mkdtempSync(join(tmpdir(), "vis-apply-"));

        writeFileSync(join(root, "package.json"), JSON.stringify({ dependencies: { react: "^18.0.0" }, name: "root" }, undefined, 2));

        mkdirSync(join(root, "packages", "app"), { recursive: true });
        writeFileSync(join(root, "packages", "app", "package.json"), JSON.stringify({ dependencies: { react: "^18.0.0" }, name: "@my/app" }, undefined, 2));

        applyPackageJsonUpdates(root, [
            { catalogName: ".:dependencies", currentRange: "^18.0.0", newRange: "^19.0.0", packageName: "react", targetVersion: "19.0.0", updateType: "major" },
            {
                catalogName: "packages/app:dependencies",
                currentRange: "^18.0.0",
                newRange: "^19.0.0",
                packageName: "react",
                targetVersion: "19.0.0",
                updateType: "major",
            },
        ]);

        const rootPkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
        const appPkg = JSON.parse(readFileSync(join(root, "packages", "app", "package.json"), "utf8"));

        expect(rootPkg.dependencies.react).toBe("^19.0.0");
        expect(appPkg.dependencies.react).toBe("^19.0.0");
    });
});

// --- npm/yarn backup and restore ---

describe("npm/yarn backup and restore", () => {
    it("should create and restore backup for npm", () => {
        expect.assertions(3);

        const root = mkdtempSync(join(tmpdir(), "vis-backup-npm-"));

        writeFileSync(join(root, "package.json"), JSON.stringify({ dependencies: { react: "^18.0.0" }, name: "app" }, undefined, 2));

        const updates = [
            {
                catalogName: ".:dependencies",
                currentRange: "^18.0.0",
                newRange: "^19.0.0",
                packageName: "react",
                targetVersion: "19.0.0",
                updateType: "major" as const,
            },
        ];

        applyCatalogUpdates(root, updates, "npm");

        const afterUpdate = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));

        expect(afterUpdate.dependencies.react).toBe("^19.0.0");
        expect(hasBackup(root, "npm")).toBe(true);

        restoreFromBackup(root, "npm");

        const afterRestore = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));

        expect(afterRestore.dependencies.react).toBe("^18.0.0");
    });

    it("should backup multiple package.json files", () => {
        expect.assertions(3);

        const root = mkdtempSync(join(tmpdir(), "vis-backup-npm-"));

        writeFileSync(join(root, "package.json"), JSON.stringify({ dependencies: { lodash: "^4.17.0" }, name: "root" }, undefined, 2));

        mkdirSync(join(root, "packages", "ui"), { recursive: true });
        writeFileSync(join(root, "packages", "ui", "package.json"), JSON.stringify({ dependencies: { react: "^18.0.0" }, name: "@my/ui" }, undefined, 2));

        const updates = [
            {
                catalogName: ".:dependencies",
                currentRange: "^4.17.0",
                newRange: "^4.18.0",
                packageName: "lodash",
                targetVersion: "4.18.0",
                updateType: "minor" as const,
            },
            {
                catalogName: "packages/ui:dependencies",
                currentRange: "^18.0.0",
                newRange: "^19.0.0",
                packageName: "react",
                targetVersion: "19.0.0",
                updateType: "major" as const,
            },
        ];

        applyCatalogUpdates(root, updates, "npm");

        expect(hasBackup(root, "npm")).toBe(true);

        restoreFromBackup(root, "npm");

        const rootPkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
        const uiPkg = JSON.parse(readFileSync(join(root, "packages", "ui", "package.json"), "utf8"));

        expect(rootPkg.dependencies.lodash).toBe("^4.17.0");
        expect(uiPkg.dependencies.react).toBe("^18.0.0");
    });

    it("should report no backup when none exists for npm", () => {
        expect.assertions(1);

        const root = mkdtempSync(join(tmpdir(), "vis-backup-npm-"));

        expect(hasBackup(root, "npm")).toBe(false);
    });
});

// --- hasCatalogs for npm/yarn ---

describe("hasCatalogs for npm/yarn", () => {
    it("should return true for npm when package.json has deps", () => {
        expect.assertions(1);

        const root = mkdtempSync(join(tmpdir(), "vis-has-cat-"));

        writeFileSync(join(root, "package.json"), JSON.stringify({ dependencies: { react: "^18.0.0" } }));

        expect(hasCatalogs(root, "npm")).toBe(true);
    });

    it("should return true for yarn when package.json has deps", () => {
        expect.assertions(1);

        const root = mkdtempSync(join(tmpdir(), "vis-has-cat-"));

        writeFileSync(join(root, "package.json"), JSON.stringify({ devDependencies: { vitest: "^1.0.0" } }));

        expect(hasCatalogs(root, "yarn")).toBe(true);
    });

    it("should return false for npm when no deps exist", () => {
        expect.assertions(1);

        const root = mkdtempSync(join(tmpdir(), "vis-has-cat-"));

        writeFileSync(join(root, "package.json"), JSON.stringify({ name: "empty" }));

        expect(hasCatalogs(root, "npm")).toBe(false);
    });
});

// --- readCatalogs for npm/yarn ---

describe("readCatalogs for npm/yarn", () => {
    it("should return deps using composite keys for npm", () => {
        expect.assertions(2);

        const root = mkdtempSync(join(tmpdir(), "vis-read-cat-"));

        writeFileSync(
            join(root, "package.json"),
            JSON.stringify({
                dependencies: { react: "^18.0.0" },
                devDependencies: { vitest: "^1.0.0" },
                name: "app",
            }),
        );

        const catalogs = readCatalogs(root, "npm");

        expect(catalogs.has(".:dependencies")).toBe(true);
        expect(catalogs.has(".:devDependencies")).toBe(true);
    });

    it("should pass dev/prod options through for yarn", () => {
        expect.assertions(2);

        const root = mkdtempSync(join(tmpdir(), "vis-read-cat-"));

        writeFileSync(
            join(root, "package.json"),
            JSON.stringify({
                dependencies: { react: "^18.0.0" },
                devDependencies: { vitest: "^1.0.0" },
                name: "app",
            }),
        );

        const catalogs = readCatalogs(root, "yarn", { dev: true });

        expect(catalogs.has(".:devDependencies")).toBe(true);
        expect(catalogs.has(".:dependencies")).toBe(false);
    });

    it("should fall back to package.json deps for pnpm without catalogs", () => {
        expect.assertions(2);

        const root = mkdtempSync(join(tmpdir(), "vis-read-cat-"));

        // pnpm-workspace.yaml with no catalog section
        writeFileSync(join(root, "pnpm-workspace.yaml"), "packages:\n  - packages/*\n");
        writeFileSync(
            join(root, "package.json"),
            JSON.stringify({
                dependencies: { react: "^18.0.0" },
                name: "app",
            }),
        );

        const catalogs = readCatalogs(root, "pnpm");

        expect(catalogs.size).toBeGreaterThan(0);
        expect(catalogs.has(".:dependencies")).toBe(true);
    });

    it("should fall back to package.json deps for bun without catalogs", () => {
        expect.assertions(2);

        const root = mkdtempSync(join(tmpdir(), "vis-read-cat-"));

        // package.json with workspaces but no catalog field
        writeFileSync(
            join(root, "package.json"),
            JSON.stringify({
                dependencies: { lodash: "^4.17.0" },
                name: "app",
                workspaces: { packages: ["packages/*"] },
            }),
        );

        const catalogs = readCatalogs(root, "bun");

        expect(catalogs.size).toBeGreaterThan(0);
        expect(catalogs.has(".:dependencies")).toBe(true);
    });
});

// --- collectInternalOutdated ---

describe(collectInternalOutdated, () => {
    it("should return empty when the workspace root has no package.json", () => {
        expect.assertions(1);

        const root = mkdtempSync(join(tmpdir(), "vis-internal-empty-"));

        expect(collectInternalOutdated(root)).toStrictEqual({ ignored: [], outdated: [] });
    });

    it("should return empty when no internal packages are declared", () => {
        expect.assertions(1);

        const root = mkdtempSync(join(tmpdir(), "vis-internal-none-"));

        writeRoot(root, { name: "monorepo", workspaces: ["packages/*"] });

        expect(collectInternalOutdated(root)).toStrictEqual({ ignored: [], outdated: [] });
    });

    it("should return empty when consumer pin matches the local source-of-truth version", () => {
        expect.assertions(1);

        const root = mkdtempSync(join(tmpdir(), "vis-internal-uptodate-"));

        writeRoot(root, { name: "monorepo", workspaces: ["packages/*"] });
        writeChild(root, "packages/fs", { name: "@visulima/fs", version: "5.0.0" });
        writeChild(root, "packages/consumer", {
            dependencies: { "@visulima/fs": "5.0.0" },
            name: "@visulima/consumer",
            version: "1.0.0",
        });

        expect(collectInternalOutdated(root).outdated).toStrictEqual([]);
    });

    it("should detect a stale internal pin and emit a composite catalogName matching applyPackageJsonUpdates", () => {
        expect.assertions(5);

        const root = mkdtempSync(join(tmpdir(), "vis-internal-stale-"));

        writeRoot(root, { name: "monorepo", workspaces: ["packages/*"] });
        writeChild(root, "packages/fs", { name: "@visulima/fs", version: "5.0.0-alpha.14" });
        writeChild(root, "packages/consumer", {
            dependencies: { "@visulima/fs": "5.0.0-alpha.10" },
            name: "@visulima/consumer",
            version: "1.0.0",
        });

        const result = collectInternalOutdated(root);

        expect(result.outdated).toHaveLength(1);

        const [entry] = result.outdated;

        expect(entry?.packageName).toBe("@visulima/fs");
        expect(entry?.catalogName).toBe("packages/consumer:dependencies");
        expect(entry?.currentRange).toBe("5.0.0-alpha.10");
        expect(entry?.newRange).toBe("5.0.0-alpha.14");
    });

    it("should preserve a caret prefix on the bumped range", () => {
        expect.assertions(1);

        const root = mkdtempSync(join(tmpdir(), "vis-internal-caret-"));

        writeRoot(root, { name: "monorepo", workspaces: ["packages/*"] });
        writeChild(root, "packages/fs", { name: "@visulima/fs", version: "5.1.0" });
        writeChild(root, "packages/consumer", {
            dependencies: { "@visulima/fs": "^5.0.0" },
            name: "@visulima/consumer",
            version: "1.0.0",
        });

        expect(collectInternalOutdated(root).outdated[0]?.newRange).toBe("^5.1.0");
    });

    it("should skip workspace:/file:/link:/catalog:/* protocols", () => {
        expect.assertions(1);

        const root = mkdtempSync(join(tmpdir(), "vis-internal-protocols-"));

        writeRoot(root, { name: "monorepo", workspaces: ["packages/*"] });
        writeChild(root, "packages/fs", { name: "@visulima/fs", version: "5.0.0-alpha.14" });
        writeChild(root, "packages/c1", {
            dependencies: { "@visulima/fs": "workspace:^" },
            name: "c1",
        });
        writeChild(root, "packages/c2", {
            dependencies: { "@visulima/fs": "catalog:" },
            name: "c2",
        });
        writeChild(root, "packages/c3", {
            dependencies: { "@visulima/fs": "*" },
            name: "c3",
        });
        writeChild(root, "packages/c4", {
            dependencies: { "@visulima/fs": "file:../fs" },
            name: "c4",
        });
        writeChild(root, "packages/c5", {
            dependencies: { "@visulima/fs": "link:../fs" },
            name: "c5",
        });

        expect(collectInternalOutdated(root).outdated).toStrictEqual([]);
    });

    it("should honor an ignore pattern and surface the matched name in `ignored`", () => {
        expect.assertions(2);

        const root = mkdtempSync(join(tmpdir(), "vis-internal-ignore-"));

        writeRoot(root, { name: "monorepo", workspaces: ["packages/*"] });
        writeChild(root, "packages/fs", { name: "@visulima/fs", version: "5.0.0-alpha.14" });
        writeChild(root, "packages/consumer", {
            dependencies: { "@visulima/fs": "5.0.0-alpha.10" },
            name: "consumer",
        });

        const result = collectInternalOutdated(root, { ignore: ["@visulima/fs"] });

        expect(result.outdated).toStrictEqual([]);
        expect(result.ignored).toStrictEqual(["@visulima/fs"]);
    });

    it("should drop entries that exceed the patch target (a major bump is not patch)", () => {
        expect.assertions(1);

        const root = mkdtempSync(join(tmpdir(), "vis-internal-target-patch-"));

        writeRoot(root, { name: "monorepo", workspaces: ["packages/*"] });
        // major bump: 5 → 6
        writeChild(root, "packages/fs", { name: "@visulima/fs", version: "6.0.0" });
        writeChild(root, "packages/consumer", {
            dependencies: { "@visulima/fs": "5.0.0" },
            name: "consumer",
        });

        expect(collectInternalOutdated(root, { target: "patch" }).outdated).toStrictEqual([]);
    });

    it("should drop entries that exceed the minor target (a major bump is not minor)", () => {
        expect.assertions(1);

        const root = mkdtempSync(join(tmpdir(), "vis-internal-target-minor-"));

        writeRoot(root, { name: "monorepo", workspaces: ["packages/*"] });
        writeChild(root, "packages/fs", { name: "@visulima/fs", version: "6.0.0" });
        writeChild(root, "packages/consumer", {
            dependencies: { "@visulima/fs": "5.0.0" },
            name: "consumer",
        });

        expect(collectInternalOutdated(root, { target: "minor" }).outdated).toStrictEqual([]);
    });

    it("should detect stale internal deps in the workspace root package.json (catalogName `.:dependencies`)", () => {
        expect.assertions(2);

        const root = mkdtempSync(join(tmpdir(), "vis-internal-root-"));

        writeRoot(root, {
            dependencies: { "@visulima/fs": "5.0.0-alpha.10" },
            name: "monorepo",
            workspaces: ["packages/*"],
        });
        writeChild(root, "packages/fs", { name: "@visulima/fs", version: "5.0.0-alpha.14" });

        const result = collectInternalOutdated(root);

        expect(result.outdated).toHaveLength(1);
        expect(result.outdated[0]?.catalogName).toBe(".:dependencies");
    });

    it("should fall back to pnpm-workspace.yaml patterns when the root package.json has no `workspaces` field", () => {
        expect.assertions(1);

        const root = mkdtempSync(join(tmpdir(), "vis-internal-pnpm-"));

        writeRoot(root, { name: "monorepo" });
        writeFileSync(join(root, "pnpm-workspace.yaml"), "packages:\n  - \"packages/*\"\n");
        writeChild(root, "packages/fs", { name: "@visulima/fs", version: "5.0.0-alpha.14" });
        writeChild(root, "packages/consumer", {
            dependencies: { "@visulima/fs": "5.0.0-alpha.10" },
            name: "consumer",
        });

        expect(collectInternalOutdated(root).outdated).toHaveLength(1);
    });

    it("should respect dev/prod scoping by skipping the opposite dep field", () => {
        expect.assertions(2);

        const root = mkdtempSync(join(tmpdir(), "vis-internal-scope-"));

        writeRoot(root, { name: "monorepo", workspaces: ["packages/*"] });
        writeChild(root, "packages/fs", { name: "@visulima/fs", version: "5.0.0-alpha.14" });
        writeChild(root, "packages/consumer", {
            devDependencies: { "@visulima/fs": "5.0.0-alpha.10" },
            name: "consumer",
        });

        // prod-only ignores devDependencies
        expect(collectInternalOutdated(root, { prod: true }).outdated).toStrictEqual([]);

        // dev-only finds it
        expect(collectInternalOutdated(root, { dev: true }).outdated).toHaveLength(1);
    });
});
