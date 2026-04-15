import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type * as Native from "../index.js";

// The napi-generated `index.js` at the package root is CJS and handles
// platform-binding selection via optionalDependencies. We load it with
// createRequire so the bundler leaves the reference intact.
const esmRequire = createRequire(import.meta.url);

type Binding = typeof Native;
const binding: Binding = esmRequire("../index.js") as Binding;

export interface ScanOptions {
    /**
     * Path to a baseline JSON file (array of `Finding` objects). Findings whose
     * fingerprint matches a baseline entry are suppressed.
     */
    baselinePath?: string;
    /** Worker thread count (rayon). `0` or omit = auto. */
    concurrency?: number;
    /** Path to a gitleaks-compatible TOML config. Defaults to the bundled gitleaks ruleset. */
    configPath?: string;
    /** Raw TOML rule string. Takes precedence over `configPath`. */
    configToml?: string;
    /** Drop findings whose ruleId is in this list. Applied after scanning. */
    disableRules?: string[];
    /** Additional glob patterns to exclude. */
    extraIgnores?: string[];
    /** Inline ignore fingerprints, merged with any loaded from `ignorePath`. */
    ignoreFingerprints?: string[];

    /**
     * Path to a `.gitleaksignore` file. Each line is a finding fingerprint
     * (`&lt;file>:&lt;ruleID>:&lt;startLine>`); matching findings are suppressed.
     * If omitted, a `.gitleaksignore` at the first scan root is auto-loaded.
     */
    ignorePath?: string;
    /** Include hidden (dotfile) entries. Default: `false`. */
    includeHidden?: boolean;
    /** Maximum per-file size in bytes. Default: 10 MiB. Larger files are skipped. */
    maxFileSize?: number;
    /** Only report findings whose ruleId is in this list. Applied after scanning. */
    onlyRules?: string[];
    /** Replace `match` and `secret` strings with a redacted form in the output. */
    redact?: boolean;
    /** Respect `.gitignore`, `.ignore` and global excludes. Default: `true`. */
    respectGitignore?: boolean;

    /**
     * Warn to stderr about rules that failed to compile from the config. Default: `false`
     * (callers should invoke `inspectRuleset()` explicitly when they care).
     */
    warnOnSkippedRules?: boolean;
}

export interface Finding {
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

const here: string = typeof __dirname === "string" ? __dirname : dirname(fileURLToPath(import.meta.url));
const bundledConfigPath: string = resolve(here, "..", "assets", "gitleaks.toml");

let cachedConfigToml: string | undefined;

const loadBundledConfig = async (): Promise<string> => {
    if (cachedConfigToml !== undefined) {
        return cachedConfigToml;
    }

    cachedConfigToml = await readFile(bundledConfigPath, "utf8");

    return cachedConfigToml;
};

const resolveOptions = async (options: ScanOptions | undefined): Promise<Native.ScanOptions> => {
    const hasConfig = options?.configPath !== undefined || options?.configToml !== undefined;
    const configToml: string | undefined = hasConfig ? options?.configToml : await loadBundledConfig();
    const resolved: Native.ScanOptions = {
        concurrency: options?.concurrency,
        configPath: options?.configPath,
        configToml,
        extraIgnores: options?.extraIgnores,
        includeHidden: options?.includeHidden,
        maxFileSize: options?.maxFileSize,
        redact: options?.redact,
        respectGitignore: options?.respectGitignore,
    };

    return resolved;
};

/** Gitleaks-compatible fingerprint: `&lt;file>:&lt;ruleID>:&lt;startLine>`. */
export const fingerprint = (f: Finding): string => `${f.file}:${f.ruleId}:${f.startLine}`;

const loadIgnoreSet = async (ignorePath: string | undefined, inline: string[] | undefined, paths: string[]): Promise<Set<string>> => {
    const set = new Set<string>(inline);
    let actualPath = ignorePath;

    if (!actualPath) {
        for (const root of paths) {
            const candidate = resolve(root, ".gitleaksignore");

            if (existsSync(candidate)) {
                actualPath = candidate;
                break;
            }
        }
    }

    if (actualPath && existsSync(actualPath)) {
        const raw = await readFile(actualPath, "utf8");

        for (const line of raw.split(/\r?\n/)) {
            const trimmed = line.trim();

            if (trimmed && !trimmed.startsWith("#")) set.add(trimmed);
        }
    }

    return set;
};

const loadBaselineSet = async (baselinePath: string | undefined): Promise<Set<string>> => {
    if (!baselinePath || !existsSync(baselinePath)) return new Set();

    const raw = await readFile(baselinePath, "utf8");
    let parsed: unknown;

    try {
        parsed = JSON.parse(raw);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);

        process.stderr.write(`secret-scanner: ignoring malformed baseline ${baselinePath}: ${message}\n`);

        return new Set();
    }

    if (!Array.isArray(parsed)) {
        process.stderr.write(`secret-scanner: baseline ${baselinePath} must be an array of findings; ignoring\n`);

        return new Set();
    }

