/**
 * Resolves `name + specifier` to a concrete `name@version` install from
 * a lockfile-derived index.
 *
 * Lockfiles don't encode every edge uniformly:
 *
 * - pnpm stores **resolved** versions in each entry's `dependencies`
 *   sub-map, so the specifier is already the install's exact version.
 * - npm / yarn / bun store **semver ranges** (or dist-tags); we have
 *   to match the range against the set of versions we know exist for
 *   the given `name`.
 *
 * We try exact match first (cheap, handles pnpm), then fall back to
 * `semver.maxSatisfying` over every known version of `name`, and
 * finally to "pick one version" so a partial-lockfile input still
 * produces a best-effort edge.
 */

import semver from "semver";

/** `name → Set<version>` index built from every lockfile entry. */
export type VersionIndex = Map<string, Set<string>>;

/**
 * Resolves a single `name + specifier` pair to a concrete version, or
 * `undefined` if the name isn't in the lockfile at all.
 */
export const resolveSpecifier = (name: string, specifier: string, index: VersionIndex): string | undefined => {
    const versions = index.get(name);

    if (!versions || versions.size === 0) {
        return undefined;
    }

    // Fast path: the specifier is already the exact version (pnpm).
    if (versions.has(specifier)) {
        return specifier;
    }

    // semver.maxSatisfying prefers the highest version that matches; we
    // pass `{ includePrerelease: true }` so `1.2.3-beta.4` isn't silently
    // filtered when users explicitly pull in a prerelease.
    const list = [...versions];
    const best = semver.maxSatisfying(list, specifier, { includePrerelease: true });

    if (best) {
        return best;
    }

    // Workspace / git / file specifiers ("workspace:^", "git+…") don't
    // satisfy any range. Take the first version we saw so the edge
    // still lands; callers that care can post-filter.
    return list[0];
};
