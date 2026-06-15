/**
 * Channel routing — branch → ChannelConfig resolution (RFC §10).
 *
 * Pure functions. Handles glob-pattern branch matching (e.g. maintenance
 * branches like `[0-9]*.x`). Glob library: vis's existing `zeptomatch`
 * (already a dep). NB: zeptomatch does not support extglob syntax such
 * as `+([0-9])` — stick to `*`, `?`, `[...]`, and `{a,b}` alternations.
 */

import zeptomatch from "zeptomatch";

import type { ChannelConfig } from "../types";

export interface ResolvedChannel {
    /** Branch name that matched (literal string from config, or glob source). */
    branch: string;
    /** Auto-publish vs version-PR. Default: `auto-publish`. */
    mode: "auto-publish" | "version-pr";

    /**
     * Other channel patterns that also matched the branch (literal or glob).
     * First-listed wins; callers should surface this so users can disambiguate
     * unintentional overlaps.
     */
    overlapping?: ReadonlyArray<string>;
    /** Pre-release identifier (`alpha`, `beta`, `rc`, undefined for stable). */
    prerelease?: string;

    /**
     * Maintenance-branch range (e.g. `1.x`), or the literal `"match"` to
     * derive the range from the branch name. Undefined for normal branches.
     */
    range?: string;
    /** npm dist-tag for publishes on this channel. */
    tag: string;
}

/**
 * Match a branch name against the configured channels and return the
 * resolved channel. Returns `undefined` when no channel matches —
 * callers should treat that as "no release" (e.g. on a feature branch
 * outside the configured release branches).
 *
 * Match precedence: literal branch name wins over glob; among globs,
 * the first match in iteration order wins (so users should order
 * specific globs before catch-alls in `vis.config.ts`).
 */
export const resolveChannel = (
    branch: string,
    channels: Record<string, ChannelConfig> | undefined,
): ResolvedChannel | undefined => {
    if (!channels) {
        return undefined;
    }

    // Pass 1: literal match.
    if (Object.hasOwn(channels, branch)) {
        // Glob patterns that *also* match the branch are surfaced so the
        // CLI can warn — a literal still wins, but the user might have
        // intended the glob.
        const overlapping = Object.keys(channels).filter(
            (pattern) => pattern !== branch && isGlobPattern(pattern) && zeptomatch(pattern, branch),
        );

        return materialize(branch, channels[branch]!, overlapping);
    }

    // Pass 2: glob match. Collect *all* matching globs and surface the
    // first-wins choice plus any runner-up patterns so callers can warn.
    const matchingGlobs: string[] = [];

    for (const [pattern] of Object.entries(channels)) {
        if (isGlobPattern(pattern) && zeptomatch(pattern, branch)) {
            matchingGlobs.push(pattern);
        }
    }

    if (matchingGlobs.length > 0) {
        const [winner, ...overlapping] = matchingGlobs;

        return materialize(branch, channels[winner!]!, overlapping);
    }

    return undefined;
};

const materialize = (branch: string, cfg: ChannelConfig, overlapping: ReadonlyArray<string> = []): ResolvedChannel => {
    let { tag } = cfg;

    if (tag === "branch-name") {
        tag = sanitizeDistTag(branch);
    }

    return {
        branch,
        mode: cfg.mode ?? "auto-publish",
        ...(overlapping.length > 0 ? { overlapping } : {}),
        prerelease: cfg.prerelease,
        range: cfg.range,
        tag,
    };
};

/**
 * Sanitise a branch name into a valid npm dist-tag — npm dist-tags must be
 * ASCII with no spaces or slashes. Used for maintenance branches like `1.x`
 * that publish under a tag matching the branch name.
 */
const sanitizeDistTag = (branch: string): string => branch.toLowerCase().replaceAll(/[^a-z0-9.-]/g, "-").replaceAll(/^-+|-+$/g, "") || "branch";

const GLOB_META_RE = /[!()*+?@[\]{|}]/;
const isGlobPattern = (pattern: string): boolean => GLOB_META_RE.test(pattern);

/**
 * Detect the current git branch via `git rev-parse --abbrev-ref HEAD`.
 * Returns `undefined` on detached HEAD or non-git workspaces (caller
 * should fall back to `--channel` flag or `defaultBranch` config).
 *
 * NB: this function shells out to `git`. Kept here for proximity to the
 * channel-resolution logic; could be moved to `core/git.ts` later.
 */
export const detectCurrentBranch = async (
    cwd: string,
    runner: { run: (command: string, args: ReadonlyArray<string>, options: { cwd: string; silent?: boolean }) => Promise<{ exitCode: number; stdout: string }> },
): Promise<string | undefined> => {
    try {
        const result = await runner.run("git", ["rev-parse", "--abbrev-ref", "HEAD"], { cwd, silent: true });

        if (result.exitCode !== 0) {
            return undefined;
        }

        const branch = result.stdout.trim();

        return branch === "HEAD" || branch === "" ? undefined : branch;
    } catch {
        return undefined;
    }
};