    const isFinding = (f: unknown): f is Finding => {
        if (typeof f !== "object" || f === null) return false;

        const candidate = f as Finding;

        return typeof candidate.ruleId === "string" && typeof candidate.file === "string" && typeof candidate.startLine === "number";
    };

    return new Set(parsed.filter(isFinding).map((f) => fingerprint(f)));
};

const applySuppressions = async (findings: Finding[], options: ScanOptions | undefined, paths: string[]): Promise<Finding[]> => {
    const [ignore, baseline] = await Promise.all([
        loadIgnoreSet(options?.ignorePath, options?.ignoreFingerprints, paths),
        loadBaselineSet(options?.baselinePath),
    ]);

    if (ignore.size === 0 && baseline.size === 0) return findings;

    return findings.filter((f) => {
        const fp = fingerprint(f);

        return !ignore.has(fp) && !baseline.has(fp);
    });
};

export interface SkippedRule {
    reason: string;
    ruleId: string;
}

export interface RuleInfo {
    description: string;
    entropy?: number;
    hasPathFilter: boolean;
    hasRegex: boolean;
    id: string;
    keywords: string[];
    tags: string[];
}

/** Return metadata for every compiled rule in the config. */
export const listRules = async (options?: ScanOptions): Promise<RuleInfo[]> => {
    const resolved = await resolveOptions(options);

    return binding.listRules(resolved) as RuleInfo[];
};

/**
 * Scan a fixed list of files (e.g., paths produced by `git diff --name-only`).
 * Bypasses directory walking.
 */
export const scanFiles = async (files: string[], options?: ScanOptions): Promise<Finding[]> => {
    const resolved = await resolveOptions(options);

    if (options?.warnOnSkippedRules) {
        await warnOnSkippedRules(resolved);
    }

    const raw = (await binding.scanFiles(files, resolved)) as Finding[];
    const filtered = applyRuleFilter(raw, options);

    return applySuppressions(filtered, options, files);
};

/** Return any rules from the given config that failed to compile, with the reason. */
export const inspectRuleset = async (options?: ScanOptions): Promise<SkippedRule[]> => {
    const resolved = await resolveOptions(options);

    return binding.inspectRuleset(resolved) as SkippedRule[];
};

const applyRuleFilter = (findings: Finding[], options: ScanOptions | undefined): Finding[] => {
    const only = options?.onlyRules && options.onlyRules.length > 0 ? new Set(options.onlyRules) : undefined;
    const disable = options?.disableRules && options.disableRules.length > 0 ? new Set(options.disableRules) : undefined;

    if (!only && !disable) return findings;

    return findings.filter((f) => {
        if (only && !only.has(f.ruleId)) return false;

        if (disable?.has(f.ruleId)) return false;

        return true;
    });
};

let warnedOnce = false;

const warnOnSkippedRules = async (resolved: Native.ScanOptions): Promise<void> => {
    if (warnedOnce) return;

    warnedOnce = true;

    try {
        const skipped = binding.inspectRuleset(resolved) as SkippedRule[];

        if (skipped.length > 0) {
            process.stderr.write(`secret-scanner: ${skipped.length} rule(s) skipped due to invalid regex:\n`);

            for (const s of skipped.slice(0, 10)) {
                process.stderr.write(`  - ${s.ruleId}: ${s.reason}\n`);
            }

            if (skipped.length > 10) {
                process.stderr.write(`  ... and ${skipped.length - 10} more\n`);
            }
        }
    } catch {
        // Validation is best-effort; don't break the scan on a diagnostics failure.
    }
};

/** Scan the given paths for secrets. Runs the detector on a Rust thread pool. */
export const scan = async (paths: string[], options?: ScanOptions): Promise<Finding[]> => {
    const resolved = await resolveOptions(options);

    if (options?.warnOnSkippedRules) {
        await warnOnSkippedRules(resolved);
    }

    const raw = (await binding.scan(paths, resolved)) as Finding[];
    const filtered = applyRuleFilter(raw, options);

    return applySuppressions(filtered, options, paths);
};

/**
 * Scan an in-memory buffer as if it lived at `file`. Useful for editor integrations.
 * Unlike `scan()`, this does not auto-discover a `.gitleaksignore` from the filesystem;
 * pass one explicitly via `options.ignorePath` or `options.ignoreFingerprints` if you need it.
 */
export const scanString = async (content: string, file: string, options?: ScanOptions): Promise<Finding[]> => {
    const resolved = await resolveOptions(options);
    const raw = binding.scanTextSync(content, file, resolved) as Finding[];
    const filtered = applyRuleFilter(raw, options);

    // Pass empty paths so `.gitleaksignore` auto-discovery does not sniff the caller's cwd.
    return applySuppressions(filtered, options, []);
};

/** Path to the bundled gitleaks.toml. Exposed for tooling that wants to reuse or extend it. */
export { bundledConfigPath };
