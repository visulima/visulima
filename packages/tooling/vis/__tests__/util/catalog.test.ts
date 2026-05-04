import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";

import { join } from "@visulima/path";
import { describe, expect, it, vi } from "vitest";

import type { CatalogCheckOptions, CheckOutdatedResult, NpmrcConfig } from "../../src/util/catalog";
import {
    applyCatalogUpdates,
    applyPackageJsonUpdates,
    checkOutdated,
    createBackup,
    detectJsonIndent,
    extractPrefix,
    fetchChangelogInfo,
    fetchPackageVersions,
    fetchVulnerabilities,
    findTargetVersion,
    formatOutdatedJson,
    formatOutdatedMinimal,
    formatOutdatedTable,
    formatSummary,
    getRegistryForPackage,
    getUpdateType,
    hasBackup,
    hasCatalogs,
    hasPackageJsonDeps,
    isNewer,
    loadNpmrc,
    matchesFilters,
    matchesPattern,
    parseBunCatalogs,
    parseCatalogsFromYaml,
    parseCompositeCatalogName,
    parseNpmrc,
    parseVersion,
    readCatalogs,
    readPackageJsonDeps,
    resolvePackageTarget,
    restoreFromBackup,
} from "../../src/util/catalog";

// --- parseVersion ---

describe(parseVersion, () => {
    it("should parse basic version", () => {
        expect.assertions(1);

        expect(parseVersion("1.2.3")).toStrictEqual({ major: 1, minor: 2, patch: 3, prerelease: "" });
    });

    it("should parse version with caret prefix", () => {
        expect.assertions(1);

        expect(parseVersion("^18.2.0")).toStrictEqual({ major: 18, minor: 2, patch: 0, prerelease: "" });
    });

    it("should parse version with tilde prefix", () => {
        expect.assertions(1);

        expect(parseVersion("~5.3.0")).toStrictEqual({ major: 5, minor: 3, patch: 0, prerelease: "" });
    });

    it("should parse version with >= prefix", () => {
        expect.assertions(1);

        expect(parseVersion(">=1.0.0")).toStrictEqual({ major: 1, minor: 0, patch: 0, prerelease: "" });
    });

    it("should parse version with < prefix", () => {
        expect.assertions(1);

        expect(parseVersion("<2.0.0")).toStrictEqual({ major: 2, minor: 0, patch: 0, prerelease: "" });
    });

    it("should parse prerelease version", () => {
        expect.assertions(1);

        expect(parseVersion("5.3.0-beta.1")).toStrictEqual({ major: 5, minor: 3, patch: 0, prerelease: "beta.1" });
    });

    it("should parse prerelease with prefix", () => {
        expect.assertions(1);

        expect(parseVersion("^5.3.0-rc.2")).toStrictEqual({ major: 5, minor: 3, patch: 0, prerelease: "rc.2" });
    });

    it("should parse large version numbers", () => {
        expect.assertions(1);

        expect(parseVersion("100.200.300")).toStrictEqual({ major: 100, minor: 200, patch: 300, prerelease: "" });
    });

    it("should return undefined for wildcard", () => {
        expect.assertions(1);

        expect(parseVersion("*")).toBeUndefined();
    });

    it("should return undefined for workspace protocol", () => {
        expect.assertions(1);

        expect(parseVersion("workspace:*")).toBeUndefined();
    });

    it("should return undefined for non-version string", () => {
        expect.assertions(1);

        expect(parseVersion("latest")).toBeUndefined();
    });

    it("should return undefined for empty string", () => {
        expect.assertions(1);

        expect(parseVersion("")).toBeUndefined();
    });

    it("should return undefined for file protocol", () => {
        expect.assertions(1);

        expect(parseVersion("file:../my-lib")).toBeUndefined();
    });

    it("should return undefined for link protocol", () => {
        expect.assertions(1);

        expect(parseVersion("link:../my-lib")).toBeUndefined();
    });
});

// --- extractPrefix ---

describe(extractPrefix, () => {
    it("should extract caret", () => {
        expect.assertions(1);

        expect(extractPrefix("^1.2.3")).toBe("^");
    });

    it("should extract tilde", () => {
        expect.assertions(1);

        expect(extractPrefix("~1.2.3")).toBe("~");
    });

    it("should extract >=", () => {
        expect.assertions(1);

        expect(extractPrefix(">=1.2.3")).toBe(">=");
    });

    it("should extract >", () => {
        expect.assertions(1);

        expect(extractPrefix(">1.2.3")).toBe(">");
    });

    it("should extract <=", () => {
        expect.assertions(1);

        expect(extractPrefix("<=1.2.3")).toBe("<=");
    });

    it("should extract <", () => {
        expect.assertions(1);

        expect(extractPrefix("<1.2.3")).toBe("<");
    });

    it("should return empty for exact version", () => {
        expect.assertions(1);

        expect(extractPrefix("1.2.3")).toBe("");
    });

    it("should return empty for prerelease without prefix", () => {
        expect.assertions(1);

        expect(extractPrefix("1.2.3-beta.1")).toBe("");
    });

    it("should return empty for empty string", () => {
        expect.assertions(1);

        expect(extractPrefix("")).toBe("");
    });
});

// --- getUpdateType ---

describe(getUpdateType, () => {
    it("should detect major update", () => {
        expect.assertions(1);

        expect(getUpdateType({ major: 1, minor: 0, patch: 0, prerelease: "" }, { major: 2, minor: 0, patch: 0, prerelease: "" })).toBe("major");
    });

    it("should detect minor update", () => {
        expect.assertions(1);

        expect(getUpdateType({ major: 1, minor: 0, patch: 0, prerelease: "" }, { major: 1, minor: 1, patch: 0, prerelease: "" })).toBe("minor");
    });

    it("should detect patch update", () => {
        expect.assertions(1);

        expect(getUpdateType({ major: 1, minor: 0, patch: 0, prerelease: "" }, { major: 1, minor: 0, patch: 1, prerelease: "" })).toBe("patch");
    });

    it("should detect no update", () => {
        expect.assertions(1);

        expect(getUpdateType({ major: 1, minor: 0, patch: 0, prerelease: "" }, { major: 1, minor: 0, patch: 0, prerelease: "" })).toBe("none");
    });

    it("should classify major even when minor/patch also differ", () => {
        expect.assertions(1);

        expect(getUpdateType({ major: 1, minor: 5, patch: 3, prerelease: "" }, { major: 2, minor: 0, patch: 0, prerelease: "" })).toBe("major");
    });

    it("should classify minor even when patch also differs", () => {
        expect.assertions(1);

        expect(getUpdateType({ major: 1, minor: 0, patch: 5, prerelease: "" }, { major: 1, minor: 1, patch: 0, prerelease: "" })).toBe("minor");
    });
});

// --- isNewer ---

