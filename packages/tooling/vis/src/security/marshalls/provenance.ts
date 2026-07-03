/**
 * Provenance-regression marshall.
 *
 * Flags a package whose currently-resolved version is missing
 * `dist.attestations.provenance` despite a prior published `< version` having
 * it. Catches the "publisher dropped provenance" supply-chain regression that
 * a stale tarball or compromised CI key would produce.
 *
 * Reads through the shared {@link getPackument} cache — no extra HTTP. The
 * raw finding shape is intentionally narrower than the outer marshall finding
 * envelope; call sites wrap it with `marshall: "provenance"` + severity + message.
 */

import { lt as semverLt, satisfies as semverSatisfies, valid as semverValid } from "semver";

import { DEFAULT_MARSHALL_CONCURRENCY, mapWithConcurrency } from "./concurrency";
import type { Packument } from "./packument";
import { getPackument } from "./packument";
import { isMarshallDisabled } from "./registry";

export interface ProvenanceFinding {
    packageName: string;
    priorVersionWithProvenance: string;
    version: string;
}

export interface RunProvenanceMarshallOptions {
    allowlist?: string[];
    /** Max packages inspected in parallel. Defaults to {@link DEFAULT_MARSHALL_CONCURRENCY}. */
    concurrency?: number;
    /** Workspace root used to resolve registry overrides. */
    workspaceRoot?: string;
}

const hasProvenance = (packument: Packument, version: string): boolean => {
    const entry = packument.versions[version];

    return entry?.dist?.attestations?.provenance !== undefined;
};

/**
 * Return the highest published version strictly less than `installedVersion`
 * that has `dist.attestations.provenance`. Stable releases only —
 * prereleases ahead or alongside the installed version are ignored.
 */
export const findNewestPriorWithAttestations = (packument: Packument, installedVersion: string): string | undefined => {
    if (!semverValid(installedVersion)) {
        return undefined;
    }

    const candidates = Object.keys(packument.versions)
        .filter((version) => semverValid(version) !== null && semverLt(version, installedVersion))
        .filter((version) => semverSatisfies(version, "*", { includePrerelease: false }))
        .filter((version) => hasProvenance(packument, version))
        .sort((a, b) => (semverLt(a, b) ? 1 : -1));

    return candidates[0];
};

export const runProvenanceMarshall = async (
    packages: { name: string; version: string }[],
    options: RunProvenanceMarshallOptions = {},
): Promise<ProvenanceFinding[]> => {
    if (isMarshallDisabled("provenance")) {
        return [];
    }

    const allowlist = new Set(options.allowlist);
    const concurrency = options.concurrency ?? DEFAULT_MARSHALL_CONCURRENCY;

    const perPackage = await mapWithConcurrency(packages, concurrency, async ({ name, version }): Promise<ProvenanceFinding | undefined> => {
        if (allowlist.has(name)) {
            return undefined;
        }

        const packument = await getPackument(name, { workspaceRoot: options.workspaceRoot });

        if (packument === undefined) {
            return undefined;
        }

        if (hasProvenance(packument, version)) {
            return undefined;
        }

        const priorWithProvenance = findNewestPriorWithAttestations(packument, version);

        if (priorWithProvenance === undefined) {
            return undefined;
        }

        return { packageName: name, priorVersionWithProvenance: priorWithProvenance, version };
    });

    return perPackage.filter((entry): entry is ProvenanceFinding => entry !== undefined);
};
