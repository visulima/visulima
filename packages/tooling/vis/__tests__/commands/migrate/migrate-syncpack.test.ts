import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

import { join } from "@visulima/path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
    detectSyncpackConfig,
    extractSyncpackFromPackageJson,
    hasUnsupportedSyncpackConfig,
    migrateSyncpack,
    parseSyncpackJsonFile,
    parseSyncpackYamlFile,
    removeSyncpackFromPackageJson,
    translateBannedDeps,
    translateCustomTypes,
} from "../../../src/commands/migrate/syncpack";
import { createMigrationReport } from "../../../src/commands/migrate/types";
import { cleanupTemporaryDirectory, createMockLogger, createTemporaryDirectory } from "../../test-helpers";

describe("migrate-syncpack", () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = createTemporaryDirectory("vis-migrate-syncpack-");
    });

    afterEach(() => {
        cleanupTemporaryDirectory(tmpDir);
    });

    describe(detectSyncpackConfig, () => {
        it("returns undefined when nothing is configured", () => {
            expect.assertions(1);
            expect(detectSyncpackConfig(tmpDir)).toBeUndefined();
        });

        it("finds package.json#syncpack first", () => {
            expect.assertions(1);

            writeFileSync(join(tmpDir, "package.json"), JSON.stringify({ syncpack: { customTypes: {} } }));
            writeFileSync(join(tmpDir, ".syncpackrc.json"), "{}");

            expect(detectSyncpackConfig(tmpDir)).toBe("package.json");
        });

        it("falls back to .syncpackrc.json", () => {
            expect.assertions(1);

            writeFileSync(join(tmpDir, ".syncpackrc.json"), "{}");

            expect(detectSyncpackConfig(tmpDir)).toBe(".syncpackrc.json");
        });

        it("finds .syncpackrc.yaml", () => {
            expect.assertions(1);

            writeFileSync(join(tmpDir, ".syncpackrc.yaml"), "customTypes: {}\n");

            expect(detectSyncpackConfig(tmpDir)).toBe(".syncpackrc.yaml");
        });

        it("finds an unsupported TS config so we can warn about it", () => {
            expect.assertions(1);

            writeFileSync(join(tmpDir, ".syncpackrc.ts"), "export default {};");

            expect(detectSyncpackConfig(tmpDir)).toBe(".syncpackrc.ts");
        });
    });

    describe(hasUnsupportedSyncpackConfig, () => {
        it("flags .syncpackrc.ts", () => {
            expect.assertions(1);

            writeFileSync(join(tmpDir, ".syncpackrc.ts"), "export default {};");

            expect(hasUnsupportedSyncpackConfig(tmpDir)).toBe(".syncpackrc.ts");
        });

        it("does not flag yaml-shaped .syncpackrc", () => {
            expect.assertions(1);

            writeFileSync(join(tmpDir, ".syncpackrc"), "customTypes:\n  enginesNode:\n    path: engines.node\n    strategy: versionsByName\n");

            expect(hasUnsupportedSyncpackConfig(tmpDir)).toBeUndefined();
        });
    });

    describe(parseSyncpackJsonFile, () => {
        it("parses a JSON config", () => {
            expect.assertions(1);

            const filePath = join(tmpDir, ".syncpackrc.json");

            writeFileSync(filePath, JSON.stringify({ customTypes: { foo: { path: "foo", strategy: "name@version" } } }));

            expect(parseSyncpackJsonFile(filePath)?.customTypes?.foo?.path).toBe("foo");
        });
    });

    describe(parseSyncpackYamlFile, () => {
        it("parses a YAML config", () => {
            expect.assertions(1);

            const filePath = join(tmpDir, ".syncpackrc.yaml");

            writeFileSync(filePath, "customTypes:\n  foo:\n    path: foo\n    strategy: name@version\n");

            expect(parseSyncpackYamlFile(filePath)?.customTypes?.foo?.path).toBe("foo");
        });

        it("returns undefined on a missing file", () => {
            expect.assertions(1);

            expect(parseSyncpackYamlFile(join(tmpDir, "nope.yaml"))).toBeUndefined();
        });
    });

    describe(extractSyncpackFromPackageJson, () => {
        it("returns undefined when there is no syncpack key", () => {
            expect.assertions(1);

            writeFileSync(join(tmpDir, "package.json"), JSON.stringify({ name: "x" }));

            expect(extractSyncpackFromPackageJson(tmpDir)).toBeUndefined();
        });

        it("returns the embedded syncpack block", () => {
            expect.assertions(1);

            writeFileSync(
                join(tmpDir, "package.json"),
                JSON.stringify({ syncpack: { customTypes: { foo: { path: "foo", strategy: "name@version" } } } }),
            );

            expect(extractSyncpackFromPackageJson(tmpDir)?.customTypes?.foo?.strategy).toBe("name@version");
        });
    });

    describe(translateCustomTypes, () => {
        it("flips the record into an array of named entries", () => {
            expect.assertions(2);

            const report = createMigrationReport();

            const out = translateCustomTypes(
                {
                    customTypes: {
                        nodeFromCi: { path: "ci.nodeVersion", strategy: "versionsByName" },
                        rustToolchain: { depName: "rust", path: "rust-toolchain", strategy: "string" },
                    },
                },
                report,
            );

            expect(out).toContainEqual({ name: "nodeFromCi", path: "ci.nodeVersion", strategy: "versionsByName" });
            expect(out).toContainEqual({ depName: "rust", name: "rustToolchain", path: "rust-toolchain", strategy: "string" });
        });

        it("drops entries that collide with vis built-in types", () => {
            expect.assertions(2);

            const report = createMigrationReport();

            const out = translateCustomTypes(
                {
                    customTypes: {
                        engines: { path: "engines", strategy: "versionsByName" },
                        myExtra: { path: "extra", strategy: "name@version" },
                    },
                },
                report,
            );

            expect(out).toHaveLength(1);
            expect(report.warnings.some((w) => w.includes("engines") && w.includes("vis built-in"))).toBe(true);
        });

        it("warns when strategy=string is missing depName but still records the entry plus a manual step", () => {
            expect.assertions(3);

            const report = createMigrationReport();

            const out = translateCustomTypes(
                {
                    customTypes: {
                        rustToolchain: { path: "rust-toolchain", strategy: "string" },
                    },
                },
                report,
            );

            expect(out).toHaveLength(1);
            expect(report.warnings.some((w) => w.includes("depName"))).toBe(true);
            expect(report.manualSteps.some((s) => s.includes("rustToolchain"))).toBe(true);
        });

        it("skips entries with unsupported strategies", () => {
            expect.assertions(2);

            const report = createMigrationReport();

            const out = translateCustomTypes(
                {
                    customTypes: {
                        weird: { path: "x", strategy: "totally-made-up" },
                    },
                },
                report,
            );

            expect(out).toHaveLength(0);
            expect(report.warnings.some((w) => w.includes("unsupported strategy"))).toBe(true);
        });

        it("skips entries without a path", () => {
            expect.assertions(2);

            const report = createMigrationReport();

            const out = translateCustomTypes(
                {
                    customTypes: {
                        broken: { strategy: "name@version" },
                    },
                },
                report,
            );

            expect(out).toHaveLength(0);
            expect(report.warnings.some((w) => w.includes("no `path`"))).toBe(true);
        });
    });

    describe(removeSyncpackFromPackageJson, () => {
        it("strips the syncpack block, devDependency, and matching scripts", () => {
            expect.assertions(5);

            writeFileSync(
                join(tmpDir, "package.json"),
                JSON.stringify({
                    devDependencies: { syncpack: "^12.0.0", typescript: "^5.0.0" },
                    scripts: {
                        build: "tsc",
                        "deps:fix": "syncpack fix-mismatches",
                        "deps:lint": "syncpack lint",
                    },
                    syncpack: { customTypes: {} },
                }),
            );

            const result = removeSyncpackFromPackageJson(tmpDir);

            expect(result.configRemoved).toBe(true);
            expect(result.dependencyRemoved).toBe(true);
            expect(result.scriptCount).toBe(2);

            const pkg = JSON.parse(readFileSync(join(tmpDir, "package.json"), "utf8")) as {
                devDependencies?: Record<string, string>;
                scripts?: Record<string, string>;
                syncpack?: unknown;
            };

            expect(pkg.scripts).toStrictEqual({ build: "tsc" });
            expect(pkg.devDependencies?.syncpack).toBeUndefined();
        });
    });

    describe(migrateSyncpack, () => {
        it("returns false when there is no syncpack config", () => {
            expect.assertions(1);

            const report = createMigrationReport();

            expect(migrateSyncpack(tmpDir, { dryRun: false }, createMockLogger(), report)).toBe(false);
        });

        it("dry-run leaves files in place but still surfaces manual steps", () => {
            expect.assertions(3);

            writeFileSync(
                join(tmpDir, ".syncpackrc.json"),
                JSON.stringify({
                    customTypes: { tooling: { path: "tooling.version", strategy: "name@version" } },
                    versionGroups: [{ packages: ["**"] }],
                }),
            );
            writeFileSync(
                join(tmpDir, "package.json"),
                JSON.stringify({ devDependencies: { syncpack: "^12.0.0" } }),
            );

            const report = createMigrationReport();
            const ok = migrateSyncpack(tmpDir, { dryRun: true }, createMockLogger(), report);

            expect(ok).toBe(true);
            // dry-run does NOT mutate package.json
            expect(existsSync(join(tmpDir, ".syncpackrc.json"))).toBe(true);
            expect(report.manualSteps.some((s) => s.includes("versionGroups"))).toBe(true);
        });

        it("end-to-end: removes the config file, strips the dep, and writes vis.config.ts", () => {
            expect.assertions(4);

            writeFileSync(
                join(tmpDir, ".syncpackrc.json"),
                JSON.stringify({
                    customTypes: {
                        toolingNode: { path: "tooling.nodeVersion", strategy: "versionsByName" },
                    },
                }),
            );
            writeFileSync(
                join(tmpDir, "package.json"),
                JSON.stringify({
                    devDependencies: { syncpack: "^12.0.0" },
                    scripts: { "deps:lint": "syncpack lint" },
                }),
            );

            const report = createMigrationReport();

            migrateSyncpack(tmpDir, { dryRun: false }, createMockLogger(), report);

            // Config file removed (with backup written)
            expect(existsSync(join(tmpDir, ".syncpackrc.json"))).toBe(false);
            expect(existsSync(join(tmpDir, ".syncpackrc.json.bak"))).toBe(true);

            // vis.config.ts created with policy.customTypes.extraTypes
            const visConfig = readFileSync(join(tmpDir, "vis.config.ts"), "utf8");

            expect(visConfig).toContain("toolingNode");
            expect(visConfig).toContain("extraTypes");
        });

        it("emits manual steps for versionGroups, semverGroups, dependencyTypes, specifierTypes, and filter", () => {
            expect.assertions(6);

            writeFileSync(
                join(tmpDir, ".syncpackrc.json"),
                JSON.stringify({
                    dependencyTypes: ["prod"],
                    filter: "^@org/.*",
                    semverGroups: [{ range: "^" }],
                    specifierTypes: ["version"],
                    versionGroups: [{ packages: ["**"] }],
                }),
            );

            const report = createMigrationReport();

            migrateSyncpack(tmpDir, { dryRun: true }, createMockLogger(), report);

            expect(report.manualSteps.some((s) => s.includes("versionGroups"))).toBe(true);
            // The manual-step copy names the deferred DSL pieces by name so reviewers know what's lost.
            expect(report.manualSteps.some((s) => s.includes("pinVersion") && s.includes("snapTo") && s.includes("sameRange"))).toBe(true);
            expect(report.manualSteps.some((s) => s.includes("semverGroups"))).toBe(true);
            expect(report.manualSteps.some((s) => s.includes("dependencyTypes"))).toBe(true);
            expect(report.manualSteps.some((s) => s.includes("specifierTypes"))).toBe(true);
            expect(report.manualSteps.some((s) => s.includes("filter"))).toBe(true);
        });

        it("warns when sortPackages/formatBugs/formatRepository are present (superseded by sort-package-json)", () => {
            expect.assertions(1);

            writeFileSync(
                join(tmpDir, ".syncpackrc.json"),
                JSON.stringify({ formatBugs: true, formatRepository: true, sortPackages: true }),
            );

            const report = createMigrationReport();

            migrateSyncpack(tmpDir, { dryRun: true }, createMockLogger(), report);

            expect(report.warnings.some((w) => w.includes("sortPackages") && w.includes("sort-package-json"))).toBe(true);
        });

        it("notes that lintFormatting/lintSemverRanges/lintVersions are covered by vis lint", () => {
            expect.assertions(1);

            writeFileSync(
                join(tmpDir, ".syncpackrc.json"),
                JSON.stringify({ lintFormatting: false, lintSemverRanges: true, lintVersions: true }),
            );

            const report = createMigrationReport();

            migrateSyncpack(tmpDir, { dryRun: true }, createMockLogger(), report);

            expect(report.warnings.some((w) => w.includes("vis lint") && w.includes("lintFormatting"))).toBe(true);
        });

        it("emits a manual step when source globs are configured", () => {
            expect.assertions(1);

            writeFileSync(
                join(tmpDir, ".syncpackrc.json"),
                JSON.stringify({ source: ["packages/*", "apps/*"] }),
            );

            const report = createMigrationReport();

            migrateSyncpack(tmpDir, { dryRun: true }, createMockLogger(), report);

            expect(report.manualSteps.some((s) => s.includes("source") && s.includes("packages/*"))).toBe(true);
        });

        it("warns when sortAz/sortFirst/sortExports are present (handled by sort-package-json)", () => {
            expect.assertions(1);

            writeFileSync(
                join(tmpDir, ".syncpackrc.json"),
                JSON.stringify({ sortAz: ["dependencies"], sortFirst: ["name"] }),
            );

            const report = createMigrationReport();

            migrateSyncpack(tmpDir, { dryRun: true }, createMockLogger(), report);

            expect(report.warnings.some((w) => w.includes("sort-package-json"))).toBe(true);
        });

        it("warns and skips when the config file is a TS/JS unsupported format", () => {
            expect.assertions(2);

            writeFileSync(join(tmpDir, ".syncpackrc.ts"), "export default {};");

            const report = createMigrationReport();
            const logger = createMockLogger();

            migrateSyncpack(tmpDir, { dryRun: false }, logger, report);

            expect(report.warnings.some((w) => w.includes(".syncpackrc.ts"))).toBe(true);
            expect(report.manualSteps.some((s) => s.includes(".syncpackrc.ts"))).toBe(true);
        });

        it("emits a manual step for each CI workflow file invoking syncpack", () => {
            expect.assertions(2);

            writeFileSync(join(tmpDir, ".syncpackrc.json"), "{}");
            mkdirSync(join(tmpDir, ".github", "workflows"), { recursive: true });
            writeFileSync(join(tmpDir, ".github", "workflows", "ci.yml"), "jobs:\n  lint:\n    steps:\n      - run: pnpm syncpack lint\n");
            writeFileSync(join(tmpDir, ".gitlab-ci.yml"), "lint:\n  script:\n    - npx syncpack lint\n");

            const report = createMigrationReport();

            migrateSyncpack(tmpDir, { dryRun: true }, createMockLogger(), report);

            expect(report.manualSteps.some((s) => s.includes(".github/workflows/ci.yml"))).toBe(true);
            expect(report.manualSteps.some((s) => s.includes(".gitlab-ci.yml"))).toBe(true);
        });

        it("strips syncpack from pnpm-workspace.yaml catalog and named catalogs", () => {
            expect.assertions(3);

            writeFileSync(join(tmpDir, ".syncpackrc.json"), "{}");
            writeFileSync(
                join(tmpDir, "pnpm-workspace.yaml"),
                "packages:\n  - 'packages/*'\ncatalog:\n  syncpack: ^12.0.0\n  typescript: ^5.0.0\ncatalogs:\n  lint:\n    syncpack: ^12.0.0\n    eslint: ^9.0.0\n",
            );

            const report = createMigrationReport();

            migrateSyncpack(tmpDir, { dryRun: false }, createMockLogger(), report);

            const yamlContent = readFileSync(join(tmpDir, "pnpm-workspace.yaml"), "utf8");

            expect(yamlContent).not.toContain("syncpack:");
            expect(yamlContent).toContain("typescript:");
            expect(yamlContent).toContain("eslint:");
        });

        it("strips syncpack from bun's package.json#workspaces.catalog", () => {
            expect.assertions(2);

            writeFileSync(join(tmpDir, ".syncpackrc.json"), "{}");
            writeFileSync(
                join(tmpDir, "package.json"),
                JSON.stringify({
                    workspaces: {
                        catalog: { syncpack: "^12.0.0", typescript: "^5.0.0" },
                        packages: ["packages/*"],
                    },
                }),
            );

            const report = createMigrationReport();

            migrateSyncpack(tmpDir, { dryRun: false }, createMockLogger(), report);

            const pkg = JSON.parse(readFileSync(join(tmpDir, "package.json"), "utf8")) as {
                workspaces?: { catalog?: Record<string, string> };
            };

            expect(pkg.workspaces?.catalog?.syncpack).toBeUndefined();
            expect(pkg.workspaces?.catalog?.typescript).toBe("^5.0.0");
        });

        it("emits a manual step for each hook file invoking syncpack", () => {
            expect.assertions(3);

            writeFileSync(join(tmpDir, ".syncpackrc.json"), "{}");
            mkdirSync(join(tmpDir, ".husky"), { recursive: true });
            writeFileSync(join(tmpDir, ".husky", "pre-commit"), "#!/bin/sh\nsyncpack lint\n");

            const report = createMigrationReport();
            const logger = createMockLogger();

            migrateSyncpack(tmpDir, { dryRun: false }, logger, report);

            expect(report.manualSteps.some((s) => s.includes(".husky/pre-commit"))).toBe(true);
            // Hook file is NOT auto-rewritten — replacement is subcommand-specific.
            expect(readFileSync(join(tmpDir, ".husky", "pre-commit"), "utf8")).toContain("syncpack lint");
            expect(logger.warnMessages.some((m) => m.includes("hook file"))).toBe(true);
        });

        it("reads the embedded syncpack block from package.json", () => {
            expect.assertions(2);

            writeFileSync(
                join(tmpDir, "package.json"),
                JSON.stringify({
                    devDependencies: { syncpack: "^12.0.0" },
                    syncpack: { customTypes: { ciNode: { path: "ci.node", strategy: "versionsByName" } } },
                }),
            );

            const report = createMigrationReport();

            migrateSyncpack(tmpDir, { dryRun: false }, createMockLogger(), report);

            const pkg = JSON.parse(readFileSync(join(tmpDir, "package.json"), "utf8")) as {
                devDependencies?: Record<string, string>;
                syncpack?: unknown;
            };

            expect(pkg.syncpack).toBeUndefined();
            expect(pkg.devDependencies?.syncpack).toBeUndefined();
        });

        it("preserves the full text of removed syncpack scripts via manual steps", () => {
            expect.assertions(3);

            writeFileSync(
                join(tmpDir, "package.json"),
                JSON.stringify({
                    devDependencies: { syncpack: "^12.0.0" },
                    scripts: {
                        // Mixed command — the eslint half would silently disappear without a manual step.
                        check: "syncpack lint && eslint .",
                        "deps:fix": "syncpack fix-mismatches",
                    },
                    syncpack: {},
                }),
            );

            const report = createMigrationReport();

            migrateSyncpack(tmpDir, { dryRun: false }, createMockLogger(), report);

            expect(report.manualSteps.some((s) => s.includes("check") && s.includes("syncpack lint && eslint ."))).toBe(true);
            expect(report.manualSteps.some((s) => s.includes("deps:fix") && s.includes("syncpack fix-mismatches"))).toBe(true);

            const pkg = JSON.parse(readFileSync(join(tmpDir, "package.json"), "utf8")) as { scripts?: Record<string, string> };

            expect(pkg.scripts).toBeUndefined();
        });

        it("notes that syncpack `indent` is implicit because vis honors editorconfig", () => {
            expect.assertions(1);

            writeFileSync(join(tmpDir, ".syncpackrc.json"), JSON.stringify({ indent: "    " }));

            const report = createMigrationReport();

            migrateSyncpack(tmpDir, { dryRun: true }, createMockLogger(), report);

            expect(report.warnings.some((w) => w.includes("indent") && w.includes("editorconfig"))).toBe(true);
        });
    });

    describe(translateBannedDeps, () => {
        it("returns an empty record when no versionGroups have isBanned", () => {
            expect.assertions(1);

            const report = createMigrationReport();

            expect(translateBannedDeps({ versionGroups: [{ packages: ["**"] }] }, report)).toStrictEqual({});
        });

        it("translates a banned versionGroup with packages scope into a scoped bannedDep entry", () => {
            expect.assertions(2);

            const report = createMigrationReport();
            const result = translateBannedDeps(
                {
                    versionGroups: [
                        { dependencies: ["react", "react-dom"], isBanned: true, label: "no react in legacy app", packages: ["@app/legacy"] },
                    ],
                },
                report,
            );

            expect(result["react"]).toStrictEqual({ packages: ["@app/legacy"], reason: "no react in legacy app" });
            expect(result["react-dom"]).toStrictEqual({ packages: ["@app/legacy"], reason: "no react in legacy app" });
        });

        it("uses the string form when no packages scope is set", () => {
            expect.assertions(1);

            const report = createMigrationReport();
            const result = translateBannedDeps(
                { versionGroups: [{ dependencies: ["request"], isBanned: true, label: "deprecated" }] },
                report,
            );

            expect(result["request"]).toBe("deprecated");
        });

        it("falls back to a default reason when no label is provided", () => {
            expect.assertions(1);

            const report = createMigrationReport();
            const result = translateBannedDeps(
                { versionGroups: [{ dependencies: ["lodash.foo"], isBanned: true }] },
                report,
            );

            expect(result["lodash.foo"]).toBe("banned via syncpack versionGroups");
        });

        it("warns when a banned versionGroup has no dependencies", () => {
            expect.assertions(2);

            const report = createMigrationReport();
            const result = translateBannedDeps(
                { versionGroups: [{ isBanned: true, label: "blanket ban" }] },
                report,
            );

            expect(result).toStrictEqual({});
            expect(report.warnings.some((w) => w.includes("isBanned") && w.includes("dependencies"))).toBe(true);
        });

        it("warns and keeps the first match when two banned versionGroups target the same dep", () => {
            expect.assertions(3);

            const report = createMigrationReport();
            const result = translateBannedDeps(
                {
                    versionGroups: [
                        { dependencies: ["request"], isBanned: true, label: "first reason" },
                        { dependencies: ["request"], isBanned: true, label: "second reason" },
                    ],
                },
                report,
            );

            expect(result["request"]).toBe("first reason");
            expect(report.warnings.some((w) => w.includes("Multiple banned versionGroups"))).toBe(true);
            expect(report.warnings.some((w) => w.includes("\"request\""))).toBe(true);
        });
    });

    describe("end-to-end bannedDeps translation", () => {
        it("emits policy.bannedDeps in the generated vis.config.ts and skips the manual step for that group", () => {
            expect.assertions(5);

            writeFileSync(
                join(tmpDir, "package.json"),
                JSON.stringify({ devDependencies: { syncpack: "^12.0.0" } }),
            );
            writeFileSync(
                join(tmpDir, ".syncpackrc.json"),
                JSON.stringify({
                    versionGroups: [
                        { dependencies: ["react", "react-dom"], isBanned: true, label: "no react in legacy app", packages: ["@app/legacy"] },
                        // This one has no isBanned — it should still trigger the manual step for the remainder.
                        { dependencies: ["lodash"], pinVersion: "4.17.21" },
                    ],
                }),
            );

            const report = createMigrationReport();

            migrateSyncpack(tmpDir, { dryRun: false }, createMockLogger(), report);

            const visConfig = readFileSync(join(tmpDir, "vis.config.ts"), "utf8");

            expect(visConfig).toContain("bannedDeps:");
            expect(visConfig).toContain("\"react\": { reason: \"no react in legacy app\", packages: [\"@app/legacy\"] }");
            expect(visConfig).toContain("\"react-dom\": { reason: \"no react in legacy app\", packages: [\"@app/legacy\"] }");
            // The manual step still fires for the remaining (non-isBanned) versionGroup entry.
            expect(report.manualSteps.some((s) => s.includes("versionGroups"))).toBe(true);
            // But not for the isBanned half — that translation succeeded.
            expect(report.manualSteps.filter((s) => s.includes("versionGroups"))).toHaveLength(1);
        });

        it("does not emit a versionGroups manual step when every versionGroup is isBanned", () => {
            expect.assertions(2);

            writeFileSync(join(tmpDir, "package.json"), "{}");
            writeFileSync(
                join(tmpDir, ".syncpackrc.json"),
                JSON.stringify({
                    versionGroups: [
                        { dependencies: ["request"], isBanned: true, label: "deprecated" },
                    ],
                }),
            );

            const report = createMigrationReport();

            migrateSyncpack(tmpDir, { dryRun: false }, createMockLogger(), report);

            const visConfig = readFileSync(join(tmpDir, "vis.config.ts"), "utf8");

            expect(visConfig).toContain("\"request\": \"deprecated\"");
            expect(report.manualSteps.some((s) => s.includes("versionGroups"))).toBe(false);
        });
    });
});