describe(isNewer, () => {
    it("should detect newer major", () => {
        expect.assertions(1);

        expect(isNewer({ major: 1, minor: 0, patch: 0, prerelease: "" }, { major: 2, minor: 0, patch: 0, prerelease: "" })).toBe(true);
    });

    it("should detect newer minor", () => {
        expect.assertions(1);

        expect(isNewer({ major: 1, minor: 0, patch: 0, prerelease: "" }, { major: 1, minor: 1, patch: 0, prerelease: "" })).toBe(true);
    });

    it("should detect newer patch", () => {
        expect.assertions(1);

        expect(isNewer({ major: 1, minor: 0, patch: 0, prerelease: "" }, { major: 1, minor: 0, patch: 1, prerelease: "" })).toBe(true);
    });

    it("should not be newer for same version", () => {
        expect.assertions(1);

        expect(isNewer({ major: 1, minor: 0, patch: 0, prerelease: "" }, { major: 1, minor: 0, patch: 0, prerelease: "" })).toBe(false);
    });

    it("should not be newer for older version", () => {
        expect.assertions(1);

        expect(isNewer({ major: 2, minor: 0, patch: 0, prerelease: "" }, { major: 1, minor: 0, patch: 0, prerelease: "" })).toBe(false);
    });

    it("should detect release as newer than prerelease of same version", () => {
        expect.assertions(1);

        expect(isNewer({ major: 1, minor: 0, patch: 0, prerelease: "beta.1" }, { major: 1, minor: 0, patch: 0, prerelease: "" })).toBe(true);
    });

    it("should detect higher prerelease of same version as newer", () => {
        expect.assertions(1);

        expect(isNewer({ major: 1, minor: 0, patch: 0, prerelease: "alpha" }, { major: 1, minor: 0, patch: 0, prerelease: "beta" })).toBe(true);
    });

    it("should not consider lower prerelease as newer", () => {
        expect.assertions(1);

        expect(isNewer({ major: 1, minor: 0, patch: 0, prerelease: "beta" }, { major: 1, minor: 0, patch: 0, prerelease: "alpha" })).toBe(false);
    });

    it("should detect prerelease of higher major as newer", () => {
        expect.assertions(1);

        expect(isNewer({ major: 1, minor: 0, patch: 0, prerelease: "" }, { major: 2, minor: 0, patch: 0, prerelease: "beta.1" })).toBe(true);
    });

    it("should not consider prerelease target newer when not a higher version", () => {
        expect.assertions(1);

        expect(isNewer({ major: 1, minor: 0, patch: 0, prerelease: "" }, { major: 1, minor: 0, patch: 0, prerelease: "beta.1" })).toBe(false);
    });
});

// --- matchesPattern ---

describe(matchesPattern, () => {
    it("should match exact name", () => {
        expect.assertions(1);

        expect(matchesPattern("react", "react")).toBe(true);
    });

    it("should not match different name", () => {
        expect.assertions(1);

        expect(matchesPattern("react", "vue")).toBe(false);
    });

    it("should match wildcard suffix", () => {
        expect.assertions(1);

        expect(matchesPattern("eslint-plugin-react", "eslint*")).toBe(true);
    });

    it("should match scoped wildcard", () => {
        expect.assertions(1);

        expect(matchesPattern("@types/node", "@types/*")).toBe(true);
    });

    it("should not match scoped from different scope", () => {
        expect.assertions(1);

        expect(matchesPattern("@visulima/path", "@types/*")).toBe(false);
    });

    it("should match question mark for single char", () => {
        expect.assertions(1);

        expect(matchesPattern("react", "reac?")).toBe(true);
    });

    it("should match full wildcard", () => {
        expect.assertions(1);

        expect(matchesPattern("anything-at-all", "*")).toBe(true);
    });

    it("should match wildcard in middle", () => {
        expect.assertions(1);

        expect(matchesPattern("@visulima/path", "@*/path")).toBe(true);
    });

    it("should handle package names with dots", () => {
        expect.assertions(1);

        expect(matchesPattern("eslint.config", "eslint*")).toBe(true);
    });

    it("should not partially match", () => {
        expect.assertions(1);

        expect(matchesPattern("react-dom", "react")).toBe(false);
    });

    it("should handle empty pattern", () => {
        expect.assertions(1);

        expect(matchesPattern("react", "")).toBe(false);
    });
});

// --- matchesFilters ---

describe(matchesFilters, () => {
    it("should include all when no filters", () => {
        expect.assertions(1);

        expect(matchesFilters("react", [], [])).toBe(true);
    });

    it("should exclude matching patterns", () => {
        expect.assertions(1);

        expect(matchesFilters("@types/node", [], ["@types/*"])).toBe(false);
    });

    it("should include only matching patterns", () => {
        expect.assertions(2);

        expect(matchesFilters("react", ["react*"], [])).toBe(true);
        expect(matchesFilters("vue", ["react*"], [])).toBe(false);
    });

    it("should prioritize exclude over include", () => {
        expect.assertions(1);

        expect(matchesFilters("react", ["react*"], ["react"])).toBe(false);
    });

    it("should handle multiple include patterns", () => {
        expect.assertions(2);

        expect(matchesFilters("react", ["vue*", "react*"], [])).toBe(true);
        expect(matchesFilters("angular", ["vue*", "react*"], [])).toBe(false);
    });

    it("should handle multiple exclude patterns", () => {
        expect.assertions(3);

        expect(matchesFilters("@types/node", [], ["@types/*", "eslint*"])).toBe(false);
        expect(matchesFilters("eslint-plugin", [], ["@types/*", "eslint*"])).toBe(false);
        expect(matchesFilters("react", [], ["@types/*", "eslint*"])).toBe(true);
    });
});

// --- parseCatalogsFromYaml ---

describe(parseCatalogsFromYaml, () => {
    it("should parse default catalog", () => {
        expect.assertions(4);

        const yaml = `packages:
  - "packages/*"
catalog:
  react: ^18.2.0
  typescript: ~5.3.0
`;
        const catalogs = parseCatalogsFromYaml(yaml);

        expect(catalogs.size).toBe(1);
        expect(catalogs.has("default")).toBe(true);
        expect(catalogs.get("default")?.get("react")).toBe("^18.2.0");
        expect(catalogs.get("default")?.get("typescript")).toBe("~5.3.0");
    });

    it("should parse named catalogs", () => {
        expect.assertions(4);

        const yaml = `catalogs:
  dev:
    eslint: ^8.0.0
    prettier: ^3.0.0
  test:
    vitest: ^1.0.0
`;
        const catalogs = parseCatalogsFromYaml(yaml);

        expect(catalogs.size).toBe(2);
        expect(catalogs.get("dev")?.get("eslint")).toBe("^8.0.0");
        expect(catalogs.get("dev")?.get("prettier")).toBe("^3.0.0");
        expect(catalogs.get("test")?.get("vitest")).toBe("^1.0.0");
    });

    it("should parse both default and named catalogs", () => {
        expect.assertions(3);

        const yaml = `catalog:
  react: ^18.2.0
catalogs:
  dev:
    eslint: ^8.0.0
`;
        const catalogs = parseCatalogsFromYaml(yaml);

        expect(catalogs.size).toBe(2);
        expect(catalogs.get("default")?.get("react")).toBe("^18.2.0");
        expect(catalogs.get("dev")?.get("eslint")).toBe("^8.0.0");
    });

    it("should parse quoted scoped package names", () => {
        expect.assertions(3);

        const yaml = `catalog:
  '@types/node': ^20.0.0
  "@visulima/path": ^1.0.0
  react: ^18.0.0
`;
        const catalogs = parseCatalogsFromYaml(yaml);
        const defaultCatalog = catalogs.get("default");

        expect(defaultCatalog?.get("@types/node")).toBe("^20.0.0");
        expect(defaultCatalog?.get("@visulima/path")).toBe("^1.0.0");
        expect(defaultCatalog?.get("react")).toBe("^18.0.0");
    });

    it("should parse exact versions without prefix", () => {
        expect.assertions(2);

        const yaml = `catalogs:
  prod:
    yaml: 2.8.3
    type-fest: 5.5.0
`;
        const catalogs = parseCatalogsFromYaml(yaml);

        expect(catalogs.get("prod")?.get("yaml")).toBe("2.8.3");
        expect(catalogs.get("prod")?.get("type-fest")).toBe("5.5.0");
    });

    it("should parse quoted version values", () => {
        expect.assertions(2);

        const yaml = `catalog:
  react: "^18.2.0"
  typescript: '~5.3.0'
`;
        const catalogs = parseCatalogsFromYaml(yaml);
        const defaultCatalog = catalogs.get("default");

        expect(defaultCatalog?.get("react")).toBe("^18.2.0");
        expect(defaultCatalog?.get("typescript")).toBe("~5.3.0");
    });

    it("should handle inline comments after values", () => {
        expect.assertions(2);

        const yaml = `catalog:
  react: ^18.2.0 # main framework
  typescript: ~5.3.0 # type checking
`;
        const catalogs = parseCatalogsFromYaml(yaml);
        const defaultCatalog = catalogs.get("default");

        // Value should not include the comment
        expect(defaultCatalog?.get("react")).toBe("^18.2.0");
        expect(defaultCatalog?.get("typescript")).toBe("~5.3.0");
    });

    it("should ignore comments", () => {
        expect.assertions(2);

        const yaml = `catalog:
  # This is a comment
  react: ^18.2.0
  # typescript: ~5.3.0
`;
        const catalogs = parseCatalogsFromYaml(yaml);

        expect(catalogs.get("default")?.size).toBe(1);
        expect(catalogs.get("default")?.get("react")).toBe("^18.2.0");
    });

    it("should handle empty content", () => {
        expect.assertions(1);

        const catalogs = parseCatalogsFromYaml("");

        expect(catalogs.size).toBe(0);
    });

    it("should handle YAML without catalogs", () => {
        expect.assertions(1);

        const yaml = `packages:
  - "packages/*"
`;
        const catalogs = parseCatalogsFromYaml(yaml);

        expect(catalogs.size).toBe(0);
    });

    it("should stop parsing catalog section when new top-level key appears", () => {
        expect.assertions(2);

        const yaml = `catalog:
  react: ^18.2.0
packages:
  - "packages/*"
`;
        const catalogs = parseCatalogsFromYaml(yaml);

        expect(catalogs.get("default")?.size).toBe(1);
        expect(catalogs.get("default")?.get("react")).toBe("^18.2.0");
    });

    it("should not confuse 'catalogs:' with 'catalog:'", () => {
        expect.assertions(2);

        const yaml = `catalogs:
  dev:
    eslint: ^8.0.0
`;
        const catalogs = parseCatalogsFromYaml(yaml);

        expect(catalogs.has("default")).toBe(false);
        expect(catalogs.has("dev")).toBe(true);
    });

    it("should handle workspace protocol entries (parsed as values)", () => {
        expect.assertions(2);

        const yaml = `catalog:
  react: ^18.0.0
  my-lib: workspace:*
`;
        const catalogs = parseCatalogsFromYaml(yaml);
        const defaultCatalog = catalogs.get("default");

        expect(defaultCatalog?.get("react")).toBe("^18.0.0");
        expect(defaultCatalog?.get("my-lib")).toBe("workspace:*");
    });
});

