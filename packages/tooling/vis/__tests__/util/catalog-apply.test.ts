import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";

import { join } from "@visulima/path";
import { describe, expect, it } from "vitest";

import { applyCatalogUpdates, detectJsonIndent, hasCatalogs, parseBunCatalogs, readCatalogs } from "../../src/util/catalog";

// --- applyCatalogUpdates ---

describe(applyCatalogUpdates, () => {
    it("should update version in default catalog", () => {
        expect.assertions(2);

        const temporaryDirectory = mkdtempSync(join(tmpdir(), "vis-test-"));

        writeFileSync(join(temporaryDirectory, "package.json"), "{\"name\":\"root\"}");

        const filePath = join(temporaryDirectory, "pnpm-workspace.yaml");

        writeFileSync(
            filePath,
            `packages:
  - "packages/*"
catalog:
  react: ^18.2.0
  typescript: ~5.3.0
`,
        );

        applyCatalogUpdates(temporaryDirectory, [
            {
                catalogName: "default",
                currentRange: "^18.2.0",
                newRange: "^19.0.0",
                packageName: "react",
                targetVersion: "19.0.0",
                updateType: "major",
            },
        ]);

        const result = readFileSync(filePath, "utf8");

        expect(result).toContain("react: ^19.0.0");
        expect(result).toContain("typescript: ~5.3.0");
    });

    it("should update version in named catalog", () => {
        expect.assertions(2);

        const temporaryDirectory = mkdtempSync(join(tmpdir(), "vis-test-"));

        writeFileSync(join(temporaryDirectory, "package.json"), "{\"name\":\"root\"}");

        const filePath = join(temporaryDirectory, "pnpm-workspace.yaml");

        writeFileSync(
            filePath,
            `catalogs:
  dev:
    eslint: ^8.0.0
    prettier: ^3.0.0
`,
        );

        applyCatalogUpdates(temporaryDirectory, [
            {
                catalogName: "dev",
                currentRange: "^8.0.0",
                newRange: "^9.0.0",
                packageName: "eslint",
                targetVersion: "9.0.0",
                updateType: "major",
            },
        ]);

        const result = readFileSync(filePath, "utf8");

        expect(result).toContain("eslint: ^9.0.0");
        expect(result).toContain("prettier: ^3.0.0");
    });

    it("should preserve comments", () => {
        expect.assertions(2);

        const temporaryDirectory = mkdtempSync(join(tmpdir(), "vis-test-"));

        writeFileSync(join(temporaryDirectory, "package.json"), "{\"name\":\"root\"}");

        const filePath = join(temporaryDirectory, "pnpm-workspace.yaml");

        writeFileSync(
            filePath,
            `catalog:
  # Main framework
  react: ^18.2.0
`,
        );

        applyCatalogUpdates(temporaryDirectory, [
            {
                catalogName: "default",
                currentRange: "^18.2.0",
                newRange: "^19.0.0",
                packageName: "react",
                targetVersion: "19.0.0",
                updateType: "major",
            },
        ]);

        const result = readFileSync(filePath, "utf8");

        expect(result).toContain("# Main framework");
        expect(result).toContain("react: ^19.0.0");
    });

    it("should update scoped package with single-quoted key", () => {
        expect.assertions(1);

        const temporaryDirectory = mkdtempSync(join(tmpdir(), "vis-test-"));

        writeFileSync(join(temporaryDirectory, "package.json"), "{\"name\":\"root\"}");

        const filePath = join(temporaryDirectory, "pnpm-workspace.yaml");

        writeFileSync(
            filePath,
            `catalog:
  '@types/node': ^20.0.0
`,
        );

        applyCatalogUpdates(temporaryDirectory, [
            {
                catalogName: "default",
                currentRange: "^20.0.0",
                newRange: "^22.0.0",
                packageName: "@types/node",
                targetVersion: "22.0.0",
                updateType: "major",
            },
        ]);

        const result = readFileSync(filePath, "utf8");

        expect(result).toContain("'@types/node': ^22.0.0");
    });

    it("should update scoped package with double-quoted key", () => {
        expect.assertions(1);

        const temporaryDirectory = mkdtempSync(join(tmpdir(), "vis-test-"));

        writeFileSync(join(temporaryDirectory, "package.json"), "{\"name\":\"root\"}");

        const filePath = join(temporaryDirectory, "pnpm-workspace.yaml");

        writeFileSync(
            filePath,
            `catalog:
  "@types/node": ^20.0.0
`,
        );

        applyCatalogUpdates(temporaryDirectory, [
            {
                catalogName: "default",
                currentRange: "^20.0.0",
                newRange: "^22.0.0",
                packageName: "@types/node",
                targetVersion: "22.0.0",
                updateType: "major",
            },
        ]);

        const result = readFileSync(filePath, "utf8");

        expect(result).toContain("\"@types/node\": ^22.0.0");
    });

    it("should update exact version without prefix", () => {
        expect.assertions(1);

        const temporaryDirectory = mkdtempSync(join(tmpdir(), "vis-test-"));

        writeFileSync(join(temporaryDirectory, "package.json"), "{\"name\":\"root\"}");

        const filePath = join(temporaryDirectory, "pnpm-workspace.yaml");

        writeFileSync(
            filePath,
            `catalogs:
  prod:
    yaml: 2.8.3
`,
        );

        applyCatalogUpdates(temporaryDirectory, [
            {
                catalogName: "prod",
                currentRange: "2.8.3",
                newRange: "2.9.0",
                packageName: "yaml",
                targetVersion: "2.9.0",
                updateType: "minor",
            },
        ]);

        const result = readFileSync(filePath, "utf8");

        expect(result).toContain("yaml: 2.9.0");
    });

    it("should update only the correct catalog when same package exists in multiple", () => {
        expect.assertions(2);

        const temporaryDirectory = mkdtempSync(join(tmpdir(), "vis-test-"));

        writeFileSync(join(temporaryDirectory, "package.json"), "{\"name\":\"root\"}");

        const filePath = join(temporaryDirectory, "pnpm-workspace.yaml");

        writeFileSync(
            filePath,
            `catalog:
  react: ^18.0.0
catalogs:
  old:
    react: ^17.0.0
`,
        );

        applyCatalogUpdates(temporaryDirectory, [
            {
                catalogName: "old",
                currentRange: "^17.0.0",
                newRange: "^18.0.0",
                packageName: "react",
                targetVersion: "18.0.0",
                updateType: "major",
            },
        ]);

        const result = readFileSync(filePath, "utf8");
        const lines = result.split("\n");

        // Default catalog should keep ^18.0.0 (not touched)
        const catalogsIndex = lines.indexOf("catalogs:");
        const defaultLine = lines.find((l, i) => l.includes("react:") && i < catalogsIndex);

        expect(defaultLine).toContain("^18.0.0");

        // Old catalog should be updated
        const oldLine = lines.find((l, i) => i > catalogsIndex && l.includes("react:"));

        expect(oldLine).toContain("^18.0.0");
    });

    it("should handle multiple updates at once", () => {
        expect.assertions(3);

        const temporaryDirectory = mkdtempSync(join(tmpdir(), "vis-test-"));

        writeFileSync(join(temporaryDirectory, "package.json"), "{\"name\":\"root\"}");

        const filePath = join(temporaryDirectory, "pnpm-workspace.yaml");

        writeFileSync(
            filePath,
            `catalog:
  react: ^18.2.0
  typescript: ~5.3.0
  lodash: ^4.17.20
`,
        );

        applyCatalogUpdates(temporaryDirectory, [
            {
                catalogName: "default",
                currentRange: "^18.2.0",
                newRange: "^19.0.0",
                packageName: "react",
                targetVersion: "19.0.0",
                updateType: "major",
            },
            {
                catalogName: "default",
                currentRange: "~5.3.0",
                newRange: "~5.7.0",
                packageName: "typescript",
                targetVersion: "5.7.0",
                updateType: "minor",
            },
        ]);

        const result = readFileSync(filePath, "utf8");

        expect(result).toContain("react: ^19.0.0");
        expect(result).toContain("typescript: ~5.7.0");
        expect(result).toContain("lodash: ^4.17.20");
    });

    it("should not modify file when updates array is empty", () => {
        expect.assertions(1);

        const temporaryDirectory = mkdtempSync(join(tmpdir(), "vis-test-"));

        writeFileSync(join(temporaryDirectory, "package.json"), "{\"name\":\"root\"}");

        const filePath = join(temporaryDirectory, "pnpm-workspace.yaml");
        const original = `catalog:
  react: ^18.2.0
`;

        writeFileSync(filePath, original);
        applyCatalogUpdates(temporaryDirectory, []);

        const result = readFileSync(filePath, "utf8");

        expect(result).toBe(original);
    });

    it("should preserve packages section", () => {
        expect.assertions(3);

        const temporaryDirectory = mkdtempSync(join(tmpdir(), "vis-test-"));

        writeFileSync(join(temporaryDirectory, "package.json"), "{\"name\":\"root\"}");

        const filePath = join(temporaryDirectory, "pnpm-workspace.yaml");

        writeFileSync(
            filePath,
            `packages:
  - "packages/*"
  - "apps/*"
catalog:
  react: ^18.2.0
`,
        );

        applyCatalogUpdates(temporaryDirectory, [
            {
                catalogName: "default",
                currentRange: "^18.2.0",
                newRange: "^19.0.0",
                packageName: "react",
                targetVersion: "19.0.0",
                updateType: "major",
            },
        ]);

        const result = readFileSync(filePath, "utf8");

        expect(result).toContain("- \"packages/*\"");
        expect(result).toContain("- \"apps/*\"");
        expect(result).toContain("react: ^19.0.0");
    });

    it("should handle quoted version values", () => {
        expect.assertions(1);

        const temporaryDirectory = mkdtempSync(join(tmpdir(), "vis-test-"));

        writeFileSync(join(temporaryDirectory, "package.json"), "{\"name\":\"root\"}");

        const filePath = join(temporaryDirectory, "pnpm-workspace.yaml");

        writeFileSync(
            filePath,
            `catalog:
  react: "^18.2.0"
`,
        );

        applyCatalogUpdates(temporaryDirectory, [
            {
                catalogName: "default",
                currentRange: "^18.2.0",
                newRange: "^19.0.0",
                packageName: "react",
                targetVersion: "19.0.0",
                updateType: "major",
            },
        ]);

        const result = readFileSync(filePath, "utf8");

        // Quotes around version should be preserved (replace happens inside)
        expect(result).toContain("^19.0.0\"");
    });
});

