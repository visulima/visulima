import { existsSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { isAbsolute, relative, resolve as resolvePath } from "node:path";

import ignoreModule from "ignore";

import type * as Native from "../index.js";
import type { GitleaksConfig, PresetName } from "./config-loader";
import { resolveConfig } from "./config-loader";

// The napi-generated `index.js` at the package root is CJS and handles platform-binding
// selection via optionalDependencies. We load it with createRequire so the bundler leaves
// the reference intact.
const esmRequire = createRequire(import.meta.url);

type Binding = typeof Native;
const binding: Binding = esmRequire("../index.js") as Binding;

/**
 * Grouped scan options. Keys are namespaced by concern — config source, walker, rule
 * filters, output, baseline — so autocomplete surfaces only related settings at each level.
 */
export interface ScanOptions {
    /** Path to a baseline JSON array of `Finding` objects (suppression list). */
    baseline?: string;

    /** Rayon worker threads. `0` / omit = auto (use rayon's global pool). */
    concurrency?: number;

    /** Where the ruleset comes from. */
    config?: {
        /** Layer the user's rules on top of the bundled gitleaks ruleset. Default: `true`. */
        extendBundled?: boolean;
        /** Pre-parsed gitleaks-shaped object. Fastest path — zero file IO. */
        inline?: GitleaksConfig;
        /** Path to a JSON file (gitleaks-compatible shape). */
        path?: string;

        /**
         * Bundled presets layered on top of the default ruleset.
         * `"weak-passwords"` complements `generic-api-key`'s 3.0 entropy threshold with a 2.0-entropy variant.
         */
        presets?: PresetName[];
    };

    /** Mask `match` / `secret` strings in every finding. */
    redact?: boolean;

    /** Rule-id level filters, applied after scanning. */
    rules?: {
        /** Drop findings whose ruleId is in this list. */
        exclude?: string[];
        /** Only report findings whose ruleId is in this list. */
        include?: string[];
    };

    /** Print diagnostics (skipped rules, etc.) to stderr on first run. */
    verbose?: boolean;

    /** Walker / filesystem traversal. */
    walk?: {
        /** Additional `.gitignore`-shaped files to honor (e.g. `.secretsignore`). */
        excludeFromFiles?: string[];
        /** Gitignore-syntax lines applied on top of `.gitignore`. */
        excludePatterns?: string[];
        /** Respect `.gitignore`, `.ignore` and global excludes. Default: `true`. */
        gitignore?: boolean;
        /** Visit dotfiles and hidden entries. Default: `false`. */
        includeHidden?: boolean;
        /** Skip files larger than this (bytes). Default: 10 MiB. */
        maxFileSize?: number;
    };
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

/**
 * Flatten grouped options into the shape the NAPI binding expects. Centralising the
 * mapping here means every public API function (`scan`/`scanFiles`/`scanString`/
 * `listRules`/`inspectRuleset`) sees a single canonical normalisation step.
 */
const toNativeOptions = (options: ScanOptions | undefined): Native.ScanOptions => {
    const config = resolveConfig({
        config: options?.config?.inline,
        configPath: options?.config?.path,
        extendBundled: options?.config?.extendBundled,
        presets: options?.config?.presets,
    });

    return {
        concurrency: options?.concurrency,
        config: config as unknown as Native.ScanOptions["config"],
        extraIgnores: options?.walk?.excludePatterns,
        ignoreFiles: options?.walk?.excludeFromFiles,
        includeHidden: options?.walk?.includeHidden,
        maxFileSize: options?.walk?.maxFileSize,
        redact: options?.redact,
        respectGitignore: options?.walk?.gitignore,
    };
};

// `ignore` ships as ESM and CJS; handle both default-export shapes transparently.
type IgnoreFactory = () => IgnoreMatcher;

interface IgnoreMatcher {
    add: (pattern: string | string[]) => IgnoreMatcher;
    ignores: (path: string) => boolean;
}

const ignore: IgnoreFactory = (ignoreModule as { default?: IgnoreFactory }).default ?? (ignoreModule as unknown as IgnoreFactory);

/**
 * Build a gitignore matcher for the `scanFiles` path — it bypasses the native walker
 * and therefore has to filter paths itself.
 */
const buildIgnoreMatcher = (options: ScanOptions | undefined): IgnoreMatcher | undefined => {
    const ignoreFiles = options?.walk?.excludeFromFiles ?? [];
    const patterns = options?.walk?.excludePatterns ?? [];

    if (ignoreFiles.length === 0 && patterns.length === 0) {
        return undefined;
    }

    const matcher = ignore();

    for (const file of ignoreFiles) {
        if (!existsSync(file)) {
            continue;
        }

        try {
            matcher.add(readFileSync(file, "utf8"));
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);

            process.stderr.write(`secret-scanner: failed to read ignore file ${file}: ${message}\n`);
        }
    }

    if (patterns.length > 0) {
        matcher.add(patterns);
    }

    return matcher;
};

const filterIgnoredFiles = (files: string[], matcher: IgnoreMatcher | undefined, cwd: string): string[] => {
    if (!matcher) {
        return files;
    }

    return files.filter((file) => {
        const abs = isAbsolute(file) ? file : resolvePath(cwd, file);
        const rel = relative(cwd, abs);

        if (rel === "" || rel.startsWith("..")) {
            return true;
        }

        return !matcher.ignores(rel);
    });
};

/** Gitleaks-compatible fingerprint: `&lt;file>:&lt;ruleID>:&lt;startLine>`. */
export const fingerprint = (f: Finding): string => `${f.file}:${f.ruleId}:${f.startLine}`;

const loadBaselineSet = async (baselinePath: string | undefined): Promise<Set<string>> => {
    if (!baselinePath || !existsSync(baselinePath)) {
        return new Set();
    }

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
        if (typeof f !== "object" || f === null) {
            return false;
        }

        const candidate = f as Finding;

        return typeof candidate.ruleId === "string" && typeof candidate.file === "string" && typeof candidate.startLine === "number";
    };

    return new Set(parsed.filter(isFinding).map((f) => fingerprint(f)));
};