// --- findTargetVersion ---

describe(findTargetVersion, () => {
    const versions = ["1.0.0", "1.0.1", "1.1.0", "1.2.0", "2.0.0", "2.1.0", "3.0.0-beta.1"];

    it("should find latest version", () => {
        expect.assertions(1);

        expect(findTargetVersion(versions, "2.1.0", "^1.0.0", "latest", false)).toBe("2.1.0");
    });

    it("should return undefined when already at latest", () => {
        expect.assertions(1);

        expect(findTargetVersion(versions, "2.1.0", "^2.1.0", "latest", false)).toBeUndefined();
    });

    it("should find minor target version", () => {
        expect.assertions(1);

        expect(findTargetVersion(versions, "2.1.0", "^1.0.0", "minor", false)).toBe("1.2.0");
    });

    it("should find patch target version", () => {
        expect.assertions(1);

        expect(findTargetVersion(versions, "2.1.0", "^1.0.0", "patch", false)).toBe("1.0.1");
    });

    it("should return undefined when no patch available", () => {
        expect.assertions(1);

        expect(findTargetVersion(versions, "2.1.0", "^1.2.0", "patch", false)).toBeUndefined();
    });

    it("should exclude prereleases by default", () => {
        expect.assertions(1);

        expect(findTargetVersion(versions, "3.0.0-beta.1", "^2.1.0", "latest", false)).toBeUndefined();
    });

    it("should include prereleases when enabled", () => {
        expect.assertions(1);

        expect(findTargetVersion(versions, "3.0.0-beta.1", "^2.1.0", "latest", true)).toBe("3.0.0-beta.1");
    });

    it("should return undefined for unparseable range", () => {
        expect.assertions(1);

        expect(findTargetVersion(versions, "2.1.0", "*", "latest", false)).toBeUndefined();
    });

    it("should handle minor target when no updates within major", () => {
        expect.assertions(1);

        expect(findTargetVersion(versions, "2.1.0", "^2.1.0", "minor", false)).toBeUndefined();
    });

    it("should return undefined for empty versions list", () => {
        expect.assertions(1);

        expect(findTargetVersion([], "2.1.0", "^1.0.0", "minor", false)).toBeUndefined();
    });

    it("should return undefined for empty latest string", () => {
        expect.assertions(1);

        expect(findTargetVersion(versions, "", "^1.0.0", "latest", false)).toBeUndefined();
    });

    it("should pick highest minor version when multiple available", () => {
        expect.assertions(1);

        const v = ["1.0.0", "1.1.0", "1.2.0", "1.3.0", "2.0.0"];

        expect(findTargetVersion(v, "2.0.0", "^1.0.0", "minor", false)).toBe("1.3.0");
    });

    it("should pick highest patch version when multiple available", () => {
        expect.assertions(1);

        const v = ["1.0.0", "1.0.1", "1.0.2", "1.0.3", "1.1.0"];

        expect(findTargetVersion(v, "1.1.0", "^1.0.0", "patch", false)).toBe("1.0.3");
    });

    it("should handle unsorted version input", () => {
        expect.assertions(1);

        const unsorted = ["2.0.0", "1.0.0", "1.2.0", "1.1.0", "1.0.1"];

        expect(findTargetVersion(unsorted, "2.0.0", "^1.0.0", "minor", false)).toBe("1.2.0");
    });

    it("should filter out prerelease versions in minor mode", () => {
        expect.assertions(1);

        const v = ["1.0.0", "1.1.0", "1.2.0-beta.1", "2.0.0"];

        expect(findTargetVersion(v, "2.0.0", "^1.0.0", "minor", false)).toBe("1.1.0");
    });

    it("should include prerelease versions in minor mode when enabled", () => {
        expect.assertions(1);

        const v = ["1.0.0", "1.1.0", "1.2.0-beta.1"];

        expect(findTargetVersion(v, "1.2.0-beta.1", "^1.0.0", "minor", true)).toBe("1.2.0-beta.1");
    });
    it("should filter out immature versions when maturity options are provided", () => {
        expect.assertions(1);

        const v = ["1.0.0", "1.1.0", "1.2.0", "2.0.0"];
        const now = Date.now();
        const publishTimes = new Map([
            ["1.0.0", new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString()],
            ["1.1.0", new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString()],
            ["1.2.0", new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString()],
            ["2.0.0", new Date(now - 1000).toISOString()], // published 1 second ago
        ]);

        // minimumReleaseAge = 20160 minutes (14 days), 2.0.0 is too new
        expect(
            findTargetVersion(v, "2.0.0", "^1.0.0", "latest", false, {
                minimumReleaseAge: 20_160,
                packageName: "react",
                publishTimes,
            }),
        ).toBe("1.2.0");
    });

    it("should skip maturity check for excluded packages", () => {
        expect.assertions(1);

        const v = ["1.0.0", "2.0.0"];
        const now = Date.now();
        const publishTimes = new Map([
            ["1.0.0", new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString()],
            ["2.0.0", new Date(now - 1000).toISOString()],
        ]);

        expect(
            findTargetVersion(v, "2.0.0", "^1.0.0", "latest", false, {
                minimumReleaseAge: 20_160,
                minimumReleaseAgeExclude: ["react"],
                packageName: "react",
                publishTimes,
            }),
        ).toBe("2.0.0");
    });

    it("should filter immature versions in minor mode", () => {
        expect.assertions(1);

        const v = ["1.0.0", "1.1.0", "1.2.0", "2.0.0"];
        const now = Date.now();
        const publishTimes = new Map([
            ["1.0.0", new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString()],
            ["1.1.0", new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString()],
            ["1.2.0", new Date(now - 1000).toISOString()], // too new
            ["2.0.0", new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString()],
        ]);

        expect(
            findTargetVersion(v, "2.0.0", "^1.0.0", "minor", false, {
                minimumReleaseAge: 20_160,
                packageName: "lodash",
                publishTimes,
            }),
        ).toBe("1.1.0");
    });

    it("should return latest when no maturity options are provided", () => {
        expect.assertions(1);

        expect(findTargetVersion(["1.0.0", "2.0.0"], "2.0.0", "^1.0.0", "latest", false)).toBe("2.0.0");
    });
});

