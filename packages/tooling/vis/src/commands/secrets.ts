import type { Command } from "@visulima/cerebro";
import colorize from "@visulima/colorize";

const { dim, green, yellow } = colorize;
import { isAccessibleSync } from "@visulima/fs";
import { join, relative, resolve } from "@visulima/path";
import type { Confidence, Finding, RuleInfo, ScanOptions } from "@visulima/secret-scanner";
import { inspectRuleset, listRequiredValidators, listRules, scan, scanFiles } from "@visulima/secret-scanner";

import { failure, info, note, success, warn } from "../output";
import { diffBaseline, toRelativeFinding, writeBaseline } from "../secrets/baseline";
import { formatSarif, formatText } from "../secrets/format";
import { filesSince, hasGit, stagedFiles } from "../secrets/git";
import { startSpinner } from "../secrets/spinner";

type RepeatableString = string | string[];
type ReportFormat = "json" | "sarif" | "text";

interface SecretsFlags {
    affected?: boolean;
    baseline?: string;
    concurrency?: number;
    config?: string;
    dryRun?: boolean;
    enableRule?: RepeatableString;
    exclude?: RepeatableString;
    excludeFrom?: RepeatableString;
    excludeRule?: RepeatableString;
    format?: ReportFormat;
    includeHidden?: boolean;
    includeRule?: RepeatableString;
    init?: boolean;
    listRules?: boolean;
    listValidators?: boolean;
    maxSize?: number;
    minConfidence?: string;
    noExtendBundled?: boolean;
    noGitignore?: boolean;
    onlyVerified?: boolean;
    quiet?: boolean;
    redact?: boolean;
    replaceBaseline?: boolean;
    since?: string;
    staged?: boolean;
    updateBaseline?: boolean;
    validate?: boolean;
    verbose?: boolean;
}

const DEFAULT_BASELINE = ".secrets-baseline.json";

const toArray = (value: string | string[] | undefined): string[] => {
    if (!value) {
        return [];
    }

    return Array.isArray(value) ? value : [value];
};

const validateFormat = (raw: string | undefined): ReportFormat => {
    const allowed = new Set(["json", "sarif", "text"]);

    if (raw && !allowed.has(raw)) {
        failure(`--format must be one of: ${[...allowed].join(", ")} (got "${raw}")`);
        process.exit(2);
    }

    return (raw ?? "text") as ReportFormat;
};

const validateConfidence = (raw: string | undefined): Confidence | undefined => {
    if (raw === undefined) {
        return undefined;
    }

    const allowed = new Set<Confidence>(["high", "low", "medium"]);

    if (!allowed.has(raw as Confidence)) {
        failure(`--min-confidence must be one of: ${[...allowed].join(", ")} (got "${raw}")`);
        process.exit(2);
    }

    return raw as Confidence;
};

const printListRules = async (scanOptions: ScanOptions, useColor: boolean): Promise<void> => {
    const rules: RuleInfo[] = await listRules(scanOptions);

    process.stdout.write(`${String(rules.length)} rules loaded\n\n`);

    for (const rule of rules) {
        const id = useColor ? yellow(rule.id) : rule.id;
        const tags = rule.tags.length > 0 ? ` ${useColor ? dim(`[${rule.tags.join(", ")}]`) : `[${rule.tags.join(", ")}]`}` : "";

        process.stdout.write(`${id}${tags}\n  ${rule.description}\n`);

        if (rule.keywords.length > 0) {
            const kw = `keywords: ${rule.keywords.slice(0, 6).join(", ")}${rule.keywords.length > 6 ? ", ..." : ""}`;

            process.stdout.write(`  ${useColor ? dim(kw) : kw}\n`);
        }

        process.stdout.write("\n");
    }
};

