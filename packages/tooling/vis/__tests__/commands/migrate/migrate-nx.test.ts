import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

import { join } from "@visulima/path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
    applyAggressiveCleanupForTesting,
    applyPnpmFilterScriptRewritesForTesting,
    discoverPackageToProjectMapForTesting,
    ensurePersistentTargetDefaultsForTesting,
    findProjectJsonFilesForTesting,
    isNxRunScriptShimForTesting,
    migrateNx,
    parsePnpmFilterCommandForTesting,
    rewriteNxScriptForTesting,
} from "../../../src/commands/migrate/nx";
import { createMigrationReport } from "../../../src/commands/migrate/types";
import { cleanupTemporaryDirectory, createMockLogger, createTemporaryDirectory } from "../../test-helpers";

const writeJson = (path: string, data: unknown): void => {
    writeFileSync(path, `${JSON.stringify(data, undefined, 2)}\n`, "utf8");
};

describe("migrate-nx", () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = createTemporaryDirectory("vis-migrate-nx-");
    });

    afterEach(() => {
        cleanupTemporaryDirectory(tmpDir);
    });

    describe(migrateNx, () => {
        it("should warn and skip when no nx.json exists", () => {
            expect.assertions(1);

            const report = createMigrationReport();

            migrateNx(tmpDir, {}, createMockLogger(), report);

            expect(report.warnings).toContain("No nx.json at workspace root.");
        });

        it("should generate vis.config.ts from nx.json", () => {
            expect.assertions(3);

            writeJson(join(tmpDir, "nx.json"), {
                namedInputs: { production: ["src/**"] },
                targetDefaults: { build: { cache: true, outputs: ["dist/**"] } },
            });

            const report = createMigrationReport();

            migrateNx(tmpDir, {}, createMockLogger(), report);

            const configPath = join(tmpDir, "vis.config.ts");

            expect(existsSync(configPath)).toBe(true);

            const content = readFileSync(configPath, "utf8");

            expect(content).toContain("namedInputs");
            expect(content).toContain("tasks");
        });

        it("translates nx.defaultBase into vis.config.ts#defaultBase when it differs from main", () => {
            expect.assertions(3);

            writeJson(join(tmpDir, "nx.json"), { defaultBase: "develop" });

            const report = createMigrationReport();

            migrateNx(tmpDir, {}, createMockLogger(), report);

            const content = readFileSync(join(tmpDir, "vis.config.ts"), "utf8");

            expect(content).toContain("defaultBase");
            expect(content).toContain("develop");
            expect(report.manualSteps.find((s) => s.includes("default base branch"))).toBeUndefined();
        });

        it("translates nx.affected.defaultBase (preferred over nx.defaultBase) into vis.config.ts#defaultBase", () => {
            expect.assertions(2);

            writeJson(join(tmpDir, "nx.json"), { affected: { defaultBase: "trunk" }, defaultBase: "develop" });

            const report = createMigrationReport();

            migrateNx(tmpDir, {}, createMockLogger(), report);

            const content = readFileSync(join(tmpDir, "vis.config.ts"), "utf8");

            expect(content).toContain("trunk");
            expect(content).not.toContain("develop");
        });

        it("omits defaultBase from vis.config.ts when nx already uses main", () => {
            expect.assertions(1);

            writeJson(join(tmpDir, "nx.json"), { defaultBase: "main" });

            const report = createMigrationReport();

            migrateNx(tmpDir, {}, createMockLogger(), report);

            const content = readFileSync(join(tmpDir, "vis.config.ts"), "utf8");

            expect(content).not.toContain("defaultBase");
        });

        it("translates namespaced executor keys into their hint targets and keeps explicit entries on conflict", () => {
            expect.assertions(6);

            writeJson(join(tmpDir, "nx.json"), {
                targetDefaults: {
                    "@nx/eslint:lint": { cache: true, inputs: ["{projectRoot}/**/*.ts"] },
                    "@nx/js:tsc": { cache: true, dependsOn: ["^build"] },
                    build: { cache: true },
                    "some-plugin:weird": { cache: false },
                },
            });

            const report = createMigrationReport();

            migrateNx(tmpDir, {}, createMockLogger(), report);

            const content = readFileSync(join(tmpDir, "vis.config.ts"), "utf8");

            // Explicit `build` entry preserved.
            expect(content).toContain("build:");
            // Namespaced keys do not appear in the output.
            expect(content).not.toContain("@nx/js:tsc");
            expect(content).not.toContain("@nx/eslint:lint");
            // `@nx/eslint:lint` → `lint:eslint` carries cache+inputs.
            expect(content).toMatch(/"lint:eslint"|lint:eslint:/u);
            // `@nx/js:tsc` collides with explicit `build` → dropped with warning.
            const conflictWarning = report.warnings.find((w) => w.includes("@nx/js:tsc") && w.includes("explicit"));

            expect(conflictWarning).toBeDefined();
            // Unknown executor with no hint → dropped with warning.
            const unknownWarning = report.warnings.find((w) => w.includes("some-plugin:weird"));

            expect(unknownWarning).toBeDefined();
        });

        it("strips shim entries from a mixed targets block but keeps the non-shim entries", () => {
            expect.assertions(4);

            writeJson(join(tmpDir, "nx.json"), {});
            mkdirSync(join(tmpDir, "apps", "web"), { recursive: true });

            writeJson(join(tmpDir, "apps", "web", "project.json"), {
                name: "web",
                targets: {
                    build: { executor: "nx:run-script", options: { script: "build" } },
                    "custom-gen": {
                        executor: "@nx/devkit:run-generator",
                        options: { name: "tools:custom" },
                    },
                    test: { executor: "nx:run-script" },
                },
            });

            const report = createMigrationReport();

            migrateNx(tmpDir, {}, createMockLogger(), report);

            const updated = JSON.parse(readFileSync(join(tmpDir, "apps", "web", "project.json"), "utf8")) as {
                targets?: Record<string, unknown>;
            };

            // Shim entries gone.
            expect(updated.targets?.build).toBeUndefined();
            expect(updated.targets?.test).toBeUndefined();
            // Non-shim entry kept.
            expect(updated.targets?.["custom-gen"]).toBeDefined();
            // Non-shim entry surfaced on the punch list.
            expect(report.manualSteps.some((s) => s.includes("non-shim targets") && s.includes("custom-gen"))).toBe(true);
        });

        it("rewrites $schema in project.json files to point at vis", () => {
            expect.assertions(3);

            writeJson(join(tmpDir, "nx.json"), {});
            mkdirSync(join(tmpDir, "apps", "web"), { recursive: true });
            mkdirSync(join(tmpDir, "packages", "lib"), { recursive: true });

            writeJson(join(tmpDir, "apps", "web", "project.json"), {
                $schema: "../../node_modules/nx/schemas/project-schema.json",
                name: "web",
            });
            writeJson(join(tmpDir, "packages", "lib", "project.json"), {
                $schema: "../../node_modules/nx/schemas/project-schema.json",
                name: "lib",
            });

            const report = createMigrationReport();

            migrateNx(tmpDir, {}, createMockLogger(), report);

            const webContent = JSON.parse(readFileSync(join(tmpDir, "apps", "web", "project.json"), "utf8")) as { $schema?: string };
            const libContent = JSON.parse(readFileSync(join(tmpDir, "packages", "lib", "project.json"), "utf8")) as { $schema?: string };

            expect(webContent.$schema).toBe("../../node_modules/@visulima/vis/schemas/project.schema.json");
            expect(libContent.$schema).toBe("../../node_modules/@visulima/vis/schemas/project.schema.json");
            // Backups are taken alongside the original.
            expect(report.backupsCreated).toHaveLength(2);
        });

        it("removes the targets block when every entry is an nx:run-script shim", () => {
            expect.assertions(2);

            writeJson(join(tmpDir, "nx.json"), {});
            mkdirSync(join(tmpDir, "apps", "web"), { recursive: true });

            writeJson(join(tmpDir, "apps", "web", "project.json"), {
                name: "web",
                targets: {
                    build: { executor: "nx:run-script", options: { script: "build" } },
                    test: { executor: "nx:run-script" },
                },
            });

            const report = createMigrationReport();

            migrateNx(tmpDir, {}, createMockLogger(), report);

            const updated = JSON.parse(readFileSync(join(tmpDir, "apps", "web", "project.json"), "utf8")) as { targets?: unknown };

            expect(updated.targets).toBeUndefined();
            expect(report.backupsCreated.some((b) => b.endsWith("project.json.bak"))).toBe(true);
        });

        it("keeps non-shim targets and surfaces them in manualSteps for review", () => {
            expect.assertions(2);

            writeJson(join(tmpDir, "nx.json"), {});
            mkdirSync(join(tmpDir, "tools", "tailwind-sync-plugin"), { recursive: true });

            writeJson(join(tmpDir, "tools", "tailwind-sync-plugin", "project.json"), {
                name: "tailwind-sync-plugin",
                targets: {
                    "update-tailwind-globs": {
                        executor: "@nx/devkit:run-generator",
                        options: { name: "tailwind-sync-plugin:update-tailwind-globs" },
                    },
                },
            });

            const report = createMigrationReport();

            migrateNx(tmpDir, {}, createMockLogger(), report);

            const updated = JSON.parse(readFileSync(join(tmpDir, "tools", "tailwind-sync-plugin", "project.json"), "utf8")) as { targets?: unknown };

            expect(updated.targets).toBeDefined();
            expect(report.manualSteps.some((s) => s.includes("non-shim targets") && s.includes("update-tailwind-globs"))).toBe(true);
        });

        it("warns when project.json declares syncGenerators and does not silently drop them", () => {
            expect.assertions(2);

            writeJson(join(tmpDir, "nx.json"), {});
            mkdirSync(join(tmpDir, "apps", "web"), { recursive: true });

            writeJson(join(tmpDir, "apps", "web", "project.json"), {
                name: "web",
                targets: {
                    build: {
                        executor: "nx:run-script",
                        options: { script: "build" },
                        syncGenerators: ["tailwind-sync-plugin:update-tailwind-globs"],
                    },
                },
            });

            const report = createMigrationReport();

            migrateNx(tmpDir, {}, createMockLogger(), report);

            const warning = report.warnings.find((w) => w.includes("syncGenerators"));

            expect(warning).toBeDefined();
            expect(warning).toContain("tailwind-sync-plugin:update-tailwind-globs");
        });

        it("with --rewrite-sync-generators, adds a `pre<target>` TODO script to sibling package.json", () => {
            expect.assertions(4);

            writeJson(join(tmpDir, "nx.json"), {});
            mkdirSync(join(tmpDir, "apps", "web"), { recursive: true });

            writeJson(join(tmpDir, "apps", "web", "project.json"), {
                name: "web",
                targets: {
                    build: {
                        executor: "nx:run-script",
                        options: { script: "build" },
                        syncGenerators: ["tailwind-sync-plugin:update-tailwind-globs"],
                    },
                },
            });
            writeJson(join(tmpDir, "apps", "web", "package.json"), { name: "@app/web", scripts: { build: "vite build" } });

            const report = createMigrationReport();

            migrateNx(tmpDir, { rewriteSyncGenerators: true }, createMockLogger(), report);

            const pkg = JSON.parse(readFileSync(join(tmpDir, "apps", "web", "package.json"), "utf8")) as {
                scripts?: Record<string, string>;
            };

            // pre<target> script inserted with TODO.
            expect(pkg.scripts?.prebuild).toContain("TODO(vis)");
            expect(pkg.scripts?.prebuild).toContain("tailwind-sync-plugin:update-tailwind-globs");
            // Existing build script preserved.
            expect(pkg.scripts?.build).toBe("vite build");
            // Manual step naming the inserted script.
            expect(report.manualSteps.some((s) => s.includes("prebuild") && s.includes("tailwind-sync-plugin:update-tailwind-globs"))).toBe(true);
        });

        it("with --rewrite-sync-generators, falls back to a warning when there is no sibling package.json", () => {
            expect.assertions(2);

            writeJson(join(tmpDir, "nx.json"), {});
            mkdirSync(join(tmpDir, "apps", "web"), { recursive: true });

            writeJson(join(tmpDir, "apps", "web", "project.json"), {
                name: "web",
                targets: {
                    build: {
                        executor: "nx:run-script",
                        options: { script: "build" },
                        syncGenerators: ["tailwind-sync-plugin:update-tailwind-globs"],
                    },
                },
            });

            const report = createMigrationReport();

            migrateNx(tmpDir, { rewriteSyncGenerators: true }, createMockLogger(), report);

            const warning = report.warnings.find((w) => w.includes("syncGenerators") && w.includes("not auto-rewritten"));

            expect(warning).toBeDefined();
            expect(warning).toContain("no sibling package.json");
        });

        it("with --rewrite-sync-generators, refuses to clobber an existing pre<target> script", () => {
            expect.assertions(3);

            writeJson(join(tmpDir, "nx.json"), {});
            mkdirSync(join(tmpDir, "apps", "web"), { recursive: true });

            writeJson(join(tmpDir, "apps", "web", "project.json"), {
                name: "web",
                targets: {
                    build: {
                        executor: "nx:run-script",
                        options: { script: "build" },
                        syncGenerators: ["tailwind-sync-plugin:update-tailwind-globs"],
                    },
                },
            });
            writeJson(join(tmpDir, "apps", "web", "package.json"), {
                name: "@app/web",
                scripts: { build: "vite build", prebuild: "existing-prebuild-step" },
            });

            const report = createMigrationReport();

            migrateNx(tmpDir, { rewriteSyncGenerators: true }, createMockLogger(), report);

            const pkg = JSON.parse(readFileSync(join(tmpDir, "apps", "web", "package.json"), "utf8")) as {
                scripts?: Record<string, string>;
            };

            // Existing prebuild script is preserved verbatim.
            expect(pkg.scripts?.prebuild).toBe("existing-prebuild-step");

            const warning = report.warnings.find((w) => w.includes("syncGenerators") && w.includes("not auto-rewritten"));

            expect(warning).toBeDefined();
            expect(warning).toContain("already exists");
        });

        it("removes nx and @nx/* entries from pnpm-workspace.yaml catalogs and onlyBuiltDependencies", () => {
            expect.assertions(4);

            writeJson(join(tmpDir, "nx.json"), {});
            writeFileSync(
                join(tmpDir, "pnpm-workspace.yaml"),
                [
                    "packages:",
                    "  - 'packages/*'",
                    "onlyBuiltDependencies:",
                    "  - nx",
                    "  - esbuild",
                    "catalogs:",
                    "  monorepo:",
                    "    '@nx/devkit': 22.7.1",
                    "    typescript: 5.9.0",
                    "",
                ].join("\n"),
            );

            const report = createMigrationReport();

            migrateNx(tmpDir, {}, createMockLogger(), report);

            const updated = readFileSync(join(tmpDir, "pnpm-workspace.yaml"), "utf8");

            expect(updated).not.toContain("@nx/devkit");
            expect(updated).toContain("typescript:");
            expect(updated).not.toMatch(/^\s*-\s*nx\s*$/m);
            expect(updated).toContain("- esbuild");
        });

        it("does not overwrite an existing vis.config.ts without --force", () => {
            expect.assertions(3);

            writeJson(join(tmpDir, "nx.json"), { namedInputs: { production: ["src/**"] } });
            writeFileSync(join(tmpDir, "vis.config.ts"), "// pre-existing\n");

            const report = createMigrationReport();

            migrateNx(tmpDir, {}, createMockLogger(), report);

            expect(readFileSync(join(tmpDir, "vis.config.ts"), "utf8")).toBe("// pre-existing\n");
            expect(report.warnings.some((w) => w.includes("vis.config.ts already exists"))).toBe(true);
            expect(report.warnings.some((w) => w.includes("--force"))).toBe(true);
        });

        it("overwrites vis.config.ts with --force and creates a backup", () => {
            expect.assertions(3);

            writeJson(join(tmpDir, "nx.json"), { namedInputs: { production: ["src/**"] } });
            writeFileSync(join(tmpDir, "vis.config.ts"), "// pre-existing\n");

            const report = createMigrationReport();

            migrateNx(tmpDir, { force: true }, createMockLogger(), report);

            const updated = readFileSync(join(tmpDir, "vis.config.ts"), "utf8");

            expect(updated).toContain("namedInputs");
            expect(updated).not.toBe("// pre-existing\n");
            expect(report.backupsCreated.some((b) => b.endsWith("vis.config.ts.bak"))).toBe(true);
        });

        it("prints a cleanup checklist when leftovers are present", () => {
            expect.assertions(3);

            writeJson(join(tmpDir, "nx.json"), {});
            writeJson(join(tmpDir, "package.json"), {
                devDependencies: { "@nx/devkit": "22.7.1" },
                scripts: { build: "nx run-many -t build" },
            });
            mkdirSync(join(tmpDir, ".github", "workflows"), { recursive: true });
            writeFileSync(join(tmpDir, ".github", "workflows", "ci.yml"), "jobs:\n  test:\n    steps:\n      - uses: nrwl/nx-set-shas@v4\n");

            const logger = createMockLogger();
            const report = createMigrationReport();

            migrateNx(tmpDir, {}, logger, report);

            const allLogs = logger.infoMessages.join("\n");

            expect(allLogs).toContain("Post-migrate cleanup");
            expect(allLogs).toContain("@nx/devkit");
            expect(allLogs).toContain("nrwl/nx-set-shas");
        });
    });

    describe("pnpm filter script rewriting", () => {
        it("rewrites `pnpm --filter <pkg> dev` to `vis run dev --projects=<project>` and adds persistent task defaults", () => {
            expect.assertions(5);

            writeJson(join(tmpDir, "nx.json"), {});
            writeJson(join(tmpDir, "package.json"), {
                name: "root",
                scripts: {
                    dev: "pnpm --filter web dev",
                    "dev:api": "pnpm -F api dev",
                },
            });

            mkdirSync(join(tmpDir, "apps", "web"), { recursive: true });
            mkdirSync(join(tmpDir, "apps", "api"), { recursive: true });

            // pkg "web" maps to project "chat" (filter name != project name)
            writeJson(join(tmpDir, "apps", "web", "project.json"), { name: "chat" });
            writeJson(join(tmpDir, "apps", "web", "package.json"), { name: "web" });

            // pkg name == project name, both "api"
            writeJson(join(tmpDir, "apps", "api", "project.json"), { name: "api" });
            writeJson(join(tmpDir, "apps", "api", "package.json"), { name: "api" });

            const report = createMigrationReport();

            migrateNx(tmpDir, {}, createMockLogger(), report);

            const updated = JSON.parse(readFileSync(join(tmpDir, "package.json"), "utf8")) as { scripts: Record<string, string> };

            expect(updated.scripts.dev).toBe("vis run dev --projects=chat");
            expect(updated.scripts["dev:api"]).toBe("vis run dev --projects=api");

            const config = readFileSync(join(tmpDir, "vis.config.ts"), "utf8");

            // dev is recognised as long-running → persistent defaults emitted.
            expect(config).toContain("persistent: true");
            expect(config).toContain("cache: false");
            expect(report.backupsCreated.some((b) => b.endsWith("package.json.bak"))).toBe(true);
        });

        it("leaves pnpm-filter scripts alone when filters use exclusions or globs and warns", () => {
            expect.assertions(3);

            writeJson(join(tmpDir, "nx.json"), {});
            writeJson(join(tmpDir, "package.json"), {
                name: "root",
                scripts: {
                    "build:not-docs": "pnpm --filter !docs build",
                    "test:scoped": "pnpm --filter=@scope/* test",
                },
            });

            const report = createMigrationReport();

            migrateNx(tmpDir, {}, createMockLogger(), report);

            const updated = JSON.parse(readFileSync(join(tmpDir, "package.json"), "utf8")) as { scripts: Record<string, string> };

            expect(updated.scripts["build:not-docs"]).toBe("pnpm --filter !docs build");
            expect(updated.scripts["test:scoped"]).toBe("pnpm --filter=@scope/* test");
            expect(report.warnings.filter((w) => w.includes("pnpm filter in scripts."))).toHaveLength(2);
        });

        it("surfaces unmapped filter names as warnings and leaves the script untouched", () => {
            expect.assertions(2);

            writeJson(join(tmpDir, "nx.json"), {});
            writeJson(join(tmpDir, "package.json"), {
                name: "root",
                scripts: { "build:ghost": "pnpm --filter does-not-exist build" },
            });

            const report = createMigrationReport();

            migrateNx(tmpDir, {}, createMockLogger(), report);

            const updated = JSON.parse(readFileSync(join(tmpDir, "package.json"), "utf8")) as { scripts: Record<string, string> };

            expect(updated.scripts["build:ghost"]).toBe("pnpm --filter does-not-exist build");
            expect(report.warnings.some((w) => w.includes("don't match any known project") && w.includes("does-not-exist"))).toBe(true);
        });

        it("skips scripts with shell complexity (chained commands, quotes)", () => {
            expect.assertions(1);

            const cases = [
                "pnpm --filter web dev && echo done",
                "pnpm --filter web dev || true",
                "pnpm --filter \"web\" dev",
                "pnpm --filter web build > out.log",
                "pnpm --filter web dev | tee log",
                "cross-env CI=1 pnpm --filter web dev",
                "pnpm --filter web dev --port 3001",
            ];

            // None of these should produce a parseable, non-complex result that yields a target.
            const yielded = cases.filter((script) => {
                const parsed = parsePnpmFilterCommandForTesting(script);

                return parsed !== null && !parsed.complex && parsed.target !== "";
            });

            expect(yielded).toStrictEqual([]);
        });

        it("parses recursive form `pnpm -r run build` with no filters", () => {
            expect.assertions(4);

            const parsed = parsePnpmFilterCommandForTesting("pnpm -r run build");

            expect(parsed).not.toBeNull();
            expect(parsed?.recursive).toBe(true);
            expect(parsed?.filters).toStrictEqual([]);
            expect(parsed?.target).toBe("build");
        });

        it("rewrites recursive form `pnpm -r run build` to `vis run build` (no --projects filter)", () => {
            expect.assertions(1);

            writeJson(join(tmpDir, "nx.json"), {});
            writeJson(join(tmpDir, "package.json"), {
                name: "root",
                scripts: { build: "pnpm -r run build" },
            });

            const report = createMigrationReport();

            migrateNx(tmpDir, {}, createMockLogger(), report);

            const updated = JSON.parse(readFileSync(join(tmpDir, "package.json"), "utf8")) as { scripts: Record<string, string> };

            // Recursive (no filters) maps to all projects, which is `vis run <target>` with no --projects.
            expect(updated.scripts.build).toBe("vis run build");
        });

        it("emits comma-separated --projects= sorted alphabetically when multiple filters are given", () => {
            expect.assertions(1);

            writeJson(join(tmpDir, "nx.json"), {});
            writeJson(join(tmpDir, "package.json"), {
                name: "root",
                scripts: { dev: "pnpm --filter web --filter api dev" },
            });

            mkdirSync(join(tmpDir, "apps", "web"), { recursive: true });
            mkdirSync(join(tmpDir, "apps", "api"), { recursive: true });
            writeJson(join(tmpDir, "apps", "web", "project.json"), { name: "web" });
            writeJson(join(tmpDir, "apps", "api", "project.json"), { name: "api" });

            const report = createMigrationReport();

            migrateNx(tmpDir, {}, createMockLogger(), report);

            const updated = JSON.parse(readFileSync(join(tmpDir, "package.json"), "utf8")) as { scripts: Record<string, string> };

            expect(updated.scripts.dev).toBe("vis run dev --projects=api,web");
        });

        it("does not overwrite an existing persistent: false override in targetDefaults", () => {
            expect.assertions(2);

            const nx: Record<string, unknown> = {
                targetDefaults: {
                    build: { cache: true },
                    dev: { cache: false, persistent: true },
                },
            };

            ensurePersistentTargetDefaultsForTesting(nx, new Set(["build", "dev"]), createMigrationReport());

            const td = nx.targetDefaults as Record<string, { cache?: boolean; persistent?: boolean }>;

            // build is not in PERSISTENT_TARGET_NAMES → stays cache: true.
            expect(td.build).toStrictEqual({ cache: true });
            // dev was already persistent: true, cache: false → unchanged.
            expect(td.dev).toStrictEqual({ cache: false, persistent: true });
        });

        it("dry-run previews script rewrites without touching package.json", () => {
            expect.assertions(2);

            writeJson(join(tmpDir, "nx.json"), {});
            writeJson(join(tmpDir, "package.json"), {
                name: "root",
                scripts: { dev: "pnpm --filter web dev" },
            });
            mkdirSync(join(tmpDir, "apps", "web"), { recursive: true });
            writeJson(join(tmpDir, "apps", "web", "project.json"), { name: "web" });

            const logger = createMockLogger();
            const report = createMigrationReport();

            migrateNx(tmpDir, { dryRun: true }, logger, report);

            const updated = JSON.parse(readFileSync(join(tmpDir, "package.json"), "utf8")) as { scripts: Record<string, string> };

            expect(updated.scripts.dev).toBe("pnpm --filter web dev");
            expect(logger.infoMessages.some((m) => m.includes("Would rewrite scripts.dev"))).toBe(true);
        });

        it("discoverPackageToProjectMap maps pkg name to project name when they differ", () => {
            expect.assertions(2);

            mkdirSync(join(tmpDir, "apps", "web"), { recursive: true });
            mkdirSync(join(tmpDir, "apps", "api"), { recursive: true });

            writeJson(join(tmpDir, "apps", "web", "project.json"), { name: "chat" });
            writeJson(join(tmpDir, "apps", "web", "package.json"), { name: "@acme/web" });
            writeJson(join(tmpDir, "apps", "api", "project.json"), { name: "api" });

            const map = discoverPackageToProjectMapForTesting([join(tmpDir, "apps", "web", "project.json"), join(tmpDir, "apps", "api", "project.json")]);

            expect(map.pkgToProject.get("@acme/web")).toBe("chat");
            expect(map.knownProjects).toStrictEqual(new Set(["api", "chat"]));
        });

        it("applyPnpmFilterScriptRewrites returns rewrittenTargets for downstream consumption", () => {
            expect.assertions(3);

            writeJson(join(tmpDir, "package.json"), {
                name: "root",
                scripts: {
                    "build:web": "pnpm --filter web build",
                    "watch:web": "pnpm --filter web watch",
                },
            });
            mkdirSync(join(tmpDir, "apps", "web"), { recursive: true });
            writeJson(join(tmpDir, "apps", "web", "project.json"), { name: "web" });

            const map = discoverPackageToProjectMapForTesting([join(tmpDir, "apps", "web", "project.json")]);
            const result = applyPnpmFilterScriptRewritesForTesting(tmpDir, map, {}, createMockLogger(), createMigrationReport());

            expect(result.rewrittenTargets.has("build")).toBe(true);
            expect(result.rewrittenTargets.has("watch")).toBe(true);
            expect(result.unmappedHits).toStrictEqual([]);
        });
    });

    describe("internal helpers", () => {
        it("isNxRunScriptShim recognises shim and non-shim entries", () => {
            expect.assertions(4);

            expect(isNxRunScriptShimForTesting({ executor: "nx:run-script" })).toBe(true);
            expect(isNxRunScriptShimForTesting({ executor: "nx:run-script", options: { script: "build" } })).toBe(true);
            expect(isNxRunScriptShimForTesting({ executor: "nx:run-script", options: { env: { CI: "1" }, script: "build" } })).toBe(false);
            expect(isNxRunScriptShimForTesting({ executor: "@nx/js:tsc" })).toBe(false);
        });

        it("findProjectJsonFiles skips node_modules and dist", () => {
            expect.assertions(1);

            mkdirSync(join(tmpDir, "node_modules", "ignored"), { recursive: true });
            mkdirSync(join(tmpDir, "dist"), { recursive: true });
            mkdirSync(join(tmpDir, "apps", "web"), { recursive: true });

            writeJson(join(tmpDir, "node_modules", "ignored", "project.json"), { name: "ignored" });
            writeJson(join(tmpDir, "dist", "project.json"), { name: "dist-leak" });
            writeJson(join(tmpDir, "apps", "web", "project.json"), { name: "web" });

            const found = findProjectJsonFilesForTesting(tmpDir);

            expect(found).toStrictEqual([join(tmpDir, "apps", "web", "project.json")]);
        });
    });

    describe("--aggressive cleanup", () => {
        describe(rewriteNxScriptForTesting, () => {
            it("rewrites `nx run-many -t <target>` to `vis run <target>`", () => {
                expect.assertions(2);

                expect(rewriteNxScriptForTesting("nx run-many -t build", new Set())).toBe("vis run build");
                expect(rewriteNxScriptForTesting("nx run-many --target=test", new Set())).toBe("vis run test");
            });

            it("rewrites `nx affected -t <target>` to `vis run <target> --affected`", () => {
                expect.assertions(2);

                expect(rewriteNxScriptForTesting("nx affected -t build", new Set())).toBe("vis run build --affected");
                expect(rewriteNxScriptForTesting("nx affected --target=lint", new Set())).toBe("vis run lint --affected");
            });

            it("rewrites `nx run <project>:<target>` only when the project is known", () => {
                expect.assertions(2);

                expect(rewriteNxScriptForTesting("nx run web:build", new Set(["web"]))).toBe("vis run build --projects=web");
                // Unknown project → no rewrite (caller leaves it on the checklist).
                expect(rewriteNxScriptForTesting("nx run unknown:build", new Set(["web"]))).toBeUndefined();
            });

            it("rewrites `nx <target>` shorthand but not reserved subcommands", () => {
                expect.assertions(3);

                expect(rewriteNxScriptForTesting("nx build", new Set())).toBe("vis run build");
                expect(rewriteNxScriptForTesting("nx reset", new Set())).toBeUndefined();
                expect(rewriteNxScriptForTesting("nx repair", new Set())).toBeUndefined();
            });

            it("returns undefined for shell-complex commands", () => {
                expect.assertions(3);

                expect(rewriteNxScriptForTesting("nx run-many -t build && echo done", new Set())).toBeUndefined();
                expect(rewriteNxScriptForTesting("nx run-many -t build --parallel 4", new Set())).toBeUndefined();
                expect(rewriteNxScriptForTesting("nx run web:build --configuration=production", new Set(["web"]))).toBeUndefined();
            });
        });

        it("strips nx/@nx/*/@nrwl/* devDependencies from package.json", () => {
            expect.assertions(3);

            writeJson(join(tmpDir, "package.json"), {
                devDependencies: {
                    "@nrwl/cli": "20.0.0",
                    "@nx/devkit": "20.0.0",
                    "@nx/eslint": "20.0.0",
                    nx: "20.0.0",
                    typescript: "5.7.0",
                },
                name: "monorepo",
            });

            const report = createMigrationReport();

            const result = applyAggressiveCleanupForTesting(tmpDir, new Set(), {}, createMockLogger(), report);

            const pkg = JSON.parse(readFileSync(join(tmpDir, "package.json"), "utf8")) as {
                devDependencies?: Record<string, string>;
            };

            expect(pkg.devDependencies).toStrictEqual({ typescript: "5.7.0" });
            expect(result.strippedDevDeps.sort()).toStrictEqual(["@nrwl/cli", "@nx/devkit", "@nx/eslint", "nx"]);
            expect(report.backupsCreated.some((b) => b.endsWith("package.json.bak"))).toBe(true);
        });

        it("rewrites mechanical `nx run-many|run|affected` scripts and leaves complex ones on the checklist", () => {
            expect.assertions(4);

            writeJson(join(tmpDir, "package.json"), {
                name: "monorepo",
                scripts: {
                    affected: "nx affected -t test",
                    build: "nx run-many -t build",
                    "build:web": "nx run web:build",
                    complex: "nx run web:build --configuration=production",
                    typecheck: "tsc --noEmit",
                },
            });

            const report = createMigrationReport();

            const result = applyAggressiveCleanupForTesting(tmpDir, new Set(["web"]), {}, createMockLogger(), report);

            const pkg = JSON.parse(readFileSync(join(tmpDir, "package.json"), "utf8")) as {
                scripts?: Record<string, string>;
            };

            expect(pkg.scripts).toStrictEqual({
                affected: "vis run test --affected",
                build: "vis run build",
                "build:web": "vis run build --projects=web",
                complex: "nx run web:build --configuration=production",
                typecheck: "tsc --noEmit",
            });
            expect(result.rewrittenScripts.map((r) => r.name).sort()).toStrictEqual(["affected", "build", "build:web"]);
            expect(result.skippedScripts).toStrictEqual(["complex"]);
            expect(report.manualSteps.some((s) => s.includes("complex"))).toBe(true);
        });

        it("deletes .github/ignore-files-for-nx-affected.yml with a .bak backup", () => {
            expect.assertions(3);

            mkdirSync(join(tmpDir, ".github"), { recursive: true });
            writeFileSync(join(tmpDir, ".github", "ignore-files-for-nx-affected.yml"), "files:\n  - 'docs/**'\n", "utf8");

            const report = createMigrationReport();

            const result = applyAggressiveCleanupForTesting(tmpDir, new Set(), {}, createMockLogger(), report);

            expect(existsSync(join(tmpDir, ".github", "ignore-files-for-nx-affected.yml"))).toBe(false);
            expect(result.deletedFiles.some((f) => f.includes("ignore-files-for-nx-affected.yml"))).toBe(true);
            expect(report.backupsCreated.some((b) => b.endsWith("ignore-files-for-nx-affected.yml.bak"))).toBe(true);
        });

        it("dry-run reports changes without touching files", () => {
            expect.assertions(4);

            writeJson(join(tmpDir, "package.json"), {
                devDependencies: { nx: "20.0.0", typescript: "5.7.0" },
                name: "monorepo",
                scripts: { build: "nx run-many -t build" },
            });

            const report = createMigrationReport();

            const result = applyAggressiveCleanupForTesting(tmpDir, new Set(), { dryRun: true }, createMockLogger(), report);

            const pkg = JSON.parse(readFileSync(join(tmpDir, "package.json"), "utf8")) as {
                devDependencies?: Record<string, string>;
                scripts?: Record<string, string>;
            };

            // File untouched.
            expect(pkg.devDependencies?.nx).toBe("20.0.0");
            expect(pkg.scripts?.build).toBe("nx run-many -t build");
            // But the result still describes what *would* change.
            expect(result.strippedDevDeps).toContain("nx");
            expect(result.rewrittenScripts.map((r) => r.name)).toContain("build");
        });

        it("end-to-end: --aggressive removes nx.json, ignore file, devDeps, and rewrites scripts in one pass", () => {
            expect.assertions(5);

            writeJson(join(tmpDir, "nx.json"), {});
            mkdirSync(join(tmpDir, ".github"), { recursive: true });
            writeFileSync(join(tmpDir, ".github", "ignore-files-for-nx-affected.yml"), "files: []\n", "utf8");
            writeJson(join(tmpDir, "package.json"), {
                devDependencies: { "@nx/devkit": "20.0.0", nx: "20.0.0" },
                name: "monorepo",
                scripts: { build: "nx run-many -t build" },
            });

            const report = createMigrationReport();

            migrateNx(tmpDir, { aggressive: true }, createMockLogger(), report);

            const pkg = JSON.parse(readFileSync(join(tmpDir, "package.json"), "utf8")) as {
                devDependencies?: Record<string, string>;
                scripts?: Record<string, string>;
            };

            expect(existsSync(join(tmpDir, "nx.json"))).toBe(false);
            expect(existsSync(join(tmpDir, ".github", "ignore-files-for-nx-affected.yml"))).toBe(false);
            expect(pkg.devDependencies).toStrictEqual({});
            expect(pkg.scripts).toStrictEqual({ build: "vis run build" });
            // Backups taken for everything mutated.
            expect(report.backupsCreated.length).toBeGreaterThanOrEqual(3);
        });
    });
});
