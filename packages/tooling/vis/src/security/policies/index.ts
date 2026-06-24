/**
 * Unified policy engine — one entry point for the 8 Socket.dev-style
 * supply-chain policies. Every surface (`vis audit`, `vis add`,
 * `vis install`, `vis update`, `vis doctor`) calls `evaluatePolicies()`
 * and renders / gates on the resulting decisions.
 *
 * Each policy lives in its own file and exports a `PolicyModule` —
 * the engine wires them through a registry, handles offline-skip and
 * surface filtering uniformly, and returns a flat `PolicyDecision[]`.
 *
 * Offline-clean policies: `license`, `installScripts`, `vulnerability`,
 * `unexpectedDeps` (baseline mode). Network-bound policies `firstSeen`
 * and `publisherChange` re-verify the resolved closure against the
 * registry (publish age / provenance downgrade) — the engine
 * offline-skips them when `--offline` is set. `malware` / `score`
 * remain to be wired.
 */

import type { PolicyName, VisConfig } from "../../config/types";
import { POLICY_NAMES } from "../../config/types";
import type { SecurityVulnerability } from "../../util/catalog";
import type { InstalledPackage } from "../dependency-scan";
import type { PackageManifest } from "../manifests";
import type { AcceptedRisk, PackageReportData } from "../socket-security";
import { evaluateFirstSeenPolicy } from "./first-seen";
import { evaluateInstallScriptsPolicy } from "./install-scripts";
import { evaluateLicensePolicy } from "./license";
import { evaluatePublisherChangePolicy } from "./publisher-change";
import { evaluateUnexpectedDepsPolicy } from "./unexpected-deps";
import { evaluateVulnerabilityPolicy } from "./vulnerability";

/** Severity attached to a single policy decision. */
export type PolicyDecisionSeverity = "block" | "info" | "warn";

/**
 * One row in the policy report. Each decision targets a single
 * `(package, version, policy)` combination — a package can produce
 * multiple decisions (e.g., low score + license violation).
 */
export interface PolicyDecision {
    /** Matched accepted-risk entry, if any. Non-null = surfaced but not gating. */
    acceptedRisk?: AcceptedRisk;
    /** Structured payload, policy-specific (e.g., `{ deniedLicense: "GPL-3.0" }`). */
    data?: Record<string, unknown>;
    /** Canonical package name. */
    packageName: string;
    /** Which of the 8 Socket-style policies produced this decision. */
    policy: PolicyName;
    /** Human-readable explanation rendered by every formatter. */
    reason: string;
    /** `"block"` rows feed into exit-code gating; `"warn"`/`"info"` are advisory. */
    severity: PolicyDecisionSeverity;
    /** Resolved version of the offending package. */
    version: string;
}

/**
 * All data sources a policy can consult. The engine builds this once
 * per invocation and threads it through every module.
 */
export interface PolicyInput {
    /**
     * Path (relative to workspace root or absolute) of a baseline
     * lockfile snapshot, when configured. Used by
     * `unexpectedDeps.baselineLockfile`.
     */
    baselineLockfilePath?: string;
    /** Manifest map keyed by `name@version`. */
    manifestData?: Map<string, PackageManifest>;
    /** `true` when the caller passed `--offline`. */
    offline: boolean;
    /** OSV findings keyed by package name (not name@version — OSV reports per name). */
    osvFindings?: Map<string, SecurityVulnerability[]>;
    /** Active package manager. */
    packageManager: string;
    /** Resolved package set, typically from `lockedPackages()`. */
    packages: InstalledPackage[];
    /** Socket.dev reports keyed by `name@version`. */
    socketReports?: Map<string, PackageReportData>;
    /** Absolute workspace root. */
    workspaceRoot: string;
}

/** Surfaces the engine is invoked from. */
export type PolicySurface = "audit" | "doctor" | "install";

