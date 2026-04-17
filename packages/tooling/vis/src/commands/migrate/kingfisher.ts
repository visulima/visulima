import { existsSync, readFileSync, writeFileSync } from "node:fs";

import { join } from "@visulima/path";

import { backupFile } from "./backup";
import { readJsonFile } from "./json";
import type { MigrateLogger, MigrationReport } from "./types";
import { addManualStep, addMigrationWarning, bumpPerMigration } from "./types";

// MongoDB Kingfisher (Apache-2.0) and @visulima/secret-scanner detect the same
// kinds of secrets and share most rule provenance (we import Kingfisher's
// ruleset via `scripts/build-rules.mjs`), but the two tools differ where it
// matters for a migration:
//
// - **Baseline format**. Kingfisher writes a YAML file with xxhash-based
//   fingerprints (see upstream `src/baseline.rs`). We write JSON with a
//   SHA-256-based content-hash. Neither hash is recoverable from the
//   baseline alone — the secret has to pass through the scanner again — so
//   we back up the YAML and recommend a fresh `vis secrets --init`.
// - **Custom rule files**. Kingfisher rules are YAML with a richer schema
//   (`pattern_requirements`, `depends_on_rule`, `validation`). We ship the
//   full bundled ruleset already; user-authored Kingfisher rules need the
//   `scripts/kingfisher-converter.mjs` pass (manual step).
// - **Scripts / hooks**. `kingfisher scan` -> `vis secrets`; `kingfisher
//   validate` -> `vis secrets --validate`. Rewritten automatically.
// - **Inline ignore token**. Kingfisher uses `kingfisher:ignore`. The
//   scanner already accepts `gitleaks:allow` / `secret-scanner:allow` —
//   flagged as a manual step so users can do a repo-wide replace at their
//   own pace.

const KINGFISHER_BASELINE_CANDIDATES = ["kingfisher-baseline.yaml", ".kingfisher-baseline.yaml", "kingfisher-baseline.yml", ".kingfisher-baseline.yml"];
const KINGFISHER_RULES_CANDIDATES = ["kingfisher-rules.yml", "kingfisher-rules.yaml", ".kingfisher-rules.yml", ".kingfisher-rules.yaml"];

interface KingfisherBaselineRecord {
    filepath: string;
    fingerprint: string;
    linenum: number;
}

const detectKingfisherBaseline = (root: string): string | undefined => KINGFISHER_BASELINE_CANDIDATES.find((name) => existsSync(join(root, name)));

const detectKingfisherRules = (root: string): string | undefined => KINGFISHER_RULES_CANDIDATES.find((name) => existsSync(join(root, name)));

