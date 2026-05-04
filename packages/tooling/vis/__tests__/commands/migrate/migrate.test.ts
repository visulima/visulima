import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { LINT_STAGED_ALL_CONFIG_FILES, LINT_STAGED_JSON_CONFIG_FILES, REPLACED_PACKAGES, STALE_LINT_STAGED_PATTERNS } from "../../../src/commands/migrate/constants";
import { migrateDeps, rewritePackageJson, rewriteScripts, updatePnpmWorkspaceCatalog } from "../../../src/commands/migrate/deps";
import { editJsonFile, isJsonFile, readJsonFile } from "../../../src/commands/migrate/json";
import {
    detectLintStagedConfig,
    extractLintStagedFromPackageJson,
    generateStagedConfigSnippet,
    hasStagedConfigInVisConfig,
    hasStandaloneLintStagedConfig,
    hasUnsupportedLintStagedConfig,
    insertStagedIntoVisConfig,
    migrateLintStaged,
    parseLintStagedJsonFile,
    removeLintStagedConfigFiles,
    removeLintStagedFromPackageJson,
    rewritePreCommitHook,
} from "../../../src/commands/migrate/lint-staged";
import { addManualStep, addMigrationWarning, createMigrationReport } from "../../../src/commands/migrate/types";

// ─── Helpers ────────────────────────────────────────────────────────

const createTemporaryDirectory = (): { cleanup: () => void; root: string } => {
    const root = mkdtempSync(join(tmpdir(), "vis-migrate-test-"));

    return {
        cleanup: () => {
            rmSync(root, { force: true, recursive: true });
        },
        root,
    };
};

const createLogger = (): { info: (message: string) => void; messages: string[]; warn: (message: string) => void; warnings: string[] } => {
    const messages: string[] = [];
    const warnings: string[] = [];

    return {
        info: (message: string) => messages.push(message),
        messages,
        warn: (message: string) => warnings.push(message),
        warnings,
    };
};

// ─── MigrationReport (unit) ────────────────────────────────────────

describe("migrationReport", () => {
    it("should create empty report", () => {
        expect.assertions(8);

        const report = createMigrationReport();

        expect(report.mergedStagedConfigCount).toBe(0);
        expect(report.inlinedLintStagedConfigCount).toBe(0);
        expect(report.removedConfigCount).toBe(0);
        expect(report.removedPackageCount).toBe(0);
        expect(report.rewrittenScriptCount).toBe(0);
        expect(report.gitHooksConfigured).toBe(false);
        expect(report.warnings).toHaveLength(0);
        expect(report.manualSteps).toHaveLength(0);
    });

    it("should not add duplicate warnings", () => {
        expect.assertions(1);

        const report = createMigrationReport();

        addMigrationWarning(report, "test warning");
        addMigrationWarning(report, "test warning");

        expect(report.warnings).toHaveLength(1);
    });

    it("should not add duplicate manual steps", () => {
        expect.assertions(1);

        const report = createMigrationReport();

        addManualStep(report, "test step");
        addManualStep(report, "test step");

        expect(report.manualSteps).toHaveLength(1);
    });

    it("should handle undefined report", () => {
        expect.assertions(1);

        addMigrationWarning(undefined, "test");
        addManualStep(undefined, "test");

        expect(true).toBe(true);
    });
});

// ─── JSON utilities (unit) ─────────────────────────────────────────

describe("json utilities", () => {
    let temporary: { cleanup: () => void; root: string };

    beforeEach(() => {
        temporary = createTemporaryDirectory();
    });

    afterEach(() => {
        temporary.cleanup();
    });

    it("readJsonFile should parse valid JSON", () => {
        expect.assertions(1);

        const filePath = join(temporary.root, "test.json");

        writeFileSync(filePath, '{"key": "value"}');

        expect(readJsonFile(filePath)).toStrictEqual({ key: "value" });
    });

    it("readJsonFile should return undefined for non-existent file", () => {
        expect.assertions(1);

        expect(readJsonFile(join(temporary.root, "missing.json"))).toBeUndefined();
    });

    it("isJsonFile should return true for valid JSON", () => {
        expect.assertions(1);

        const filePath = join(temporary.root, "test.json");

        writeFileSync(filePath, '{"key": "value"}');

        expect(isJsonFile(filePath)).toBe(true);
    });

    it("isJsonFile should return false for non-JSON", () => {
        expect.assertions(1);

        const filePath = join(temporary.root, "test.yaml");

        writeFileSync(filePath, "key: value");

        expect(isJsonFile(filePath)).toBe(false);
    });

    it("isJsonFile should return false for missing file", () => {
        expect.assertions(1);

        expect(isJsonFile(join(temporary.root, "missing.json"))).toBe(false);
    });

    it("editJsonFile should modify and write back", () => {
        expect.assertions(1);

        const filePath = join(temporary.root, "test.json");

        writeFileSync(filePath, '{"count": 1}');

        editJsonFile<{ count: number }>(filePath, (data) => {
            return { count: data.count + 1 };
        });

        const result = JSON.parse(readFileSync(filePath, "utf8"));

        expect(result.count).toBe(2);
    });

    it("editJsonFile should skip when mutator returns undefined", () => {
        expect.assertions(1);

        const filePath = join(temporary.root, "test.json");

        writeFileSync(filePath, '{"count": 1}');

        editJsonFile<{ count: number }>(filePath, () => undefined);

        const result = JSON.parse(readFileSync(filePath, "utf8"));

        expect(result.count).toBe(1);
    });
});

// ─── detectLintStagedConfig (unit) ─────────────────────────────────

describe(detectLintStagedConfig, () => {
    let temporary: { cleanup: () => void; root: string };

    beforeEach(() => {
        temporary = createTemporaryDirectory();
    });

    afterEach(() => {
        temporary.cleanup();
    });

    it("should detect lint-staged in package.json", () => {
        expect.assertions(1);

        writeFileSync(join(temporary.root, "package.json"), JSON.stringify({ "lint-staged": { "*.ts": "eslint" } }));

        expect(detectLintStagedConfig(temporary.root)).toBe("package.json");
    });

    it("should detect .lintstagedrc.json", () => {
        expect.assertions(1);

        writeFileSync(join(temporary.root, "package.json"), JSON.stringify({}));
        writeFileSync(join(temporary.root, ".lintstagedrc.json"), JSON.stringify({ "*.ts": "eslint" }));

        expect(detectLintStagedConfig(temporary.root)).toBe(".lintstagedrc.json");
    });

    it("should detect .lintstagedrc", () => {
        expect.assertions(1);

        writeFileSync(join(temporary.root, "package.json"), JSON.stringify({}));
        writeFileSync(join(temporary.root, ".lintstagedrc"), JSON.stringify({ "*.ts": "eslint" }));

        expect(detectLintStagedConfig(temporary.root)).toBe(".lintstagedrc");
    });

    it("should return undefined when no config found", () => {
        expect.assertions(1);

        writeFileSync(join(temporary.root, "package.json"), JSON.stringify({}));

        expect(detectLintStagedConfig(temporary.root)).toBeUndefined();
    });

    it("should prefer package.json over standalone files", () => {
        expect.assertions(1);

        writeFileSync(join(temporary.root, "package.json"), JSON.stringify({ "lint-staged": { "*.ts": "eslint" } }));
        writeFileSync(join(temporary.root, ".lintstagedrc.json"), JSON.stringify({ "*.js": "prettier" }));

        expect(detectLintStagedConfig(temporary.root)).toBe("package.json");
    });
});

