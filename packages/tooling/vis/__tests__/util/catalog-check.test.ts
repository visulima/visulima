import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";

import { join } from "@visulima/path";
import { describe, expect, it, vi } from "vitest";

import type { CatalogCheckOptions } from "../../src/util/catalog";
import {
    applyPackageJsonUpdates,
    checkOutdated,
    hasCatalogs,
    hasPackageJsonDeps,
    readCatalogs,
    readPackageJsonDeps,
} from "../../src/util/catalog";
import { mockFetch } from "./catalog-test-helpers";

// --- includeLocked (collectEntries via checkOutdated) ---

describe("includeLocked option", () => {
    it("should skip pinned versions by default", async () => {
        expect.assertions(1);

        mockFetch({
            react: { latest: "19.0.0", versions: ["18.2.0", "19.0.0"] },
        });

        const catalogs = new Map([["default", new Map([["react", "18.2.0"]])]]);
        const options: CatalogCheckOptions = { exclude: [], ignore: [], include: [], includeLocked: false, includePrerelease: false, target: "latest" };
        const result = await checkOutdated(catalogs, options);

        expect(result.outdated).toHaveLength(0);

        vi.restoreAllMocks();
    });

    it("should include pinned versions when includeLocked is true", async () => {
        expect.assertions(2);

        mockFetch({
            react: { latest: "19.0.0", versions: ["18.2.0", "19.0.0"] },
        });

        const catalogs = new Map([["default", new Map([["react", "18.2.0"]])]]);
        const options: CatalogCheckOptions = { exclude: [], ignore: [], include: [], includeLocked: true, includePrerelease: false, target: "latest" };
        const result = await checkOutdated(catalogs, options);

        expect(result.outdated).toHaveLength(1);
        expect(result.outdated[0]?.packageName).toBe("react");

        vi.restoreAllMocks();
    });

    it("should not skip versions with ^ or ~ prefix", async () => {
        expect.assertions(1);

        mockFetch({
            react: { latest: "19.0.0", versions: ["18.2.0", "19.0.0"] },
        });

        const catalogs = new Map([["default", new Map([["react", "^18.2.0"]])]]);
        const options: CatalogCheckOptions = { exclude: [], ignore: [], include: [], includeLocked: false, includePrerelease: false, target: "latest" };
        const result = await checkOutdated(catalogs, options);

        expect(result.outdated).toHaveLength(1);

        vi.restoreAllMocks();
    });
});

// --- packageMode (via checkOutdated) ---

describe("packageMode option", () => {
    it("should use per-package target override", async () => {
        expect.assertions(2);

        mockFetch({
            react: { latest: "19.0.0", versions: ["18.2.0", "18.3.0", "19.0.0"] },
            typescript: { latest: "5.5.0", versions: ["5.3.0", "5.4.0", "5.5.0"] },
        });

        const catalogs = new Map([
            [
                "default",
                new Map([
                    ["react", "^18.2.0"],
                    ["typescript", "^5.3.0"],
                ]),
            ],
        ]);
        const options: CatalogCheckOptions = {
            exclude: [],
            ignore: [],
            include: [],
            includeLocked: false,
            includePrerelease: false,
            packageMode: { typescript: "minor" },
            target: "latest",
        };
        const result = await checkOutdated(catalogs, options);

        // react should get latest (19.0.0), typescript should be constrained to minor (5.5.0 is same major)
        const reactEntry = result.outdated.find((e) => e.packageName === "react");
        const tsEntry = result.outdated.find((e) => e.packageName === "typescript");

        expect(reactEntry?.targetVersion).toBe("19.0.0");
        expect(tsEntry?.targetVersion).toBe("5.5.0");

        vi.restoreAllMocks();
    });
});

// --- depFields (readPackageJsonDeps) ---