// --- Bun catalog support ---

describe(parseBunCatalogs, () => {
    it("should parse default catalog from package.json workspaces", () => {
        expect.assertions(3);

        const pkg = {
            workspaces: {
                catalog: { react: "^19.1.0", "react-dom": "^19.1.0" },
                packages: ["packages/*"],
            },
        };
        const catalogs = parseBunCatalogs(pkg);

        expect(catalogs.size).toBe(1);
        expect(catalogs.get("default")?.get("react")).toBe("^19.1.0");
        expect(catalogs.get("default")?.get("react-dom")).toBe("^19.1.0");
    });

    it("should parse named catalogs from package.json workspaces", () => {
        expect.assertions(4);

        const pkg = {
            workspaces: {
                catalogs: {
                    react17: { react: "^17.0.0" },
                    testing: { jest: "^30.0.4", vitest: "^3.2.4" },
                },
            },
        };
        const catalogs = parseBunCatalogs(pkg);

        expect(catalogs.size).toBe(2);
        expect(catalogs.get("testing")?.get("jest")).toBe("^30.0.4");
        expect(catalogs.get("testing")?.get("vitest")).toBe("^3.2.4");
        expect(catalogs.get("react17")?.get("react")).toBe("^17.0.0");
    });

    it("should parse both default and named catalogs", () => {
        expect.assertions(3);

        const pkg = {
            workspaces: {
                catalog: { react: "^19.1.0" },
                catalogs: { testing: { vitest: "^3.2.4" } },
                packages: ["packages/*"],
            },
        };
        const catalogs = parseBunCatalogs(pkg);

        expect(catalogs.size).toBe(2);
        expect(catalogs.get("default")?.get("react")).toBe("^19.1.0");
        expect(catalogs.get("testing")?.get("vitest")).toBe("^3.2.4");
    });

    it("should return empty map when no catalogs", () => {
        expect.assertions(1);

        const pkg = { workspaces: { packages: ["packages/*"] } };
        const catalogs = parseBunCatalogs(pkg);

        expect(catalogs.size).toBe(0);
    });

    it("should return empty map when no workspaces", () => {
        expect.assertions(1);

        const pkg = {};
        const catalogs = parseBunCatalogs(pkg);

        expect(catalogs.size).toBe(0);
    });
});