// ─── hasStandaloneLintStagedConfig (unit) ──────────────────────────

describe(hasStandaloneLintStagedConfig, () => {
    let temporary: { cleanup: () => void; root: string };

    beforeEach(() => {
        temporary = createTemporaryDirectory();
    });

    afterEach(() => {
        temporary.cleanup();
    });

    it("should return true for .lintstagedrc.json", () => {
        expect.assertions(1);

        writeFileSync(join(temporary.root, ".lintstagedrc.json"), "{}");

        expect(hasStandaloneLintStagedConfig(temporary.root)).toBe(true);
    });

    it("should return true for lint-staged.config.mjs", () => {
        expect.assertions(1);

        writeFileSync(join(temporary.root, "lint-staged.config.mjs"), "export default {}");

        expect(hasStandaloneLintStagedConfig(temporary.root)).toBe(true);
    });

    it("should return false when none exist", () => {
        expect.assertions(1);

        expect(hasStandaloneLintStagedConfig(temporary.root)).toBe(false);
    });
});

// ─── hasUnsupportedLintStagedConfig (unit) ─────────────────────────

describe(hasUnsupportedLintStagedConfig, () => {
    let temporary: { cleanup: () => void; root: string };

    beforeEach(() => {
        temporary = createTemporaryDirectory();
    });

    afterEach(() => {
        temporary.cleanup();
    });

    it("should return true for .lintstagedrc.mjs", () => {
        expect.assertions(1);

        writeFileSync(join(temporary.root, ".lintstagedrc.mjs"), "export default {}");

        expect(hasUnsupportedLintStagedConfig(temporary.root)).toBe(true);
    });

    it("should return true for non-JSON .lintstagedrc", () => {
        expect.assertions(1);

        writeFileSync(join(temporary.root, ".lintstagedrc"), "key: value");

        expect(hasUnsupportedLintStagedConfig(temporary.root)).toBe(true);
    });

    it("should return false for JSON .lintstagedrc", () => {
        expect.assertions(1);

        writeFileSync(join(temporary.root, ".lintstagedrc"), '{"*.ts": "eslint"}');

        expect(hasUnsupportedLintStagedConfig(temporary.root)).toBe(false);
    });

    it("should return false when no config files exist", () => {
        expect.assertions(1);

        expect(hasUnsupportedLintStagedConfig(temporary.root)).toBe(false);
    });
});

// ─── hasStagedConfigInVisConfig (unit) ─────────────────────────────

describe(hasStagedConfigInVisConfig, () => {
    let temporary: { cleanup: () => void; root: string };

    beforeEach(() => {
        temporary = createTemporaryDirectory();
    });

    afterEach(() => {
        temporary.cleanup();
    });

    it("should return true when vis.config.ts has staged", () => {
        expect.assertions(1);

        writeFileSync(join(temporary.root, "vis.config.ts"), 'export default defineConfig({ staged: { "*.ts": "eslint" } });');

        expect(hasStagedConfigInVisConfig(temporary.root)).toBe(true);
    });

    it("should return false when vis.config.ts has no staged", () => {
        expect.assertions(1);

        writeFileSync(join(temporary.root, "vis.config.ts"), "export default defineConfig({ update: {} });");

        expect(hasStagedConfigInVisConfig(temporary.root)).toBe(false);
    });

    it("should return false when no config file exists", () => {
        expect.assertions(1);

        expect(hasStagedConfigInVisConfig(temporary.root)).toBe(false);
    });
});

// ─── extractLintStagedFromPackageJson (unit) ───────────────────────

describe(extractLintStagedFromPackageJson, () => {
    let temporary: { cleanup: () => void; root: string };

    beforeEach(() => {
        temporary = createTemporaryDirectory();
    });

    afterEach(() => {
        temporary.cleanup();
    });

    it("should extract lint-staged config", () => {
        expect.assertions(1);

        const config = { "*.css": ["prettier --write", "stylelint"], "*.ts": "eslint --fix" };

        writeFileSync(join(temporary.root, "package.json"), JSON.stringify({ "lint-staged": config }));

        expect(extractLintStagedFromPackageJson(temporary.root)).toStrictEqual(config);
    });

    it("should return undefined when no lint-staged key", () => {
        expect.assertions(1);

        writeFileSync(join(temporary.root, "package.json"), JSON.stringify({ name: "test" }));

        expect(extractLintStagedFromPackageJson(temporary.root)).toBeUndefined();
    });
});

// ─── generateStagedConfigSnippet (unit) ────────────────────────────

describe(generateStagedConfigSnippet, () => {
    it("should generate snippet for string commands", () => {
        expect.assertions(2);

        const snippet = generateStagedConfigSnippet({ "*.ts": "eslint --fix" });

        expect(snippet).toContain('"*.ts": "eslint --fix"');
        expect(snippet).toContain("staged:");
    });

    it("should generate snippet for array commands", () => {
        expect.assertions(2);

        const snippet = generateStagedConfigSnippet({ "*.css": ["prettier --write", "stylelint"] });

        expect(snippet).toContain('"prettier --write"');
        expect(snippet).toContain('"stylelint"');
    });
});

// ─── insertStagedIntoVisConfig (unit) ──────────────────────────────