// --- resolvePackageTarget ---

describe(resolvePackageTarget, () => {
    it("should return global target when no packageMode", () => {
        expect.assertions(1);

        expect(resolvePackageTarget("react", "latest")).toBe("latest");
    });

    it("should return global target when package does not match any pattern", () => {
        expect.assertions(1);

        expect(resolvePackageTarget("react", "latest", { typescript: "minor" })).toBe("latest");
    });

    it("should match exact package name", () => {
        expect.assertions(1);

        expect(resolvePackageTarget("typescript", "latest", { typescript: "minor" })).toBe("minor");
    });

    it("should match glob pattern", () => {
        expect.assertions(1);

        expect(resolvePackageTarget("@types/node", "latest", { "@types/*": "patch" })).toBe("patch");
    });

    it("should match regex pattern", () => {
        expect.assertions(1);

        expect(resolvePackageTarget("@vue/compiler-sfc", "latest", { "/^@vue/": "patch" })).toBe("patch");
    });

    it("should not match regex that does not apply", () => {
        expect.assertions(1);

        expect(resolvePackageTarget("react", "latest", { "/^@vue/": "patch" })).toBe("latest");
    });

    it("should return the first matching pattern", () => {
        expect.assertions(1);

        expect(
            resolvePackageTarget("typescript", "latest", {
                "/^type/": "patch",
                typescript: "minor",
            }),
        ).toBe("minor");
    });
});

// --- includeLocked (collectEntries via checkOutdated) ---

