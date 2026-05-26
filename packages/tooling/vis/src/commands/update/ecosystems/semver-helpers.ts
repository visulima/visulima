import { coerce, gt, parse, rcompare, valid } from "semver";

import type { EcosystemUpdateType } from "./types";

/**
 * Loose semver shape — covers the common tag styles found in workflow
 * pins (`v3`, `v3.1`, `v3.1.0`, `3.1.0-beta.2`). `coerce` handles
 * partial versions; we keep a separate `prerelease` flag because the
 * applier needs to know whether to filter pre-releases without
 * re-parsing.
 */
export interface ParsedTag {
    readonly major: number;
    readonly minor: number;
    readonly patch: number;
    readonly prerelease: boolean;
    readonly raw: string;
    readonly normalized: string;
}

/**
 * Parses a tag string into a `ParsedTag`. Returns `undefined` for
 * non-semver tags (e.g. `latest`, `nightly`, `main`). A leading `v` is
 * tolerated and stripped.
 */
export const parseTag = (input: string): ParsedTag | undefined => {
    const trimmed = input.trim();

    if (trimmed === "") {
        return undefined;
    }

    const candidate = trimmed.startsWith("v") || trimmed.startsWith("V") ? trimmed.slice(1) : trimmed;
    // `parse` is strict (requires major.minor.patch); we fall back to
    // `coerce` for partials like `v3` or `3.1`. We prefer `parse` first
    // because it preserves prerelease tags faithfully.
    const strict = valid(candidate) ? parse(candidate) : undefined;
    const coerced = strict ?? coerce(candidate, { includePrerelease: true });

    if (!coerced) {
        return undefined;
    }

    return {
        major: coerced.major,
        minor: coerced.minor,
        patch: coerced.patch,
        prerelease: coerced.prerelease.length > 0,
        raw: trimmed,
        normalized: `${String(coerced.major)}.${String(coerced.minor)}.${String(coerced.patch)}${
            coerced.prerelease.length > 0 ? `-${coerced.prerelease.join(".")}` : ""
        }`,
    };
};

/**
 * Compares two parsed tags newest-first. Wraps semver `rcompare` to keep
 * the call sites consistent across the ecosystems.
 */
export const compareTagsDesc = (a: ParsedTag, b: ParsedTag): number => rcompare(a.normalized, b.normalized);

/**
 * Selects the best candidate tag from a list under the constraints:
 *   - drop entries that are not newer than `current` (when current is set);
 *   - drop pre-releases unless `includePrerelease` is true;
 *   - respect `mode`: `latest` allows any newer ref, `minor` constrains to
 *     same major, `patch` constrains to same major+minor.
 *
 * Returns `undefined` when nothing qualifies (already up-to-date or only
 * pre-releases are newer and the caller opted out).
 */
export const pickBestTag = (
    candidates: ParsedTag[],
    current: ParsedTag | undefined,
    mode: "latest" | "minor" | "patch",
    includePrerelease: boolean,
): ParsedTag | undefined => {
    const filtered = candidates.filter((tag) => {
        if (!includePrerelease && tag.prerelease) {
            return false;
        }

        if (!current) {
            return true;
        }

        if (mode === "patch" && (tag.major !== current.major || tag.minor !== current.minor)) {
            return false;
        }

        if (mode === "minor" && tag.major !== current.major) {
            return false;
        }

        // Strictly newer.
        return gt(tag.normalized, current.normalized);
    });

    if (filtered.length === 0) {
        return undefined;
    }

    return filtered.toSorted(compareTagsDesc)[0];
};

/**
 * Classifies the size of the version jump from `current` to `next`.
 * Returns `"unknown"` when either side fails to parse — the caller is
 * expected to surface this in the UI rather than guess.
 */
export const classifyUpdate = (current: ParsedTag | undefined, next: ParsedTag | undefined): EcosystemUpdateType => {
    if (!current || !next) {
        return "unknown";
    }

    if (next.major !== current.major) {
        return "major";
    }

    if (next.minor !== current.minor) {
        return "minor";
    }

    if (next.patch !== current.patch) {
        return "patch";
    }

    return "unknown";
};