describe(insertStagedIntoVisConfig, () => {
    let temporary: { cleanup: () => void; root: string };

    beforeEach(() => {
        temporary = createTemporaryDirectory();
    });

    afterEach(() => {
        temporary.cleanup();
    });

    it("should insert into existing vis.config.ts with defineConfig", () => {
        expect.assertions(2);

        writeFileSync(
            join(temporary.root, "vis.config.ts"),
            'import { defineConfig } from "@visulima/vis/config";\n\nexport default defineConfig({\n    update: {},\n});\n',
        );

        const logger = createLogger();
        const result = insertStagedIntoVisConfig(temporary.root, { "*.ts": "eslint" }, logger);

        expect(result).toBe(true);

        const content = readFileSync(join(temporary.root, "vis.config.ts"), "utf8");

        expect(content).toContain("staged:");
    });

    it("should insert into existing vis.config.ts with export default", () => {
        expect.assertions(2);

        writeFileSync(join(temporary.root, "vis.config.ts"), "export default {\n    update: {},\n};\n");

        const logger = createLogger();
        const result = insertStagedIntoVisConfig(temporary.root, { "*.ts": "eslint" }, logger);

        expect(result).toBe(true);

        const content = readFileSync(join(temporary.root, "vis.config.ts"), "utf8");

        expect(content).toContain("staged:");
    });

    it("should create new vis.config.ts when none exists", () => {
        expect.assertions(3);

        const logger = createLogger();
        const result = insertStagedIntoVisConfig(temporary.root, { "*.ts": "eslint" }, logger);

        expect(result).toBe(true);
        expect(existsSync(join(temporary.root, "vis.config.ts"))).toBe(true);

        const content = readFileSync(join(temporary.root, "vis.config.ts"), "utf8");

        expect(content).toContain("staged:");
    });
});

// ─── removeLintStagedFromPackageJson (unit) ────────────────────────

describe(removeLintStagedFromPackageJson, () => {
    let temporary: { cleanup: () => void; root: string };

    beforeEach(() => {
        temporary = createTemporaryDirectory();
    });

    afterEach(() => {
        temporary.cleanup();
    });

    it("should remove lint-staged config key and dependency in one pass", () => {
        expect.assertions(4);

        writeFileSync(
            join(temporary.root, "package.json"),
            JSON.stringify(
                {
                    devDependencies: { "lint-staged": "^15.0.0" },
                    "lint-staged": { "*.ts": "eslint" },
                    name: "test",
                },
                undefined,
                4,
            ),
        );

        const result = removeLintStagedFromPackageJson(temporary.root);

        expect(result.configRemoved).toBe(true);
        expect(result.dependencyRemoved).toBe(true);

        const pkg = JSON.parse(readFileSync(join(temporary.root, "package.json"), "utf8"));

        expect(pkg["lint-staged"]).toBeUndefined();
        expect(pkg.devDependencies["lint-staged"]).toBeUndefined();
    });

    it("should remove from dependencies (not just devDependencies)", () => {
        expect.assertions(2);

        writeFileSync(join(temporary.root, "package.json"), JSON.stringify({ dependencies: { "lint-staged": "^15.0.0" } }, undefined, 4));

        const result = removeLintStagedFromPackageJson(temporary.root);

        expect(result.dependencyRemoved).toBe(true);

        const pkg = JSON.parse(readFileSync(join(temporary.root, "package.json"), "utf8"));

        expect(pkg.dependencies["lint-staged"]).toBeUndefined();
    });

    it("should return both false when nothing to remove", () => {
        expect.assertions(2);

        writeFileSync(join(temporary.root, "package.json"), JSON.stringify({ name: "test" }));

        const result = removeLintStagedFromPackageJson(temporary.root);

        expect(result.configRemoved).toBe(false);
        expect(result.dependencyRemoved).toBe(false);
    });

    it("should return both false when no package.json", () => {
        expect.assertions(2);

        const result = removeLintStagedFromPackageJson(temporary.root);

        expect(result.configRemoved).toBe(false);
        expect(result.dependencyRemoved).toBe(false);
    });
});

// ─── removeLintStagedConfigFiles (unit) ────────────────────────────

describe(removeLintStagedConfigFiles, () => {
    let temporary: { cleanup: () => void; root: string };

    beforeEach(() => {
        temporary = createTemporaryDirectory();
    });

    afterEach(() => {
        temporary.cleanup();
    });

    it("should remove existing config files and count them", () => {
        expect.assertions(3);

        writeFileSync(join(temporary.root, ".lintstagedrc.json"), "{}");
        writeFileSync(join(temporary.root, ".lintstagedrc"), "{}");

        const report = createMigrationReport();

        removeLintStagedConfigFiles(temporary.root, report);

        expect(existsSync(join(temporary.root, ".lintstagedrc.json"))).toBe(false);
        expect(existsSync(join(temporary.root, ".lintstagedrc"))).toBe(false);
        expect(report.removedConfigCount).toBe(2);
    });
});

// ─── rewritePreCommitHook (unit) ──────────────────────────────────

describe(rewritePreCommitHook, () => {
    let temporary: { cleanup: () => void; root: string };

    beforeEach(() => {
        temporary = createTemporaryDirectory();
    });

    afterEach(() => {
        temporary.cleanup();
    });

    it("should replace npx lint-staged with vis staged", () => {
        expect.assertions(2);

        mkdirSync(join(temporary.root, ".vis-hooks"), { recursive: true });
        writeFileSync(join(temporary.root, ".vis-hooks", "pre-commit"), "#!/usr/bin/env sh\nnpx lint-staged\n");

        const result = rewritePreCommitHook(temporary.root, ".vis-hooks");

        expect(result).toBe(true);

        const content = readFileSync(join(temporary.root, ".vis-hooks", "pre-commit"), "utf8");

        expect(content).toContain("vis staged");
    });

    it("should replace pnpm exec lint-staged with vis staged", () => {
        expect.assertions(2);

        mkdirSync(join(temporary.root, ".vis-hooks"), { recursive: true });
        writeFileSync(join(temporary.root, ".vis-hooks", "pre-commit"), "#!/usr/bin/env sh\npnpm exec lint-staged\n");

        const result = rewritePreCommitHook(temporary.root, ".vis-hooks");

        expect(result).toBe(true);

        const content = readFileSync(join(temporary.root, ".vis-hooks", "pre-commit"), "utf8");

        expect(content).toContain("vis staged");
    });

    it("should replace bare lint-staged with vis staged", () => {
        expect.assertions(2);

        mkdirSync(join(temporary.root, ".vis-hooks"), { recursive: true });
        writeFileSync(join(temporary.root, ".vis-hooks", "pre-commit"), "#!/usr/bin/env sh\nlint-staged\n");

        const result = rewritePreCommitHook(temporary.root, ".vis-hooks");

        expect(result).toBe(true);

        const content = readFileSync(join(temporary.root, ".vis-hooks", "pre-commit"), "utf8");

        expect(content).toContain("vis staged");
    });

    it("should preserve env var prefix", () => {
        expect.assertions(2);

        mkdirSync(join(temporary.root, ".vis-hooks"), { recursive: true });
        writeFileSync(join(temporary.root, ".vis-hooks", "pre-commit"), "#!/usr/bin/env sh\nNODE_OPTIONS=--max-old-space-size=4096 npx lint-staged\n");

        const result = rewritePreCommitHook(temporary.root, ".vis-hooks");

        expect(result).toBe(true);

        const content = readFileSync(join(temporary.root, ".vis-hooks", "pre-commit"), "utf8");

        expect(content).toContain("NODE_OPTIONS=--max-old-space-size=4096 vis staged");
    });

    it("should not modify if already has vis staged", () => {
        expect.assertions(1);

        mkdirSync(join(temporary.root, ".vis-hooks"), { recursive: true });
        writeFileSync(join(temporary.root, ".vis-hooks", "pre-commit"), "#!/usr/bin/env sh\nvis staged\n");

        expect(rewritePreCommitHook(temporary.root, ".vis-hooks")).toBe(false);
    });

    it("should return false if no lint-staged line found (no mutation)", () => {
        expect.assertions(2);

        mkdirSync(join(temporary.root, ".vis-hooks"), { recursive: true });
        writeFileSync(join(temporary.root, ".vis-hooks", "pre-commit"), "#!/usr/bin/env sh\necho hello\n");

        const result = rewritePreCommitHook(temporary.root, ".vis-hooks");

        expect(result).toBe(false);

        const content = readFileSync(join(temporary.root, ".vis-hooks", "pre-commit"), "utf8");

        expect(content).not.toContain("vis staged");
    });

    it("should return false when no pre-commit hook exists", () => {
        expect.assertions(1);

        expect(rewritePreCommitHook(temporary.root, ".vis-hooks")).toBe(false);
    });
});