describe("includeLocked option", () => {
    const mockFetch = (responses: Record<string, { latest: string; versions: string[] } | "error">) => {
        vi.spyOn(globalThis, "fetch").mockImplementation(async (input: RequestInfo | URL) => {
            const url = typeof input === "string" ? input : input.toString();
            const packageName = url.replace("https://registry.npmjs.org/", "");
            const data = responses[packageName];

            if (!data || data === "error") {
                return { ok: false, status: 404, statusText: "Not Found" } as Response;
            }

            const versionsObject: Record<string, unknown> = {};

            for (const v of data.versions) {
                versionsObject[v] = {};
            }

            return {
                json: async () => {
                    return { "dist-tags": { latest: data.latest }, versions: versionsObject };
                },
                ok: true,
            } as Response;
        });
    };

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
    const mockFetch = (responses: Record<string, { latest: string; versions: string[] } | "error">) => {
        vi.spyOn(globalThis, "fetch").mockImplementation(async (input: RequestInfo | URL) => {
            const url = typeof input === "string" ? input : input.toString();
            const packageName = url.replace("https://registry.npmjs.org/", "");
            const data = responses[packageName];

            if (!data || data === "error") {
                return { ok: false, status: 404, statusText: "Not Found" } as Response;
            }

            const versionsObject: Record<string, unknown> = {};

            for (const v of data.versions) {
                versionsObject[v] = {};
            }

            return {
                json: async () => {
                    return { "dist-tags": { latest: data.latest }, versions: versionsObject };
                },
                ok: true,
            } as Response;
        });
    };

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
    const mockFetch = (responses: Record<string, { latest: string; versions: string[] } | "error">) => {
        vi.spyOn(globalThis, "fetch").mockImplementation(async (input: RequestInfo | URL) => {
            const url = typeof input === "string" ? input : input.toString();
            const packageName = url.replace("https://registry.npmjs.org/", "");
            const data = responses[packageName];

            if (!data || data === "error") {
                return { ok: false, status: 404, statusText: "Not Found" } as Response;
            }

            const versionsObject: Record<string, unknown> = {};

            for (const v of data.versions) {
                versionsObject[v] = {};
            }

            return {
                json: async () => {
                    return { "dist-tags": { latest: data.latest }, versions: versionsObject };
                },
                ok: true,
            } as Response;
        });
    };

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
        expect(result.ignored).toEqual(expect.arrayContaining(["@types/node", "@types/react"]));

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
    const mockFetch = (responses: Record<string, { latest: string; versions: string[] } | "error">) => {
        vi.spyOn(globalThis, "fetch").mockImplementation(async (input: RequestInfo | URL) => {
            const url = typeof input === "string" ? input : input.toString();
            const packageName = url.replace("https://registry.npmjs.org/", "");
            const data = responses[packageName];

            if (!data || data === "error") {
                return { ok: false, status: 404, statusText: "Not Found" } as Response;
            }

            const versionsObject: Record<string, unknown> = {};

            for (const v of data.versions) {
                versionsObject[v] = {};
            }

            return {
                json: async () => {
                    return { "dist-tags": { latest: data.latest }, versions: versionsObject };
                },
                ok: true,
            } as Response;
        });
    };

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

// --- applyCatalogUpdates ---

describe(applyCatalogUpdates, () => {
    it("should update version in default catalog", () => {
        expect.assertions(2);

        const temporaryDirectory = mkdtempSync(join(tmpdir(), "vis-test-"));
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

        expect(result).toContain('"@types/node": ^22.0.0');
    });

    it("should update exact version without prefix", () => {
        expect.assertions(1);

        const temporaryDirectory = mkdtempSync(join(tmpdir(), "vis-test-"));
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

        expect(result).toContain('- "packages/*"');
        expect(result).toContain('- "apps/*"');
        expect(result).toContain("react: ^19.0.0");
    });

    it("should handle quoted version values", () => {
        expect.assertions(1);

        const temporaryDirectory = mkdtempSync(join(tmpdir(), "vis-test-"));
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
        expect(result).toContain('^19.0.0"');
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

        expect(detectJsonIndent('{\n  "name": "test"\n}')).toBe(2);
    });

    it("should detect 4-space indent", () => {
        expect.assertions(1);

        expect(detectJsonIndent('{\n    "name": "test"\n}')).toBe(4);
    });

    it("should default to 2 when no indentation found", () => {
        expect.assertions(1);

        expect(detectJsonIndent('{"name":"test"}')).toBe(2);
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
        expect(content).toContain('    "workspaces"');
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

// --- .npmrc support ---

describe(parseNpmrc, () => {
    it("should parse default registry", () => {
        expect.assertions(1);

        const config = parseNpmrc("registry=https://custom.registry.com");

        expect(config.defaultRegistry).toBe("https://custom.registry.com");
    });

    it("should parse scoped registry", () => {
        expect.assertions(1);

        const config = parseNpmrc("@myorg:registry=https://npm.myorg.com");

        expect(config.registries.get("@myorg")).toBe("https://npm.myorg.com");
    });

    it("should parse auth token", () => {
        expect.assertions(1);

        const config = parseNpmrc("//npm.myorg.com/:_authToken=secret123");

        expect(config.authTokens.get("npm.myorg.com")).toBe("secret123");
    });

    it("should parse multiple entries", () => {
        expect.assertions(6);

        const content = `registry=https://custom.registry.com
@myorg:registry=https://npm.myorg.com
@another:registry=https://npm.another.com
//npm.myorg.com/:_authToken=token1
//npm.another.com/:_authToken=token2`;

        const config = parseNpmrc(content);

        expect(config.defaultRegistry).toBe("https://custom.registry.com");
        expect(config.registries.size).toBe(2);
        expect(config.registries.get("@myorg")).toBe("https://npm.myorg.com");
        expect(config.registries.get("@another")).toBe("https://npm.another.com");
        expect(config.authTokens.size).toBe(2);
        expect(config.authTokens.get("npm.myorg.com")).toBe("token1");
    });

    it("should ignore comments", () => {
        expect.assertions(1);

        const content = `# This is a comment
; Another comment
registry=https://custom.registry.com`;

        const config = parseNpmrc(content);

        expect(config.defaultRegistry).toBe("https://custom.registry.com");
    });

    it("should ignore empty lines", () => {
        expect.assertions(2);

        const content = `
registry=https://custom.registry.com

@myorg:registry=https://npm.myorg.com
`;

        const config = parseNpmrc(content);

        expect(config.defaultRegistry).toBe("https://custom.registry.com");
        expect(config.registries.get("@myorg")).toBe("https://npm.myorg.com");
    });

    it("should handle empty content", () => {
        expect.assertions(3);

        const config = parseNpmrc("");

        expect(config.defaultRegistry).toBe("https://registry.npmjs.org");
        expect(config.registries.size).toBe(0);
        expect(config.authTokens.size).toBe(0);
    });

    it("should handle values with = in them", () => {
        expect.assertions(1);

        const config = parseNpmrc("//npm.myorg.com/:_authToken=abc=def==");

        expect(config.authTokens.get("npm.myorg.com")).toBe("abc=def==");
    });
});

describe(getRegistryForPackage, () => {
    const config: NpmrcConfig = {
        authTokens: new Map([["npm.myorg.com", "secret"]]),
        defaultRegistry: "https://registry.npmjs.org",
        registries: new Map([["@myorg", "https://npm.myorg.com"]]),
    };

    it("should return scoped registry for matching package", () => {
        expect.assertions(2);

        const result = getRegistryForPackage("@myorg/utils", config);

        expect(result.url).toBe("https://npm.myorg.com");
        expect(result.token).toBe("secret");
    });

    it("should return default registry for unscoped package", () => {
        expect.assertions(2);

        const result = getRegistryForPackage("react", config);

        expect(result.url).toBe("https://registry.npmjs.org");
        expect(result.token).toBeUndefined();
    });

    it("should return default registry for unmatched scope", () => {
        expect.assertions(1);

        const result = getRegistryForPackage("@other/pkg", config);

        expect(result.url).toBe("https://registry.npmjs.org");
    });
});

describe(loadNpmrc, () => {
    it("should load project .npmrc", () => {
        expect.assertions(1);

        const temporaryDirectory = mkdtempSync(join(tmpdir(), "vis-test-"));

        writeFileSync(join(temporaryDirectory, ".npmrc"), "@myorg:registry=https://npm.myorg.com\n");

        const config = loadNpmrc(temporaryDirectory);

        expect(config.registries.get("@myorg")).toBe("https://npm.myorg.com");
    });

    it("should return defaults when no .npmrc exists", () => {
        expect.assertions(2);

        const temporaryDirectory = mkdtempSync(join(tmpdir(), "vis-test-"));

        // Isolate from host ~/.npmrc by pointing HOME to a directory without one
        const originalHome = process.env.HOME;

        process.env.HOME = temporaryDirectory;

        try {
            const config = loadNpmrc(temporaryDirectory);

            expect(config.defaultRegistry).toBe("https://registry.npmjs.org");
            expect(config.registries.size).toBe(0);
        } finally {
            process.env.HOME = originalHome;
        }
    });
});

// --- fetchPackageVersions with timeout and registry ---

describe(fetchPackageVersions, () => {
    it("should use custom registry URL", async () => {
        expect.assertions(2);

        vi.spyOn(globalThis, "fetch").mockImplementation(async (input: RequestInfo | URL) => {
            const url = typeof input === "string" ? input : input.toString();

            expect(url).toBe("https://custom.registry.com/react");

            return {
                json: async () => {
                    return { "dist-tags": { latest: "19.0.0" }, versions: { "19.0.0": {} } };
                },
                ok: true,
            } as Response;
        });

        const result = await fetchPackageVersions("react", { url: "https://custom.registry.com" });

        expect(result.latest).toBe("19.0.0");

        vi.restoreAllMocks();
    });

    it("should pass auth token in header", async () => {
        expect.assertions(1);

        vi.spyOn(globalThis, "fetch").mockImplementation(async (_input: RequestInfo | URL, init?: RequestInit) => {
            const headers = init?.headers as Record<string, string>;

            expect(headers["Authorization"]).toBe("Bearer mytoken");

            return {
                json: async () => {
                    return { "dist-tags": { latest: "1.0.0" }, versions: { "1.0.0": {} } };
                },
                ok: true,
            } as Response;
        });

        await fetchPackageVersions("pkg", { authToken: "mytoken", url: "https://npm.example.com" });

        vi.restoreAllMocks();
    });

    it("should abort on timeout", async () => {
        expect.assertions(1);

        vi.spyOn(globalThis, "fetch").mockImplementation(async (_input: RequestInfo | URL, init?: RequestInit) => {
            // Wait longer than timeout
            await new Promise((resolve, reject) => {
                const timer = setTimeout(resolve, 5000);

                init?.signal?.addEventListener("abort", () => {
                    clearTimeout(timer);
                    reject(new DOMException("Aborted", "AbortError"));
                });
            });

            return {
                json: async () => {
                    return {};
                },
                ok: true,
            } as Response;
        });

        await expect(fetchPackageVersions("slow-pkg", undefined, 50)).rejects.toThrow("Aborted");

        vi.restoreAllMocks();
    });

    it("should strip trailing slash from registry URL", async () => {
        expect.assertions(1);

        vi.spyOn(globalThis, "fetch").mockImplementation(async (input: RequestInfo | URL) => {
            const url = typeof input === "string" ? input : input.toString();

            expect(url).toBe("https://custom.registry.com/react");

            return {
                json: async () => {
                    return { "dist-tags": { latest: "1.0.0" }, versions: { "1.0.0": {} } };
                },
                ok: true,
            } as Response;
        });

        await fetchPackageVersions("react", { url: "https://custom.registry.com/" });

        vi.restoreAllMocks();
    });
});

// --- Backup & Rollback ---

describe(createBackup, () => {
    it("should create pnpm backup", () => {
        expect.assertions(2);

        const temporaryDirectory = mkdtempSync(join(tmpdir(), "vis-test-"));
        const filePath = join(temporaryDirectory, "pnpm-workspace.yaml");

        writeFileSync(filePath, "catalog:\n  react: ^18.0.0\n");

        const backupPath = createBackup(temporaryDirectory);

        expect(backupPath).toBe(`${filePath}.bak`);
        expect(readFileSync(backupPath as string, "utf8")).toBe("catalog:\n  react: ^18.0.0\n");
    });

    it("should create bun backup", () => {
        expect.assertions(2);

        const temporaryDirectory = mkdtempSync(join(tmpdir(), "vis-test-"));
        const filePath = join(temporaryDirectory, "package.json");

        writeFileSync(filePath, '{"workspaces":{"catalog":{"react":"^18.0.0"}}}');

        const backupPath = createBackup(temporaryDirectory, "bun");

        expect(backupPath).toBe(`${filePath}.bak`);
        expect(readFileSync(backupPath as string, "utf8")).toContain("react");
    });

    it("should return undefined when file does not exist", () => {
        expect.assertions(1);

        const temporaryDirectory = mkdtempSync(join(tmpdir(), "vis-test-"));

        expect(createBackup(temporaryDirectory)).toBeUndefined();
    });
});

describe(restoreFromBackup, () => {
    it("should restore pnpm file from backup", () => {
        expect.assertions(2);

        const temporaryDirectory = mkdtempSync(join(tmpdir(), "vis-test-"));
        const filePath = join(temporaryDirectory, "pnpm-workspace.yaml");
        const backupPath = `${filePath}.bak`;

        writeFileSync(backupPath, "catalog:\n  react: ^18.0.0\n");
        writeFileSync(filePath, "catalog:\n  react: ^19.0.0\n");

        const restored = restoreFromBackup(temporaryDirectory);

        expect(restored).toBe(true);
        expect(readFileSync(filePath, "utf8")).toContain("^18.0.0");
    });

    it("should restore bun file from backup", () => {
        expect.assertions(2);

        const temporaryDirectory = mkdtempSync(join(tmpdir(), "vis-test-"));
        const filePath = join(temporaryDirectory, "package.json");
        const backupPath = `${filePath}.bak`;

        writeFileSync(backupPath, '{"old":true}');
        writeFileSync(filePath, '{"new":true}');

        const restored = restoreFromBackup(temporaryDirectory, "bun");

        expect(restored).toBe(true);
        expect(readFileSync(filePath, "utf8")).toContain('"old"');
    });

    it("should return false when no backup exists", () => {
        expect.assertions(1);

        const temporaryDirectory = mkdtempSync(join(tmpdir(), "vis-test-"));

        expect(restoreFromBackup(temporaryDirectory)).toBe(false);
    });
});

describe(hasBackup, () => {
    it("should detect existing backup", () => {
        expect.assertions(1);

        const temporaryDirectory = mkdtempSync(join(tmpdir(), "vis-test-"));

        writeFileSync(join(temporaryDirectory, "pnpm-workspace.yaml.bak"), "backup");

        expect(hasBackup(temporaryDirectory)).toBe(true);
    });

    it("should return false when no backup", () => {
        expect.assertions(1);

        const temporaryDirectory = mkdtempSync(join(tmpdir(), "vis-test-"));

        expect(hasBackup(temporaryDirectory)).toBe(false);
    });

    it("should check bun backup path", () => {
        expect.assertions(2);

        const temporaryDirectory = mkdtempSync(join(tmpdir(), "vis-test-"));

        writeFileSync(join(temporaryDirectory, "package.json.bak"), "backup");

        expect(hasBackup(temporaryDirectory, "bun")).toBe(true);
        expect(hasBackup(temporaryDirectory, "pnpm")).toBe(false);
    });
});

// --- Output formatting ---

describe(formatOutdatedJson, () => {
    it("should produce valid JSON with outdated and failed", () => {
        expect.assertions(3);

        const result: CheckOutdatedResult = {
            failed: ["broken-pkg"],
            outdated: [
                {
                    catalogName: "default",
                    currentRange: "^18.0.0",
                    newRange: "^19.0.0",
                    packageName: "react",
                    targetVersion: "19.0.0",
                    updateType: "major",
                },
            ],
        };
        const json = formatOutdatedJson(result);
        const parsed = JSON.parse(json);

        expect(parsed.outdated).toHaveLength(1);
        expect(parsed.outdated[0].packageName).toBe("react");
        expect(parsed.failed).toStrictEqual(["broken-pkg"]);
    });

    it("should produce valid JSON for empty results", () => {
        expect.assertions(2);

        const json = formatOutdatedJson({ failed: [], outdated: [] });
        const parsed = JSON.parse(json);

        expect(parsed.outdated).toHaveLength(0);
        expect(parsed.failed).toHaveLength(0);
    });
});

describe(formatOutdatedMinimal, () => {
    it("should format one entry per line", () => {
        expect.assertions(4);

        const result = formatOutdatedMinimal([
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
                currentRange: "~5.3.0",
                newRange: "~5.7.0",
                packageName: "typescript",
                targetVersion: "5.7.0",
                updateType: "minor",
            },
        ]);

        const lines = result.split("\n");

        expect(lines).toHaveLength(2);
        expect(lines[0]).toContain("react");
        expect(lines[0]).toContain("→");
        expect(lines[1]).toContain("typescript");
    });

    it("should return empty string for no entries", () => {
        expect.assertions(1);

        expect(formatOutdatedMinimal([])).toBe("");
    });
});

// --- applyCatalogUpdates with backup ---

describe("applyCatalogUpdates with backup", () => {
    it("should create backup by default", () => {
        expect.assertions(3);

        const temporaryDirectory = mkdtempSync(join(tmpdir(), "vis-test-"));
        const filePath = join(temporaryDirectory, "pnpm-workspace.yaml");

        writeFileSync(filePath, "catalog:\n  react: ^18.0.0\n");

        const backupPath = applyCatalogUpdates(temporaryDirectory, [
            {
                catalogName: "default",
                currentRange: "^18.0.0",
                newRange: "^19.0.0",
                packageName: "react",
                targetVersion: "19.0.0",
                updateType: "major",
            },
        ]);

        expect(backupPath).toBe(`${filePath}.bak`);
        // Backup should contain the OLD content
        expect(readFileSync(backupPath as string, "utf8")).toContain("^18.0.0");
        // File should contain the NEW content
        expect(readFileSync(filePath, "utf8")).toContain("^19.0.0");
    });

    it("should skip backup when backup=false", () => {
        expect.assertions(2);

        const temporaryDirectory = mkdtempSync(join(tmpdir(), "vis-test-"));
        const filePath = join(temporaryDirectory, "pnpm-workspace.yaml");

        writeFileSync(filePath, "catalog:\n  react: ^18.0.0\n");

        const backupPath = applyCatalogUpdates(
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
            undefined,
            false,
        );

        expect(backupPath).toBeUndefined();
        expect(readFileSync(filePath, "utf8")).toContain("^19.0.0");
    });

    it("should create backup for bun updates", () => {
        expect.assertions(3);

        const temporaryDirectory = mkdtempSync(join(tmpdir(), "vis-test-"));
        const filePath = join(temporaryDirectory, "package.json");

        writeFileSync(
            filePath,
            `${JSON.stringify(
                {
                    workspaces: { catalog: { react: "^18.0.0" } },
                },
                undefined,
                2,
            )}\n`,
        );

        const backupPath = applyCatalogUpdates(
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

        expect(backupPath).toBe(`${filePath}.bak`);
        expect(JSON.parse(readFileSync(backupPath as string, "utf8")).workspaces.catalog.react).toBe("^18.0.0");
        expect(JSON.parse(readFileSync(filePath, "utf8")).workspaces.catalog.react).toBe("^19.0.0");
    });
});

// --- checkOutdated with npmrc ---

describe("checkOutdated with npmrcConfig", () => {
    it("should use scoped registry from npmrc", async () => {
        expect.assertions(1);

        const fetchCalls: string[] = [];

        vi.spyOn(globalThis, "fetch").mockImplementation(async (input: RequestInfo | URL) => {
            const url = typeof input === "string" ? input : input.toString();

            fetchCalls.push(url);

            return {
                json: async () => {
                    return { "dist-tags": { latest: "2.0.0" }, versions: { "1.0.0": {}, "2.0.0": {} } };
                },
                ok: true,
            } as Response;
        });

        const catalogs = new Map([["default", new Map([["@myorg/utils", "^1.0.0"]])]]);
        const options: CatalogCheckOptions = { exclude: [], ignore: [], include: [], includeLocked: false, includePrerelease: false, target: "latest" };
        const npmrcConfig: NpmrcConfig = {
            authTokens: new Map(),
            defaultRegistry: "https://registry.npmjs.org",
            registries: new Map([["@myorg", "https://npm.myorg.com"]]),
        };

        await checkOutdated(catalogs, options, npmrcConfig);

        expect(fetchCalls[0]).toBe("https://npm.myorg.com/@myorg/utils");

        vi.restoreAllMocks();
    });

    it("should use default registry when no npmrcConfig", async () => {
        expect.assertions(1);

        const fetchCalls: string[] = [];

        vi.spyOn(globalThis, "fetch").mockImplementation(async (input: RequestInfo | URL) => {
            fetchCalls.push(typeof input === "string" ? input : input.toString());

            return {
                json: async () => {
                    return { "dist-tags": { latest: "2.0.0" }, versions: { "1.0.0": {}, "2.0.0": {} } };
                },
                ok: true,
            } as Response;
        });

        const catalogs = new Map([["default", new Map([["react", "^1.0.0"]])]]);
        const options: CatalogCheckOptions = { exclude: [], ignore: [], include: [], includeLocked: false, includePrerelease: false, target: "latest" };

        await checkOutdated(catalogs, options);

        expect(fetchCalls[0]).toBe("https://registry.npmjs.org/react");

        vi.restoreAllMocks();
    });
});

// --- Security scanning (OSV.dev) ---

describe(fetchVulnerabilities, () => {
    it("should return vulnerabilities from OSV batch API", async () => {
        expect.assertions(9);

        vi.spyOn(globalThis, "fetch").mockImplementation(
            async () =>
                ({
                    json: async () => {
                        return {
                            results: [
                                {
                                    vulns: [
                                        {
                                            affected: [{ ranges: [{ events: [{ introduced: "0" }, { fixed: "4.17.21" }] }] }],
                                            id: "GHSA-1234-5678",
                                            severity: [{ score: "7.5", type: "CVSS_V3" }],
                                            summary: "Prototype Pollution",
                                        },
                                    ],
                                },
                                { vulns: [] },
                            ],
                        };
                    },
                    ok: true,
                }) as Response,
        );

        const result = await fetchVulnerabilities([
            { name: "lodash", version: "4.17.20" },
            { name: "react", version: "18.2.0" },
        ]);

        expect(result.size).toBe(1);
        expect(result.has("lodash")).toBe(true);
        expect(result.has("react")).toBe(false);

        const vulns = result.get("lodash");

        expect(vulns).toHaveLength(1);
        expect(vulns?.[0]?.id).toBe("GHSA-1234-5678");
        expect(vulns?.[0]?.severity).toBe("HIGH");
        expect(vulns?.[0]?.cvssScore).toBe(7.5);
        expect(vulns?.[0]?.fixedVersions).toStrictEqual(["4.17.21"]);
        expect(vulns?.[0]?.summary).toBe("Prototype Pollution");

        vi.restoreAllMocks();
    });

    it("should return empty map on API failure", async () => {
        expect.assertions(1);

        vi.spyOn(globalThis, "fetch").mockImplementation(
            async () =>
                ({
                    ok: false,
                    status: 500,
                }) as Response,
        );

        const result = await fetchVulnerabilities([{ name: "lodash", version: "4.17.20" }]);

        expect(result.size).toBe(0);

        vi.restoreAllMocks();
    });

    it("should return empty map on network error", async () => {
        expect.assertions(1);

        vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
            throw new Error("Network error");
        });

        const result = await fetchVulnerabilities([{ name: "lodash", version: "4.17.20" }]);

        expect(result.size).toBe(0);

        vi.restoreAllMocks();
    });

    it("should return empty map for empty input", async () => {
        expect.assertions(1);

        const result = await fetchVulnerabilities([]);

        expect(result.size).toBe(0);
    });

    it("should map severity from database_specific", async () => {
        expect.assertions(1);

        vi.spyOn(globalThis, "fetch").mockImplementation(
            async () =>
                ({
                    json: async () => {
                        return {
                            results: [
                                {
                                    vulns: [
                                        {
                                            database_specific: { severity: "CRITICAL" },
                                            id: "GHSA-test",
                                            summary: "Test",
                                        },
                                    ],
                                },
                            ],
                        };
                    },
                    ok: true,
                }) as Response,
        );

        const result = await fetchVulnerabilities([{ name: "pkg", version: "1.0.0" }]);

        expect(result.get("pkg")?.[0]?.severity).toBe("CRITICAL");

        vi.restoreAllMocks();
    });

    it("should map CVSS score ranges correctly", async () => {
        expect.assertions(4);

        const makeResponse = (score: string) =>
            ({
                json: async () => {
                    return {
                        results: [
                            {
                                vulns: [
                                    {
                                        id: "GHSA-test",
                                        severity: [{ score, type: "CVSS_V3" }],
                                        summary: "Test",
                                    },
                                ],
                            },
                        ],
                    };
                },
                ok: true,
            }) as Response;

        // CRITICAL >= 9.0
        vi.spyOn(globalThis, "fetch").mockImplementation(async () => makeResponse("9.8"));

        const criticalResult = await fetchVulnerabilities([{ name: "a", version: "1.0.0" }]);

        expect(criticalResult.get("a")?.[0]?.severity).toBe("CRITICAL");

        vi.restoreAllMocks();

        // HIGH >= 7.0
        vi.spyOn(globalThis, "fetch").mockImplementation(async () => makeResponse("7.0"));

        const highResult = await fetchVulnerabilities([{ name: "a", version: "1.0.0" }]);

        expect(highResult.get("a")?.[0]?.severity).toBe("HIGH");

        vi.restoreAllMocks();

        // MODERATE >= 4.0
        vi.spyOn(globalThis, "fetch").mockImplementation(async () => makeResponse("4.0"));

        const moderateResult = await fetchVulnerabilities([{ name: "a", version: "1.0.0" }]);

        expect(moderateResult.get("a")?.[0]?.severity).toBe("MODERATE");

        vi.restoreAllMocks();

        // LOW < 4.0
        vi.spyOn(globalThis, "fetch").mockImplementation(async () => makeResponse("2.5"));

        const lowResult = await fetchVulnerabilities([{ name: "a", version: "1.0.0" }]);

        expect(lowResult.get("a")?.[0]?.severity).toBe("LOW");

        vi.restoreAllMocks();
    });

    it("should extract multiple fixed versions from affected ranges", async () => {
        expect.assertions(1);

        vi.spyOn(globalThis, "fetch").mockImplementation(
            async () =>
                ({
                    json: async () => {
                        return {
                            results: [
                                {
                                    vulns: [
                                        {
                                            affected: [
                                                { ranges: [{ events: [{ introduced: "0" }, { fixed: "1.2.0" }] }] },
                                                { ranges: [{ events: [{ introduced: "2.0.0" }, { fixed: "2.1.0" }] }] },
                                            ],
                                            id: "GHSA-test",
                                            summary: "Test",
                                        },
                                    ],
                                },
                            ],
                        };
                    },
                    ok: true,
                }) as Response,
        );

        const result = await fetchVulnerabilities([{ name: "pkg", version: "1.0.0" }]);

        expect(result.get("pkg")?.[0]?.fixedVersions).toStrictEqual(["1.2.0", "2.1.0"]);

        vi.restoreAllMocks();
    });
});

describe("checkOutdated with security", () => {
    it("should enrich outdated entries with vulnerability data when security=true", async () => {
        expect.assertions(5);

        let callCount = 0;

        vi.spyOn(globalThis, "fetch").mockImplementation(async (input: RequestInfo | URL) => {
            const url = typeof input === "string" ? input : input.toString();

            // npm registry call
            if (url.includes("registry.npmjs.org")) {
                return {
                    json: async () => {
                        return {
                            "dist-tags": { latest: "4.17.21" },
                            versions: { "4.17.20": {}, "4.17.21": {} },
                        };
                    },
                    ok: true,
                } as Response;
            }

            // OSV API call
            if (url.includes("osv.dev")) {
                callCount += 1;

                return {
                    json: async () => {
                        return {
                            results: [
                                {
                                    vulns: [
                                        {
                                            affected: [{ ranges: [{ events: [{ introduced: "0" }, { fixed: "4.17.21" }] }] }],
                                            id: "GHSA-sec-1234",
                                            severity: [{ score: "7.5", type: "CVSS_V3" }],
                                            summary: "Prototype Pollution in lodash",
                                        },
                                    ],
                                },
                            ],
                        };
                    },
                    ok: true,
                } as Response;
            }

            return { ok: false, status: 404 } as Response;
        });

        const catalogs = new Map([["default", new Map([["lodash", "^4.17.20"]])]]);
        const options: CatalogCheckOptions = { exclude: [], ignore: [], include: [], includePrerelease: false, security: true, target: "latest" };
        const { outdated } = await checkOutdated(catalogs, options);

        expect(outdated).toHaveLength(1);
        expect(outdated[0]?.vulnerabilities).toBeDefined();
        expect(outdated[0]?.vulnerabilities).toHaveLength(1);
        expect(outdated[0]?.vulnerabilities?.[0]?.id).toBe("GHSA-sec-1234");
        expect(callCount).toBe(1);

        vi.restoreAllMocks();
    });

    it("should not call OSV when security=false", async () => {
        expect.assertions(3);

        vi.spyOn(globalThis, "fetch").mockImplementation(
            async () =>
                ({
                    json: async () => {
                        return {
                            "dist-tags": { latest: "2.0.0" },
                            versions: { "1.0.0": {}, "2.0.0": {} },
                        };
                    },
                    ok: true,
                }) as Response,
        );

        const catalogs = new Map([["default", new Map([["react", "^1.0.0"]])]]);
        const options: CatalogCheckOptions = { exclude: [], ignore: [], include: [], includePrerelease: false, security: false, target: "latest" };
        const { outdated } = await checkOutdated(catalogs, options);

        expect(outdated).toHaveLength(1);
        expect(outdated[0]?.vulnerabilities).toBeUndefined();

        // Only npm registry calls, no OSV
        const { calls } = (globalThis.fetch as ReturnType<typeof vi.fn>).mock;

        expect(calls.every((c: unknown[]) => !(c[0] as string).includes("osv.dev"))).toBe(true);

        vi.restoreAllMocks();
    });
});

describe("formatOutdatedTable with security", () => {
    it("should show [SEC] prefix for entries with vulnerabilities", () => {
        expect.assertions(4);

        const logs: string[] = [];
        const mockLogger = { info: (message: string) => logs.push(message) } as unknown as Console;

        formatOutdatedTable(
            [
                {
                    catalogName: "default",
                    currentRange: "^4.17.20",
                    newRange: "^4.17.21",
                    packageName: "lodash",
                    targetVersion: "4.17.21",
                    updateType: "patch",
                    vulnerabilities: [{ cvssScore: 7.5, fixedVersions: ["4.17.21"], id: "GHSA-1234", severity: "HIGH", summary: "Prototype Pollution" }],
                },
                {
                    catalogName: "default",
                    currentRange: "^18.0.0",
                    newRange: "^19.0.0",
                    packageName: "react",
                    targetVersion: "19.0.0",
                    updateType: "major",
                },
            ],
            mockLogger,
        );

        const output = logs.join("\n");

        expect(output).toContain("[SEC] lodash");
        expect(output).toContain("HIGH GHSA-1234");
        expect(output).toContain("Prototype Pollution");
        expect(output).not.toContain("[SEC] react");
    });
});

describe("formatSummary with security", () => {
    it("should include vulnerability count in summary", () => {
        expect.assertions(3);

        const result = formatSummary([
            {
                catalogName: "default",
                currentRange: "^4.17.20",
                newRange: "^4.17.21",
                packageName: "lodash",
                targetVersion: "4.17.21",
                updateType: "patch",
                vulnerabilities: [{ cvssScore: 7.5, fixedVersions: [], id: "GHSA-1234", severity: "HIGH", summary: "test" }],
            },
            {
                catalogName: "default",
                currentRange: "^18.0.0",
                newRange: "^19.0.0",
                packageName: "react",
                targetVersion: "19.0.0",
                updateType: "major",
            },
        ]);

        expect(result).toContain("1 major");
        expect(result).toContain("1 patch");
        expect(result).toContain("1 with vulnerabilities");
    });

    it("should not mention vulnerabilities when none found", () => {
        expect.assertions(1);

        const result = formatSummary([
            {
                catalogName: "default",
                currentRange: "^18.0.0",
                newRange: "^19.0.0",
                packageName: "react",
                targetVersion: "19.0.0",
                updateType: "major",
            },
        ]);

        expect(result).not.toContain("vulnerabilit");
    });
});

// --- fetchChangelogInfo ---

describe(fetchChangelogInfo, () => {
    it("should return GitHub release URL when repo is on GitHub", async () => {
        expect.assertions(3);

        vi.spyOn(globalThis, "fetch").mockImplementation(
            async () =>
                ({
                    json: async () => {
                        return { repository: { url: "git+https://github.com/facebook/react.git" } };
                    },
                    ok: true,
                }) as Response,
        );

        const result = await fetchChangelogInfo([
            { catalogName: "default", currentRange: "^18.0.0", newRange: "^19.0.0", packageName: "react", targetVersion: "19.0.0", updateType: "major" },
        ]);

        expect(result).toHaveLength(1);
        expect(result[0]?.releaseUrl).toBe("https://github.com/facebook/react/releases/tag/v19.0.0");
        expect(result[0]?.repoUrl).toBe("https://github.com/facebook/react");

        vi.restoreAllMocks();
    });

    it("should fallback to npm URL when no repo info", async () => {
        expect.assertions(2);

        vi.spyOn(globalThis, "fetch").mockImplementation(
            async () =>
                ({
                    json: async () => {
                        return {};
                    },
                    ok: true,
                }) as Response,
        );

        const result = await fetchChangelogInfo([
            { catalogName: "default", currentRange: "^1.0.0", newRange: "^2.0.0", packageName: "my-pkg", targetVersion: "2.0.0", updateType: "major" },
        ]);

        expect(result[0]?.releaseUrl).toBeUndefined();
        expect(result[0]?.npmUrl).toBe("https://www.npmjs.com/package/my-pkg");

        vi.restoreAllMocks();
    });

    it("should handle fetch failure gracefully", async () => {
        expect.assertions(2);

        vi.spyOn(globalThis, "fetch").mockImplementation(async () => ({ ok: false, status: 404 }) as Response);

        const result = await fetchChangelogInfo([
            { catalogName: "default", currentRange: "^1.0.0", newRange: "^2.0.0", packageName: "missing-pkg", targetVersion: "2.0.0", updateType: "major" },
        ]);

        expect(result).toHaveLength(1);
        expect(result[0]?.npmUrl).toBe("https://www.npmjs.com/package/missing-pkg");

        vi.restoreAllMocks();
    });

    it("should handle non-GitHub repos", async () => {
        expect.assertions(2);

        vi.spyOn(globalThis, "fetch").mockImplementation(
            async () =>
                ({
                    json: async () => {
                        return { repository: { url: "https://gitlab.com/my/repo.git" } };
                    },
                    ok: true,
                }) as Response,
        );

        const result = await fetchChangelogInfo([
            { catalogName: "default", currentRange: "^1.0.0", newRange: "^2.0.0", packageName: "gitlab-pkg", targetVersion: "2.0.0", updateType: "major" },
        ]);

        expect(result[0]?.releaseUrl).toBeUndefined();
        expect(result[0]?.repoUrl).toBe("https://gitlab.com/my/repo.git");

        vi.restoreAllMocks();
    });

    it("should handle multiple packages in parallel", async () => {
        expect.assertions(2);

        vi.spyOn(globalThis, "fetch").mockImplementation(async (input: RequestInfo | URL) => {
            const url = typeof input === "string" ? input : input.toString();
            const name = url.replace("https://registry.npmjs.org/", "");

            return {
                json: async () => {
                    return { repository: { url: `git+https://github.com/owner/${name}.git` } };
                },
                ok: true,
            } as Response;
        });

        const result = await fetchChangelogInfo([
            { catalogName: "default", currentRange: "^1.0.0", newRange: "^2.0.0", packageName: "pkg-a", targetVersion: "2.0.0", updateType: "major" },
            { catalogName: "default", currentRange: "^1.0.0", newRange: "^2.0.0", packageName: "pkg-b", targetVersion: "2.0.0", updateType: "major" },
        ]);

        expect(result).toHaveLength(2);
        expect(result[0]?.releaseUrl).toContain("pkg-a");

        vi.restoreAllMocks();
    });
});

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
