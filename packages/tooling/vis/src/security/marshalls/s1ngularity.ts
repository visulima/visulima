/**
 * s1ngularity marshall — composite "compromised-publish shape" detector.
 *
 * Named after the August 2025 s1ngularity attack on Nx, where a stolen npm
 * publish token was used to ship `nx` / `@nx/*` versions that *added* a
 * malicious `postinstall` hook while *dropping* the sigstore provenance the
 * prior good versions carried (the OIDC-derived attestation can't be
 * reproduced without the real CI).
 *
 * Neither half is actionable alone: plenty of legitimate packages have a
 * postinstall, and plenty lack provenance. What is rare — and is the literal
 * fingerprint of a token-compromise publish — is *one version bump that does
 * both at once*. The existing `provenance` and `installScripts` marshalls run
 * independently and never correlate; this marshall is that correlation.
 *
 * Signal A (install-script regression): the resolved version introduced or
 *   changed a `preinstall` / `install` / `postinstall` script relative to the
 *   newest prior stable version. `prepare` is deliberately excluded — it does
 *   not run for registry tarball installs, so it is not an install-time
 *   execution vector.
 * Signal B (trust regression): the newest prior stable version had
 *   `dist.attestations.provenance` and the resolved version does not.
 *
 * A finding is emitted only when A AND B hold for the same version. Severity
 * is `error` — the conjunction is high-confidence by construction. Packages
 * that never carried provenance cannot trip Signal B (same inherent limit as
 * the `provenance` marshall); that is accepted for v1 and documented.
 *
 * Reads through the shared {@link getPackument} cache — no extra HTTP.
 */

import { lt as semverLt, prerelease as semverPrerelease, valid as semverValid } from "semver";

import { DEFAULT_MARSHALL_CONCURRENCY, mapWithConcurrency } from "./concurrency";
import type { Packument } from "./packument";
import { getPackument } from "./packument";
import { isMarshallDisabled } from "./registry";

/** Install-time lifecycle hooks. `prepare` is excluded — it does not run for registry tarball installs. */
const INSTALL_HOOKS = ["preinstall", "install", "postinstall"] as const;

export interface S1ngularityHookChange {
    /** The command the resolved version runs for this hook. */
    command: string;
    hook: (typeof INSTALL_HOOKS)[number];
    /** `introduced` when the prior stable version had no such hook; `changed` when it had a different command. */
    kind: "changed" | "introduced";
}

export interface S1ngularityFinding {
    /** Install hooks the resolved version introduced or changed vs. the prior stable version. */
    hookChanges: S1ngularityHookChange[];
    packageName: string;
    /** Newest stable version `< version` used as the comparison baseline. */
    priorVersion: string;
    /** What the prior stable version carried that the resolved version dropped. v1 only emits `provenance-dropped`. */
    trustSignal: "provenance-dropped";
    version: string;
}

export interface RunS1ngularityMarshallOptions {
    allowlist?: string[];
    /** Max packages inspected in parallel. Defaults to {@link DEFAULT_MARSHALL_CONCURRENCY}. */
    concurrency?: number;
    /** Workspace root used to resolve registry overrides. */
    workspaceRoot?: string;
}

const hasProvenance = (packument: Packument, version: string): boolean =>
    packument.versions[version]?.dist?.attestations?.provenance !== undefined;

/**
 * Newest published stable version strictly less than `installedVersion`.
 * Prereleases are skipped — a user bumping a stable dep compares against the
 * prior stable, and prerelease churn would produce noisy baselines.
 */
export const findNewestPriorStable = (packument: Packument, installedVersion: string): string | undefined => {
    if (semverValid(installedVersion) === null) {
        return undefined;
    }

    return Object.keys(packument.versions)
        .filter((version) => semverValid(version) !== null && semverPrerelease(version) === null && semverLt(version, installedVersion))
        .sort((a, b) => (semverLt(a, b) ? 1 : -1))[0];
};

const installHookChanges = (
    current: Record<string, string> | undefined,
    prior: Record<string, string> | undefined,
): S1ngularityHookChange[] => {
    const currentScripts = current ?? {};
    const priorScripts = prior ?? {};
    const changes: S1ngularityHookChange[] = [];

    for (const hook of INSTALL_HOOKS) {
        const command = currentScripts[hook];

        if (command === undefined || command === "") {
            continue;
        }

        const priorCommand = priorScripts[hook];

        if (priorCommand === undefined || priorCommand === "") {
            changes.push({ command, hook, kind: "introduced" });
        } else if (priorCommand !== command) {
            changes.push({ command, hook, kind: "changed" });
        }
    }

    return changes;
};

export const runS1ngularityMarshall = async (
    packages: { name: string; version: string }[],
    options: RunS1ngularityMarshallOptions = {},
): Promise<S1ngularityFinding[]> => {
    if (isMarshallDisabled("s1ngularity")) {
        return [];
    }

    const allowlist = new Set(options.allowlist);
    const concurrency = options.concurrency ?? DEFAULT_MARSHALL_CONCURRENCY;

    const perPackage = await mapWithConcurrency(packages, concurrency, async ({ name, version }): Promise<S1ngularityFinding | undefined> => {
        if (allowlist.has(name)) {
            return undefined;
        }

        const packument = await getPackument(name, { workspaceRoot: options.workspaceRoot });

        if (packument?.versions[version] === undefined) {
            return undefined;
        }

        const priorVersion = findNewestPriorStable(packument, version);

        if (priorVersion === undefined) {
            // No prior stable release — a brand-new package can't *regress*.
            return undefined;
        }

        // Signal B: prior carried provenance, resolved version dropped it.
        if (!hasProvenance(packument, priorVersion) || hasProvenance(packument, version)) {
            return undefined;
        }

        // Signal A: install hook introduced or changed in the resolved version.
        const hookChanges = installHookChanges(packument.versions[version]?.scripts, packument.versions[priorVersion]?.scripts);

        if (hookChanges.length === 0) {
            return undefined;
        }

        return { hookChanges, packageName: name, priorVersion, trustSignal: "provenance-dropped", version };
    });

    return perPackage.filter((entry): entry is S1ngularityFinding => entry !== undefined);
};