// ─── rewriteScripts (deps) (unit) ─────────────────────────────────

describe(rewriteScripts, () => {
    it("should remove standalone husky script", () => {
        expect.assertions(2);

        const report = createMigrationReport();
        const result = rewriteScripts({ prepare: "husky" }, report);

        expect(result.modified).toBe(true);
        expect(result.scripts["prepare"]).toBeUndefined();
    });

    it("should replace lint-staged with vis staged", () => {
        expect.assertions(2);

        const report = createMigrationReport();
        const result = rewriteScripts({ "pre-commit": "lint-staged" }, report);

        expect(result.modified).toBe(true);
        expect(result.scripts["pre-commit"]).toBe("vis staged");
    });

    it("should handle husky && lint-staged compound", () => {
        expect.assertions(2);

        const report = createMigrationReport();
        const result = rewriteScripts({ prepare: "husky && lint-staged" }, report);

        expect(result.modified).toBe(true);
        expect(result.scripts["prepare"]).toBe("vis staged");
    });

    it("should not modify unrelated scripts", () => {
        expect.assertions(2);

        const report = createMigrationReport();
        const result = rewriteScripts({ build: "tsc", test: "vitest" }, report);

        expect(result.modified).toBe(false);
        expect(result.scripts).toStrictEqual({ build: "tsc", test: "vitest" });
    });
});

// ─── rewritePackageJson (deps) (unit) ─────────────────────────────

