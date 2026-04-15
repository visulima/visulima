import { existsSync, readFileSync, writeFileSync } from "node:fs";

import { join } from "@visulima/path";

import { backupFile } from "./backup";
import { readJsonFile } from "./json";
import type { MigrateLogger, MigrationReport } from "./types";
import { addManualStep, addMigrationWarning, bumpPerMigration } from "./types";

// Gitleaks artifacts are mostly format-compatible with @visulima/secret-scanner:
// - `gitleaks.toml` / `.gitleaks.toml` — same schema; the scanner accepts it via --config
// - `.gitleaksignore` — same fingerprint format (file:ruleID:startLine)
// - baseline JSON — same fields (mapped from RuleID -> ruleId etc. Gitleaks uses PascalCase;
//   our scanner uses camelCase. Auto-convert below.)
//
// What needs rewriting:
// - package.json scripts calling `gitleaks`
// - pre-commit hooks (.husky/*, .vis-hooks/*)
// - CI workflows (noted as manual step — too brittle to auto-edit)

const GITLEAKS_CONFIG_NAMES = ["gitleaks.toml", ".gitleaks.toml"];
const GITLEAKS_BASELINE_CANDIDATES = ["gitleaks-report.json", ".gitleaks-report.json", "baseline.json"];

interface GitleaksUpstreamFinding {
    Author?: string;
    Commit?: string;
    Date?: string;
    Description?: string;
    Email?: string;
    EndColumn?: number;
    EndLine?: number;
    Entropy?: number;
    File?: string;
    Fingerprint?: string;
    Match?: string;
    Message?: string;
    RuleID?: string;
    Secret?: string;
    StartColumn?: number;
    StartLine?: number;
    Tags?: string[];
}

const detectGitleaksConfig = (root: string): string | undefined => GITLEAKS_CONFIG_NAMES.find((name) => existsSync(join(root, name)));

const detectGitleaksIgnore = (root: string): string | undefined => {
    const path = join(root, ".gitleaksignore");

    return existsSync(path) ? path : undefined;
};

const detectGitleaksBaseline = (root: string): string | undefined => {
    for (const name of GITLEAKS_BASELINE_CANDIDATES) {
        const path = join(root, name);

        if (!existsSync(path)) {
            continue;
        }

        try {
            const parsed = JSON.parse(readFileSync(path, "utf8")) as unknown;

            // Heuristic: gitleaks reports start with PascalCase RuleID
            if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === "object" && parsed[0] !== null && "RuleID" in parsed[0]) {
                return path;
            }
        } catch {
            // not a JSON baseline; skip
        }
    }

    return undefined;
};

const convertBaseline = (upstream: GitleaksUpstreamFinding[]): unknown[] =>
    upstream.map((f) => {
        return {
            description: f.Description ?? "",
            endColumn: f.EndColumn ?? 0,
            endLine: f.EndLine ?? f.StartLine ?? 0,
            entropy: f.Entropy ?? 0,
            file: f.File ?? "",
            match: f.Match ?? "",
            ruleId: f.RuleID ?? "",
            secret: f.Secret ?? "",
            startColumn: f.StartColumn ?? 0,
            startLine: f.StartLine ?? 0,
            tags: f.Tags ?? [],
        };
    });

const migrateBaseline = (root: string, dryRun: boolean, logger: MigrateLogger, report: MigrationReport): void => {
    const source = detectGitleaksBaseline(root);

    if (!source) {
        return;
    }

    const target = join(root, ".secrets-baseline.json");

    if (existsSync(target) && source !== target) {
        addMigrationWarning(report, `.secrets-baseline.json already exists — leaving ${source} in place`);

        return;
    }

    const raw = readJsonFile<GitleaksUpstreamFinding[]>(source);

    if (!Array.isArray(raw)) {
        addMigrationWarning(report, `Could not parse ${source} as a gitleaks baseline`);

        return;
    }

    const converted = convertBaseline(raw);

    if (dryRun) {
        logger.info(`[dry-run] Would convert ${source} -> ${target} (${String(converted.length)} findings)`);

        return;
    }

    backupFile(source, report);
    writeFileSync(target, `${JSON.stringify(converted, null, 4)}\n`);
    logger.info(`Converted ${source} -> ${target} (${String(converted.length)} findings)`);
    bumpPerMigration(report, "gitleaks", "rewrittenScriptCount");
};

