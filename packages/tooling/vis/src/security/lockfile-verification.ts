/**
 * Whole-lockfile supply-chain verification — vis's counterpart to
 * pnpm v11's "verify the lockfile against supply-chain policies" phase.
 *
 * Unlike the pre-install marshall pipeline (which only inspects the
 * packages a user is *adding*), this re-validates the **entire resolved
 * closure** every time it runs, so a tampered/poisoned lockfile is
 * caught even when nothing is being added and even on npm / yarn / bun
 * (which have no native equivalent gate).
 *
 * It composes existing building blocks — the `firstSeen` and
 * `publisherChange` policy modules over the full closure plus the
 * `blockExoticSubdeps` scanner — into a single pass/fail attestation
 * with an entry count and elapsed time, suitable for a CI log line.
 */

import { isAccessibleSync } from "@visulima/fs";
import { join } from "@visulima/path";

import type { PolicyName, VisConfig } from "../config/types";
import { LOCKFILE_NAMES, lockedPackages } from "./dependency-scan";
import { scanExoticSubdeps } from "./exotic-subdeps";
import type { ExoticSubdepViolation } from "./exotic-subdeps";
import type { PolicyDecision } from "./policies";
import { evaluatePolicies } from "./policies";

const VERIFIED_POLICIES: ReadonlySet<PolicyName> = new Set<PolicyName>(["firstSeen", "publisherChange"]);

export type LockfileVerificationStatus = "fail" | "pass" | "skipped";

export interface LockfileVerificationResult {
    /** Policy decisions over the full closure (block/warn/info rows). */
    decisions: PolicyDecision[];
    /** Wall-clock time spent verifying, in milliseconds. */
    durationMs: number;
    /** Number of distinct `name@version` entries verified. */
    entryCount: number;
    /** Exotic transitive-source violations, when blockExoticSubdeps is on. */
    exoticViolations: ExoticSubdepViolation[];
    /**
     * `true` when a supply-chain policy was configured but the lockfile
     * file is absent (or the PM has no lockfile vis understands). The
     * closure cannot be attested, so the result is forced to `fail`
     * rather than a misleading zero-entry `pass`.
     */
    lockfileMissing: boolean;
    /**
     * `skipped` — no supply-chain policy is configured, nothing verified.
     * `fail`    — at least one gating (unaccepted block) violation.
     * `pass`    — every entry satisfied every configured policy.
     */
    status: LockfileVerificationStatus;
}

export interface VerifyLockfileOptions {
    /** `true` when the caller passed `--offline` (network policies skip). */
    offline?: boolean;
    packageManager: string;
    visConfig: VisConfig;
    workspaceRoot: string;
}

const isGatingDecision = (decision: PolicyDecision): boolean => decision.severity === "block" && decision.acceptedRisk === undefined;

const anyPolicyConfigured = (config: VisConfig): boolean => {
    const minutes = config.security?.policies?.firstSeen?.minutes;
    const firstSeenOn = typeof minutes === "number" && minutes > 0;
    const publisherOn = config.security?.policies?.publisherChange?.mode === "no-downgrade";
    const exoticOn = config.security?.blockExoticSubdeps === true;

    return firstSeenOn || publisherOn || exoticOn;
};

export const verifyLockfile = async (options: VerifyLockfileOptions): Promise<LockfileVerificationResult> => {
    const { offline = false, packageManager, visConfig, workspaceRoot } = options;
    const start = Date.now();

    if (!anyPolicyConfigured(visConfig)) {
        return { decisions: [], durationMs: Date.now() - start, entryCount: 0, exoticViolations: [], lockfileMissing: false, status: "skipped" };
    }

    const lockInfo = LOCKFILE_NAMES[packageManager];

    if (!lockInfo || !isAccessibleSync(join(workspaceRoot, lockInfo.file))) {
        return { decisions: [], durationMs: Date.now() - start, entryCount: 0, exoticViolations: [], lockfileMissing: true, status: "fail" };
    }

    const packages = lockedPackages(workspaceRoot, packageManager, { includeDev: true });
    const entryCount = packages.length;

    const decisions = await evaluatePolicies(
        {
            offline,
            packageManager,
            packages,
            workspaceRoot,
        },
        "install",
        { enabledPolicies: new Set(VERIFIED_POLICIES), visConfig },
    );

    const exoticViolations
        = visConfig.security?.blockExoticSubdeps === true
            ? scanExoticSubdeps(workspaceRoot, packageManager, { allow: visConfig.security.exoticSubdepsAllow })
            : [];

    const failed = decisions.some((decision) => isGatingDecision(decision)) || exoticViolations.length > 0;

    return {
        decisions,
        durationMs: Date.now() - start,
        entryCount,
        exoticViolations,
        lockfileMissing: false,
        status: failed ? "fail" : "pass",
    };
};

const formatElapsed = (ms: number): string => (ms < 1000 ? `${String(ms)}ms` : `${(ms / 1000).toFixed(1)}s`);

/**
 * Render the result as pnpm-style attestation lines. The first element
 * is always the headline (`✓`/`✗`/`–`); any following elements are the
 * per-violation detail lines a human-readable surface prints underneath.
 */
export const formatLockfileVerification = (result: LockfileVerificationResult): string[] => {
    if (result.status === "skipped") {
        return ["– Lockfile supply-chain verification skipped (no firstSeen / publisherChange / blockExoticSubdeps policy configured)"];
    }

    if (result.lockfileMissing) {
        return ["✗ Lockfile supply-chain verification failed — no lockfile found, the resolved closure cannot be attested"];
    }

    const suffix = `(${String(result.entryCount)} ${result.entryCount === 1 ? "entry" : "entries"}, ${formatElapsed(result.durationMs)})`;

    if (result.status === "pass") {
        return [`✓ Lockfile passes supply-chain policies ${suffix}`];
    }

    const lines = [`✗ Lockfile failed supply-chain policy check ${suffix}`];

    for (const decision of result.decisions) {
        if (decision.severity === "block" && decision.acceptedRisk === undefined) {
            lines.push(`  [${decision.policy}] ${decision.reason}`);
        }
    }

    for (const violation of result.exoticViolations) {
        lines.push(`  [blockExoticSubdeps] ${violation.packageName} pulled from exotic source by ${violation.declaredBy}: ${violation.source}`);
    }

    return lines;
};