describe(rewritePackageJson, () => {
    let temporary: { cleanup: () => void; root: string };

    beforeEach(() => {
        temporary = createTemporaryDirectory();
    });

    afterEach(() => {
        temporary.cleanup();
    });

    it("should remove replaced packages", () => {
        expect.assertions(2);

        writeFileSync(
            join(temporary.root, "package.json"),
            JSON.stringify(
                {
                    devDependencies: {
                        eslint: "^9.0.0",
                        husky: "^9.0.0",
                        "lint-staged": "^15.0.0",
                    },
                },
                undefined,
                4,
            ),
        );

        const report = createMigrationReport();

        rewritePackageJson(temporary.root, "npm", {}, report);

        const pkg = JSON.parse(readFileSync(join(temporary.root, "package.json"), "utf8"));

        expect(pkg.devDependencies["husky"]).toBeUndefined();
        expect(pkg.devDependencies["lint-staged"]).toBeUndefined();
    });

    it("should add npm overrides", () => {
        expect.assertions(1);

        writeFileSync(join(temporary.root, "package.json"), JSON.stringify({ name: "test" }, undefined, 4));

        const report = createMigrationReport();

        rewritePackageJson(temporary.root, "npm", { lodash: "lodash-es@^4.0.0" }, report);

        const pkg = JSON.parse(readFileSync(join(temporary.root, "package.json"), "utf8"));

        expect(pkg.overrides).toStrictEqual({ lodash: "lodash-es@^4.0.0" });
    });

    it("should add yarn resolutions", () => {
        expect.assertions(1);

        writeFileSync(join(temporary.root, "package.json"), JSON.stringify({ name: "test" }, undefined, 4));

        const report = createMigrationReport();

        rewritePackageJson(temporary.root, "yarn", { lodash: "lodash-es@^4.0.0" }, report);

        const pkg = JSON.parse(readFileSync(join(temporary.root, "package.json"), "utf8"));

        expect(pkg.resolutions).toStrictEqual({ lodash: "lodash-es@^4.0.0" });
    });

    it("should add pnpm overrides", () => {
        expect.assertions(1);

        writeFileSync(join(temporary.root, "package.json"), JSON.stringify({ name: "test" }, undefined, 4));

        const report = createMigrationReport();

        rewritePackageJson(temporary.root, "pnpm", { lodash: "lodash-es@^4.0.0" }, report);

        const pkg = JSON.parse(readFileSync(join(temporary.root, "package.json"), "utf8"));

        expect(pkg.pnpm.overrides).toStrictEqual({ lodash: "lodash-es@^4.0.0" });
    });

    it("should add bun overrides with catalog references", () => {
        expect.assertions(2);

        writeFileSync(join(temporary.root, "package.json"), JSON.stringify({ name: "test" }, undefined, 4));

        const report = createMigrationReport();

        rewritePackageJson(temporary.root, "bun", { lodash: "lodash-es@^4.0.0" }, report);

        const pkg = JSON.parse(readFileSync(join(temporary.root, "package.json"), "utf8"));

        expect(pkg.catalog).toStrictEqual({ lodash: "lodash-es@^4.0.0" });
        expect(pkg.overrides).toStrictEqual({ lodash: "catalog:" });
    });

    it("should write bun catalog to top-level when workspaces is an array", () => {
        expect.assertions(3);

        writeFileSync(
            join(temporary.root, "package.json"),
            JSON.stringify(
                {
                    name: "bun-monorepo",
                    packageManager: "bun@1.3.11",
                    workspaces: ["packages/*"],
                },
                undefined,
                4,
            ),
        );

        const report = createMigrationReport();

        rewritePackageJson(temporary.root, "bun", { vite: "^7.0.0" }, report);

        const pkg = JSON.parse(readFileSync(join(temporary.root, "package.json"), "utf8"));

        expect(pkg.catalog.vite).toBe("^7.0.0");
        expect(pkg.overrides.vite).toBe("catalog:");
        // workspaces should remain an array
        expect(Array.isArray(pkg.workspaces)).toBe(true);
    });

    it("should write bun catalog to workspaces.catalog when workspaces is an object with existing catalog", () => {
        expect.assertions(4);

        writeFileSync(
            join(temporary.root, "package.json"),
            JSON.stringify(
                {
                    name: "bun-monorepo",
                    packageManager: "bun@1.3.11",
                    workspaces: {
                        catalog: { react: "^19.0.0" },
                        packages: ["packages/*"],
                    },
                },
                undefined,
                4,
            ),
        );

        const report = createMigrationReport();

        rewritePackageJson(temporary.root, "bun", { vite: "^7.0.0" }, report);

        const pkg = JSON.parse(readFileSync(join(temporary.root, "package.json"), "utf8"));

        // No top-level catalog
        expect(pkg.catalog).toBeUndefined();
        // workspaces.catalog should have merged entries
        expect(pkg.workspaces.catalog.react).toBe("^19.0.0");
        expect(pkg.workspaces.catalog.vite).toBe("^7.0.0");
        // workspaces.packages should be preserved
        expect(pkg.workspaces.packages).toStrictEqual(["packages/*"]);
    });

    it("should write bun catalog to top-level when workspaces is an object without catalog", () => {
        expect.assertions(3);

        writeFileSync(
            join(temporary.root, "package.json"),
            JSON.stringify(
                {
                    name: "bun-monorepo",
                    packageManager: "bun@1.3.11",
                    workspaces: {
                        packages: ["packages/*"],
                    },
                },
                undefined,
                4,
            ),
        );

        const report = createMigrationReport();

        rewritePackageJson(temporary.root, "bun", { vite: "^7.0.0" }, report);

        const pkg = JSON.parse(readFileSync(join(temporary.root, "package.json"), "utf8"));

        // catalog should be at top level since workspaces.catalog didn't exist
        expect(pkg.catalog.vite).toBe("^7.0.0");
        // workspaces object should be preserved
        expect(pkg.workspaces.packages).toStrictEqual(["packages/*"]);
        expect(pkg.overrides.vite).toBe("catalog:");
    });

    it("should rewrite scripts", () => {
        expect.assertions(2);

        writeFileSync(
            join(temporary.root, "package.json"),
            JSON.stringify(
                {
                    scripts: {
                        "pre-commit": "lint-staged",
                        prepare: "husky install",
                    },
                },
                undefined,
                4,
            ),
        );

        const report = createMigrationReport();

        rewritePackageJson(temporary.root, "npm", {}, report);

        const pkg = JSON.parse(readFileSync(join(temporary.root, "package.json"), "utf8"));

        expect(pkg.scripts["prepare"]).toBeUndefined();
        expect(pkg.scripts["pre-commit"]).toBe("vis staged");
    });
});

// ─── migrateLintStaged (integration) ──────────────────────────────

describe(migrateLintStaged, () => {
    let temporary: { cleanup: () => void; root: string };

    beforeEach(() => {
        temporary = createTemporaryDirectory();
    });

    afterEach(() => {
        temporary.cleanup();
    });

    it("should migrate lint-staged from package.json to vis.config.ts", () => {
        expect.assertions(4);

        const config = { "*.css": "prettier --write", "*.ts": "eslint --fix" };

        writeFileSync(
            join(temporary.root, "package.json"),
            JSON.stringify(
                {
                    devDependencies: { "lint-staged": "^15.0.0" },
                    "lint-staged": config,
                },
                undefined,
                4,
            ),
        );

        const logger = createLogger();
        const report = createMigrationReport();
        const result = migrateLintStaged(temporary.root, { dryRun: false }, logger, report);

        expect(result).toBe(true);
        expect(existsSync(join(temporary.root, "vis.config.ts"))).toBe(true);

        const visConfig = readFileSync(join(temporary.root, "vis.config.ts"), "utf8");

        expect(visConfig).toContain("staged:");

        const pkg = JSON.parse(readFileSync(join(temporary.root, "package.json"), "utf8"));

        expect(pkg["lint-staged"]).toBeUndefined();
    });

    it("should migrate lint-staged from .lintstagedrc.json", () => {
        expect.assertions(3);

        writeFileSync(join(temporary.root, "package.json"), JSON.stringify({}, undefined, 4));
        writeFileSync(join(temporary.root, ".lintstagedrc.json"), JSON.stringify({ "*.ts": "eslint" }));

        const logger = createLogger();
        const report = createMigrationReport();
        const result = migrateLintStaged(temporary.root, { dryRun: false }, logger, report);

        expect(result).toBe(true);
        expect(existsSync(join(temporary.root, ".lintstagedrc.json"))).toBe(false);
        expect(report.removedConfigCount).toBeGreaterThanOrEqual(1);
    });

    it("should warn for non-JSON config and not auto-migrate", () => {
        expect.assertions(2);

        writeFileSync(join(temporary.root, "package.json"), JSON.stringify({}));
        writeFileSync(join(temporary.root, ".lintstagedrc.mjs"), "export default { '*.ts': 'eslint' }");

        const logger = createLogger();
        const report = createMigrationReport();

        migrateLintStaged(temporary.root, { dryRun: false }, logger, report);

        expect(report.warnings.length).toBeGreaterThanOrEqual(1);
        expect(report.manualSteps.length).toBeGreaterThanOrEqual(1);
    });

    it("should warn when vis.config.ts already has staged", () => {
        expect.assertions(1);

        writeFileSync(join(temporary.root, "package.json"), JSON.stringify({ "lint-staged": { "*.ts": "eslint" } }));
        writeFileSync(join(temporary.root, "vis.config.ts"), 'export default defineConfig({ staged: { "*.ts": "eslint" } });');

        const logger = createLogger();
        const report = createMigrationReport();

        migrateLintStaged(temporary.root, { dryRun: false }, logger, report);

        expect(report.warnings).toContain('vis.config.ts already has a "staged" config — skipping lint-staged merge');
    });

    it("should return false when no lint-staged found", () => {
        expect.assertions(1);

        writeFileSync(join(temporary.root, "package.json"), JSON.stringify({}));

        const logger = createLogger();
        const report = createMigrationReport();

        expect(migrateLintStaged(temporary.root, { dryRun: false }, logger, report)).toBe(false);
    });

    it("should preview in dry-run mode", () => {
        expect.assertions(2);

        writeFileSync(join(temporary.root, "package.json"), JSON.stringify({ "lint-staged": { "*.ts": "eslint" } }));

        const logger = createLogger();
        const report = createMigrationReport();
        const result = migrateLintStaged(temporary.root, { dryRun: true }, logger, report);

        expect(result).toBe(true);
        expect(existsSync(join(temporary.root, "vis.config.ts"))).toBe(false);
    });

    it("should rewrite pre-commit hook", () => {
        expect.assertions(2);

        writeFileSync(join(temporary.root, "package.json"), JSON.stringify({ "lint-staged": { "*.ts": "eslint" } }, undefined, 4));
        mkdirSync(join(temporary.root, ".vis-hooks"), { recursive: true });
        writeFileSync(join(temporary.root, ".vis-hooks", "pre-commit"), "#!/usr/bin/env sh\nnpx lint-staged\n");

        const logger = createLogger();
        const report = createMigrationReport();

        migrateLintStaged(temporary.root, { dryRun: false }, logger, report);

        expect(report.gitHooksConfigured).toBe(true);

        const hookContent = readFileSync(join(temporary.root, ".vis-hooks", "pre-commit"), "utf8");

        expect(hookContent).toContain("vis staged");
    });

    it("should remove lint-staged dependency", () => {
        expect.assertions(1);

        writeFileSync(
            join(temporary.root, "package.json"),
            JSON.stringify(
                {
                    devDependencies: { "lint-staged": "^15.0.0" },
                    "lint-staged": { "*.ts": "eslint" },
                },
                undefined,
                4,
            ),
        );

        const logger = createLogger();
        const report = createMigrationReport();

        migrateLintStaged(temporary.root, { dryRun: false }, logger, report);

        const pkg = JSON.parse(readFileSync(join(temporary.root, "package.json"), "utf8"));

        expect(pkg.devDependencies?.["lint-staged"]).toBeUndefined();
    });
});

