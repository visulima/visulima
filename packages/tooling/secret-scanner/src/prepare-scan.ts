// One-shot scan preparation — everything a scan entry point needs from the
// user's `ScanOptions`, computed once and threaded through the native binding,
// rule-meta map, and post-scan filters. Avoids re-doing the resolve/expand/gate
// dance three times per scan.

import type { Native } from "./binding";
import type { ChecksumSpec } from "./checksum";
import type { GitleaksConfig } from "./config-loader";
import { expandTagFilters, gateOptInRules, resolveConfig } from "./config-loader";
import type { ScanOptions } from "./types";

/**
 * Normalise `depends_on_rule` entries from Kingfisher YAML. Upstream uses
 * `rule_id` (snake_case); internally we expose camelCase `ruleId` to match
 * the rest of the public + internal surface. Accepts either spelling on input
 * so hand-authored rules that use either convention still work.
 */
type DepCandidate = { rule_id?: unknown; ruleId?: unknown; variable?: unknown } | undefined;

const asDepCandidate = (entry: unknown): DepCandidate => {
    if (typeof entry === "object" && entry !== null) {
        return entry;
    }

    return undefined;
};

/**
 * Per-rule metadata the post-scan pipeline consults — checksum filter, HTTP
 * validator, dependency resolver. Private to the scanner; not exported.
 */
export interface RuleMeta {
    checksum?: ChecksumSpec;
    dependsOnRule?: { ruleId: string; variable: string }[];
    pattern?: string;
    validation?: unknown;
}

export interface PreparedScan {
    excludeIds?: string[];
    includeIds?: string[];
    nativeOptions: Native.ScanOptions;
    ruleMeta: Map<string, RuleMeta>;
}

/**
 * Build the `ruleId → metadata` map that the post-scan pipeline (checksum
 * filter + HTTP validator + dependency resolver) reads. O(rules) pass —
 * runs once per scan.
 */
export const buildRuleMeta = (config: GitleaksConfig): Map<string, RuleMeta> => {
    const map = new Map<string, RuleMeta>();

    for (const rule of config.rules ?? []) {
        // eslint-disable-next-line sonarjs/different-types-comparison -- Defensive: `rule` is typed `GitleaksRule` but the underlying config holds `unknown` at runtime; guard against `null` slipping through.
        if (typeof rule !== "object" || rule === null) {
            continue;
        }

        const record = rule as {
            dependsOnRule?: unknown;
            id?: unknown;
            patternRequirements?: { checksum?: ChecksumSpec };
            regex?: unknown;
            validation?: unknown;
        };

        if (typeof record.id !== "string") {
            continue;
        }

        // `dependsOnRule` comes from the kingfisher converter as the raw YAML
        // array. Filter to the shape the validator expects so a malformed
        // custom rule can't crash the scan — broken entries become "no deps".
        // Accept either `rule_id` (snake_case, upstream YAML) or `ruleId`
        // (camelCase, matches our output types).
        let deps: { ruleId: string; variable: string }[] | undefined;

        if (Array.isArray(record.dependsOnRule)) {
            deps = record.dependsOnRule
                .map((entry) => asDepCandidate(entry))
                .flatMap((entry) => {
                    if (typeof entry?.variable !== "string") {
                        return [];
                    }

                    let ruleId: string | undefined;

                    if (typeof entry.ruleId === "string") {
                        ruleId = entry.ruleId;
                    } else if (typeof entry.rule_id === "string") {
                        ruleId = entry.rule_id;
                    }

                    return ruleId === undefined ? [] : [{ ruleId, variable: entry.variable }];
                });
        }

        map.set(record.id, {
            checksum: record.patternRequirements?.checksum,
            dependsOnRule: deps && deps.length > 0 ? deps : undefined,
            pattern: typeof record.regex === "string" ? record.regex : undefined,
            validation: record.validation,
        });
    }

    return map;
};

