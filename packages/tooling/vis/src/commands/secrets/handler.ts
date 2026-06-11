import type { CommandExecute, Toolbox } from "@visulima/cerebro";
import { dim, green, yellow } from "@visulima/colorize";
import { isAccessibleSync } from "@visulima/fs";
import { join, relative, resolve } from "@visulima/path";
import { redact } from "@visulima/redact";
import type { Confidence, Finding, RuleInfo, ScanOptions } from "@visulima/secret-scanner";
import { inspectRuleset, listRequiredValidators, listRules, scan, scanFiles } from "@visulima/secret-scanner";

import { pail } from "../../io/logger";
import { createSpinner } from "../../io/spinner";
import { diffBaseline, toRelativeFinding, writeBaseline } from "../../secrets/baseline";
import { formatSarif, formatText } from "../../secrets/format";
import { filesSince, hasGit, stagedFiles } from "../../secrets/git";
import type { SecretsOptions } from "./index";

type RepeatableString = string | string[];
type ReportFormat = "json" | "sarif" | "text";

export interface SecretsFlags {
    affected?: boolean;
    baseline?: string;
    concurrency?: number;
    config?: string;
    dryRun?: boolean;
    enableRule?: RepeatableString;
    exclude?: RepeatableString;
    excludeFrom?: RepeatableString;
    excludeRule?: RepeatableString;
    extendBundled?: boolean;
    format?: ReportFormat;
    gitignore?: boolean;
    includeHidden?: boolean;
    includeRule?: RepeatableString;
    init?: boolean;
    listRules?: boolean;
    listValidators?: boolean;
    maxSize?: number;
    minConfidence?: string;
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
        throw new Error(`--format must be one of: ${[...allowed].join(", ")} (got "${raw}")`);
    }

    return (raw ?? "text") as ReportFormat;
};

const validateConfidence = (raw: string | undefined): Confidence | undefined => {
    if (raw === undefined) {
        return undefined;
    }

    const allowed = new Set<Confidence>(["high", "low", "medium"]);

    if (!allowed.has(raw as Confidence)) {
        throw new Error(`--min-confidence must be one of: ${[...allowed].join(", ")} (got "${raw}")`);
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
        pail.warn(`Detected existing ${DEFAULT_BASELINE} — refusing to overwrite. Delete it first to re-init.`);
        process.exitCode = 1;

        return;
    }

    pail.info(dryRun ? "[dry-run] Previewing init — no files will be written." : "Scanning workspace to seed baseline…");
    const spinner = createSpinner();

    spinner.start("scanning");

    let findings: Finding[];

    try {
        findings = await scan([root], scanOptions);
        spinner.succeed();
    } catch (error) {
        spinner.failed();
        throw error;
    }

    if (dryRun) {
        pail.info(`[dry-run] Would create ${DEFAULT_BASELINE} with ${String(findings.length)} finding(s).`);

        return;
    }

    const count = writeBaseline(findings, baselinePath, root, { replace: true });

    pail.success(`Wrote ${DEFAULT_BASELINE} (${String(count)} findings).`);
    pail.notice("Commit it. Use `vis secrets --baseline .secrets-baseline.json` in CI. Add path patterns to .gitignore to exclude directories from scanning.");
};

export interface VisSecretsConfig {
    baseline?: string;
    config?: ScanOptions["config"] & {
        /**
         * Bundled rule-tag presets to enable in addition to the defaults.
         * Each entry expands to a `tag:preset:&lt;name>` enable filter, so
         * the same opt-in groups exposed by `--enable-rule` can be set
         * once in `vis.config.ts` instead of being repeated per
         * invocation.
         */
        presets?: string[];
    };
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
 *
 * Exported for unit tests — the layering is the only place where
 * `secrets.config.presets` and `--enable-rule` interact, and a regression
 * here is silent (the scan still runs; it just runs the wrong rule set).
 */
export const resolveScanOptions = (flags: SecretsFlags, visSecrets: VisSecretsConfig | undefined, root: string): ScanOptions => {
    const cfg = visSecrets ?? {};
    const resolvePath = (p: string | undefined): string | undefined => (p ? resolve(root, p) : undefined);
    const pickList = (flag: RepeatableString | undefined, fallback: string[] | undefined): string[] | undefined => {
        const fromFlag = toArray(flag);

        return fromFlag.length > 0 ? fromFlag : fallback;
    };

    const presetEnableRules = (cfg.config?.presets ?? []).map((name) => `tag:preset:${name}`);
    const baseEnableRules = pickList(flags.enableRule, cfg.rules?.enable) ?? [];
    // Presets layer on top of the active enable list (CLI flag or rules.enable).
    // Keep order stable + dedupe so explicit user entries win over generated
    // preset filters when the scanner reports an unknown / collided tag.
    const mergedEnable = [...baseEnableRules, ...presetEnableRules.filter((entry) => !baseEnableRules.includes(entry))];
    const enableRules = mergedEnable.length > 0 ? mergedEnable : undefined;
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
            extendBundled: flags.extendBundled === false ? false : cfg.config?.extendBundled,
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
            gitignore: flags.gitignore === false ? false : (cfg.walk?.gitignore ?? true),
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
            throw new Error("--staged requires a git working tree, and none was detected.");
        }