// ─── parseLintStagedJsonFile (unit) ────────────────────────────────

describe(parseLintStagedJsonFile, () => {
    let temporary: { cleanup: () => void; root: string };

    beforeEach(() => {
        temporary = createTemporaryDirectory();
    });

    afterEach(() => {
        temporary.cleanup();
    });

    it("should parse valid JSON lint-staged config", () => {
        expect.assertions(1);

        const filePath = join(temporary.root, ".lintstagedrc.json");

        writeFileSync(filePath, JSON.stringify({ "*.ts": "eslint --fix" }));

        expect(parseLintStagedJsonFile(filePath)).toStrictEqual({ "*.ts": "eslint --fix" });
    });

    it("should return undefined for non-existent file", () => {
        expect.assertions(1);

        expect(parseLintStagedJsonFile(join(temporary.root, "missing.json"))).toBeUndefined();
    });

    it("should return undefined for invalid JSON", () => {
        expect.assertions(1);

        const filePath = join(temporary.root, ".lintstagedrc");

        writeFileSync(filePath, "not json {");

        expect(parseLintStagedJsonFile(filePath)).toBeUndefined();
    });
});

// ─── editJsonFile edge cases (unit) ───────────────────────────────

describe("editJsonFile edge cases", () => {
    let temporary: { cleanup: () => void; root: string };

    beforeEach(() => {
        temporary = createTemporaryDirectory();
    });

    afterEach(() => {
        temporary.cleanup();
    });

    it("should return false for non-existent file", () => {
        expect.assertions(1);

        expect(
            editJsonFile(join(temporary.root, "missing.json"), () => {
                return {};
            }),
        ).toBe(false);
    });

    it("should return false for invalid JSON file", () => {
        expect.assertions(1);

        const filePath = join(temporary.root, "bad.json");

        writeFileSync(filePath, "not json");

        expect(
            editJsonFile(filePath, () => {
                return {};
            }),
        ).toBe(false);
    });
});

// ─── insertStagedIntoVisConfig edge cases (unit) ──────────────────

describe("insertStagedIntoVisConfig edge cases", () => {
    let temporary: { cleanup: () => void; root: string };

    beforeEach(() => {
        temporary = createTemporaryDirectory();
    });

    afterEach(() => {
        temporary.cleanup();
    });

    it("should return false for unrecognized config format", () => {
        expect.assertions(1);

        writeFileSync(join(temporary.root, "vis.config.ts"), "const config = {};\nmodule.exports = config;\n");

        const logger = createLogger();

        expect(insertStagedIntoVisConfig(temporary.root, { "*.ts": "eslint" }, logger)).toBe(false);
    });
});

// ─── rewriteScripts edge cases (unit) ─────────────────────────────

describe("rewriteScripts edge cases", () => {
    it("should remove husky install standalone", () => {
        expect.assertions(2);

        const report = createMigrationReport();
        const result = rewriteScripts({ prepare: "husky install" }, report);

        expect(result.modified).toBe(true);
        expect(result.scripts["prepare"]).toBeUndefined();
    });

    it("should clean (is-ci || husky || exit 0) && pattern", () => {
        expect.assertions(2);

        const report = createMigrationReport();
        const result = rewriteScripts({ postinstall: "(is-ci || husky || exit 0) && node setup.js" }, report);

        expect(result.modified).toBe(true);
        expect(result.scripts["postinstall"]).toBe("node setup.js");
    });

    it("should clean && husky install pattern", () => {
        expect.assertions(2);

        const report = createMigrationReport();
        const result = rewriteScripts({ prepare: "tsc && husky install" }, report);

        expect(result.modified).toBe(true);
        expect(result.scripts["prepare"]).toBe("tsc");
    });

    it("should clean || husky pattern", () => {
        expect.assertions(2);

        const report = createMigrationReport();
        const result = rewriteScripts({ prepare: "is-ci || husky" }, report);

        expect(result.modified).toBe(true);
        expect(result.scripts["prepare"]).toBe("is-ci");
    });

    it("should replace lint-staged in compound scripts", () => {
        expect.assertions(2);

        const report = createMigrationReport();
        const result = rewriteScripts({ "pre-commit": "echo start && lint-staged && echo done" }, report);

        expect(result.modified).toBe(true);
        expect(result.scripts["pre-commit"]).toBe("echo start && vis staged && echo done");
    });

    it("should increment rewrittenScriptCount", () => {
        expect.assertions(1);

        const report = createMigrationReport();

        rewriteScripts({ a: "husky", b: "lint-staged", c: "tsc" }, report);

        expect(report.rewrittenScriptCount).toBe(2);
    });
});

