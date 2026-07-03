/**
 * Shared git-tag resolution for `syncGitTag` groups (tegami parity).
 *
 * A `fixed` / `linked` group configured with `syncGitTag: true` collapses to a
 * single git tag (and a single aggregate GitHub/GitLab release) for the whole
 * group instead of one tag + release per member. This module decides, for a
 * given published set, which members belong to a sync group and what the shared
 * tag is — the orchestrator's tag loop + release creation consume the result.
 *
 * Pure functions only.
 */

import { gt as semverGt, valid as semverValid } from "semver";
import zeptomatch from "zeptomatch";

import type { VisReleaseConfig } from "../types";
import { normaliseGroup } from "../types";

export interface SyncTagGroup {
    /** Published member package names covered by this group. */
    members: string[];
    /** Group name (config `name`, else `group-&lt;index>`). */
    name: string;
    /** Resolved shared git tag. */
    tag: string;
    /** Representative version (highest among members — equal for fixed groups). */
    version: string;
}

export interface SyncTagResolution {
    /** Every member name covered by a sync group (skip per-package tag/release). */
    grouped: Set<string>;
    /** One entry per sync group that has ≥1 published member. */
    groups: SyncTagGroup[];
}

const renderGroupTag = (pattern: string | undefined, name: string, version: string): string =>
    (pattern ?? "{name}@{version}").replaceAll("{name}", name).replaceAll("{version}", version);

/**
 * Highest version among the group's members. Uses full semver comparison
 * (prerelease identifiers included) so `1.2.0` beats `1.2.0-rc.1` rather than
 * tying on the numeric core and falling back to input order. Non-semver values
 * sort below valid ones and ties keep the earlier entry.
 */
const pickMaxVersion = (versions: string[]): string => {
    let max = versions[0] ?? "0.0.0";

    for (const current of versions) {
        const valid = semverValid(current) !== null;
        const maxValid = semverValid(max) !== null;

        if (valid && (!maxValid || semverGt(current, max))) {
            max = current;
        }
    }

    return max;
};

/**
 * Resolve which published packages collapse into a shared `syncGitTag` group
 * tag. A package matched by multiple sync groups is claimed by the first
 * (config order: `fixed` before `linked`).
 */
export const resolveSyncTagGroups = (config: VisReleaseConfig, published: ReadonlyArray<{ name: string; version: string }>): SyncTagResolution => {
    const rawGroups = [...(config.fixed ?? []), ...(config.linked ?? [])].map((group) => normaliseGroup(group));
    const groups: SyncTagGroup[] = [];
    const grouped = new Set<string>();

    rawGroups.forEach((group, index) => {
        if (!group.syncGitTag) {
            return;
        }

        const members = published
            .filter((p) => !grouped.has(p.name) && group.packages.some((pattern) => p.name === pattern || zeptomatch(pattern, p.name)))
            .map((p) => p.name);

        if (members.length === 0) {
            return;
        }

        for (const member of members) {
            grouped.add(member);
        }

        const versions = members.map((member) => published.find((p) => p.name === member)?.version ?? "0.0.0");
        const version = pickMaxVersion(versions);
        const name = group.name ?? `group-${index}`;

        groups.push({ members, name, tag: renderGroupTag(group.tagPattern, name, version), version });
    });

    return { grouped, groups };
};