        return { files: stagedFiles(root) };
    }

    if (flags.since) {
        if (!hasGit(root)) {
            throw new Error("--since requires a git working tree, and none was detected.");
        }

        return { files: filesSince(root, flags.since) };
    }

    if (flags.affected) {
        // Best-effort: derive a file list from `git diff` against a base ref. If the
        // user has the full vis workspace available, they can combine --since with
        // their preferred base (e.g. `--since main`) for more control.
        if (!hasGit(root)) {
            pail.warn("--affected requires git; falling back to full scan");

            return { paths: args && args.length > 0 ? args.map((p) => resolve(root, p)) : [root] };
        }

        const baseRef = process.env["VIS_BASE"] ?? "HEAD~1";

        return { files: filesSince(root, baseRef) };
    }

    return { paths: args && args.length > 0 ? args.map((p) => resolve(root, p)) : [root] };
};

const emitFindings = (
    findings: Finding[],
    format: ReportFormat,
    root: string,
    useColor: boolean,
    toolVersion: string,
    ruleMetadata: RuleInfo[],
    redactFindings: boolean,
): void => {
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
            process.stdout.write(`${formatText(findings, root, useColor, { redact: redactFindings })}\n`);
        }
    }
};

const execute = async ({ argument, options, visConfig, workspaceRoot }: Toolbox<Console, SecretsOptions>): Promise<void> => {
    const flags = options as unknown as SecretsFlags;
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
            pail.success("No files to scan.");
        }

        return;
    }

    const isInteractive = !flags.quiet && !["json", "sarif"].includes(flags.format ?? "text");
    const spinner = createSpinner({ verbose: isInteractive });

    spinner.start("scanning for secrets");

    let findings: Finding[];

    try {
        findings = target.files === undefined ? await scan(target.paths ?? [root], scanOptions) : await scanFiles(target.files, scanOptions);
        spinner.succeed();
    } catch (error) {
        spinner.failed();
        throw new Error(`secret scan failed: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
    }

    // Optional skipped-rule diagnostics (verbose only)
    if (flags.verbose) {
        const skipped = await inspectRuleset(scanOptions);

        if (skipped.length > 0) {
            pail.warn(`${String(skipped.length)} rule(s) skipped due to invalid regex. First few:`);

            for (const s of skipped.slice(0, 5)) {
                process.stderr.write(`  - ${s.ruleId}: ${s.reason}\n`);
            }
        }
    }

    // `ScanOptions.baseline` also accepts an inline Finding[]/fingerprint Set, but this
    // command only resolves a baseline file path (see resolveScanOptions), so narrow to
    // the string form and fall back to the default path otherwise.
    const baselineFullPath = typeof scanOptions.baseline === "string" ? scanOptions.baseline : join(root, DEFAULT_BASELINE);
    const showDiff = !flags.quiet && isAccessibleSync(baselineFullPath);

    if (flags.updateBaseline) {
        const count = writeBaseline(findings, baselineFullPath, root, { replace: flags.replaceBaseline });

        pail.success(`Baseline updated: ${relative(root, baselineFullPath) || baselineFullPath} now contains ${String(count)} entries.`);

        return;
    }

    const format = validateFormat(flags.format);

    const ruleMetadata = format === "sarif" ? await listRules(scanOptions).catch(() => [] as RuleInfo[]) : [];

    const shouldRedact = scanOptions.redact === true;
    const reportFindings = shouldRedact ? redact(findings, ["match", "secret"]) : findings;

    emitFindings(reportFindings, format, root, useColor, toolVersion, ruleMetadata, shouldRedact);

    if (format === "text" && showDiff) {
        printDiff(diffBaseline(findings, baselineFullPath, root));
    }

    if (findings.length > 0) {
        if (!flags.quiet) {
            pail.warn(`${String(findings.length)} potential secret(s) found`);
            pail.notice("Suppress individual lines with `gitleaks:allow` / `secret-scanner:allow`, or run `vis secrets --update-baseline`.");
        }

        process.exitCode = 1;

        return;
    }

    if (!flags.quiet) {
        pail.success("No secrets detected.");
    }
};

export default execute as CommandExecute<Toolbox>;