// ─── rewritePackageJson edge cases (unit) ─────────────────────────

describe("rewritePackageJson edge cases", () => {
    let temporary: { cleanup: () => void; root: string };

    beforeEach(() => {
        temporary = createTemporaryDirectory();
    });

    afterEach(() => {
        temporary.cleanup();
    });

    it("should do nothing when package.json does not exist", () => {
        expect.assertions(1);

        const report = createMigrationReport();

        rewritePackageJson(temporary.root, "npm", {}, report);

        expect(report.removedPackageCount).toBe(0);
    });

    it("should remove husky from dependencies (not just devDependencies)", () => {
        expect.assertions(2);

        writeFileSync(join(temporary.root, "package.json"), JSON.stringify({ dependencies: { husky: "^9.0.0" } }, undefined, 4));

        const report = createMigrationReport();

        rewritePackageJson(temporary.root, "npm", {}, report);

        const pkg = JSON.parse(readFileSync(join(temporary.root, "package.json"), "utf8"));

        expect(pkg.dependencies["husky"]).toBeUndefined();
        expect(report.removedPackageCount).toBe(1);
    });

    it("should merge with existing overrides", () => {
        expect.assertions(1);

        writeFileSync(join(temporary.root, "package.json"), JSON.stringify({ overrides: { existing: "^1.0.0" } }, undefined, 4));

        const report = createMigrationReport();

        rewritePackageJson(temporary.root, "npm", { newpkg: "^2.0.0" }, report);

        const pkg = JSON.parse(readFileSync(join(temporary.root, "package.json"), "utf8"));

        expect(pkg.overrides).toStrictEqual({ existing: "^1.0.0", newpkg: "^2.0.0" });
    });

    it("should not modify package.json when nothing to change", () => {
        expect.assertions(1);

        writeFileSync(join(temporary.root, "package.json"), JSON.stringify({ name: "test", scripts: { build: "tsc" } }, undefined, 4));

        const report = createMigrationReport();

        rewritePackageJson(temporary.root, "npm", {}, report);

        expect(report.removedPackageCount).toBe(0);
    });
});

// ─── updatePnpmWorkspaceCatalog (unit) ────────────────────────────

describe(updatePnpmWorkspaceCatalog, () => {
    let temporary: { cleanup: () => void; root: string };

    beforeEach(() => {
        temporary = createTemporaryDirectory();
    });

    afterEach(() => {
        temporary.cleanup();
    });

    it("should add new entries to existing catalog", () => {
        expect.assertions(2);

        writeFileSync(join(temporary.root, "pnpm-workspace.yaml"), 'packages:\n  - packages/*\ncatalog:\n  eslint: "^9.0.0"\n');

        updatePnpmWorkspaceCatalog(temporary.root, { prettier: "^3.0.0" });

        const content = readFileSync(join(temporary.root, "pnpm-workspace.yaml"), "utf8");

        expect(content).toContain('prettier: "^3.0.0"');
        expect(content).toContain('eslint: "^9.0.0"');
    });

    it("should not duplicate existing catalog entries", () => {
        expect.assertions(1);

        writeFileSync(join(temporary.root, "pnpm-workspace.yaml"), 'packages:\n  - packages/*\ncatalog:\n  eslint: "^9.0.0"\n');

        updatePnpmWorkspaceCatalog(temporary.root, { eslint: "^10.0.0" });

        const content = readFileSync(join(temporary.root, "pnpm-workspace.yaml"), "utf8");
        const matches = content.match(/eslint/g);

        expect(matches).toHaveLength(1);
    });

    it("should do nothing when no pnpm-workspace.yaml", () => {
        expect.assertions(1);

        updatePnpmWorkspaceCatalog(temporary.root, { pkg: "^1.0.0" });

        expect(existsSync(join(temporary.root, "pnpm-workspace.yaml"))).toBe(false);
    });

    it("should do nothing when overrides is empty", () => {
        expect.assertions(1);

        const original = 'packages:\n  - packages/*\ncatalog:\n  eslint: "^9.0.0"\n';

        writeFileSync(join(temporary.root, "pnpm-workspace.yaml"), original);

        updatePnpmWorkspaceCatalog(temporary.root, {});

        expect(readFileSync(join(temporary.root, "pnpm-workspace.yaml"), "utf8")).toBe(original);
    });

    it("should create catalog section if missing", () => {
        expect.assertions(1);

        writeFileSync(join(temporary.root, "pnpm-workspace.yaml"), "packages:\n  - packages/*\n");

        updatePnpmWorkspaceCatalog(temporary.root, { newpkg: "^1.0.0" });

        const content = readFileSync(join(temporary.root, "pnpm-workspace.yaml"), "utf8");

        expect(content).toContain('newpkg: "^1.0.0"');
    });
});

// ─── migrateDeps (integration) ────────────────────────────────────

