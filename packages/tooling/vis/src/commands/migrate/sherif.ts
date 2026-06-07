import { readdirSync, writeFileSync } from "node:fs";

import { isAccessibleSync, readFileSync } from "@visulima/fs";
import { join } from "@visulima/path";

import { backupFile } from "./backup";
import { detectJsonIndent, readJsonFile } from "./json";
import type { MigrateLogger, MigrationReport } from "./types";
import { addManualStep, addMigrationWarning, bumpPerMigration } from "./types";

const MIGRATION_ID = "sherif";

const SHERIF_SCRIPT_RE = /\bsherif\b/;

/**
 * Subset of the sherif config we recognise. Sherif is configured via
 * package.json `sherif` block (or CLI flags). The shape is borrowed
 * from sherif's own config struct.
 *
 * Reference: https://github.com/QuiiBz/sherif
 */
interface SherifConfig {
    /** Glob list — deps to skip across all rules. */
    "ignore-dependencies"?: string[];
    /** Glob list — workspace package names to skip. */
    "ignore-packages"?: string[];
    /** Glob list — workspace paths to skip. */
    "ignore-paths"?: string[];
    /** Sherif rule names to disable globally. */
    "ignore-rules"?: string[];
}

/**
 * Sherif → vis lint name mapping. Used to translate sherif's
 * `ignore-rules` array into vis-equivalent guidance. Rules without
 * a vis equivalent map to `undefined` and surface as a manual step.
 */
const RULE_MAP: Readonly<Record<string, string | undefined>> = {
    "empty-dependencies": "empty-deps",
    "multiple-dependency-versions": "workspace-versions",
    "non-existant-packages": "dead-workspace-patterns",
    "packages-without-package-json": "missing-package-json",
    "root-package-dependencies": "root-deps",
    "root-package-manager-field": "root-package-manager",
    "root-package-private-field": "root-private",
    "types-in-dependencies": "types-in-deps",
    // sherif's unordered-dependencies has no `vis lint` equivalent —
    // `vis sort-package-json` covers the same surface, but it's a separate
    // command rather than a lint rule.
    "unordered-dependencies": undefined,
    "unsync-similar-dependencies": "similar-deps",
};

const ALL_VIS_LINTS_FOR_SHERIF: string[] = Object.values(RULE_MAP).filter((v): v is string => v !== undefined);

// Detection ---------------------------------------------------------

const detectSherifConfig = (root: string): "package.json" | undefined => {
    const packageJsonPath = join(root, "package.json");

    if (!isAccessibleSync(packageJsonPath)) {
        return undefined;
    }

    const pkg = readJsonFile<Record<string, unknown>>(packageJsonPath);

    return pkg?.["sherif"] ? "package.json" : undefined;
};

const detectSherifInstallation = (root: string): boolean => {
    const packageJsonPath = join(root, "package.json");

    if (!isAccessibleSync(packageJsonPath)) {
        return false;
    }

    const pkg = readJsonFile<{ dependencies?: Record<string, string>; devDependencies?: Record<string, string>; scripts?: Record<string, string> }>(
        packageJsonPath,
    );

    if (!pkg) {
        return false;
    }

    if (pkg.devDependencies?.["sherif"] || pkg.dependencies?.["sherif"]) {
        return true;
    }

    if (pkg.scripts) {
        for (const value of Object.values(pkg.scripts)) {
            if (typeof value === "string" && SHERIF_SCRIPT_RE.test(value)) {
                return true;
            }
        }
    }

    return false;
};

// Config extraction -------------------------------------------------

const extractSherifFromPackageJson = (root: string): SherifConfig | undefined => {
    const pkg = readJsonFile<{ sherif?: SherifConfig }>(join(root, "package.json"));

    return pkg?.sherif;
};

// Translation -------------------------------------------------------

interface TranslatedRules {
    /** Sherif rules with no vis equivalent — surface to user. */
    unmapped: string[];
    /** vis lint names the user wants disabled (rules from `ignore-rules`). */
    visDisabled: string[];
}