describe("hasCatalogs with bun", () => {
    it("should detect bun catalogs in package.json", () => {
        expect.assertions(1);

        const temporaryDirectory = mkdtempSync(join(tmpdir(), "vis-test-"));

        writeFileSync(
            join(temporaryDirectory, "package.json"),
            JSON.stringify({
                workspaces: {
                    catalog: { react: "^19.1.0" },
                    packages: ["packages/*"],
                },
            }),
        );

        expect(hasCatalogs(temporaryDirectory, "bun")).toBe(true);
    });

    it("should detect bun named catalogs", () => {
        expect.assertions(1);

        const temporaryDirectory = mkdtempSync(join(tmpdir(), "vis-test-"));

        writeFileSync(
            join(temporaryDirectory, "package.json"),
            JSON.stringify({
                workspaces: {
                    catalogs: { testing: { vitest: "^3.0.0" } },
                    packages: ["packages/*"],
                },
            }),
        );

        expect(hasCatalogs(temporaryDirectory, "bun")).toBe(true);
    });

    it("should return false for bun without catalogs", () => {
        expect.assertions(1);

        const temporaryDirectory = mkdtempSync(join(tmpdir(), "vis-test-"));

        writeFileSync(join(temporaryDirectory, "package.json"), JSON.stringify({ workspaces: { packages: ["packages/*"] } }));

        expect(hasCatalogs(temporaryDirectory, "bun")).toBe(false);
    });

    it("should return false when no package.json", () => {
        expect.assertions(1);

        const temporaryDirectory = mkdtempSync(join(tmpdir(), "vis-test-"));

        expect(hasCatalogs(temporaryDirectory, "bun")).toBe(false);
    });
});