describe("depFields option", () => {
    it("should read overrides field when configured", () => {
        expect.assertions(2);

        const root = mkdtempSync(join(tmpdir(), "vis-depfields-"));

        writeFileSync(
            join(root, "package.json"),
            JSON.stringify({
                dependencies: { react: "^18.0.0" },
                name: "app",
                overrides: { lodash: "^4.17.21" },
            }),
        );

        const result = readPackageJsonDeps(root, { depFields: ["dependencies", "overrides"] });

        expect(result.get(".:dependencies")?.has("react")).toBe(true);
        expect(result.get(".:overrides")?.has("lodash")).toBe(true);
    });

    it("should read pnpm.overrides nested field when configured", () => {
        expect.assertions(2);

        const root = mkdtempSync(join(tmpdir(), "vis-depfields-"));

        writeFileSync(
            join(root, "package.json"),
            JSON.stringify({
                dependencies: { react: "^18.0.0" },
                name: "app",
                pnpm: { overrides: { lodash: "^4.17.21" } },
            }),
        );

        const result = readPackageJsonDeps(root, { depFields: ["dependencies", "pnpm.overrides"] });

        expect(result.get(".:dependencies")?.has("react")).toBe(true);
        expect(result.get(".:pnpm.overrides")?.has("lodash")).toBe(true);
    });

    it("should skip $ references in overrides", () => {
        expect.assertions(2);

        const root = mkdtempSync(join(tmpdir(), "vis-depfields-"));

        writeFileSync(
            join(root, "package.json"),
            JSON.stringify({
                dependencies: { react: "^18.0.0" },
                name: "app",
                overrides: { lodash: "^4.17.21", "react-dom": "$react" },
            }),
        );

        const result = readPackageJsonDeps(root, { depFields: ["overrides"] });
        const overrides = result.get(".:overrides");

        expect(overrides?.has("lodash")).toBe(true);
        expect(overrides?.has("react-dom")).toBe(false);
    });

    it("should use default dep types when depFields is not set", () => {
        expect.assertions(2);

        const root = mkdtempSync(join(tmpdir(), "vis-depfields-"));

        writeFileSync(
            join(root, "package.json"),
            JSON.stringify({
                dependencies: { react: "^18.0.0" },
                name: "app",
                overrides: { lodash: "^4.17.21" },
            }),
        );

        const result = readPackageJsonDeps(root);

        expect(result.get(".:dependencies")?.has("react")).toBe(true);
        expect(result.has(".:overrides")).toBe(false);
    });
});

// --- hasPackageJsonDeps with extended fields ---

describe("hasPackageJsonDeps with overrides/resolutions", () => {
    it("should return true when package.json has overrides", () => {
        expect.assertions(1);

        const root = mkdtempSync(join(tmpdir(), "vis-has-deps-"));

        writeFileSync(join(root, "package.json"), JSON.stringify({ name: "app", overrides: { lodash: "^4.17.21" } }));

        expect(hasPackageJsonDeps(root)).toBe(true);
    });

    it("should return true when package.json has resolutions", () => {
        expect.assertions(1);

        const root = mkdtempSync(join(tmpdir(), "vis-has-deps-"));

        writeFileSync(join(root, "package.json"), JSON.stringify({ name: "app", resolutions: { lodash: "^4.17.21" } }));

        expect(hasPackageJsonDeps(root)).toBe(true);
    });

    it("should return true when package.json has pnpm.overrides", () => {
        expect.assertions(1);

        const root = mkdtempSync(join(tmpdir(), "vis-has-deps-"));

        writeFileSync(join(root, "package.json"), JSON.stringify({ name: "app", pnpm: { overrides: { lodash: "^4.17.21" } } }));

        expect(hasPackageJsonDeps(root)).toBe(true);
    });
});

// --- applyPackageJsonUpdates with nested fields ---