// Memoise prepared scans by the subset of options that actually shape the
// native config + rule meta. An editor integration calling `scanString` per
// save re-runs `resolveConfig` + `gateOptInRules` + `buildRuleMeta` over
// ~1,058 rules on every keystroke otherwise. Inline configs are *not* cached
// (their identity is the object reference, which we can't cheaply serialise and
// which callers often rebuild) — the key includes a marker that forces a miss.
const preparedScanCache = new Map<string, PreparedScan>();
const PREPARED_CACHE_LIMIT = 32;

/** Test-only: drop the prepared-scan memo so config-fixture mutations don't leak across tests. */
export const resetPrepareScanCacheForTests = (): void => {
    preparedScanCache.clear();
};

const preparedCacheKey = (options: ScanOptions | undefined): string | undefined => {
    // Inline configs carry an object whose contents drive the result; we don't
    // serialise it (could be large / non-deterministic ordering), so skip the
    // cache for that path.
    if (options?.config?.inline !== undefined) {
        return undefined;
    }

    return JSON.stringify({
        concurrency: options?.concurrency,
        extendBundled: options?.config?.extendBundled,
        includeHidden: options?.walk?.includeHidden,
        maxFileSize: options?.walk?.maxFileSize,
        minConfidence: options?.config?.minConfidence,
        path: options?.config?.path,
        redact: options?.redact,
        respectGitignore: options?.walk?.gitignore,
        rules: options?.rules,
        walkExcludeFromFiles: options?.walk?.excludeFromFiles,
        walkExcludePatterns: options?.walk?.excludePatterns,
    });
};

const buildPreparedScan = (options: ScanOptions | undefined): PreparedScan => {
    const base = resolveConfig({
        config: options?.config?.inline,
        configPath: options?.config?.path,
        extendBundled: options?.config?.extendBundled,
    });
    const allRules = base.rules ?? [];
    const enableIds = expandTagFilters(options?.rules?.enable, allRules, "rules.enable");
    const includeIds = expandTagFilters(options?.rules?.include, allRules, "rules.include");
    const excludeIds = expandTagFilters(options?.rules?.exclude, allRules, "rules.exclude");

    // `enable` and `include` both imply enablement: you can't filter to a rule
    // that's off. `exclude` is filter-only — it never turns anything on.
    const enabledSet = new Set<string>([...(enableIds ?? []), ...(includeIds ?? [])]);
    const config = gateOptInRules(base, enabledSet);

    return {
        excludeIds,
        includeIds,
        nativeOptions: {
            concurrency: options?.concurrency,
            config,
            extraIgnores: options?.walk?.excludePatterns,
            ignoreFiles: options?.walk?.excludeFromFiles,
            includeHidden: options?.walk?.includeHidden,
            maxFileSize: options?.walk?.maxFileSize,
            minConfidence: options?.config?.minConfidence,
            redact: options?.redact,
            respectGitignore: options?.walk?.gitignore,
        },
        ruleMeta: buildRuleMeta(config),
    };
};

/**
 * Resolve the effective ruleset, expand `tag:` selectors in
 * `rules.enable`/`include`/`exclude` against the loaded rules (throws on
 * unknown tags — typos surface early), union enable + include into the
 * enablement set, gate `defaultEnabled: false` rules, and flatten the
 * user's grouped options into the shape the native binding expects.
 *
 * Results are memoised by the config-shaping subset of `options` (inline
 * configs excepted) so repeated `scanString`/`scan` calls with the same config
 * skip the O(rules) resolve + rule-meta rebuild.
 */
export const prepareScan = (options: ScanOptions | undefined): PreparedScan => {
    const cacheKey = preparedCacheKey(options);

    if (cacheKey !== undefined) {
        const cached = preparedScanCache.get(cacheKey);

        if (cached !== undefined) {
            return cached;
        }
    }

    const prepared = buildPreparedScan(options);

    if (cacheKey !== undefined) {
        // Bounded LRU-ish: evict the oldest entry when over the limit so a
        // long-lived process scanning many distinct configs doesn't grow
        // unbounded.
        if (preparedScanCache.size >= PREPARED_CACHE_LIMIT) {
            const oldest = preparedScanCache.keys().next().value;

            if (oldest !== undefined) {
                preparedScanCache.delete(oldest);
            }
        }

        preparedScanCache.set(cacheKey, prepared);
    }

    return prepared;
};
