import zeptomatch from "zeptomatch";

import type { DepInstance, DepType } from "./workspace-deps";

export interface JsonDepsFilterOptions {
    depTypes?: DepType[];
    excludePatterns?: string[];
    externalOnly?: boolean;
    includePatterns?: string[];
    internalOnly?: boolean;
}

const matchesAny = (target: string, patterns: string[]): boolean => {
    for (const pattern of patterns) {
        if (zeptomatch(pattern, target)) {
            return true;
        }
    }

    return false;
};

/**
 * Filter a flat list of `DepInstance` records.
 *
 * Rules:
 * - `internalOnly` and `externalOnly` are mutually exclusive. When both are
 *   true the result is empty (no instance can be both).
 * - `includePatterns` is matched against the *declaring package's* `name`
 *   field via zeptomatch — instances from packages without a `name` are
 *   dropped when any include pattern is supplied.
 * - `excludePatterns` removes instances whose declaring package name matches.
 * - `depTypes` whitelists which `*Dependencies` blocks survive.
 */
export const filterDepInstances = (instances: DepInstance[], options: JsonDepsFilterOptions = {}): DepInstance[] => {
    const { depTypes, excludePatterns, externalOnly, includePatterns, internalOnly } = options;

    if (internalOnly && externalOnly) {
        return [];
    }

    const depTypeSet = depTypes && depTypes.length > 0 ? new Set<DepType>(depTypes) : undefined;
    const includes = includePatterns && includePatterns.length > 0 ? includePatterns : undefined;
    const excludes = excludePatterns && excludePatterns.length > 0 ? excludePatterns : undefined;

    const out: DepInstance[] = [];

    for (const instance of instances) {
        if (internalOnly && !instance.isInternal) {
            continue;
        }

        if (externalOnly && instance.isInternal) {
            continue;
        }

        if (depTypeSet && !depTypeSet.has(instance.depType)) {
            continue;
        }

        if (includes && (!instance.packageName || !matchesAny(instance.packageName, includes))) {
            continue;
        }

        if (excludes && instance.packageName && matchesAny(instance.packageName, excludes)) {
            continue;
        }

        out.push(instance);
    }

    return out;
};