const applyRuleFilter = (findings: Finding[], options: ScanOptions | undefined): Finding[] => {
    const include = options?.rules?.include && options.rules.include.length > 0 ? new Set(options.rules.include) : undefined;
    const exclude = options?.rules?.exclude && options.rules.exclude.length > 0 ? new Set(options.rules.exclude) : undefined;

    if (!include && !exclude) {
        return findings;
    }

    return findings.filter((f) => {
        if (include && !include.has(f.ruleId)) {
            return false;
        }

        if (exclude?.has(f.ruleId)) {
            return false;
        }

        return true;
    });
};

const applySuppressions = async (findings: Finding[], options: ScanOptions | undefined): Promise<Finding[]> => {
    const baseline = await loadBaselineSet(options?.baseline);

    if (baseline.size === 0) {
        return findings;
    }

    return findings.filter((f) => !baseline.has(fingerprint(f)));
};

/** Return any rules from the given config that failed to compile, with the reason. */
export const inspectRuleset = async (options?: ScanOptions): Promise<SkippedRule[]> => {
    const resolved = toNativeOptions(options);

    return binding.inspectRuleset(resolved) as SkippedRule[];
};

/** Return metadata for every compiled rule in the effective config. */
export const listRules = async (options?: ScanOptions): Promise<RuleInfo[]> => {
    const resolved = toNativeOptions(options);

    return binding.listRules(resolved) as RuleInfo[];
};

let warnedOnce = false;

const warnOnSkippedRules = async (resolved: Native.ScanOptions): Promise<void> => {
    if (warnedOnce) {
        return;
    }

    warnedOnce = true;

    try {
        const skipped = binding.inspectRuleset(resolved) as SkippedRule[];

        if (skipped.length > 0) {
            process.stderr.write(`secret-scanner: ${String(skipped.length)} rule(s) skipped due to invalid regex:\n`);

            for (const s of skipped.slice(0, 10)) {
                process.stderr.write(`  - ${s.ruleId}: ${s.reason}\n`);
            }

            if (skipped.length > 10) {
                process.stderr.write(`  ... and ${String(skipped.length - 10)} more\n`);
            }
        }
    } catch {
        // Diagnostics are best-effort; don't break the scan on a failure here.
    }
};

/** Scan the given paths for secrets. Runs the detector on a Rust thread pool. */
export const scan = async (paths: string[], options?: ScanOptions): Promise<Finding[]> => {
    const resolved = toNativeOptions(options);

    if (options?.verbose) {
        await warnOnSkippedRules(resolved);
    }

    const raw = (await binding.scan(paths, resolved)) as Finding[];
    const filtered = applyRuleFilter(raw, options);

    return applySuppressions(filtered, options);
};

/**
 * Scan a fixed list of files (e.g. output of `git diff --name-only`). Bypasses the
 * native walker, so `walk.excludePatterns` / `walk.excludeFromFiles` are honored here in JS via the
 * `ignore` package.
 */
export const scanFiles = async (files: string[], options?: ScanOptions): Promise<Finding[]> => {
    const resolved = toNativeOptions(options);

    if (options?.verbose) {
        await warnOnSkippedRules(resolved);
    }

    const matcher = buildIgnoreMatcher(options);
    const filteredFiles = filterIgnoredFiles(files, matcher, process.cwd());

    const raw = (await binding.scanFiles(filteredFiles, resolved)) as Finding[];
    const filtered = applyRuleFilter(raw, options);

    return applySuppressions(filtered, options);
};

/** Scan an in-memory buffer as if it lived at `file`. Useful for editor integrations. */
export const scanString = async (content: string, file: string, options?: ScanOptions): Promise<Finding[]> => {
    const resolved = toNativeOptions(options);
    const raw = binding.scanTextSync(content, file, resolved) as Finding[];
    const filtered = applyRuleFilter(raw, options);

    return applySuppressions(filtered, options);
};

export { bundledConfigPath, type GitleaksConfig, type PresetName } from "./config-loader";