// Kingfisher's baseline YAML has a flat, well-known shape:
//
//   ExactFindings:
//     matches:
//       - filepath: src/app.ts
//         fingerprint: 16hexchars
//         linenum: 42
//         lastupdated: 2025-01-01T00:00:00Z
//
// We hand-parse this rather than adding a `yaml` dep: the schema is fixed
// upstream and we only consume three fields. Anything weirder falls back to
// a warning + manual step. Returns records in file order.
const parseKingfisherBaseline = (text: string): KingfisherBaselineRecord[] => {
    const records: KingfisherBaselineRecord[] = [];
    let current: Partial<KingfisherBaselineRecord> = {};

    for (const rawLine of text.split(/\r?\n/)) {
        const line = rawLine.replace(/#.*$/, "");

        if (/^\s*-\s*filepath\s*:/.test(line) || /^\s*-\s*$/.test(line)) {
            if (current.filepath && typeof current.linenum === "number" && current.fingerprint) {
                records.push(current as KingfisherBaselineRecord);
            }

            current = {};
        }

        const filepath = /filepath\s*:\s*(.+?)\s*$/.exec(line);

        if (filepath?.[1]) {
            current.filepath = filepath[1].replaceAll(/^["']|["']$/g, "");

            continue;
        }

        const fingerprint = /fingerprint\s*:\s*(.+?)\s*$/.exec(line);

        if (fingerprint?.[1]) {
            current.fingerprint = fingerprint[1].replaceAll(/^["']|["']$/g, "");

            continue;
        }

        const linenum = /linenum\s*:\s*(\d+)/.exec(line);

        if (linenum?.[1]) {
            current.linenum = Number.parseInt(linenum[1], 10);
        }
    }

    if (current.filepath && typeof current.linenum === "number" && current.fingerprint) {
        records.push(current as KingfisherBaselineRecord);
    }

    return records;
};

// Kingfisher baselines carry `(filepath, xxhash, linenum)` — our scanner
// needs `(file, ruleId, startLine, secret)` to compute its own fingerprint.
// We can't recover the rule id or secret from an xxhash, so the conversion is
// lossy: we emit placeholder entries that will NOT suppress findings on their
// own. Users run `vis secrets` once to regenerate the real baseline; the
// placeholder file is only useful as a diff target for manual triage.
interface PlaceholderBaselineEntry {
    _kingfisherMigration: {
        legacyFingerprint: string;
        note: string;
    };
    description: string;
    endColumn: number;
    endLine: number;
    entropy: number;
    file: string;
    match: string;
    ruleId: string;
    secret: string;
    startColumn: number;
    startLine: number;
    tags: string[];
}

const toPlaceholderEntry = (record: KingfisherBaselineRecord): PlaceholderBaselineEntry => {
    return {
        _kingfisherMigration: {
            legacyFingerprint: record.fingerprint,
            note: "Kingfisher xxhash — regenerate by running `vis secrets --update-baseline`.",
        },
        description: "",
        endColumn: 0,
        endLine: record.linenum,
        entropy: 0,
        file: record.filepath,
        match: "",
        ruleId: "",
        secret: "",
        startColumn: 0,
        startLine: record.linenum,
        tags: [],
    };
};

const migrateBaseline = (root: string, dryRun: boolean, logger: MigrateLogger, report: MigrationReport): void => {
    const name = detectKingfisherBaseline(root);

    if (!name) {
        return;
    }

    const source = join(root, name);
    let records: KingfisherBaselineRecord[];

    try {
        records = parseKingfisherBaseline(readFileSync(source, "utf8"));
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);

        addMigrationWarning(report, `Could not parse ${name} as a Kingfisher baseline: ${message}`);

        return;
    }

    if (records.length === 0) {
        addMigrationWarning(report, `${name} contained no recognisable records — leaving it in place for manual review.`);

        return;
    }

    const target = join(root, ".secrets-baseline.json");

    if (existsSync(target)) {
        addMigrationWarning(report, `.secrets-baseline.json already exists — leaving Kingfisher baseline at ${name} for manual merge.`);

        return;
    }

    const placeholders = records.map((r) => toPlaceholderEntry(r));

    if (dryRun) {
        logger.info(`[dry-run] Would convert ${name} -> .secrets-baseline.json (${String(placeholders.length)} placeholder finding(s))`);
        addManualStep(
            report,
            "Run `vis secrets --update-baseline` after migration — Kingfisher xxhash fingerprints aren't interchangeable with our content-hash.",
        );

        return;
    }

    backupFile(source, report);
    writeFileSync(target, `${JSON.stringify(placeholders, null, 4)}\n`);
    logger.info(`Converted ${name} -> .secrets-baseline.json (${String(placeholders.length)} placeholder finding(s))`);
    addManualStep(report, "Run `vis secrets --update-baseline` — the converted entries are placeholders until the scanner computes real fingerprints.");
    bumpPerMigration(report, "kingfisher", "rewrittenScriptCount");
};

// Matches `kingfisher scan|validate|rules|update|manage-baseline <args>` up to
// the next pipe/redirect/newline so chained commands (`kingfisher scan && ...`)
// only replace the kingfisher invocation, not the rest of the line.
const KINGFISHER_INVOCATION_RE = /\bkingfisher(?:\s+(?:scan|validate|rules|update|manage-baseline|report|github|gitlab|bitbucket))?\b[^\n&|;]*/g;

const rewriteScripts = (root: string, dryRun: boolean, logger: MigrateLogger, report: MigrationReport): void => {
    const packageJsonPath = join(root, "package.json");

    if (!existsSync(packageJsonPath)) {
        return;
    }

    const pkg = readJsonFile<{ devDependencies?: Record<string, string>; scripts?: Record<string, string> }>(packageJsonPath);

    if (!pkg) {
        return;
    }

    const rulesPath = detectKingfisherRules(root);
    const replacement = rulesPath ? `vis secrets --config ${rulesPath}` : "vis secrets";
    let changed = false;

    if (pkg.scripts) {
        for (const [name, value] of Object.entries(pkg.scripts)) {
            if (typeof value !== "string" || !/\bkingfisher\b/.test(value)) {
                continue;
            }

            const rewritten = value
                .replaceAll(KINGFISHER_INVOCATION_RE, (match) => (match.includes("validate") ? `${replacement} --validate` : replacement))
                .trim();

            if (rewritten !== value) {
                pkg.scripts[name] = rewritten;
                changed = true;
                logger.info(`  scripts.${name}: "${value}" -> "${rewritten}"`);
                bumpPerMigration(report, "kingfisher", "rewrittenScriptCount");
            }
        }
    }

    if (pkg.devDependencies) {
        const devDeps = pkg.devDependencies;

        // Kingfisher is a Rust binary, not an npm package — users typically
        // install via cargo/brew — but a handful of wrappers do ship on npm.
        for (const dep of ["kingfisher", "@mongodb/kingfisher", "kingfisher-scanner"]) {
            if (dep in devDeps) {
                // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- Iterating a fixed allow-list of dep names we control.
                delete devDeps[dep];
                changed = true;
                bumpPerMigration(report, "kingfisher", "removedPackageCount");
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
    const rulesPath = detectKingfisherRules(root);
    const replacement = rulesPath ? `vis secrets --staged --config ${rulesPath}` : "vis secrets --staged";

    for (const rel of HOOK_CANDIDATES) {
        const abs = join(root, rel);

        if (!existsSync(abs)) {
            continue;
        }

        const content = readFileSync(abs, "utf8");

        if (!/\bkingfisher\b/.test(content)) {
            continue;
        }

        const rewritten = content.replaceAll(KINGFISHER_INVOCATION_RE, replacement);

        if (dryRun) {
            logger.info(`[dry-run] Would rewrite ${abs}`);

            continue;
        }

        backupFile(abs, report);
        writeFileSync(abs, rewritten);
        report.gitHooksConfigured = true;
        logger.info(`Rewrote kingfisher invocation in ${rel}`);
    }
};

const HOOK_CANDIDATES = [".husky/pre-commit", ".vis-hooks/pre-commit", ".git/hooks/pre-commit"];

const hasKingfisherRef = (path: string): boolean => {
    if (!existsSync(path)) {
        return false;
    }

    try {
        return /\bkingfisher\b/.test(readFileSync(path, "utf8"));
    } catch {
        return false;
    }
};

const migrateKingfisher = (root: string, options: { dryRun: boolean; silent?: boolean }, logger: MigrateLogger, report: MigrationReport): boolean => {
    const baselinePath = detectKingfisherBaseline(root);
    const rulesPath = detectKingfisherRules(root);
    const hasScriptsRef = hasKingfisherRef(join(root, "package.json"));
    const hasHookRef = HOOK_CANDIDATES.some((rel) => hasKingfisherRef(join(root, rel)));
    const hasArtifacts = Boolean(baselinePath ?? rulesPath) || hasScriptsRef || hasHookRef;

    if (!hasArtifacts) {
        if (!options.silent) {
            logger.info("No Kingfisher artifacts found — nothing to migrate.");
        }

        return false;
    }

    if (rulesPath) {
        logger.info(`Found custom Kingfisher ruleset at ${rulesPath} — keeping it for now.`);
        addManualStep(
            report,
            `Convert ${rulesPath} to gitleaks-shaped JSON using \`packages/tooling/secret-scanner/scripts/kingfisher-converter.mjs\`, then point \`vis secrets --config\` at the result.`,
        );
    }

    if (baselinePath) {
        migrateBaseline(root, options.dryRun, logger, report);
    }

    rewriteScripts(root, options.dryRun, logger, report);
    rewriteHooks(root, options.dryRun, logger, report);

    addManualStep(report, "Replace `# kingfisher:ignore` markers with `# secret-scanner:allow` (or keep `# gitleaks:allow` — the scanner accepts both).");
    addManualStep(report, "Review CI workflows (.github/workflows/*.yml) for Kingfisher action/docker invocations — replace with `vis secrets`.");

    return true;
};

export { detectKingfisherBaseline, detectKingfisherRules, migrateKingfisher, parseKingfisherBaseline };
