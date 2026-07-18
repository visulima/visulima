/* eslint-disable no-secrets/no-secrets -- Overview comment references the internal stage names verbatim; no actual secrets. */
// Post-scan pipeline: runs after the native detector returns raw findings.
//
//   1. `applyRuleFilter`      — `rules.include` / `rules.exclude` (tag-expanded upstream).
//   2. `applyChecksumFilter`  — drops findings whose CRC-style checksum fails.
//   3. `applyValidation`      — populates `finding.validation` via HTTP / transport validators.
//   4. `applyOnlyVerified`    — keeps only `"verified"` when `config.onlyVerified`.
//   5. `applySuppressions`    — baseline file suppression.
//
// Each stage is pure + testable in isolation; `postProcess` is the orchestrator.
/* eslint-enable no-secrets/no-secrets */

import { resolveBaselineSet } from "./baseline";
import { checkChecksum } from "./checksum";
import { fingerprint, legacyFingerprint } from "./fingerprint";
import { isLockFile, isNotAlphanumericString, isPotentialUuid, isSequentialString } from "./heuristics";
import type { PreparedScan, RuleMeta } from "./prepare-scan";
import type { Finding, ScanOptions } from "./types";
import { PerHostLimiter, validateFinding } from "./validator";

const VALIDATOR_CONCURRENCY = 8;

/**
 * Drop findings the heuristic false-positive suite flags (detect-secrets
 * parity). Each heuristic is individually toggleable via
 * `config.heuristics.*`; all default to `true`. Runs *before* checksum /
 * validation so the cheap filters short-circuit the expensive stages.
 *
 * Heuristics:
 * - `lockFile` — skip findings in Cargo.lock / yarn.lock / …
 * - `sequentialString` — skip `abcdefgh`, `12345678`, `AAAAAAAA`
 * - `potentialUuid` — skip standard UUID-shaped secrets
 * - `notAlphanumericString` — skip `*****` / `------` / `//////`
 */
const applyHeuristicFilters = (findings: Finding[], options: ScanOptions | undefined): Finding[] => {
    const redact = options?.redact === true;
    const heuristics = options?.config?.heuristics;
    const skipLockFile = heuristics?.lockFile !== false;
    // The content-shape heuristics judge `finding.secret`. Under `redact: true`
    // the native layer masks the secret before the pipeline sees it (`abc***xyz`,
    // or `******` for ≤6-char secrets), so these can no longer read the real
    // token — running them would silently drop legitimate findings (a short
    // secret masks to `******`, which `notAlphanumericString` then discards).
    // Disable them when redacting; the file-based `lockFile` heuristic reads
    // `finding.file` and is unaffected.
    const skipSequential = !redact && heuristics?.sequentialString !== false;
    const skipUuid = !redact && heuristics?.potentialUuid !== false;
    const skipNonAlnum = !redact && heuristics?.notAlphanumericString !== false;

    if (!skipLockFile && !skipSequential && !skipUuid && !skipNonAlnum) {
        return findings;
    }

    return findings.filter((finding) => {
        // Exposure-tagged rules are about file/path leakage, not the shape of
        // a captured secret. Heuristics designed to filter content-shape FPs
        // would silently drop legitimate exposure findings — e.g. the
        // `lockFile` heuristic would suppress `exposed-lockfile-in-build-output`
        // because `package-lock.json` is in the lock-file basename set.
        const isExposureFinding = finding.tags.includes("exposure");

        if (!isExposureFinding && skipLockFile && isLockFile(finding.file)) {
            return false;
        }

        if (skipSequential && isSequentialString(finding.secret)) {
            return false;
        }

        if (skipUuid && isPotentialUuid(finding.secret)) {
            return false;
        }

        if (skipNonAlnum && isNotAlphanumericString(finding.secret)) {
            return false;
        }

        return true;
    });
};

const applyRuleFilter = (findings: Finding[], includeIds: string[] | undefined, excludeIds: string[] | undefined): Finding[] => {
    const hasInclude = includeIds && includeIds.length > 0;
    const hasExclude = excludeIds && excludeIds.length > 0;

    // Short-circuit before allocating sets — the common case is "no filters".
    if (!hasInclude && !hasExclude) {
        return findings;
    }

    const include = hasInclude ? new Set(includeIds) : undefined;
    const exclude = hasExclude ? new Set(excludeIds) : undefined;

    return findings.filter((finding) => {
        if (include && !include.has(finding.ruleId)) {
            return false;
        }

        if (exclude?.has(finding.ruleId)) {
            return false;
        }

        return true;
    });
};