describe("applyPackageJsonUpdates with nested dep types", () => {
    it("should update pnpm.overrides using dot-path", () => {
        expect.assertions(2);

        const root = mkdtempSync(join(tmpdir(), "vis-apply-nested-"));

        writeFileSync(join(root, "package.json"), JSON.stringify({ name: "app", pnpm: { overrides: { lodash: "^4.17.0" } } }, undefined, 2));

        applyPackageJsonUpdates(root, [
            {
                catalogName: ".:pnpm.overrides",
                currentRange: "^4.17.0",
                newRange: "^4.17.21",
                packageName: "lodash",
                targetVersion: "4.17.21",
                updateType: "patch",
            },
        ]);

        const updated = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));

        expect(updated.pnpm.overrides.lodash).toBe("^4.17.21");
        expect(updated.name).toBe("app");
    });

    it("should update overrides field directly", () => {
        expect.assertions(1);

        const root = mkdtempSync(join(tmpdir(), "vis-apply-nested-"));

        writeFileSync(join(root, "package.json"), JSON.stringify({ name: "app", overrides: { lodash: "^4.17.0" } }, undefined, 2));

        applyPackageJsonUpdates(root, [
            {
                catalogName: ".:overrides",
                currentRange: "^4.17.0",
                newRange: "^4.17.21",
                packageName: "lodash",
                targetVersion: "4.17.21",
                updateType: "patch",
            },
        ]);

        const updated = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));

        expect(updated.overrides.lodash).toBe("^4.17.21");
    });
});

// --- hasCatalogs ---

describe(hasCatalogs, () => {
    it("should detect default catalog", () => {
        expect.assertions(1);

        const temporaryDirectory = mkdtempSync(join(tmpdir(), "vis-test-"));

        writeFileSync(
            join(temporaryDirectory, "pnpm-workspace.yaml"),
            `packages:
  - "packages/*"
catalog:
  react: ^18.0.0
`,
        );

        expect(hasCatalogs(temporaryDirectory)).toBe(true);
    });

    it("should detect named catalogs", () => {
        expect.assertions(1);

        const temporaryDirectory = mkdtempSync(join(tmpdir(), "vis-test-"));

        writeFileSync(
            join(temporaryDirectory, "pnpm-workspace.yaml"),
            `packages:
  - "packages/*"
catalogs:
  dev:
    eslint: ^8.0.0
`,
        );

        expect(hasCatalogs(temporaryDirectory)).toBe(true);
    });

    it("should return false when no catalogs", () => {
        expect.assertions(1);

        const temporaryDirectory = mkdtempSync(join(tmpdir(), "vis-test-"));

        writeFileSync(
            join(temporaryDirectory, "pnpm-workspace.yaml"),
            `packages:
  - "packages/*"
`,
        );

        expect(hasCatalogs(temporaryDirectory)).toBe(false);
    });

    it("should return false when no pnpm-workspace.yaml", () => {
        expect.assertions(1);

        const temporaryDirectory = mkdtempSync(join(tmpdir(), "vis-test-"));

        expect(hasCatalogs(temporaryDirectory)).toBe(false);
    });
});

// --- readCatalogs ---