/** Caller-side knobs that are not part of the data plane. */
export interface EvaluateOptions {
    /**
     * Narrow the active policy set. `undefined` = "all configured
     * policies"; passing an explicit set is how the `--policies` CLI
     * flag works. Use `new Set()` to disable every policy.
     */
    enabledPolicies?: Set<PolicyName>;
    /** Full vis config — each policy reads its own slice. */
    visConfig: VisConfig;
}

/**
 * One policy module — the contract every `policies/*.ts` file
 * implements. Modules are pure functions over `PolicyInput` plus their
 * own slice of `policiesConfig`. They never reach for filesystem or
 * network state directly — the engine prepares the snapshot.
 */
export interface PolicyModule {
    /** Produce zero or more decisions for the given input. */
    evaluate: (input: PolicyInput, config: VisConfig) => Promise<PolicyDecision[]> | PolicyDecision[];

    /**
     * Returns `false` when the user hasn't configured this policy
     * (so the engine omits it from the result unless explicitly
     * enabled via `enabledPolicies`). Allows zero-config monorepos to
     * see only the policies they opted into.
     */
    isConfigured: (config: VisConfig) => boolean;
    /** Display name; matches the corresponding `security.policies.*` key. */
    name: PolicyName;

    /**
     * `false` means the engine emits an `info` "skipped — requires
     * network" decision when `input.offline` is true, and short-circuits
     * the module. `true` means the policy runs normally offline.
     */
    offlineSupported: boolean;
    /** Surfaces the policy makes sense on. `[]` is illegal. */
    surfaces: ReadonlyArray<PolicySurface>;
}

const REGISTRY: PolicyModule[] = [
    {
        evaluate: evaluateVulnerabilityPolicy,
        isConfigured: (config) => config.security?.policies?.vulnerability !== undefined,
        name: "vulnerability",
        offlineSupported: true,
        surfaces: ["audit", "doctor"],
    },
    {
        evaluate: evaluateLicensePolicy,
        isConfigured: (config) => {
            const license = config.security?.policies?.license;

            return Boolean(license && ((license.allow && license.allow.length > 0) || (license.deny && license.deny.length > 0)));
        },
        name: "license",
        offlineSupported: true,
        surfaces: ["audit", "doctor", "install"],
    },
    {
        evaluate: evaluateInstallScriptsPolicy,
        isConfigured: (config) => {
            const installScripts = config.security?.policies?.installScripts;

            return Boolean(installScripts && ((installScripts.allow && Object.keys(installScripts.allow).length > 0) || installScripts.strict === true));
        },
        name: "installScripts",
        offlineSupported: true,
        surfaces: ["audit", "doctor", "install"],
    },
    {
        evaluate: evaluateUnexpectedDepsPolicy,
        isConfigured: (config) => {
            const unexpected = config.security?.policies?.unexpectedDeps;

            return Boolean(unexpected && ((unexpected.allow && unexpected.allow.length > 0) || typeof unexpected.baselineLockfile === "string"));
        },
        name: "unexpectedDeps",
        offlineSupported: true,
        surfaces: ["audit", "doctor", "install"],
    },
    {
        evaluate: evaluateFirstSeenPolicy,
        isConfigured: (config) => {
            const minutes = config.security?.policies?.firstSeen?.minutes;

            return typeof minutes === "number" && minutes > 0;
        },
        name: "firstSeen",
        offlineSupported: false,
        surfaces: ["audit", "doctor", "install"],
    },
    {
        evaluate: evaluatePublisherChangePolicy,
        isConfigured: (config) => config.security?.policies?.publisherChange?.mode === "no-downgrade",
        name: "publisherChange",
        offlineSupported: false,
        surfaces: ["audit", "doctor", "install"],
    },
];

/**
 * Returns the module list filtered by surface, enabled-set, and the
 * `isConfigured()` predicate. Order is registry-declaration order so
 * formatter output is stable.
 */