/**
 * Drop findings whose embedded checksum doesn't match the expected template.
 * Runs before the HTTP validator so findings that fail the detection-time
 * precision gate never hit the network. A `null` verdict from `checkChecksum`
 * means we couldn't evaluate the template — those findings stay (conservative),
 * mirroring Kingfisher's `skip_if_missing: true` default.
 */
const applyChecksumFilter = (findings: Finding[], ruleMeta: Map<string, RuleMeta>, redact: boolean): Finding[] => {
    // The checksum verdict is computed from `finding.match`; under `redact: true`
    // the match is masked before the pipeline runs, so `checkChecksum` would
    // evaluate garbage and drop valid findings. Skip the filter when redacting.
    if (redact || ruleMeta.size === 0) {
        return findings;
    }

    return findings.filter((finding) => {
        const meta = ruleMeta.get(finding.ruleId);

        if (!meta?.checksum || !meta.pattern) {
            return true;
        }

        const verdict = checkChecksum(finding.match, meta.pattern, meta.checksum);

        return verdict !== false;
    });
};

interface ValidationContext {
    allowedHosts?: ReadonlySet<string>;
    findingsByFileAndRule: Map<string, Finding>;
    perHostLimiter: PerHostLimiter;
    ruleMeta: Map<string, RuleMeta>;
    signal?: AbortSignal;
}

/**
 * Resolve one finding's validation status. Split out so the worker-pool
 * pattern in `applyValidation` stays flat and cancellation-friendly.
 */
const resolveOneValidation = async (finding: Finding, context: ValidationContext): Promise<Finding> => {
    const { allowedHosts, findingsByFileAndRule, perHostLimiter, ruleMeta, signal } = context;
    const meta = ruleMeta.get(finding.ruleId);
    const validationBlock = meta?.validation;

    if (validationBlock === undefined) {
        return { ...finding, validation: "skipped" as const };
    }

    const extras: Record<string, string> = {};

    for (const dep of meta?.dependsOnRule ?? []) {
        const depFinding = findingsByFileAndRule.get(`${finding.file}\0${dep.ruleId}`);

        if (!depFinding) {
            // Required dependency absent — Kingfisher treats this as a
            // non-validatable case; we skip rather than fire a half-formed
            // request.
            return { ...finding, validation: "skipped" as const };
        }

        extras[dep.variable] = depFinding.secret;
    }

    const status = await validateFinding(validationBlock, finding.secret, { allowedHosts, extraVariables: extras, perHostLimiter, signal });

    return { ...finding, validation: status };
};

/**
 * Populate `finding.validation` for every finding whose rule has an HTTP
 * (or registered transport) validation block. Bounded concurrency keeps
 * well-intentioned scans from tripping rate limits on a single provider.
 *
 * Runs after `applyRuleFilter` (so excluded rules never hit the network) and
 * before `applySuppressions` (so suppressed findings are still validated —
 * baseline is a user-facing filter, not something the validator consults).
 */
