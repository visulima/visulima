import { bold, cyan, dim, green, red, yellow } from "@visulima/colorize";

import type { EcosystemCheckResult } from "./index";
import type { EcosystemId, EcosystemUpdate, EcosystemUpdateType } from "./types";

const ECOSYSTEM_LABEL: Record<EcosystemId, string> = {
    actions: "GitHub Actions",
    docker: "Docker",
    gitlab: "GitLab CI",
};

/**
 * True when the update crosses a major boundary. Used to decide whether
 * to surface it in the breaking-changes callout and to gate the [s]afe
 * choice in the interactive picker.
 */
export const isBreakingUpdate = (update: EcosystemUpdate): boolean => update.updateType === "major";

const colorForUpdateType = (type: EcosystemUpdateType): ((text: string) => string) => {
    switch (type) {
        case "major": {
            return red;
        }
        case "minor": {
            return yellow;
        }
        case "patch": {
            return green;
        }
        default: {
            return cyan;
        }
    }
};

const formatUpdateLine = (update: EcosystemUpdate): string => {
    const colorize = colorForUpdateType(update.updateType);
    const fromLabel = update.currentVersion ?? update.currentRef;
    const toLabel = update.newVersion ?? update.newRef;

    return `    ${colorize(update.updateType.padEnd(7))}  ${update.name}  ${dim(fromLabel)} → ${toLabel}`;
};

/**
 * Formats the ecosystem-update result as a human-readable table that
 * matches the catalog reporter's tone. Used by `vis update`'s non-TUI
 * paths (CI, --format=table on a non-TTY, etc.).
 */
export const formatEcosystemReport = (result: EcosystemCheckResult, options: { showIgnored: boolean }): string => {
    const lines: string[] = [];
    const totalUpdates = result.updates.length;

    if (totalUpdates === 0 && result.scanned === 0) {
        return "";
    }

    if (totalUpdates === 0) {
        lines.push(`${green("✓")} All ecosystem references up to date.`);

        return lines.join("\n");
    }

    lines.push(`\n${cyan("Ecosystem updates")} — ${String(totalUpdates)} reference${totalUpdates === 1 ? "" : "s"} can be bumped:`);

    const breaking = result.updates.filter((update) => isBreakingUpdate(update));

    if (breaking.length > 0) {
        // Surface major bumps up-front so they don't get lost between
        // minor/patch entries. They still appear inside the per-ecosystem
        // section below — this is a callout, not a relocation.
        lines.push(`\n  ${red(bold(`⚠ Breaking changes (${String(breaking.length)})`))}`);
        lines.push(`  ${dim("Review release notes before applying — these cross a major-version boundary.")}`);

        for (const update of breaking) {
            lines.push(formatUpdateLine(update));
        }
    }

    for (const ecosystem of Object.keys(result.perEcosystem) as EcosystemId[]) {
        const bucket = result.perEcosystem[ecosystem];

        if (bucket.updates.length === 0) {
            continue;
        }

        lines.push(`\n  ${ECOSYSTEM_LABEL[ecosystem]} (${String(bucket.updates.length)})`);

        for (const update of bucket.updates) {
            lines.push(formatUpdateLine(update));
        }
    }

    if (options.showIgnored && result.ignored.length > 0) {
        lines.push(`\n  ${dim("Ignored:")}`);

        for (const update of result.ignored) {
            lines.push(`    ${dim(update.name)}  ${dim(update.reason ?? "")}`);
        }
    }

    if (result.failed.length > 0) {
        lines.push(`\n  ${yellow("Failed lookups:")}`);

        for (const failure of result.failed) {
            lines.push(`    ${failure.file}: ${failure.reason}`);
        }
    }

    return lines.join("\n");
};

/**
 * JSON serialiser used by `--format=json`. Mirrors the catalog reporter
 * shape (`{ outdated, failed, ignored }`) so downstream consumers can
 * key off `ecosystem` to know which side of the payload they're on.
 */
export const formatEcosystemJson = (result: EcosystemCheckResult): string => JSON.stringify(
    {
        ecosystems: {
            failed: result.failed,
            ignored: result.ignored,
            perEcosystem: result.perEcosystem,
            scanned: result.scanned,
            updates: result.updates,
        },
    },
    undefined,
    2,
);
