import { describe, expect, it } from "vitest";

import {
    extractPrefix,
    findTargetVersion,
    getUpdateType,
    isNewer,
    matchesFilters,
    matchesPattern,
    parseCatalogsFromYaml,
    parseVersion,
    resolvePackageTarget,
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

    // --- release-channel filter (issue #625) ---

    describe("release-channel filter", () => {
        const stableAndPrerelease = ["1.0.0", "1.1.0", "2.0.0", "2.1.0-rc.1", "2.1.0-beta.1", "2.1.0-alpha.1"];

        it("'stable' rejects an off-channel dist-tag and falls back to the newest stable in the version list", () => {
            expect.assertions(1);

            // npm's `latest` dist-tag points at an rc, but channel=stable
            // must scan the version list for a stable candidate instead of bailing.
            expect(findTargetVersion(stableAndPrerelease, "2.1.0-rc.1", "^1.0.0", "latest", false, undefined, "stable")).toBe("2.0.0");
        });

        it("'any' accepts any channel (matches legacy --prerelease=true behaviour)", () => {
            expect.assertions(1);

            expect(findTargetVersion(stableAndPrerelease, "2.1.0-rc.1", "^1.0.0", "latest", false, undefined, "any")).toBe("2.1.0-rc.1");
        });

        it("'same' on a stable current behaves like 'stable' (refuses to promote to a prerelease)", () => {
            expect.assertions(1);

            expect(findTargetVersion(stableAndPrerelease, "2.1.0-rc.1", "^1.0.0", "latest", false, undefined, "same")).toBe("2.0.0");
        });

        it("'same' on an alpha current accepts only alpha candidates", () => {
            expect.assertions(1);

            const alphaCandidates = ["1.0.0-alpha.1", "1.0.0-alpha.5", "1.0.0-beta.1", "1.0.0-rc.1", "1.0.0"];

            // Current is alpha.1 → only alpha.* should qualify, beta/rc/stable are out of channel.
            expect(findTargetVersion(alphaCandidates, "1.0.0", "^1.0.0-alpha.1", "latest", true, undefined, "same")).toBe("1.0.0-alpha.5");
        });

        it("'same' on an alpha current rejects a stable bump", () => {
            expect.assertions(1);

            const alphaThenStable = ["1.0.0-alpha.1", "1.0.0"];

            // includePrerelease=true so the `1.0.0` dist-tag isn't pruned upfront —
            // the channel filter is what should reject the cross-channel bump.
            expect(findTargetVersion(alphaThenStable, "1.0.0", "^1.0.0-alpha.1", "latest", true, undefined, "same")).toBeUndefined();
        });

        it("releaseChannel undefined + includePrerelease=true preserves legacy --prerelease semantics", () => {
            expect.assertions(1);

            // No releaseChannel passed → resolveReleaseChannel maps includePrerelease=true to "any".
            expect(findTargetVersion(stableAndPrerelease, "2.1.0-rc.1", "^1.0.0", "latest", true)).toBe("2.1.0-rc.1");
        });

        it("releaseChannel undefined + includePrerelease=false preserves stable-only semantics", () => {
            expect.assertions(1);

            expect(findTargetVersion(stableAndPrerelease, "2.0.0", "^1.0.0", "latest", false)).toBe("2.0.0");
        });
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