const printListValidators = async (scanOptions: ScanOptions, useColor: boolean): Promise<void> => {
    const report = await listRequiredValidators(scanOptions);

    if (report.length === 0) {
        process.stdout.write(
            useColor ? `${dim("No non-HTTP validators required by the current ruleset.")}\n` : "No non-HTTP validators required by the current ruleset.\n",
        );

        return;
    }

    process.stdout.write(`${String(report.length)} non-HTTP validator type(s) referenced by the current ruleset:\n\n`);

    for (const entry of report) {
        const title = useColor ? yellow(entry.displayName) : entry.displayName;
        const typeLabel = `(${entry.type}, ${String(entry.ruleCount)} rule${entry.ruleCount === 1 ? "" : "s"})`;

        process.stdout.write(`${title} ${useColor ? dim(typeLabel) : typeLabel}\n`);
        process.stdout.write(`  ${entry.summary}\n`);

        const hint = entry.packageName ? `install: npm add ${entry.packageName}` : "no driver — bespoke implementation required";

        process.stdout.write(`  ${useColor ? dim(hint) : hint}\n\n`);
    }
};

const runInit = async (root: string, scanOptions: ScanOptions, dryRun: boolean): Promise<void> => {
    const baselinePath = join(root, DEFAULT_BASELINE);

    if (!dryRun && isAccessibleSync(baselinePath)) {
        warn(`Detected existing ${DEFAULT_BASELINE} — refusing to overwrite. Delete it first to re-init.`);
        process.exit(1);
    }

    info(dryRun ? "[dry-run] Previewing init — no files will be written." : "Scanning workspace to seed baseline…");
    const spinner = startSpinner("scanning");

    let findings: Finding[];

    try {
        findings = await scan([root], scanOptions);
    } finally {
        spinner.stop();
    }

    if (dryRun) {
        info(`[dry-run] Would create ${DEFAULT_BASELINE} with ${String(findings.length)} finding(s).`);

        return;
    }

    const count = writeBaseline(findings, baselinePath, root, { replace: true });

    success(`Wrote ${DEFAULT_BASELINE} (${String(count)} findings).`);
    note("Commit it. Use `vis secrets --baseline .secrets-baseline.json` in CI. Add path patterns to .gitignore to exclude directories from scanning.");
};

interface VisSecretsConfig {
    baseline?: string;
    config?: ScanOptions["config"];
    redact?: boolean;
    rules?: { enable?: string[]; exclude?: string[]; include?: string[] };
    walk?: {
        excludeFromFiles?: string[];
        excludePatterns?: string[];
        gitignore?: boolean;
        includeHidden?: boolean;
        maxFileSize?: number;
    };
}

/**
 * Resolve scan options by layering (high → low precedence):
 *   CLI flags > vis.config.secrets > built-in defaults.
 */
const resolveScanOptions = (flags: SecretsFlags, visSecrets: VisSecretsConfig | undefined, root: string): ScanOptions => {
    const cfg = visSecrets ?? {};
    const resolvePath = (p: string | undefined): string | undefined => (p ? resolve(root, p) : undefined);
    const pickList = (flag: RepeatableString | undefined, fallback: string[] | undefined): string[] | undefined => {
        const fromFlag = toArray(flag);

        return fromFlag.length > 0 ? fromFlag : fallback;
    };

    const enableRules = pickList(flags.enableRule, cfg.rules?.enable);
    const excludeRules = pickList(flags.excludeRule, cfg.rules?.exclude);
    const includeRules = pickList(flags.includeRule, cfg.rules?.include);
    const excludePatterns = pickList(flags.exclude, cfg.walk?.excludePatterns);
    const excludeFromFlag = toArray(flags.excludeFrom).map((p) => resolve(root, p));
    const excludeFromFiles = excludeFromFlag.length > 0 ? excludeFromFlag : cfg.walk?.excludeFromFiles?.map((p) => resolve(root, p));
    const baselinePath = resolvePath(flags.baseline) ?? resolvePath(cfg.baseline);
    const configPath = resolvePath(flags.config) ?? resolvePath(cfg.config?.path);
    const minConfidence = validateConfidence(flags.minConfidence ?? cfg.config?.minConfidence);

    return {
        baseline: baselinePath,
        concurrency: flags.concurrency,
        config: {
            extendBundled: flags.noExtendBundled ? false : cfg.config?.extendBundled,
            inline: cfg.config?.inline,
            minConfidence,
            onlyVerified: flags.onlyVerified ?? cfg.config?.onlyVerified ?? false,
            path: configPath,
            validate: flags.validate ?? cfg.config?.validate ?? false,
        },
        redact: flags.redact ?? cfg.redact,
        rules: { enable: enableRules, exclude: excludeRules, include: includeRules },
        verbose: flags.verbose ?? false,
        walk: {
            excludeFromFiles,
            excludePatterns,
            gitignore: flags.noGitignore ? false : (cfg.walk?.gitignore ?? true),
            includeHidden: flags.includeHidden ?? cfg.walk?.includeHidden,
            maxFileSize: flags.maxSize ?? cfg.walk?.maxFileSize,
        },
    };
};

