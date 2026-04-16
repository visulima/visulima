// Public types for @visulima/secret-scanner.
//
// These are the shapes consumers (CLI, tests, third-party wrappers) import.
// Internal-only types (RuleMeta, PreparedScan, IgnoreMatcher, …) live alongside
// the module that uses them — they never appear here.

import type { GitleaksConfig } from "./config-loader";

/**
 * Author-declared rule quality. Drives the `--min-confidence` filter: unlabeled
 * rules resolve to `"low"` so raising the floor drops them along with explicit
 * low-confidence rules.
 */
export type Confidence = "high" | "low" | "medium";

/**
 * Validation status on a finding after the optional HTTP validator runs.
 *
 * - `null` — validator was never invoked (default; `config.validate` is `false`).
 * - `"skipped"` — validator ran but the rule uses an unsupported validation type
 * (gRPC without deps, multi-step HTTP, checksum, …).
 * - `"verified"` / `"rejected"` — the provider returned a conclusive result.
 * - `"error"` — the validator ran but failed (network error, timeout, rate-limit).
 *
 * `config.onlyVerified: true` filters to the `"verified"` subset — useful for CI
 * gating where a suspect match that can't be verified is not a blocker.
 */
export type ValidationStatus = "error" | "rejected" | "skipped" | "verified";

/**
 * Grouped scan options. Keys are namespaced by concern — config source, walker,
 * rule filters, output, baseline — so autocomplete surfaces only related settings
 * at each level.
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

        /**
         * Drop every rule whose author-declared `confidence` is below this floor.
         * Rules without an explicit confidence are treated as `"low"` and therefore
         * dropped when the floor is `"medium"` or `"high"`. Omitted or `"low"` keeps
         * all rules.
         */
        minConfidence?: Confidence;

        /**
         * With `validate: true`, drop every finding whose `validation` is not
         * `"verified"`. Useful in CI gating where an unverifiable match is not
         * an actionable leak.
         */
        onlyVerified?: boolean;
        /** Path to a JSON file (gitleaks-compatible shape). */
        path?: string;

        /**
         * When `true`, every finding whose rule declares an HTTP validator is
         * verified against the provider's own API after detection. Cost: one
         * HTTP request per finding (per-host concurrency capped at 4, global at
         * 8). Default `false` — scans stay offline-safe.
         *
         * WARNING: validators send the candidate secret to the provider. Some
         * providers page their security team on failed auth attempts. Only
         * enable on repos you own.
         */
        validate?: boolean;
    };

    /** Mask `match` / `secret` strings in every finding. */
    redact?: boolean;

    /**
     * Rule id + tag filters. Entries are either literal rule ids (e.g.
     * `"aws-access-token"`) or `tag:&lt;name>` selectors that expand to every rule
     * carrying the matching tag. An unknown tag throws so typos surface early.
     *
     * - `enable` — **additive**. Turns on opt-in rules (`defaultEnabled: false`
     * bundles tagged `preset:&lt;name>`). Doesn't restrict which findings are
     * emitted.
     * - `include` — **restrictive whitelist**. When set, only findings matching
     * this list are emitted. Also implies enablement for referenced opt-in
     * rules.
     * - `exclude` — **blacklist**. Drops findings matching this list. Doesn't
     * enable anything.
     */
    rules?: {
        /** Enable opt-in rules without restricting the output. Additive. */
        enable?: string[];
        /** Drop findings whose ruleId — or expanded tag membership — is in this list. */
        exclude?: string[];
        /** Only report findings whose ruleId — or expanded tag membership — is in this list. Implies enablement. */
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
    /**
     * Rule ids that matched the same byte span as this finding and were collapsed
     * by the dedup pass. Empty when nothing overlapped.
     */
    alternateMatches: string[];
    /** `"low"` when the rule declares no confidence (default floor). */
    confidence: Confidence;
    description: string;
    endColumn: number;
    endLine: number;
    entropy: number;
    file: string;
    match: string;
    ruleId: string;
    secret: string;
    /** Provenance of the rule — `"gitleaks"`, `"kingfisher"`, `"visulima"`, or user-declared. */
    source?: string;
    startColumn: number;
    startLine: number;
    tags: string[];

    /**
     * Populated by the HTTP validator when `config.validate: true`. Omitted when
     * the validator was never invoked (default / validate off). See
     * {@link ValidationStatus} for the meaning of each value.
     */
    validation?: ValidationStatus;
}

export interface SkippedRule {
    reason: string;
    ruleId: string;
}

export interface RuleInfo {
    /**
     * `true` when the rule has no keywords and therefore bypasses the AC prefilter —
     * its regex runs against every file. Surface it in tooling to flag perf-regressing
     * custom rules.
     */
    alwaysRuns: boolean;
    /** `"low"` when the rule declares no confidence. */
    confidence: Confidence;
    description: string;
    entropy?: number;
    hasPathFilter: boolean;
    hasRegex: boolean;
    id: string;
    keywords: string[];
    source?: string;
    tags: string[];
}