describe(readCatalogs, () => {
    it("should read catalogs from pnpm-workspace.yaml", () => {
        expect.assertions(3);

        const temporaryDirectory = mkdtempSync(join(tmpdir(), "vis-test-"));

        writeFileSync(
            join(temporaryDirectory, "pnpm-workspace.yaml"),
            `catalog:
  react: ^18.0.0
catalogs:
  dev:
    eslint: ^8.0.0
`,
        );

        const catalogs = readCatalogs(temporaryDirectory);

        expect(catalogs.size).toBe(2);
        expect(catalogs.get("default")?.get("react")).toBe("^18.0.0");
        expect(catalogs.get("dev")?.get("eslint")).toBe("^8.0.0");
    });

    it("should return empty map when no file", () => {
        expect.assertions(1);

        const temporaryDirectory = mkdtempSync(join(tmpdir(), "vis-test-"));

        expect(readCatalogs(temporaryDirectory).size).toBe(0);
    });

    it("should merge pnpm catalogs with non-catalog package.json deps", () => {
        expect.assertions(5);

        const temporaryDirectory = mkdtempSync(join(tmpdir(), "vis-test-"));

        // pnpm-workspace.yaml with catalog and workspace packages
        writeFileSync(
            join(temporaryDirectory, "pnpm-workspace.yaml"),
            `packages:
  - packages/*
catalog:
  react: ^18.0.0
`,
        );

        // Root package.json with a direct dependency (not using catalog:)
        writeFileSync(
            join(temporaryDirectory, "package.json"),
            JSON.stringify({
                dependencies: {
                    lodash: "^4.17.0",
                    react: "catalog:default",
                },
                name: "root",
            }),
        );

        // Workspace package with a direct dependency
        mkdirSync(join(temporaryDirectory, "packages", "app"), { recursive: true });
        writeFileSync(
            join(temporaryDirectory, "packages", "app", "package.json"),
            JSON.stringify({
                dependencies: {
                    axios: "^1.0.0",
                    react: "catalog:default",
                },
                name: "@myorg/app",
            }),
        );

        const catalogs = readCatalogs(temporaryDirectory, "pnpm");

        // Should have catalog entry + package.json dep entries
        expect(catalogs.get("default")?.get("react")).toBe("^18.0.0");
        // Root package.json dep (not using catalog: reference)
        expect(catalogs.get(".:dependencies")?.get("lodash")).toBe("^4.17.0");
        // catalog: references should be filtered out from package.json scanning
        expect(catalogs.get(".:dependencies")?.has("react")).toBe(false);
        // Workspace package dep
        expect(catalogs.get("packages/app:dependencies")?.get("axios")).toBe("^1.0.0");
        expect(catalogs.get("packages/app:dependencies")?.has("react")).toBe(false);
    });

    it("should skip catalog: references in package.json deps", () => {
        expect.assertions(2);

        const temporaryDirectory = mkdtempSync(join(tmpdir(), "vis-test-"));

        writeFileSync(
            join(temporaryDirectory, "pnpm-workspace.yaml"),
            `catalog:
  react: ^18.0.0
`,
        );

        writeFileSync(
            join(temporaryDirectory, "package.json"),
            JSON.stringify({
                dependencies: {
                    react: "catalog:default",
                },
                name: "root",
            }),
        );

        const catalogs = readCatalogs(temporaryDirectory, "pnpm");

        // Only the catalog entry, no package.json entry for react
        expect(catalogs.get("default")?.get("react")).toBe("^18.0.0");
        expect(catalogs.has(".:dependencies")).toBe(false);
    });
});

// --- checkOutdated ---

