/**
 * Channel-aware semver bumping (RFC §10.1).
 *
 * Wraps the `semver` package with the channel-transition rules from the
 * RFC's table:
 *
 *   from main, last 1.2.3   + minor + alpha → 1.3.0-alpha.0  (open prerelease line)
 *   on alpha, last 1.3.0-alpha.5 + patch + alpha → 1.3.0-alpha.6 (counter increments)
 *   on beta, last 1.3.0-alpha.5 + (no bump) → 1.3.0-beta.0   (re-counter on new preid)
 *   on next, last 1.3.0-beta.5 + (no bump) → 1.3.0-rc.0       (next channel preid)
 *   on main, last 1.3.0-rc.5 + (no bump) → 1.3.0              (preid stripped — final)
 *
 * Pure functions; no I/O. Re-exports `satisfies`/`coerce`/etc. from `semver`
 * so callers don't need to import both.
 */

import semver from "semver";

import { VisReleaseError } from "../errors";
import type { BumpLevel } from "../types";

export type ReleaseType = Exclude<BumpLevel, "none">;

export interface BumpInput {
    /** Bump level requested (or `"none"` for channel-only transitions). */
    bump: BumpLevel;

    /**
     * For pre-1.0 versions, demote major bumps to minor and minor bumps
     * to patch. Matches release-please's `bump-minor-pre-major` /
     * `bump-patch-for-minor-pre-major` flags — keeps libraries pre-1.0
     * from jumping all the way to 2.0 on the first breaking change.
     */
    bumpMinorPreMajor?: boolean;

    /**
     * Companion to `bumpMinorPreMajor` — for pre-1.0 versions, demote
     * minor bumps to patch as well. Only meaningful when
     * `bumpMinorPreMajor` is also set.
     */
    bumpPatchForMinorPreMajor?: boolean;
    /** Currently-published version. */
    current: string;
    /** Pre-release identifier (e.g. `"alpha"`). Omit for stable channels. */
    prerelease?: string;
}

/**
 * Compute the next version given the current version, requested bump level,
 * and active channel's prerelease id.
 *
 * Encapsulates the channel-transition rules (re-counter on preid change,
 * collapse to stable when preid is dropped, etc.).
 */
export const bumpVersion = (input: BumpInput): string => {
    const { current, prerelease } = input;
    let { bump } = input;

    if (!semver.valid(current)) {
        throw new VisReleaseError({
            code: "CONFIG_INVALID",
            message: `Invalid current version: ${JSON.stringify(current)}`,
        });
    }

    const currentParsed = semver.parse(current)!;
    const currentPreid = currentParsed.prerelease[0];
    const currentIsPrerelease = currentParsed.prerelease.length > 0;

    // Pre-1.0 demotion. Apply before the rest of the logic so escalation
    // paths through prerelease channels (alpha/beta/rc) see the demoted
    // level too. Demotion is a no-op once `current.major >= 1`.
    if (currentParsed.major === 0 && input.bumpMinorPreMajor) {
        if (bump === "major") {
            bump = "minor";
        }

        if (bump === "minor" && input.bumpPatchForMinorPreMajor) {
            bump = "patch";
        }
    }

    // Case 1: no bump requested + channel transition.
    if (bump === "none") {
        // Same channel, same version — just return.
        if ((currentPreid ?? undefined) === (prerelease ?? undefined)) {
            return current;
        }

        // Stable → prerelease (open new prerelease line on the SAME version).
        if (!currentIsPrerelease && prerelease) {
            return `${currentParsed.major}.${currentParsed.minor}.${currentParsed.patch}-${prerelease}.0`;
        }

        // Prerelease → stable (collapse — strip preid).
        if (currentIsPrerelease && !prerelease) {
            return `${currentParsed.major}.${currentParsed.minor}.${currentParsed.patch}`;
        }

        // Prerelease → different prerelease (re-counter on new preid).
        if (currentIsPrerelease && prerelease) {
            return `${currentParsed.major}.${currentParsed.minor}.${currentParsed.patch}-${prerelease}.0`;
        }

        return current;
    }

    // Case 2: explicit bump.
    if (currentIsPrerelease && prerelease && currentPreid === prerelease) {
        // Bumping within the same prerelease line.
        // - If the requested bump is <= the level that opened the line (e.g. a
        //   `patch` on a `minor`-opened line), just increment the counter.
        // - If the requested bump escalates above the line's base, strip the
        //   preid, perform the bump, and reapply the preid at .0.
        const baseType = inferBaseTypeFromPrerelease(currentParsed);

        if (RELEASE_TYPE_RANK[bump] <= RELEASE_TYPE_RANK[baseType]) {
            const next = semver.inc(current, "prerelease", prerelease);

            if (!next) {
                throw new VisReleaseError({
                    code: "CONFIG_INVALID",
                    message: `semver.inc returned null for prerelease bump on ${current}`,
                });
            }

            return next;
        }

        // Escalation — e.g. on alpha line `1.3.0-alpha.5`, user requests `major`.
        const stable = `${currentParsed.major}.${currentParsed.minor}.${currentParsed.patch}`;
        const escalated = semver.inc(stable, bump);

        if (!escalated) {
            throw new VisReleaseError({
                code: "CONFIG_INVALID",
                message: `semver.inc returned null for ${bump} bump on ${stable}`,
            });
        }

        return `${escalated}-${prerelease}.0`;
    }

    if (prerelease) {
        // Either current is stable, or current is on a different preid line.
        // Treat as: strip preid (if any), bump, append preid.0.
        const stable = `${currentParsed.major}.${currentParsed.minor}.${currentParsed.patch}`;
        const escalated = semver.inc(stable, bump);

        if (!escalated) {
            throw new VisReleaseError({
                code: "CONFIG_INVALID",
                message: `semver.inc returned null for ${bump} bump on ${stable}`,
            });
        }

        return `${escalated}-${prerelease}.0`;
    }

    // No prerelease — straight semver bump.
    if (currentIsPrerelease) {
        // From prerelease to stable: bump operates on the underlying base.
        // Example: 1.3.0-rc.5 + (none) collapses to 1.3.0; 1.3.0-rc.5 + minor → 1.4.0.
        const stable = `${currentParsed.major}.${currentParsed.minor}.${currentParsed.patch}`;
        const next = semver.inc(stable, bump);

        if (!next) {
            throw new VisReleaseError({
                code: "CONFIG_INVALID",
                message: `semver.inc returned null for ${bump} bump on ${stable}`,
            });
        }

        return next;
    }

    const next = semver.inc(current, bump);

    if (!next) {
        throw new VisReleaseError({
            code: "CONFIG_INVALID",
            message: `semver.inc returned null for ${bump} bump on ${current}`,
        });
    }

    return next;
};