describe("readCatalogs with bun", () => {
    it("should read bun catalogs from package.json", () => {
        expect.assertions(3);

        const temporaryDirectory = mkdtempSync(join(tmpdir(), "vis-test-"));

        writeFileSync(
            join(temporaryDirectory, "package.json"),
            JSON.stringify(
                {
                    workspaces: {
                        catalog: { react: "^19.1.0", "react-dom": "^19.1.0" },
                        catalogs: { testing: { vitest: "^3.2.4" } },
                        packages: ["packages/*"],
                    },
                },
                undefined,
                2,
            ),
        );

        const catalogs = readCatalogs(temporaryDirectory, "bun");

        expect(catalogs.size).toBe(2);
        expect(catalogs.get("default")?.get("react")).toBe("^19.1.0");
        expect(catalogs.get("testing")?.get("vitest")).toBe("^3.2.4");
    });

    it("should return empty map when no package.json", () => {
        expect.assertions(1);

        const temporaryDirectory = mkdtempSync(join(tmpdir(), "vis-test-"));

        expect(readCatalogs(temporaryDirectory, "bun").size).toBe(0);
    });
});

describe(detectJsonIndent, () => {
    it("should detect 2-space indent", () => {
        expect.assertions(1);

        expect(detectJsonIndent("{\n  \"name\": \"test\"\n}")).toBe(2);
    });

    it("should detect 4-space indent", () => {
        expect.assertions(1);

        expect(detectJsonIndent("{\n    \"name\": \"test\"\n}")).toBe(4);
    });

    it("should default to 2 when no indentation found", () => {
        expect.assertions(1);

        expect(detectJsonIndent("{\"name\":\"test\"}")).toBe(2);
    });
});