const translateIgnoreRules = (config: SherifConfig, report: MigrationReport): TranslatedRules => {
    const out: TranslatedRules = { unmapped: [], visDisabled: [] };

    if (!Array.isArray(config["ignore-rules"])) {
        return out;
    }

    for (const rule of config["ignore-rules"]) {
        if (typeof rule !== "string" || rule.length === 0) {
            continue;
        }

        const mapped = RULE_MAP[rule];

        if (mapped === undefined) {
            if (rule === "unordered-dependencies") {
                addMigrationWarning(
                    report,
                    "sherif rule `unordered-dependencies` has no `vis lint` equivalent — vis covers ordering via `vis sort-package-json` (separate command). No migration needed; skip running it if you don't want it.",
                );
            } else if (Object.hasOwn(RULE_MAP, rule)) {
                out.unmapped.push(rule);
            } else {
                addMigrationWarning(report, `sherif rule \`${rule}\` is unknown to vis migrate — skipped.`);
            }

            continue;
        }

        out.visDisabled.push(mapped);
    }

    return out;
};

const buildPositiveLintCommand = (visDisabled: string[]): string => {
    const enabled = ALL_VIS_LINTS_FOR_SHERIF.filter((lint) => !visDisabled.includes(lint));

    if (enabled.length === 0) {
        return "vis lint";
    }

    return `vis lint ${enabled.map((lint) => `--${lint}`).join(" ")}`;
};

// Cleanup -----------------------------------------------------------

const removeSherifFromPackageJson = (
    root: string,
    useEditorconfig?: boolean,
): {
    configRemoved: boolean;
    dependencyRemoved: boolean;
    removedScripts: { name: string; value: string }[];
    scriptCount: number;
} => {
    const packageJsonPath = join(root, "package.json");
    const result: {
        configRemoved: boolean;
        dependencyRemoved: boolean;
        removedScripts: { name: string; value: string }[];
        scriptCount: number;
    } = { configRemoved: false, dependencyRemoved: false, removedScripts: [], scriptCount: 0 };

    if (!isAccessibleSync(packageJsonPath)) {
        return result;
    }

    const content = readFileSync(packageJsonPath);
    const pkg = JSON.parse(content) as Record<string, unknown>;
    let modified = false;

    if (pkg["sherif"]) {
        delete pkg["sherif"];
        modified = true;
        result.configRemoved = true;
    }

    for (const key of ["dependencies", "devDependencies"] as const) {
        const bucket = pkg[key] as Record<string, string> | undefined;

        if (bucket?.["sherif"]) {
            delete bucket["sherif"];
            modified = true;
            result.dependencyRemoved = true;
        }
    }

    const scripts = pkg["scripts"] as Record<string, string> | undefined;

    if (scripts) {
        const kept: Record<string, string> = {};

        for (const [name, value] of Object.entries(scripts)) {
            if (typeof value === "string" && SHERIF_SCRIPT_RE.test(value)) {
                result.scriptCount += 1;
                result.removedScripts.push({ name, value });
                modified = true;
            } else {
                kept[name] = value;
            }
        }

        if (result.scriptCount > 0) {
            if (Object.keys(kept).length === 0) {
                delete pkg["scripts"];
            } else {
                pkg["scripts"] = kept;
            }
        }
    }

    if (modified) {
        const indent = detectJsonIndent(packageJsonPath, content, { useEditorconfig });

        backupFile(packageJsonPath);
        writeFileSync(packageJsonPath, `${JSON.stringify(pkg, undefined, indent)}\n`, "utf8");
    }

    return result;
};

const HOOK_CANDIDATES = [".husky/pre-commit", ".vis/hooks/pre-commit", ".git/hooks/pre-commit"] as const;
const CI_PATH_CANDIDATES = [".github/workflows", ".gitlab-ci.yml", ".circleci/config.yml", ".woodpecker.yml", ".drone.yml"] as const;