/**
 * Heuristic: given a prerelease version like `1.3.0-alpha.0`, infer what
 * release type opened the line. `1.x.0` → minor, `1.0.x` → patch, `x.0.0` → major.
 * Used to decide whether a bump within the same prerelease is a counter
 * increment or an escalation.
 */
const RELEASE_TYPE_RANK: Record<ReleaseType, number> = { major: 3, minor: 2, patch: 1 };

const inferBaseTypeFromPrerelease = (parsed: semver.SemVer): ReleaseType => {
    if (parsed.minor === 0 && parsed.patch === 0) {
        return "major";
    }

    if (parsed.patch === 0) {
        return "minor";
    }

    return "patch";
};

// ── Range satisfaction (re-export semver helpers) ───────────────────

/**
 * Check whether `version` satisfies `range`. Wraps `semver.satisfies`
 * with `includePrerelease: true` so prerelease versions can match
 * non-prerelease ranges (the propagation algorithm needs this — without it,
 * every prerelease bump would propagate everywhere as out-of-range).
 */
export const satisfiesRange = (version: string, range: string): boolean => {
    const cleaned = cleanRange(range);

    if (!cleaned) {
        // Unparseable / catalog: / workspace shorthand — treat as "always satisfied".
        return true;
    }

    return semver.satisfies(version, cleaned, { includePrerelease: true });
};

/**
 * Strip workspace/catalog protocol prefixes from a dep range and return the
 * underlying semver expression. Returns `null` for ranges that have no
 * meaningful semver constraint (`workspace:*`, `catalog:`, etc. — these are
 * effectively "always satisfied" until the publish step rewrites them).
 */
export const cleanRange = (range: string): string | null => {
    if (!range) {
        return null;
    }

    if (range.startsWith("catalog:")) {
        return null;
    }

    if (range === "*" || range === "workspace:*" || range === "workspace:^" || range === "workspace:~") {
        return null;
    }

    if (range.startsWith("workspace:")) {
        const stripped = range.slice("workspace:".length);

        if (stripped === "*" || stripped === "^" || stripped === "~") {
            return null;
        }

        return stripped;
    }

    if (range.startsWith("npm:")) {
        // npm:<name>@<spec>
        const at = range.lastIndexOf("@");

        if (at > "npm:".length) {
            return range.slice(at + 1);
        }

        return null;
    }

    return range;
};

export { default as semver } from "semver";
