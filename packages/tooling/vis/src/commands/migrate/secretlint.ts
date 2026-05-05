import { unlinkSync } from "node:fs";

import { isAccessibleSync, readFileSync, writeFileSync } from "@visulima/fs";
import { join } from "@visulima/path";

import { resolveIndentForFile } from "../../util/editorconfig";
import { backupFile } from "./backup";
import { readJsonFile } from "./json";
import type { MigrateLogger, MigrationReport } from "./types";
import { addManualStep, addMigrationWarning, bumpPerMigration } from "./types";

// Secretlint is plugin-based — its config enumerates which rule packages to run.
// We can't losslessly translate that to our native bundled ruleset (which comes
// from gitleaks), but we can:
//   1) Detect the config and report which presets/rules were active so the user
//      can verify our gitleaks ruleset covers their use cases.
//   2) Remove secretlint config + @secretlint/* devDependencies.
//   3) Rewrite package.json scripts / pre-commit hooks that invoke `secretlint`.

const SECRETLINT_CONFIG_NAMES = [
    ".secretlintrc",
    ".secretlintrc.json",
    ".secretlintrc.js",
    ".secretlintrc.mjs",
    ".secretlintrc.cjs",
    ".secretlintrc.yml",
    ".secretlintrc.yaml",
];
const SECRETLINT_IGNORE_NAMES = [".secretlintignore"];

interface SecretlintRule {
    id?: string;
    options?: Record<string, unknown>;
    rules?: SecretlintRule[];
}

interface SecretlintJsonConfig {
    rules?: SecretlintRule[];
}

const detectSecretlintConfig = (root: string): string | undefined => SECRETLINT_CONFIG_NAMES.find((name) => isAccessibleSync(join(root, name)));

const detectSecretlintIgnore = (root: string): string | undefined => SECRETLINT_IGNORE_NAMES.find((name) => isAccessibleSync(join(root, name)));

/**
 * Extract the set of rule / preset IDs from a secretlint config. Only parses
 * JSON-style configs confidently; for .js/.mjs/.cjs we warn and leave the file
 * for the user to inspect.
 */
const extractRuleIds = (root: string, file: string, report: MigrationReport): string[] => {
    if (file.endsWith(".js") || file.endsWith(".mjs") || file.endsWith(".cjs")) {
        addMigrationWarning(report, `${file} is a JS config — cannot auto-extract rule IDs. Review manually to confirm coverage.`);

        return [];
    }

    if (file.endsWith(".yml") || file.endsWith(".yaml")) {
        addMigrationWarning(report, `${file} is YAML — cannot auto-extract rule IDs without a YAML parser. Review manually.`);

        return [];
    }

    const config = readJsonFile<SecretlintJsonConfig>(join(root, file));

    if (!config) {
        return [];
    }

    const ids = new Set<string>();
    const walk = (rules: SecretlintRule[] | undefined): void => {
        if (!rules) {
            return;
        }

        for (const rule of rules) {
            if (rule.id) {
                ids.add(rule.id);
            }

            if (rule.rules) {
                walk(rule.rules);
            }
        }
    };

    walk(config.rules);

    return [...ids];
};

const removeSecretlintConfigFiles = (root: string, dryRun: boolean, logger: MigrateLogger, report: MigrationReport): void => {
    for (const name of [...SECRETLINT_CONFIG_NAMES, ...SECRETLINT_IGNORE_NAMES]) {
        const path = join(root, name);

        if (!isAccessibleSync(path)) {
            continue;
        }

        if (dryRun) {
            logger.info(`[dry-run] Would remove ${path}`);
            continue;
        }

        backupFile(path, report);
        unlinkSync(path);
        bumpPerMigration(report, "secretlint", "removedConfigCount");
        logger.info(`Removed ${path}`);
    }
};

const convertIgnoreFile = (root: string, dryRun: boolean, logger: MigrateLogger, report: MigrationReport): void => {
    const source = join(root, ".secretlintignore");

    if (!isAccessibleSync(source)) {
        return;
    }

    // secretlintignore is gitignore-style (paths/globs); .gitleaksignore is fingerprint-style.
    // Not a direct translation — we append paths as `--exclude` guidance only.
    const content: string = readFileSync(source);
    const lines = content
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith("#"));

    if (lines.length === 0) {
        return;
    }

    addManualStep(
        report,
        `.secretlintignore contained ${String(lines.length)} path pattern(s). vis secrets uses .gitignore + --exclude / --exclude-from; add these globs to your .gitignore or pass --exclude: ${lines.slice(0, 5).join(", ")}${lines.length > 5 ? ", ..." : ""}`,
    );

    // Keep the file around in dryRun; otherwise it will be cleaned by removeSecretlintConfigFiles.
    if (dryRun) {
        logger.info(`[dry-run] Would consume ${source} (${String(lines.length)} patterns) and surface as manual step.`);
    }
};

