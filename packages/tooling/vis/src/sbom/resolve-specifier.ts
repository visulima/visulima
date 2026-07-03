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

/** `name → Set&lt;version>` index built from every lockfile entry. */
export type VersionIndex = Map<string, Set<string>>;

/**
 * Yarn Berry (and some pnpm / bun entries) prefixes specifiers with a
 * protocol marker like `npm:^1.0.0` or `workspace:^`. We strip the
 * protocol before handing the range to semver, since `npm:` is just a
 * notation saying "look this up in the npm registry" — the actual
 * range is what follows.
 */
const stripProtocolPrefix = (specifier: string): string => {
    const colonIndex = specifier.indexOf(":");

    if (colonIndex <= 0) {
        return specifier;
    }

    const prefix = specifier.slice(0, colonIndex);

    // `npm:` → normal semver range; safe to strip.
    // Anything else (`workspace:`, `file:`, `patch:`, `git+`, …) has no
    // meaningful semver to recover — leave it alone so the fallback path
    // picks the first-known version instead of treating the whole string
    // as a range.
    return prefix === "npm" ? specifier.slice(colonIndex + 1) : specifier;
};

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

    const stripped = stripProtocolPrefix(specifier);

    if (stripped !== specifier && versions.has(stripped)) {
        return stripped;
    }

    // semver.maxSatisfying prefers the highest version that matches; we
    // pass `{ includePrerelease: true }` so `1.2.3-beta.4` isn't silently
    // filtered when users explicitly pull in a prerelease.
    const list = [...versions];
    const best = semver.maxSatisfying(list, stripped, { includePrerelease: true });

    if (best) {
        return best;
    }

    // Workspace / git / file specifiers ("workspace:^", "git+…") don't
    // satisfy any range. Take the first version we saw so the edge
    // still lands; callers that care can post-filter.
    return list[0];
};