const detectHookReferences = (root: string, report: MigrationReport): string[] => {
    const hits: string[] = [];

    for (const rel of HOOK_CANDIDATES) {
        const abs = join(root, rel);

        if (!isAccessibleSync(abs)) {
            continue;
        }

        if (SHERIF_SCRIPT_RE.test(readFileSync(abs))) {
            hits.push(rel);
            addManualStep(report, `Update ${rel} — replace \`sherif\` invocation with \`vis lint\`.`);
        }
    }

    return hits;
};

const detectCiReferences = (root: string, report: MigrationReport): string[] => {
    const hits: string[] = [];

    const scanFile = (rel: string): void => {
        const abs = join(root, rel);

        if (!isAccessibleSync(abs)) {
            return;
        }

        if (SHERIF_SCRIPT_RE.test(readFileSync(abs))) {
            hits.push(rel);
            addManualStep(report, `Update ${rel} — replace \`sherif\` invocation with \`vis lint\`.`);
        }
    };

    for (const rel of CI_PATH_CANDIDATES) {
        const abs = join(root, rel);

        if (!isAccessibleSync(abs)) {
            continue;
        }

        if (rel === ".github/workflows") {
            try {
                for (const entry of readdirSync(abs)) {
                    if (entry.endsWith(".yml") || entry.endsWith(".yaml")) {
                        scanFile(`.github/workflows/${entry}`);
                    }
                }
            } catch {
                // Unreadable directory — best-effort; skip.
            }

            continue;
        }

        scanFile(rel);
    }

    return hits;
};

// Orchestrator ------------------------------------------------------

const applyMigration = (
    root: string,
    config: SherifConfig,
    options: { silent?: boolean; useEditorconfig?: boolean },
    logger: MigrateLogger,
    report: MigrationReport,
): void => {
    const translated = translateIgnoreRules(config, report);

    if (translated.visDisabled.length > 0) {
        const command = buildPositiveLintCommand(translated.visDisabled);

        addManualStep(
            report,
            `sherif's \`ignore-rules\` was set to [${translated.visDisabled
                .map((r) => JSON.stringify(r))
                .join(", ")}] (vis names). vis has no global rule-disable; replace any \`sherif\` script with the explicit positive list: \`${command}\`.`,
        );
    }

    if (translated.unmapped.length > 0) {
        addMigrationWarning(
            report,
            `sherif rule(s) [${translated.unmapped.map((r) => JSON.stringify(r)).join(", ")}] could not be mapped — please re-evaluate manually.`,
        );
    }

    if (Array.isArray(config["ignore-dependencies"]) && config["ignore-dependencies"].length > 0) {
        addManualStep(
            report,
            `sherif's \`ignore-dependencies\` was set to [${config["ignore-dependencies"]
                .map((d) => JSON.stringify(d))
                .join(
                    ", ",
                )}]. Mirror this in vis.config.ts under \`policy.workspaceVersions.ignore\`, \`policy.customTypes.ignore\`, \`policy.typesInDeps.ignore\` (and \`policy.redefineRoot.ignore\`) for the lints where it applies.`,
        );
    }

    if (Array.isArray(config["ignore-packages"]) && config["ignore-packages"].length > 0) {
        addMigrationWarning(
            report,
            `sherif's \`ignore-packages\` was set to [${config["ignore-packages"]
                .map((p) => JSON.stringify(p))
                .join(
                    ", ",
                )}] — vis has no global package-skip yet (only per-rule scoping via policy.bannedDeps.{packages,paths}). Tracked alongside the dep filter work.`,
        );
        addManualStep(report, "Re-evaluate sherif `ignore-packages` — vis has no equivalent global filter yet.");
    }

    if (Array.isArray(config["ignore-paths"]) && config["ignore-paths"].length > 0) {
        addMigrationWarning(
            report,
            `sherif's \`ignore-paths\` was set to [${config["ignore-paths"].map((p) => JSON.stringify(p)).join(", ")}] — vis has no global path-skip yet.`,
        );
        addManualStep(report, "Re-evaluate sherif `ignore-paths` — vis has no equivalent global filter yet.");
    }

    const hookHits = detectHookReferences(root, report);

    if (hookHits.length > 0 && !options.silent) {
        logger.warn(`Found sherif reference in ${String(hookHits.length)} hook file(s) — see manualSteps for details.`);
    }

    const ciHits = detectCiReferences(root, report);

    if (ciHits.length > 0 && !options.silent) {
        logger.warn(`Found sherif reference in ${String(ciHits.length)} CI file(s) — see manualSteps for details.`);
    }

    const { configRemoved, dependencyRemoved, removedScripts, scriptCount } = removeSherifFromPackageJson(root, options.useEditorconfig);

    if (configRemoved && !options.silent) {
        logger.info("Removed `sherif` block from package.json");
    }

    if (configRemoved) {
        bumpPerMigration(report, MIGRATION_ID, "removedConfigCount");
    }

    if (dependencyRemoved) {
        bumpPerMigration(report, MIGRATION_ID, "removedPackageCount");
    }

    if (scriptCount > 0) {
        bumpPerMigration(report, MIGRATION_ID, "rewrittenScriptCount", scriptCount);

        for (const { name, value } of removedScripts) {
            addManualStep(
                report,
                `Recreate script \`${name}\` (removed; was \`${value}\`). Replace \`sherif\` with \`vis lint\` (sherif's lint surface ≈ \`vis lint\`).`,
            );
        }

        if (!options.silent) {
            logger.info(`Removed ${String(scriptCount)} script(s) referencing \`sherif\`. Replace with \`vis lint\`.`);
        }
    }
};