const applyValidation = async (findings: Finding[], options: ScanOptions | undefined, ruleMeta: Map<string, RuleMeta>): Promise<Finding[]> => {
    if (options?.config?.validate !== true || findings.length === 0) {
        return findings;
    }

    // `redact: true` masks `finding.secret` in the native layer before the
    // pipeline runs, so every validator would fire live provider requests with
    // placeholder strings (`abc***xyz`) — wasted outbound traffic that some
    // providers page their security team over, and which always comes back
    // rejected/error. Skip validation entirely and warn once; the caller can
    // re-run with `redact: false` to verify, then mask at output time.
    if (options.redact === true) {
        if (!warnedRedactWithValidate) {
            warnedRedactWithValidate = true;

            // eslint-disable-next-line no-console -- Diagnostic output; stderr is the intended channel for library warnings.
            console.error(
                "secret-scanner: `config.validate: true` with `redact: true` cannot validate — secrets are masked before the validator runs. Skipping validation; re-run with `redact: false` to verify findings.",
            );
        }

        return findings;
    }

    // Pre-partition: findings whose rule has no validation block can never be
    // verified, so mark them `"skipped"` here and keep them out of the worker
    // pool entirely. In the common case (most rules ship no validator) this
    // avoids both the pool round-trip and the per-finding clone for the
    // majority. `validatable` keeps original indices so the result order is
    // preserved.
    const results: Finding[] = Array.from({ length: findings.length });
    const validatableIndices: number[] = [];

    for (const [index, finding] of findings.entries()) {
        if (ruleMeta.get(finding.ruleId)?.validation === undefined) {
            results[index] = { ...finding, validation: "skipped" as const };
        } else {
            validatableIndices.push(index);
        }
    }

    if (validatableIndices.length === 0) {
        return results;
    }

    // Index findings by `(file, ruleId)` so we can resolve `depends_on_rule`
    // against other findings in the *same file* without N² scans. Kingfisher's
    // dep semantics are "any match of rule X in this file" → pick the first
    // (findings are already sorted by file+offset upstream).
    const findingsByFileAndRule = new Map<string, Finding>();

    for (const finding of findings) {
        const key = `${finding.file}\0${finding.ruleId}`;

        if (!findingsByFileAndRule.has(key)) {
            findingsByFileAndRule.set(key, finding);
        }
    }

    const allowedHostsList = options?.config?.validateAllowedHosts;
    const context: ValidationContext = {
        allowedHosts: allowedHostsList === undefined ? undefined : new Set(allowedHostsList.map((host) => host.toLowerCase())),
        findingsByFileAndRule,
        perHostLimiter: new PerHostLimiter(),
        ruleMeta,
        signal: options?.signal,
    };
    let cursor = 0;

    // Worker-pool pattern. Spawning `VALIDATOR_CONCURRENCY` workers that pull
    // from a shared cursor caps live promise chains at the pool size — with
    // `findings.map(async ...)` we'd materialise N continuations up-front
    // before the limiter gated any of them.
    const workerCount = Math.min(VALIDATOR_CONCURRENCY, validatableIndices.length);
    const workers = Array.from({ length: workerCount }, async () => {
        for (;;) {
            const slot = cursor;

            cursor += 1;

            if (slot >= validatableIndices.length) {
                return;
            }

            const index = validatableIndices[slot] as number;

            // eslint-disable-next-line no-await-in-loop -- Sequential by design: a worker processes one finding at a time so concurrency stays bounded by the pool size.
            results[index] = await resolveOneValidation(findings[index] as Finding, context);
        }
    });

    await Promise.all(workers);

    return results;
};

let warnedOnlyVerifiedWithoutValidate = false;
let warnedRedactWithValidate = false;

const applyOnlyVerified = (findings: Finding[], options: ScanOptions | undefined): Finding[] => {
    if (options?.config?.onlyVerified !== true) {
        return findings;
    }

    // Footgun guard: with `validate: false` the scanner never populates
    // `validation`, so `onlyVerified` drops every finding and the user sees an
    // empty result with no signal. Warn once, *then* filter — a caller that
    // pre-populates `validation` externally (e.g. a cached validation layer in
    // CI) is a legitimate use, so we still apply the filter.
    if (options?.config?.validate !== true && findings.length > 0) {
        const allUnvalidated = findings.every((finding) => finding.validation === undefined);

        if (allUnvalidated && !warnedOnlyVerifiedWithoutValidate) {
            warnedOnlyVerifiedWithoutValidate = true;

            // eslint-disable-next-line no-console -- Diagnostic output; stderr is the intended channel for library warnings.
            console.error(
                "secret-scanner: `config.onlyVerified: true` with `config.validate: false` and no pre-populated `validation` fields will drop every finding. Set `config.validate: true` or seed `finding.validation` before calling.",
            );
        }
    }

    return findings.filter((finding) => finding.validation === "verified");
};

/** Test-only: reset the once-per-process warning gates. */
export const resetPipelineWarningsForTests = (): void => {
    warnedOnlyVerifiedWithoutValidate = false;
    warnedRedactWithValidate = false;
};

const applySuppressions = async (findings: Finding[], options: ScanOptions | undefined): Promise<Finding[]> => {
    const baseline = await resolveBaselineSet(options?.baseline);

    if (baseline.size === 0) {
        return findings;
    }

    // Suppress when either the content-hash OR the legacy line-based
    // fingerprint is in the baseline — handles both freshly-written and
    // legacy baselines without a migration pass.
    return findings.filter((finding) => !baseline.has(fingerprint(finding)) && !baseline.has(legacyFingerprint(finding)));
};

/**
 * Shared post-processing pipeline for every scan variant. Consumers pass the
 * raw native findings plus the prepared-scan bundle; this returns the final
 * filtered list ready for return to the caller.
 */
export const postProcess = async (raw: Finding[], prepared: PreparedScan, options: ScanOptions | undefined): Promise<Finding[]> => {
    const filtered = applyRuleFilter(raw, prepared.includeIds, prepared.excludeIds);
    const heuristicsFiltered = applyHeuristicFilters(filtered, options);
    const checksumed = applyChecksumFilter(heuristicsFiltered, prepared.ruleMeta, options?.redact === true);
    const validated = await applyValidation(checksumed, options, prepared.ruleMeta);
    const verifiedOnly = applyOnlyVerified(validated, options);

    return applySuppressions(verifiedOnly, options);
};