describe("applyCatalogUpdates with bun", () => {
    it("should update version in bun default catalog", () => {
        expect.assertions(2);

        const temporaryDirectory = mkdtempSync(join(tmpdir(), "vis-test-"));
        const filePath = join(temporaryDirectory, "package.json");

        writeFileSync(
            filePath,
            `${JSON.stringify(
                {
                    name: "test-bun",
                    workspaces: {
                        catalog: { react: "^18.2.0", typescript: "~5.3.0" },
                        packages: ["packages/*"],
                    },
                },
                undefined,
                2,
            )}\n`,
        );

        applyCatalogUpdates(
            temporaryDirectory,
            [
                {
                    catalogName: "default",
                    currentRange: "^18.2.0",
                    newRange: "^19.0.0",
                    packageName: "react",
                    targetVersion: "19.0.0",
                    updateType: "major",
                },
            ],
            "bun",
        );

        const result = JSON.parse(readFileSync(filePath, "utf8"));

        expect(result.workspaces.catalog.react).toBe("^19.0.0");
        expect(result.workspaces.catalog.typescript).toBe("~5.3.0");
    });

    it("should update version in bun named catalog", () => {
        expect.assertions(2);

        const temporaryDirectory = mkdtempSync(join(tmpdir(), "vis-test-"));
        const filePath = join(temporaryDirectory, "package.json");

        writeFileSync(
            filePath,
            `${JSON.stringify(
                {
                    workspaces: {
                        catalogs: {
                            testing: { jest: "^29.0.0", vitest: "^1.0.0" },
                        },
                    },
                },
                undefined,
                2,
            )}\n`,
        );

        applyCatalogUpdates(
            temporaryDirectory,
            [
                {
                    catalogName: "testing",
                    currentRange: "^29.0.0",
                    newRange: "^30.0.0",
                    packageName: "jest",
                    targetVersion: "30.0.0",
                    updateType: "major",
                },
            ],
            "bun",
        );

        const result = JSON.parse(readFileSync(filePath, "utf8"));

        expect(result.workspaces.catalogs.testing.jest).toBe("^30.0.0");
        expect(result.workspaces.catalogs.testing.vitest).toBe("^1.0.0");
    });

    it("should preserve JSON indent", () => {
        expect.assertions(1);

        const temporaryDirectory = mkdtempSync(join(tmpdir(), "vis-test-"));
        const filePath = join(temporaryDirectory, "package.json");

        writeFileSync(
            filePath,
            `${JSON.stringify(
                {
                    workspaces: { catalog: { react: "^18.0.0" } },
                },
                undefined,
                4,
            )}\n`,
        );

        applyCatalogUpdates(
            temporaryDirectory,
            [
                {
                    catalogName: "default",
                    currentRange: "^18.0.0",
                    newRange: "^19.0.0",
                    packageName: "react",
                    targetVersion: "19.0.0",
                    updateType: "major",
                },
            ],
            "bun",
        );

        const content = readFileSync(filePath, "utf8");

        // Should use 4-space indent
        expect(content).toContain("    \"workspaces\"");
    });

    it("should handle multiple updates in bun catalog", () => {
        expect.assertions(3);

        const temporaryDirectory = mkdtempSync(join(tmpdir(), "vis-test-"));
        const filePath = join(temporaryDirectory, "package.json");

        writeFileSync(
            filePath,
            `${JSON.stringify(
                {
                    workspaces: {
                        catalog: { react: "^18.0.0", "react-dom": "^18.0.0" },
                        catalogs: { testing: { vitest: "^1.0.0" } },
                    },
                },
                undefined,
                2,
            )}\n`,
        );

        applyCatalogUpdates(
            temporaryDirectory,
            [
                {
                    catalogName: "default",
                    currentRange: "^18.0.0",
                    newRange: "^19.0.0",
                    packageName: "react",
                    targetVersion: "19.0.0",
                    updateType: "major",
                },
                {
                    catalogName: "default",
                    currentRange: "^18.0.0",
                    newRange: "^19.0.0",
                    packageName: "react-dom",
                    targetVersion: "19.0.0",
                    updateType: "major",
                },
                {
                    catalogName: "testing",
                    currentRange: "^1.0.0",
                    newRange: "^3.0.0",
                    packageName: "vitest",
                    targetVersion: "3.0.0",
                    updateType: "major",
                },
            ],
            "bun",
        );

        const result = JSON.parse(readFileSync(filePath, "utf8"));

        expect(result.workspaces.catalog.react).toBe("^19.0.0");
        expect(result.workspaces.catalog["react-dom"]).toBe("^19.0.0");
        expect(result.workspaces.catalogs.testing.vitest).toBe("^3.0.0");
    });

    it("should preserve other package.json fields", () => {
        expect.assertions(5);

        const temporaryDirectory = mkdtempSync(join(tmpdir(), "vis-test-"));
        const filePath = join(temporaryDirectory, "package.json");

        writeFileSync(
            filePath,
            `${JSON.stringify(
                {
                    name: "my-monorepo",
                    private: true,
                    scripts: { build: "echo build" },
                    workspaces: {
                        catalog: { react: "^18.0.0" },
                        packages: ["packages/*"],
                    },
                },
                undefined,
                2,
            )}\n`,
        );

        applyCatalogUpdates(
            temporaryDirectory,
            [
                {
                    catalogName: "default",
                    currentRange: "^18.0.0",
                    newRange: "^19.0.0",
                    packageName: "react",
                    targetVersion: "19.0.0",
                    updateType: "major",
                },
            ],
            "bun",
        );

        const result = JSON.parse(readFileSync(filePath, "utf8"));

        expect(result.name).toBe("my-monorepo");
        expect(result.private).toBe(true);
        expect(result.scripts.build).toBe("echo build");
        expect(result.workspaces.packages).toStrictEqual(["packages/*"]);
        expect(result.workspaces.catalog.react).toBe("^19.0.0");
    });
});