const selectModules = (surface: PolicySurface, config: VisConfig, enabledPolicies: Set<PolicyName> | undefined): PolicyModule[] =>
    REGISTRY.filter((policyModule) => {
        if (!policyModule.surfaces.includes(surface)) {
            return false;
        }

        if (enabledPolicies !== undefined) {
            return enabledPolicies.has(policyModule.name);
        }

        return policyModule.isConfigured(config);
    });

/**
 * Run every selected policy against `input` and return the flat list of
 * decisions. Failures inside a policy module are converted to an
 * `info`-level decision so a single broken policy can't take down the
 * whole audit.
 * @param input Snapshot of the resolved package set + ancillary data.
 * @param surface Where the call is coming from. Different surfaces
 * expose different policy subsets (`install` skips
 * policies that need the audit report).
 * @param options Caller knobs (active config, optional explicit policy
 * allow-list).
 */
export const evaluatePolicies = async (input: PolicyInput, surface: PolicySurface, options: EvaluateOptions): Promise<PolicyDecision[]> => {
    const selected = selectModules(surface, options.visConfig, options.enabledPolicies);
    const decisions: PolicyDecision[] = [];

    for (const policyModule of selected) {
        if (input.offline && !policyModule.offlineSupported) {
            decisions.push({
                packageName: "*",
                policy: policyModule.name,
                reason: `policy.${policyModule.name} skipped: requires network (--offline)`,
                severity: "info",
                version: "*",
            });

            continue;
        }

        try {
            const moduleDecisions = await policyModule.evaluate(input, options.visConfig);

            decisions.push(...moduleDecisions);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);

            decisions.push({
                packageName: "*",
                policy: policyModule.name,
                reason: `policy.${policyModule.name} failed: ${message}`,
                severity: "info",
                version: "*",
            });
        }
    }

    return decisions;
};

/**
 * Parses the `--policies` CLI flag. Returns:
 * - `undefined` when the flag wasn't passed (engine falls back to
 *   "all configured policies");
 * - an empty set when the user passed `--policies none` (engine
 *   evaluates nothing — useful for `--policies none` to bypass the
 *   engine entirely);
 * - a `Set&lt;PolicyName>` otherwise.
 *
 * Unknown policy names are silently skipped after a warning has been
 * emitted by the caller — we don't want a typo to silently expand the
 * allow-list.
 */
/** Lowercase → canonical camelCase lookup for case-insensitive parsing. */
const POLICY_NAME_LOOKUP: Map<string, PolicyName> = (() => {
    const map = new Map<string, PolicyName>();

    for (const name of POLICY_NAMES) {
        map.set(name.toLowerCase(), name);
    }

    return map;
})();

/**
 * Names of policies that currently have a registered module. Useful for
 * differentiating "unknown token" from "known SPDX-ish identifier but no
 * module shipped yet" in user-facing diagnostics.
 */
export const getRegisteredPolicyNames = (): PolicyName[] => REGISTRY.map((m) => m.name);

export const parsePoliciesFlag = (raw: string | undefined, onUnknown?: (name: string) => void): Set<PolicyName> | undefined => {
    if (raw === undefined) {
        return undefined;
    }

    const normalized = raw.trim().toLowerCase();

    if (normalized === "" || normalized === "none") {
        return new Set();
    }

    if (normalized === "all") {
        return new Set<PolicyName>(POLICY_NAMES);
    }

    const result = new Set<PolicyName>();

    for (const token of raw
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length > 0)) {
        // Accept both camelCase and snake_case spellings for ergonomics
        // (the CLI surface advertises camelCase; users sometimes type
        // snake_case out of muscle memory). Strip leading underscores
        // and convert `_x` sequences to upper-case.
        const camel = token.replace(/^_+/, "").replaceAll(/_+([a-z])/g, (_, c: string) => c.toUpperCase());
        const canonical = POLICY_NAME_LOOKUP.get(camel.toLowerCase());

        if (canonical === undefined) {
            onUnknown?.(token);
        } else {
            result.add(canonical);
        }
    }

    return result;
};