describe(migrateDeps, () => {
    let temporary: { cleanup: () => void; root: string };

    beforeEach(() => {
        temporary = createTemporaryDirectory();
    });

    afterEach(() => {
        temporary.cleanup();
    });

    it("should rewrite root package.json in non-dry-run", () => {
        expect.assertions(2);

        writeFileSync(
            join(temporary.root, "package.json"),
            JSON.stringify(
                {
                    devDependencies: { husky: "^9.0.0" },
                    scripts: { prepare: "husky install" },
                },
                undefined,
                4,
            ),
        );

        const logger = createLogger();
        const report = createMigrationReport();

        migrateDeps(temporary.root, "npm", {}, { dryRun: false }, logger, report);

        const pkg = JSON.parse(readFileSync(join(temporary.root, "package.json"), "utf8"));

        expect(pkg.devDependencies["husky"]).toBeUndefined();
        expect(pkg.scripts["prepare"]).toBeUndefined();
    });

    it("should only log in dry-run mode without modifying files", () => {
        expect.assertions(2);

        writeFileSync(join(temporary.root, "package.json"), JSON.stringify({ devDependencies: { husky: "^9.0.0" } }, undefined, 4));

        const logger = createLogger();
        const report = createMigrationReport();

        migrateDeps(temporary.root, "npm", {}, { dryRun: true }, logger, report);

        const pkg = JSON.parse(readFileSync(join(temporary.root, "package.json"), "utf8"));

        expect(pkg.devDependencies["husky"]).toBe("^9.0.0");
        expect(logger.messages.some((m: string) => m.includes("[dry-run]"))).toBe(true);
    });

    it("should log overrides in dry-run mode", () => {
        expect.assertions(1);

        writeFileSync(join(temporary.root, "package.json"), JSON.stringify({}, undefined, 4));

        const logger = createLogger();
        const report = createMigrationReport();

        migrateDeps(temporary.root, "npm", { overrides: { lodash: "^4.0.0" } }, { dryRun: true }, logger, report);

        expect(logger.messages.some((m: string) => m.includes("overrides"))).toBe(true);
    });

    it("should call updatePnpmWorkspaceCatalog for pnpm", () => {
        expect.assertions(1);

        writeFileSync(join(temporary.root, "package.json"), JSON.stringify({}, undefined, 4));
        writeFileSync(join(temporary.root, "pnpm-workspace.yaml"), 'packages:\n  - packages/*\ncatalog:\n  eslint: "^9.0.0"\n');

        const logger = createLogger();
        const report = createMigrationReport();

        migrateDeps(temporary.root, "pnpm", { overrides: { newpkg: "^1.0.0" } }, { dryRun: false }, logger, report);

        const content = readFileSync(join(temporary.root, "pnpm-workspace.yaml"), "utf8");

        expect(content).toContain('newpkg: "^1.0.0"');
    });
});

// ─── constants (unit) ──────────────────────────────────────────────

describe("constants", () => {
    it("should have expected replaced packages", () => {
        expect.assertions(2);

        expect(REPLACED_PACKAGES).toContain("husky");
        expect(REPLACED_PACKAGES).toContain("lint-staged");
    });

    it("should have JSON config files as subset of all config files", () => {
        expect.assertions(2);

        for (const file of LINT_STAGED_JSON_CONFIG_FILES) {
            expect(LINT_STAGED_ALL_CONFIG_FILES).toContain(file);
        }
    });

    it("should have lint-staged patterns that match common invocations", () => {
        expect.assertions(4);

        expect(STALE_LINT_STAGED_PATTERNS[0]?.test("npx lint-staged")).toBe(true);
        expect(STALE_LINT_STAGED_PATTERNS[0]?.test("pnpm exec lint-staged")).toBe(true);
        expect(STALE_LINT_STAGED_PATTERNS[1]?.test("lint-staged")).toBe(true);
        expect(STALE_LINT_STAGED_PATTERNS[1]?.test("lint-staged --verbose")).toBe(true);
    });
});

// ─── migrateLintStaged edge cases (integration) ───────────────────

describe("migrateLintStaged edge cases", () => {
    let temporary: { cleanup: () => void; root: string };

    beforeEach(() => {
        temporary = createTemporaryDirectory();
    });

    afterEach(() => {
        temporary.cleanup();
    });

    it("should handle empty lint-staged config in package.json", () => {
        expect.assertions(1);

        writeFileSync(join(temporary.root, "package.json"), JSON.stringify({ "lint-staged": {} }));

        const logger = createLogger();
        const report = createMigrationReport();

        expect(migrateLintStaged(temporary.root, { dryRun: false }, logger, report)).toBe(false);
    });

    it("should still clean up when vis.config.ts already has staged", () => {
        expect.assertions(2);

        writeFileSync(
            join(temporary.root, "package.json"),
            JSON.stringify(
                {
                    devDependencies: { "lint-staged": "^15.0.0" },
                    "lint-staged": { "*.ts": "eslint" },
                },
                undefined,
                4,
            ),
        );
        writeFileSync(join(temporary.root, "vis.config.ts"), 'export default defineConfig({ staged: { "*.ts": "eslint" } });');

        const logger = createLogger();
        const report = createMigrationReport();

        migrateLintStaged(temporary.root, { dryRun: false }, logger, report);

        const pkg = JSON.parse(readFileSync(join(temporary.root, "package.json"), "utf8"));

        expect(pkg["lint-staged"]).toBeUndefined();
        expect(pkg.devDependencies?.["lint-staged"]).toBeUndefined();
    });

    it("should not clean up in dry-run when vis.config.ts already has staged", () => {
        expect.assertions(1);

        writeFileSync(
            join(temporary.root, "package.json"),
            JSON.stringify(
                {
                    "lint-staged": { "*.ts": "eslint" },
                },
                undefined,
                4,
            ),
        );
        writeFileSync(join(temporary.root, "vis.config.ts"), 'export default defineConfig({ staged: { "*.ts": "eslint" } });');

        const logger = createLogger();
        const report = createMigrationReport();

        migrateLintStaged(temporary.root, { dryRun: true }, logger, report);

        const pkg = JSON.parse(readFileSync(join(temporary.root, "package.json"), "utf8"));

        expect(pkg["lint-staged"]).toStrictEqual({ "*.ts": "eslint" });
    });

    it("should handle non-JSON .lintstagedrc that looks like it could be JSON", () => {
        expect.assertions(1);

        writeFileSync(join(temporary.root, "package.json"), JSON.stringify({}));
        writeFileSync(join(temporary.root, ".lintstagedrc"), "yaml:\n  - value");

        const logger = createLogger();
        const report = createMigrationReport();

        migrateLintStaged(temporary.root, { dryRun: false }, logger, report);

        expect(report.warnings.length).toBeGreaterThanOrEqual(1);
    });

    it("should rewrite hooks in .husky directory", () => {
        expect.assertions(1);

        writeFileSync(join(temporary.root, "package.json"), JSON.stringify({ "lint-staged": { "*.ts": "eslint" } }, undefined, 4));
        mkdirSync(join(temporary.root, ".husky"), { recursive: true });
        writeFileSync(join(temporary.root, ".husky", "pre-commit"), "#!/usr/bin/env sh\nnpx lint-staged\n");

        const logger = createLogger();
        const report = createMigrationReport();

        migrateLintStaged(temporary.root, { dryRun: false }, logger, report);

        const hookContent = readFileSync(join(temporary.root, ".husky", "pre-commit"), "utf8");

        expect(hookContent).toContain("vis staged");
    });

    it("should suppress output in silent mode", () => {
        expect.assertions(1);

        writeFileSync(join(temporary.root, "package.json"), JSON.stringify({}));

        const logger = createLogger();
        const report = createMigrationReport();

        migrateLintStaged(temporary.root, { dryRun: false, silent: true }, logger, report);

        expect(logger.messages).toHaveLength(0);
    });
});
