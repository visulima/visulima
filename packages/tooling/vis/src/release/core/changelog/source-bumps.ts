/**
 * Dependency / cascade / group bumps, expressed as changelog entries.
 *
 * A release can be planned with no change file of its own — it moved only
 * because something it depends on moved. The grouped formatters render those
 * releases by synthesizing `deps(&lt;pkg>): …` lines, so they flow through the
 * same parse + scope-lifting path as authored entries and land under
 * `### Dependencies` as `* **@scope/pkg:** upgraded to 1.2.3` — the shape
 * `multi-semantic-release` already writes into these files.
 *
 * The flat formatters spell the same facts out in prose
 * (`- Updated dependency \@scope/pkg@1.2.3`) and don't use this.
 */

import type { ChangelogContext } from "./api";
import type { GroupableEntry } from "./sections";

export const sourceBumpEntries = (context: ChangelogContext): GroupableEntry[] => {
    const { changeFiles, release } = context;

    if (release.isCascadeBump || release.isGroupBump) {
        const verb = release.isCascadeBump ? "cascade bump to" : "group bump to";

        return release.sources.map((source) => {
            return { line: `deps(${source.name}): ${verb} ${source.newVersion}` };
        });
    }

    if (release.isDependencyBump && changeFiles.length === 0) {
        return release.sources.map((source) => {
            // F13: catalog REMOVALs surface as `newVersion === ""` (the
            // release-plan stores `entry.newVersion ?? ""` for the synthetic
            // catalog source). Render a removal line rather than a malformed
            // trailing `@`.
            return { line: source.newVersion === "" ? `deps(${source.name}): removed` : `deps(${source.name}): upgraded to ${source.newVersion}` };
        });
    }

    return [];
};