describe(checkOutdated, () => {
    it("should find outdated packages", async () => {
        expect.assertions(6);

        mockFetch({
            react: { latest: "19.0.0", versions: ["18.2.0", "19.0.0"] },
        });

        const catalogs = new Map([["default", new Map([["react", "^18.2.0"]])]]);
        const options: CatalogCheckOptions = { exclude: [], ignore: [], include: [], includeLocked: false, includePrerelease: false, target: "latest" };
        const result = await checkOutdated(catalogs, options);

        expect(result.outdated).toHaveLength(1);
        expect(result.outdated[0]?.packageName).toBe("react");
        expect(result.outdated[0]?.targetVersion).toBe("19.0.0");
        expect(result.outdated[0]?.newRange).toBe("^19.0.0");
        expect(result.outdated[0]?.updateType).toBe("major");
        expect(result.failed).toHaveLength(0);

        vi.restoreAllMocks();
    });

    it("should return empty when all up to date", async () => {
        expect.assertions(1);

        mockFetch({
            react: { latest: "18.2.0", versions: ["18.2.0"] },
        });

        const catalogs = new Map([["default", new Map([["react", "^18.2.0"]])]]);
        const options: CatalogCheckOptions = { exclude: [], ignore: [], include: [], includeLocked: false, includePrerelease: false, target: "latest" };
        const result = await checkOutdated(catalogs, options);

        expect(result.outdated).toHaveLength(0);

        vi.restoreAllMocks();
    });

    it("should skip workspace: protocol entries", async () => {
        expect.assertions(2);

        mockFetch({});

        const catalogs = new Map([
            [
                "default",
                new Map([
                    ["any", "*"],
                    ["linked", "link:../linked"],
                    ["my-lib", "workspace:*"],
                    ["my-other", "file:../other"],
                ]),
            ],
        ]);
        const options: CatalogCheckOptions = { exclude: [], ignore: [], include: [], includeLocked: false, includePrerelease: false, target: "latest" };
        const result = await checkOutdated(catalogs, options);

        expect(result.outdated).toHaveLength(0);
        // fetch should not have been called
        expect(globalThis.fetch).not.toHaveBeenCalled();

        vi.restoreAllMocks();
    });

    it("should respect include filter", async () => {
        expect.assertions(2);

        mockFetch({
            react: { latest: "19.0.0", versions: ["18.0.0", "19.0.0"] },
        });

        const catalogs = new Map([
            [
                "default",
                new Map([
                    ["react", "^18.0.0"],
                    ["vue", "^3.0.0"],
                ]),
            ],
        ]);
        const options: CatalogCheckOptions = { exclude: [], ignore: [], include: ["react"], includeLocked: false, includePrerelease: false, target: "latest" };
        const result = await checkOutdated(catalogs, options);

        expect(result.outdated).toHaveLength(1);
        expect(result.outdated[0]?.packageName).toBe("react");

        vi.restoreAllMocks();
    });

    it("should respect exclude filter", async () => {
        expect.assertions(2);

        mockFetch({
            vue: { latest: "4.0.0", versions: ["3.0.0", "4.0.0"] },
        });

        const catalogs = new Map([
            [
                "default",
                new Map([
                    ["react", "^18.0.0"],
                    ["vue", "^3.0.0"],
                ]),
            ],
        ]);
        const options: CatalogCheckOptions = { exclude: ["react*"], ignore: [], include: [], includeLocked: false, includePrerelease: false, target: "latest" };
        const result = await checkOutdated(catalogs, options);

        // Only vue should be checked (react excluded)
        expect(result.outdated).toHaveLength(1);
        expect(result.outdated[0]?.packageName).toBe("vue");

        vi.restoreAllMocks();
    });

    it("should respect ignore list and return ignored package names", async () => {
        expect.assertions(4);

        mockFetch({
            vue: { latest: "4.0.0", versions: ["3.0.0", "4.0.0"] },
        });

        const catalogs = new Map([
            [
                "default",
                new Map([
                    ["react", "^18.0.0"],
                    ["vue", "^3.0.0"],
                ]),
            ],
        ]);
        const options: CatalogCheckOptions = { exclude: [], ignore: ["react"], include: [], includeLocked: false, includePrerelease: false, target: "latest" };
        const result = await checkOutdated(catalogs, options);

        // react is ignored, only vue is checked
        expect(result.outdated).toHaveLength(1);
        expect(result.outdated[0]?.packageName).toBe("vue");
        expect(result.ignored).toHaveLength(1);
        expect(result.ignored[0]).toBe("react");

        vi.restoreAllMocks();
    });

    it("should support glob patterns in ignore list", async () => {
        expect.assertions(3);

        mockFetch({
            vue: { latest: "4.0.0", versions: ["3.0.0", "4.0.0"] },
        });

        const catalogs = new Map([
            [
                "default",
                new Map([
                    ["@types/node", "^20.0.0"],
                    ["@types/react", "^18.0.0"],
                    ["vue", "^3.0.0"],
                ]),
            ],
        ]);
        const options: CatalogCheckOptions = {
            exclude: [],
            ignore: ["@types/*"],
            include: [],
            includeLocked: false,
            includePrerelease: false,
            target: "latest",
        };
        const result = await checkOutdated(catalogs, options);

        expect(result.outdated).toHaveLength(1);
        expect(result.ignored).toHaveLength(2);
        expect(result.ignored).toStrictEqual(expect.arrayContaining(["@types/node", "@types/react"]));

        vi.restoreAllMocks();
    });

    it("should return empty ignored array when no ignore patterns match", async () => {
        expect.assertions(2);

        mockFetch({
            react: { latest: "19.0.0", versions: ["18.2.0", "19.0.0"] },
        });

        const catalogs = new Map([["default", new Map([["react", "^18.2.0"]])]]);
        const options: CatalogCheckOptions = { exclude: [], ignore: ["vue"], include: [], includeLocked: false, includePrerelease: false, target: "latest" };
        const result = await checkOutdated(catalogs, options);

        expect(result.outdated).toHaveLength(1);
        expect(result.ignored).toHaveLength(0);

        vi.restoreAllMocks();
    });

    it("should report failed fetches", async () => {
        expect.assertions(2);

        mockFetch({
            react: "error",
        });

        const catalogs = new Map([["default", new Map([["react", "^18.0.0"]])]]);
        const options: CatalogCheckOptions = { exclude: [], ignore: [], include: [], includeLocked: false, includePrerelease: false, target: "latest" };
        const result = await checkOutdated(catalogs, options);

        expect(result.outdated).toHaveLength(0);
        expect(result.failed).toContain("react");

        vi.restoreAllMocks();
    });

    it("should deduplicate fetches for same package across catalogs", async () => {
        expect.assertions(2);

        mockFetch({
            react: { latest: "19.0.0", versions: ["18.0.0", "19.0.0"] },
        });

        const catalogs = new Map([
            ["default", new Map([["react", "^18.0.0"]])],
            ["dev", new Map([["react", "^18.0.0"]])],
        ]);
        const options: CatalogCheckOptions = { exclude: [], ignore: [], include: [], includeLocked: false, includePrerelease: false, target: "latest" };
        const result = await checkOutdated(catalogs, options);

        // Two outdated entries (one per catalog) but fetch called once
        expect(result.outdated).toHaveLength(2);
        expect(globalThis.fetch).toHaveBeenCalledTimes(1);

        vi.restoreAllMocks();
    });

    it("should respect target=minor", async () => {
        expect.assertions(3);

        mockFetch({
            react: { latest: "19.0.0", versions: ["18.0.0", "18.1.0", "18.2.0", "19.0.0"] },
        });

        const catalogs = new Map([["default", new Map([["react", "^18.0.0"]])]]);
        const options: CatalogCheckOptions = { exclude: [], ignore: [], include: [], includeLocked: false, includePrerelease: false, target: "minor" };
        const result = await checkOutdated(catalogs, options);

        expect(result.outdated).toHaveLength(1);
        expect(result.outdated[0]?.targetVersion).toBe("18.2.0");
        expect(result.outdated[0]?.updateType).toBe("minor");

        vi.restoreAllMocks();
    });

    it("should respect target=patch", async () => {
        expect.assertions(3);

        mockFetch({
            react: { latest: "19.0.0", versions: ["18.0.0", "18.0.1", "18.0.2", "18.1.0", "19.0.0"] },
        });

        const catalogs = new Map([["default", new Map([["react", "^18.0.0"]])]]);
        const options: CatalogCheckOptions = { exclude: [], ignore: [], include: [], includeLocked: false, includePrerelease: false, target: "patch" };
        const result = await checkOutdated(catalogs, options);

        expect(result.outdated).toHaveLength(1);
        expect(result.outdated[0]?.targetVersion).toBe("18.0.2");
        expect(result.outdated[0]?.updateType).toBe("patch");

        vi.restoreAllMocks();
    });

    it("should call onProgress callback", async () => {
        expect.assertions(1);

        mockFetch({
            react: { latest: "19.0.0", versions: ["18.0.0", "19.0.0"] },
        });

        const catalogs = new Map([["default", new Map([["react", "^18.0.0"]])]]);
        const options: CatalogCheckOptions = { exclude: [], ignore: [], include: [], includeLocked: false, includePrerelease: false, target: "latest" };
        const onProgress = vi.fn<(current: number, total: number) => void>();

        await checkOutdated(catalogs, options, undefined, onProgress);

        expect(onProgress).toHaveBeenCalledWith(1, 1);

        vi.restoreAllMocks();
    });
});

