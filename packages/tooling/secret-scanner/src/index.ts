// @visulima/secret-scanner — entry module.
//
// Only responsibilities here:
//   1. Public surface re-exports (types, fingerprint, ruleset helpers, …).
//   2. The three top-level scan orchestrators — `scan`, `scanFiles`,
//      `scanString` — that thread `prepareScan` → native binding →
//      `postProcess`.
//
// Everything else lives in a dedicated module. Keep this file thin so
// consumers see the public surface at a glance and contributors know where
// to go for each concern (`baseline.ts`, `pipeline.ts`, `validator/`, …).

import { binding } from "./binding";
import { resolveConfig } from "./config-loader";
import { warnOnSkippedRules } from "./diagnostics";
import { buildIgnoreMatcher, filterIgnoredFiles } from "./ignore-matcher";
import { postProcess } from "./pipeline";
import { prepareScan } from "./prepare-scan";
import type { ValidatorReport } from "./transports";
import { reportValidators } from "./transports";
import type { Finding, RuleInfo, ScanOptions, SkippedRule } from "./types";

/** Return any rules from the given config that failed to compile, with the reason. */
export const inspectRuleset = async (options?: ScanOptions): Promise<SkippedRule[]> => {
    const prepared = prepareScan(options);

    return binding.inspectRuleset(prepared.nativeOptions);
};

/** Return metadata for every compiled rule in the effective config. */
export const listRules = async (options?: ScanOptions): Promise<RuleInfo[]> => {
    const prepared = prepareScan(options);

    return binding.listRules(prepared.nativeOptions) as RuleInfo[];
};

/**
 * Report every non-HTTP validator type that appears in the current ruleset,
 * along with the optional peer-dep users need to install to verify findings
 * from those rules. Returns an empty array when the ruleset has no validators
 * beyond HTTP/JWT (the built-ins). Ideal for a `--list-validators` CLI pass
 * or a CI pre-flight check.
 */
export const listRequiredValidators = async (options?: ScanOptions): Promise<ValidatorReport[]> => {
    const resolved = resolveConfig({
        config: options?.config?.inline,
        configPath: options?.config?.path,
        extendBundled: options?.config?.extendBundled,
    });
    // eslint-disable-next-line sonarjs/different-types-comparison -- Defensive: `rule` is typed `GitleaksRule` but the underlying array holds `unknown` at runtime; guard against `null` slipping through.
    const rulesArray = (resolved.rules ?? []).filter((rule): rule is { validation?: unknown } => typeof rule === "object" && rule !== null);

    return reportValidators(rulesArray);
};

/** Scan the given paths for secrets. Runs the detector on a Rust thread pool. */
export const scan = async (paths: string[], options?: ScanOptions): Promise<Finding[]> => {
    const prepared = prepareScan(options);

    if (options?.verbose) {
        await warnOnSkippedRules(prepared.nativeOptions);
    }

    const raw = (await binding.scan(paths, prepared.nativeOptions)) as Finding[];

    return postProcess(raw, prepared, options);
};

/**
 * Scan a fixed list of files (e.g. output of `git diff --name-only`). Bypasses
 * the native walker, so `walk.excludePatterns` / `walk.excludeFromFiles` are
 * honoured here in JS via the `ignore` package.
 */
export const scanFiles = async (files: string[], options?: ScanOptions): Promise<Finding[]> => {
    const prepared = prepareScan(options);

    if (options?.verbose) {
        await warnOnSkippedRules(prepared.nativeOptions);
    }

    const matcher = buildIgnoreMatcher(options);
    const filteredFiles = filterIgnoredFiles(files, matcher, process.cwd());

    const raw = (await binding.scanFiles(filteredFiles, prepared.nativeOptions)) as Finding[];

    return postProcess(raw, prepared, options);
};

/**
 * Scan an in-memory buffer as if it lived at `file`. Useful for editor
 * integrations and ad-hoc programmatic scans.
 *
 * **Note**: detection runs synchronously on the calling thread (the native
 * binding is sync for string input — scanning ~550 KB takes ~11 ms with the
 * full 1,047-rule set). The `async` signature exists because `postProcess`
 * may await validators. For large buffers on a latency-sensitive event loop
 * (HTTP server request handler, VSCode extension main thread), chunk the
 * input yourself or offload to a worker.
 */
export const scanString = async (content: string, file: string, options?: ScanOptions): Promise<Finding[]> => {
    const prepared = prepareScan(options);
    const raw = binding.scanTextSync(content, file, prepared.nativeOptions) as Finding[];

    return postProcess(raw, prepared, options);
};

export { bundledConfigPath, type GitleaksConfig } from "./config-loader";
export { fingerprint, legacyFingerprint } from "./fingerprint";
export { isLockFile, isNotAlphanumericString, isPotentialUuid, isSequentialString } from "./heuristics";
export { transformYamlBlockScalars } from "./transformers/yaml";
export type { ValidatorReport } from "./transports";
export type { Confidence, Finding, RuleInfo, ScanOptions, SkippedRule, ValidationStatus } from "./types";