const printDiff = (diff: { fresh: Finding[]; resolved: Finding[]; surviving: Finding[] }): void => {
    process.stderr.write(
        `${dim("baseline diff: ")}${green(`+${String(diff.fresh.length)} new`)} · ${yellow(`${String(diff.surviving.length)} unchanged`)} · ${dim(`-${String(diff.resolved.length)} resolved`)}\n`,
    );
};

const chooseScanPaths = async (flags: SecretsFlags, args: string[], root: string): Promise<{ files?: string[]; paths?: string[] }> => {
    if (flags.staged) {
        if (!hasGit(root)) {
            failure("--staged requires a git working tree, and none was detected.");
            process.exit(2);
        }

        return { files: stagedFiles(root) };
    }

    if (flags.since) {
        if (!hasGit(root)) {
            failure("--since requires a git working tree, and none was detected.");
            process.exit(2);
        }

        return { files: filesSince(root, flags.since) };
    }

    if (flags.affected) {
        // Best-effort: derive a file list from `git diff` against a base ref. If the
        // user has the full vis workspace available, they can combine --since with
        // their preferred base (e.g. `--since main`) for more control.
        if (!hasGit(root)) {
            warn("--affected requires git; falling back to full scan");

            return { paths: args && args.length > 0 ? args.map((p) => resolve(root, p)) : [root] };
        }

        const baseRef = process.env["VIS_BASE"] ?? "HEAD~1";

        return { files: filesSince(root, baseRef) };
    }

    return { paths: args && args.length > 0 ? args.map((p) => resolve(root, p)) : [root] };
};

const emitFindings = (findings: Finding[], format: ReportFormat, root: string, useColor: boolean, toolVersion: string, ruleMetadata: RuleInfo[]): void => {
    switch (format) {
        case "json": {
            const view = findings.map((f) => toRelativeFinding(f, root));

            process.stdout.write(`${JSON.stringify(view, null, 2)}\n`);
            break;
        }
        case "sarif": {
            process.stdout.write(`${formatSarif(findings, toolVersion, root, ruleMetadata)}\n`);
            break;
        }
        default: {
            process.stdout.write(`${formatText(findings, root, useColor)}\n`);
        }
    }
};