const rewriteScripts = (root: string, dryRun: boolean, logger: MigrateLogger, report: MigrationReport, useEditorconfig?: boolean): void => {
    const packageJsonPath = join(root, "package.json");

    if (!isAccessibleSync(packageJsonPath)) {
        return;
    }

    const pkg = readJsonFile<{ devDependencies?: Record<string, string>; scripts?: Record<string, string> }>(packageJsonPath);

    if (!pkg) {
        return;
    }

    let changed = false;

    if (pkg.scripts) {
        for (const [name, value] of Object.entries(pkg.scripts)) {
            if (typeof value === "string" && /\bsecretlint\b/.test(value)) {
                const rewritten = value.replaceAll(/\bsecretlint\b[^\n&|;]*/g, "vis secrets").trim();

                if (rewritten !== value) {
                    pkg.scripts[name] = rewritten;
                    changed = true;
                    bumpPerMigration(report, "secretlint", "rewrittenScriptCount");
                    logger.info(`  scripts.${name}: "${value}" -> "${rewritten}"`);
                }
            }
        }
    }

    if (pkg.devDependencies) {
        const devDeps = pkg.devDependencies;
        const removed: string[] = [];

        for (const dep of Object.keys(devDeps)) {
            if (dep === "secretlint" || dep.startsWith("@secretlint/")) {
                // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
                delete devDeps[dep];
                removed.push(dep);
                changed = true;
                bumpPerMigration(report, "secretlint", "removedPackageCount");
            }
        }

        if (removed.length > 0) {
            logger.info(`  removed ${String(removed.length)} secretlint devDependencies: ${removed.join(", ")}`);
        }
    }

    if (!changed) {
        return;
    }

    if (dryRun) {
        logger.info(`[dry-run] Would update ${packageJsonPath}`);

        return;
    }

    const indent = resolveIndentForFile(packageJsonPath, readFileSync(packageJsonPath), { defaultIndent: "    ", useEditorconfig });

    backupFile(packageJsonPath, report);
    writeFileSync(packageJsonPath, `${JSON.stringify(pkg, null, indent)}\n`);
};

const rewriteHooks = (root: string, dryRun: boolean, logger: MigrateLogger, report: MigrationReport): void => {
    const candidates = [".husky/pre-commit", ".vis-hooks/pre-commit", ".git/hooks/pre-commit"];

    for (const rel of candidates) {
        const abs = join(root, rel);

        if (!isAccessibleSync(abs)) {
            continue;
        }

        const content = readFileSync(abs);

        if (!/\bsecretlint\b/.test(content)) {
            continue;
        }

        const rewritten = content.replaceAll(/\bsecretlint\b[^\n&|;]*/g, "vis secrets --staged");

        if (dryRun) {
            logger.info(`[dry-run] Would rewrite ${abs}`);
            continue;
        }

        backupFile(abs, report);
        writeFileSync(abs, rewritten);
        report.gitHooksConfigured = true;
        logger.info(`Rewrote secretlint invocation in ${rel}`);
    }
};

const migrateSecretlint = (root: string, options: { dryRun: boolean; silent?: boolean; useEditorconfig?: boolean }, logger: MigrateLogger, report: MigrationReport): boolean => {
    const configFile = detectSecretlintConfig(root);
    const ignoreFile = detectSecretlintIgnore(root);
    const hasArtifacts = Boolean(configFile ?? ignoreFile);

    if (!hasArtifacts) {
        if (!options.silent) {
            logger.info("No secretlint artifacts found — nothing to migrate.");
        }

        return false;
    }

    if (configFile) {
        const ruleIds = extractRuleIds(root, configFile, report);

        logger.info(`Found ${configFile}`);

        if (ruleIds.length > 0) {
            logger.info(`  active rules/presets: ${ruleIds.join(", ")}`);
            addManualStep(
                report,
                `secretlint used these rules: ${ruleIds.join(", ")}. vis secrets ships the gitleaks ruleset (177 rules covering AWS/GCP/Azure/GitHub/Slack/Stripe and more). Verify parity before removing secretlint.`,
            );
        } else {
            addManualStep(
                report,
                `Rule IDs could not be auto-extracted from ${configFile}. Verify that the bundled gitleaks ruleset covers your secretlint rule set.`,
            );
        }
    }

    convertIgnoreFile(root, options.dryRun, logger, report);
    rewriteScripts(root, options.dryRun, logger, report, options.useEditorconfig);
    rewriteHooks(root, options.dryRun, logger, report);
    removeSecretlintConfigFiles(root, options.dryRun, logger, report);

    return true;
};

export { detectSecretlintConfig, detectSecretlintIgnore, extractRuleIds, migrateSecretlint };