const rewriteScripts = (root: string, dryRun: boolean, logger: MigrateLogger, report: MigrationReport): void => {
    const packageJsonPath = join(root, "package.json");

    if (!existsSync(packageJsonPath)) {
        return;
    }

    const pkg = readJsonFile<{ devDependencies?: Record<string, string>; scripts?: Record<string, string> }>(packageJsonPath);

    if (!pkg) {
        return;
    }

    // If the user has a custom gitleaks config, thread it through so migrated
    // commands run against their ruleset (not just our bundled one).
    const customConfig = detectGitleaksConfig(root);
    const replacement = customConfig ? `vis secrets --config ${customConfig}` : "vis secrets";
    let changed = false;

    if (pkg.scripts) {
        for (const [name, value] of Object.entries(pkg.scripts)) {
            if (typeof value === "string" && /\bgitleaks\b/.test(value)) {
                const rewritten = value.replaceAll(/\bgitleaks(?:\s+(?:detect|protect))?\b[^\n&|;]*/g, replacement).trim();

                if (rewritten !== value) {
                    pkg.scripts[name] = rewritten;
                    changed = true;
                    logger.info(`  scripts.${name}: "${value}" -> "${rewritten}"`);
                    bumpPerMigration(report, "gitleaks", "rewrittenScriptCount");
                }
            }
        }
    }

    if (pkg.devDependencies) {
        const devDeps = pkg.devDependencies;

        for (const dep of ["gitleaks", "@gitleaks/cli"]) {
            if (dep in devDeps) {
                // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
                delete devDeps[dep];
                changed = true;
                bumpPerMigration(report, "gitleaks", "removedPackageCount");
                logger.info(`  removed devDependency: ${dep}`);
            }
        }
    }

    if (!changed) {
        return;
    }

    if (dryRun) {
        logger.info(`[dry-run] Would update ${packageJsonPath}`);

        return;
    }

    backupFile(packageJsonPath, report);
    writeFileSync(packageJsonPath, `${JSON.stringify(pkg, null, 4)}\n`);
};

const rewriteHooks = (root: string, dryRun: boolean, logger: MigrateLogger, report: MigrationReport): void => {
    const candidates = [".husky/pre-commit", ".vis-hooks/pre-commit", ".git/hooks/pre-commit"];
    const customConfig = detectGitleaksConfig(root);
    const replacement = customConfig ? `vis secrets --staged --config ${customConfig}` : "vis secrets --staged";

    for (const rel of candidates) {
        const abs = join(root, rel);

        if (!existsSync(abs)) {
            continue;
        }

        const content = readFileSync(abs, "utf8");

        if (!/\bgitleaks\b/.test(content)) {
            continue;
        }

        const rewritten = content.replaceAll(/\bgitleaks(?:\s+(?:detect|protect))?\b[^\n&|;]*/g, replacement);

        if (dryRun) {
            logger.info(`[dry-run] Would rewrite ${abs}`);
            continue;
        }

        backupFile(abs, report);
        writeFileSync(abs, rewritten);
        report.gitHooksConfigured = true;
        logger.info(`Rewrote gitleaks invocation in ${rel}`);
    }
};

const migrateGitleaks = (root: string, options: { dryRun: boolean; silent?: boolean }, logger: MigrateLogger, report: MigrationReport): boolean => {
    const configPath = detectGitleaksConfig(root);
    const ignorePath = detectGitleaksIgnore(root);
    const hasArtifacts = Boolean(configPath ?? ignorePath ?? detectGitleaksBaseline(root));

    if (!hasArtifacts) {
        if (!options.silent) {
            logger.info("No gitleaks artifacts found — nothing to migrate.");
        }

        return false;
    }

    if (configPath) {
        logger.info(`Keeping ${configPath} as-is (compatible with vis secrets --config).`);
        addManualStep(report, `Run \`vis secrets --config ${configPath}\` or rename to .gitleaksignore-compatible defaults.`);
    }

    if (ignorePath) {
        logger.info(`Keeping ${ignorePath} as-is (same fingerprint format).`);
    }

    migrateBaseline(root, options.dryRun, logger, report);
    rewriteScripts(root, options.dryRun, logger, report);
    rewriteHooks(root, options.dryRun, logger, report);

    addManualStep(report, "Review CI workflows (.github/workflows/*.yml) for gitleaks-action calls — replace with `vis secrets`.");

    return true;
};

export { convertBaseline, detectGitleaksBaseline, detectGitleaksConfig, detectGitleaksIgnore, migrateGitleaks };