// --- checkOutdated: target and filteredByTarget ---

describe("checkOutdated target behavior", () => {
    it("should include major updates when target is latest", async () => {
        expect.assertions(3);

        mockFetch({
            prisma: { latest: "7.7.0", versions: ["6.19.2", "7.7.0"] },
        });

        const catalogs = new Map([["default", new Map([["prisma", "6.19.2"]])]]);
        const options: CatalogCheckOptions = { exclude: [], ignore: [], include: [], includeLocked: true, includePrerelease: false, target: "latest" };
        const result = await checkOutdated(catalogs, options);

        expect(result.outdated).toHaveLength(1);
        expect(result.outdated[0]?.packageName).toBe("prisma");
        expect(result.outdated[0]?.updateType).toBe("major");

        vi.restoreAllMocks();
    });

    it("should exclude major updates when target is minor", async () => {
        expect.assertions(1);

        mockFetch({
            prisma: { latest: "7.7.0", versions: ["6.19.2", "7.7.0"] },
        });

        const catalogs = new Map([["default", new Map([["prisma", "^6.19.2"]])]]);
        const options: CatalogCheckOptions = { exclude: [], ignore: [], include: [], includeLocked: false, includePrerelease: false, target: "minor" };
        const result = await checkOutdated(catalogs, options);

        expect(result.outdated).toHaveLength(0);

        vi.restoreAllMocks();
    });

    it("should report filteredByTarget when target is not latest", async () => {
        expect.assertions(3);

        mockFetch({
            prisma: { latest: "7.7.0", versions: ["6.19.2", "7.7.0"] },
            react: { latest: "19.0.0", versions: ["18.2.0", "18.3.0", "19.0.0"] },
        });

        const catalogs = new Map([
            [
                "default",
                new Map([
                    ["prisma", "^6.19.2"],
                    ["react", "^18.2.0"],
                ]),
            ],
        ]);
        const options: CatalogCheckOptions = { exclude: [], ignore: [], include: [], includeLocked: false, includePrerelease: false, target: "minor" };
        const result = await checkOutdated(catalogs, options);

        // react has a minor update (18.3.0), prisma has no minor update
        expect(result.outdated).toHaveLength(1);
        expect(result.outdated[0]?.packageName).toBe("react");

        // prisma should be in filteredByTarget (has major update 7.7.0 but excluded by minor target)
        expect(result.filteredByTarget.some((e) => e.packageName === "prisma")).toBe(true);

        vi.restoreAllMocks();
    });

    it("should return empty filteredByTarget when target is latest", async () => {
        expect.assertions(1);

        mockFetch({
            react: { latest: "19.0.0", versions: ["18.2.0", "19.0.0"] },
        });

        const catalogs = new Map([["default", new Map([["react", "^18.2.0"]])]]);
        const options: CatalogCheckOptions = { exclude: [], ignore: [], include: [], includeLocked: false, includePrerelease: false, target: "latest" };
        const result = await checkOutdated(catalogs, options);

        expect(result.filteredByTarget).toHaveLength(0);

        vi.restoreAllMocks();
    });

    it("should include pinned versions with includeLocked and target latest", async () => {
        expect.assertions(3);

        mockFetch({
            prisma: { latest: "7.7.0", versions: ["6.19.2", "7.7.0"] },
        });

        const catalogs = new Map([["backend", new Map([["prisma", "6.19.2"]])]]);
        const options: CatalogCheckOptions = { exclude: [], ignore: [], include: [], includeLocked: true, includePrerelease: false, target: "latest" };
        const result = await checkOutdated(catalogs, options);

        expect(result.outdated).toHaveLength(1);
        expect(result.outdated[0]?.packageName).toBe("prisma");
        expect(result.outdated[0]?.newRange).toBe("7.7.0");

        vi.restoreAllMocks();
    });
});
