/**
 * New-bin marshall.
 *
 * Warns when a version introduces a CLI bin that wasn't present in the
 * immediately-prior published version. Catches the "supply-chain dropper
 * via a new postinstall bin" pattern.
 *
 * Severity is always *warning* — bin additions are a soft signal, not a
 * hard error. The shared auto-continue collector (item 10) decides UX.
 */

import { lt as semverLt, valid as semverValid } from "semver";

import { DEFAULT_MARSHALL_CONCURRENCY, mapWithConcurrency } from "./concurrency";
import type { Packument, PackumentVersionEntry } from "./packument";
import { getPackument } from "./packument";
import { isMarshallDisabled } from "./registry";

export interface NewBinFinding {
    fromVersion: string;
    newBins: { command: string; name: string }[];
    packageName: string;
    toVersion: string;
}

export interface RunNewBinMarshallOptions {
    /** Names of bins that should never trigger (e.g. "tsc", "eslint"). */
    allowBins?: string[];
    /** Package names whose bin diffs should be skipped entirely. */
    allowlist?: string[];
    /** Max packages inspected in parallel. Defaults to {@link DEFAULT_MARSHALL_CONCURRENCY}. */
    concurrency?: number;
    workspaceRoot?: string;
}

/**
 * npm allows `bin` to be either a string (the package's name is the bin) or
 * a record. Normalize to a `{ name -> command }` map.
 */
export const normalizeBin = (binField: PackumentVersionEntry["bin"], packageName: string): Record<string, string> => {
    if (binField === undefined) {
        return {};
    }

    if (typeof binField === "string") {
        // npm strips the leading scope for the implied name (e.g. `@scope/foo` → `foo`).
        const inferred = packageName.startsWith("@") ? packageName.split("/").at(1) ?? packageName : packageName;

        return { [inferred]: binField };
    }

    return { ...binField };
};

const findImmediatelyPriorVersion = (packument: Packument, installedVersion: string): string | undefined => {
    if (!semverValid(installedVersion)) {
        return undefined;
    }

    const priors = Object.keys(packument.versions)
        .filter((version) => semverValid(version) !== null && semverLt(version, installedVersion))
        .sort((a, b) => (semverLt(a, b) ? 1 : -1));

    return priors[0];
};

export const runNewBinMarshall = async (
    packages: { name: string; version: string }[],
    options: RunNewBinMarshallOptions = {},
): Promise<NewBinFinding[]> => {
    if (isMarshallDisabled("newBin")) {
        return [];
    }

    const allowlist = new Set(options.allowlist);
    const allowBins = new Set(options.allowBins);
    const concurrency = options.concurrency ?? DEFAULT_MARSHALL_CONCURRENCY;

    const perPackage = await mapWithConcurrency(packages, concurrency, async ({ name, version }): Promise<NewBinFinding | undefined> => {
        if (allowlist.has(name)) {
            return undefined;
        }

        const packument = await getPackument(name, { workspaceRoot: options.workspaceRoot });

        if (packument === undefined) {
            return undefined;
        }

        const currentEntry = packument.versions[version];

        if (currentEntry === undefined) {
            return undefined;
        }

        const priorVersion = findImmediatelyPriorVersion(packument, version);

        if (priorVersion === undefined) {
            // Newly-published package with no priors — bin additions aren't a regression.
            return undefined;
        }

        const priorEntry = packument.versions[priorVersion];

        if (priorEntry === undefined) {
            return undefined;
        }

        const currentBins = normalizeBin(currentEntry.bin, name);
        const priorBins = normalizeBin(priorEntry.bin, name);

        const newBins = Object.entries(currentBins)
            .filter(([binName]) => !(binName in priorBins))
            .filter(([binName]) => !allowBins.has(binName))
            .map(([binName, command]) => { return { command, name: binName }; });

        if (newBins.length === 0) {
            return undefined;
        }

        return { fromVersion: priorVersion, newBins, packageName: name, toVersion: version };
    });

    return perPackage.filter((entry): entry is NewBinFinding => entry !== undefined);
};