const secrets: Command = {
    argument: {
        description: "One or more paths to scan (defaults to workspace root)",
        name: "paths",
        type: String,
    },
    description: "Scan a repository for hardcoded secrets and credentials",
    examples: [
        ["vis secrets", "Scan the workspace with grouped, colourised output"],
        ["vis secrets --staged", "Scan only files staged for the current commit (pre-commit hooks)"],
        ["vis secrets --since main", "Scan only files changed since the `main` branch"],
        ["vis secrets --affected", "Scan only projects affected by the current branch"],
        ["vis secrets --init", "Write an initial baseline from current findings"],
        ["vis secrets --list-rules", "Print all bundled detection rules"],
        ["vis secrets --list-validators", "Print non-HTTP validator types in the ruleset + install hints for each"],
        ["vis secrets --exclude-rule generic-api-key --exclude-rule aws-access-token", "Drop noisy rules"],
        ["vis secrets --include-rule stripe-access-token", "Check a single rule"],
        ["vis secrets --enable-rule tag:preset:weak-passwords", "Enable an opt-in rule group additively (defaults still fire)"],
        ["vis secrets --include-rule tag:preset:password-manager", "Restrict output to one opt-in group only"],
        ["vis secrets --min-confidence high", "Drop rules without a high confidence label (CI-friendly precision filter)"],
        ["vis secrets --validate --only-verified", "Live-verify each finding against its provider (one HTTP call per finding)"],
        ["vis secrets --exclude 'dist/**' --exclude-from .secretsignore", "Extra gitignore-syntax exclusions for the walker"],
        ["vis secrets --config ./leaks.json --no-extend-bundled", "Use only the supplied config, skip the bundled ruleset"],
        ["vis secrets --concurrency 4", "Cap the rayon thread pool (0 / omit = auto)"],
        ["vis secrets --baseline .secrets-baseline.json", "Suppress known findings; print diff vs. baseline"],
        ["vis secrets --update-baseline", "Merge current findings into the baseline (use --replace-baseline to overwrite)"],
        ["vis secrets --format sarif > report.sarif", "SARIF output for GitHub code-scanning"],
    ],
    execute: async ({ argument, options, visConfig, workspaceRoot }) => {
        const flags = options as SecretsFlags;
        const args = argument as string[] | undefined;
        const root = workspaceRoot ?? process.cwd();
        const useColor = !flags.quiet && process.stdout.isTTY;
        const visSecrets = (visConfig as { secrets?: VisSecretsConfig } | undefined)?.secrets;
        const scanOptions = resolveScanOptions(flags, visSecrets, root);
        const toolVersion = "0.0.0-alpha"; // vis injects its own version via cerebro; this just tags SARIF.

        if (flags.listRules) {
            await printListRules(scanOptions, useColor);

            return;
        }

        if (flags.listValidators) {
            await printListValidators(scanOptions, useColor);

            return;
        }

        if (flags.init) {
            await runInit(root, scanOptions, flags.dryRun ?? false);

            return;
        }

        const target = await chooseScanPaths(flags, args ?? [], root);

        if (target.files?.length === 0) {
            if (!flags.quiet) {
                success("No files to scan.");
            }

            return;
        }

        const isInteractive = !flags.quiet && !["json", "sarif"].includes(flags.format ?? "text");
        const spinner = isInteractive ? startSpinner("scanning for secrets") : { stop: () => {}, update: () => {} };

        let findings: Finding[];

        try {
            findings = target.files === undefined ? await scan(target.paths ?? [root], scanOptions) : await scanFiles(target.files, scanOptions);
        } catch (error) {
            spinner.stop();
            failure(`secret scan failed: ${error instanceof Error ? error.message : String(error)}`);
            process.exit(2);
        } finally {
            spinner.stop();
        }

        // Optional skipped-rule diagnostics (verbose only)
        if (flags.verbose) {
            const skipped = await inspectRuleset(scanOptions);

            if (skipped.length > 0) {
                warn(`${String(skipped.length)} rule(s) skipped due to invalid regex. First few:`);

                for (const s of skipped.slice(0, 5)) {
                    process.stderr.write(`  - ${s.ruleId}: ${s.reason}\n`);
                }
            }
        }

        const baselineFullPath = scanOptions.baseline ?? join(root, DEFAULT_BASELINE);
        const showDiff = !flags.quiet && isAccessibleSync(baselineFullPath);

        if (flags.updateBaseline) {
            const count = writeBaseline(findings, baselineFullPath, root, { replace: flags.replaceBaseline });

            success(`Baseline updated: ${relative(root, baselineFullPath) || baselineFullPath} now contains ${String(count)} entries.`);

            return;
        }

        const format = validateFormat(flags.format);

        const ruleMetadata = format === "sarif" ? await listRules(scanOptions).catch(() => [] as RuleInfo[]) : [];

        emitFindings(findings, format, root, useColor, toolVersion, ruleMetadata);

        if (format === "text" && showDiff) {
            printDiff(diffBaseline(findings, baselineFullPath, root));
        }

        if (findings.length > 0) {
            if (!flags.quiet) {
                warn(`${String(findings.length)} potential secret(s) found`);
                note("Suppress individual lines with `gitleaks:allow` / `secret-scanner:allow`, or run `vis secrets --update-baseline`.");
            }

            process.exit(1);
        }

        if (!flags.quiet) {
            success("No secrets detected.");
        }
    },
    group: "Security",
    name: "secrets",
    options: [
        { description: "Path to a JSON config (gitleaks-compatible shape). Defaults to the bundled ruleset.", name: "config", type: String },
        {
            description:
                "Drop rules below this author-declared confidence: low (default), medium, high. Rules without a declared confidence (every gitleaks rule) are treated as low, so --min-confidence medium or higher drops them along with explicit low-confidence rules.",
            name: "min-confidence",
            type: String,
        },
        {
            defaultValue: false,
            description:
                "Live-verify each finding against its provider (one HTTP call per finding, max 8 concurrent). Only supports Kingfisher-style HTTP validators with StatusMatch / WordMatch response matchers; other types (gRPC, multi-step, checksum) mark the finding as validation=skipped. WARNING: sends candidate secrets to the provider — some providers alert their security team on failed auth attempts.",
            name: "validate",
            type: Boolean,
        },
        {
            defaultValue: false,
            description: "With --validate, drop every finding whose validation is not 'verified'. Useful for CI gating.",
            name: "only-verified",
            type: Boolean,
        },
        {
            defaultValue: false,
            description: "With --config, do not merge on top of the bundled ruleset — replace it.",
            name: "no-extend-bundled",
            type: Boolean,
        },
        { defaultValue: "text", description: "Output format: text (default), json, sarif", name: "format", type: String },
        { description: "Path to a baseline JSON of previously-triaged findings", name: "baseline", type: String },
        { defaultValue: false, description: "Scan only files staged for commit", name: "staged", type: Boolean },
        { description: "Scan only files changed since <ref> (e.g. main, origin/HEAD)", name: "since", type: String },
        { defaultValue: false, description: "Scan only projects affected by the current branch", name: "affected", type: Boolean },
        {
            description:
                "Enable an opt-in rule or tag without restricting output — additive (e.g. tag:preset:weak-passwords, tag:preset:password-manager). Repeatable.",
            multiple: true,
            name: "enable-rule",
            type: String,
        },
        {
            description: "Rule id or tag:<name> selector — whitelist, only matching findings are emitted. Implies enablement. Repeatable.",
            multiple: true,
            name: "include-rule",
            type: String,
        },
        {
            description: "Rule id or tag:<name> selector — drop matching findings. Repeatable.",
            multiple: true,
            name: "exclude-rule",
            type: String,
        },
        { description: "Gitignore-syntax pattern to exclude from the walk (repeatable)", multiple: true, name: "exclude", type: String },
        { description: "Path to a gitignore-shaped file the walker should honor (repeatable)", multiple: true, name: "exclude-from", type: String },
        { defaultValue: false, description: "Mask secret values in output", name: "redact", type: Boolean },
        { defaultValue: false, description: "Scan dotfiles", name: "include-hidden", type: Boolean },
        { defaultValue: false, description: "Do not respect .gitignore", name: "no-gitignore", type: Boolean },
        { description: "Skip files larger than this (bytes). Default: 10 MiB", name: "max-size", type: Number },
        { description: "Rayon worker threads (0 / omit = auto)", name: "concurrency", type: Number },
        { defaultValue: false, description: "Merge current findings into the baseline and exit 0", name: "update-baseline", type: Boolean },
        { defaultValue: false, description: "With --update-baseline, replace rather than merge", name: "replace-baseline", type: Boolean },
        { defaultValue: false, description: "Scaffold a baseline from current findings", name: "init", type: Boolean },
        { defaultValue: false, description: "With --init, preview the baseline without writing files", name: "dry-run", type: Boolean },
        { defaultValue: false, description: "Print all bundled detection rules and exit", name: "list-rules", type: Boolean },
        {
            defaultValue: false,
            description: "Print non-HTTP validator types referenced by the current ruleset, with install hints for their optional peer dependencies.",
            name: "list-validators",
            type: Boolean,
        },
        { defaultValue: false, description: "Suppress all progress output (only emit findings)", name: "quiet", type: Boolean },
        { defaultValue: false, description: "Print diagnostic info (skipped rules, etc.)", name: "verbose", type: Boolean },
    ],
};

export default secrets;