/**
 * Migrates a sherif configuration to vis. Strips the sherif block /
 * dep / scripts from package.json, maps `ignore-rules` to vis lint
 * names (surfacing a positive `vis lint --&lt;rule>` script suggestion
 * since vis has no global rule-disable), and routes unsupported keys
 * (`ignore-dependencies`, `ignore-packages`, `ignore-paths`) to
 * manualSteps so the reviewer sees what's still pending.
 *
 * Reference: https://github.com/QuiiBz/sherif (MIT). See the
 * `__fixtures__/sherif-lint/README.md` for the per-rule mapping.
 */
const migrateSherif = (
    root: string,
    options: { dryRun: boolean; silent?: boolean; useEditorconfig?: boolean },
    logger: MigrateLogger,
    report: MigrationReport,
): boolean => {
    const hasConfig = detectSherifConfig(root);
    const hasInstall = detectSherifInstallation(root);

    if (!hasConfig && !hasInstall) {
        if (!options.silent) {
            logger.info("No sherif configuration or installation found — nothing to migrate.");
        }

        return false;
    }

    const config = extractSherifFromPackageJson(root) ?? {};

    if (options.dryRun) {
        const translated = translateIgnoreRules(config, report);

        detectHookReferences(root, report);
        detectCiReferences(root, report);

        if (!options.silent) {
            if (hasConfig) {
                logger.info("[dry-run] Would remove `sherif` block from package.json");
            }

            if (hasInstall) {
                logger.info("[dry-run] Would strip `sherif` from devDependencies/scripts");
            }

            if (translated.visDisabled.length > 0) {
                const command = buildPositiveLintCommand(translated.visDisabled);

                logger.info(`[dry-run] Suggested replacement script: ${command}`);
            }
        }

        return true;
    }

    applyMigration(root, config, options, logger, report);

    return true;
};

export {
    buildPositiveLintCommand,
    detectSherifConfig,
    detectSherifInstallation,
    extractSherifFromPackageJson,
    migrateSherif,
    removeSherifFromPackageJson,
    RULE_MAP,
    translateIgnoreRules,
};
