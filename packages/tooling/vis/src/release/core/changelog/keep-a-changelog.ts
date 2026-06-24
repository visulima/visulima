/**
 * Keep-a-Changelog formatter — emits the [keepachangelog.com](https://keepachangelog.com)
 * 1.1.0 format: `### Added | Changed | Deprecated | Removed | Fixed | Security`
 * sections and an optional version-comparison link footer.
 *
 * Section bucketing rules (in order):
 *   1. A line starting with `[&lt;section>]` (case-insensitive) overrides everything
 *      and slots into that section. Recognised: Added/Changed/Deprecated/Removed/
 *      Fixed/Security. Useful for one-off entries that the heuristic misclassifies.
 *   2. Conventional-commits prefix (`feat:`, `fix:`, `deprecate:`, `remove:`,
 *      `security:`, `refactor:`, `perf:`).
 *   3. Falls back to bump-level: major → Changed (also tags as breaking),
 *      minor → Added, patch → Fixed.
 *
 * Use:
 *   release.changelog: "keep-a-changelog"
 *   release.changelog: ["keep-a-changelog", { repo: "owner/name" }]
 */

import type { ChangelogContext, ChangelogFormatter } from "./api";

export interface KeepAChangelogOptions {
    /** Override the comparison URL prefix (e.g. self-hosted GitLab). */
    compareUrlPrefix?: string;
    /** Owner/repo for `[Unreleased]` and version-comparison links (`https://github.com/&lt;repo>/compare/...`). */
    repo?: string;
}

type Section = "Added" | "Changed" | "Deprecated" | "Removed" | "Fixed" | "Security";

const SECTIONS_IN_ORDER: ReadonlyArray<Section> = ["Added", "Changed", "Deprecated", "Removed", "Fixed", "Security"];

const normalizeSection = (raw: string): Section | undefined => {
    const lower = raw.toLowerCase();

    return SECTIONS_IN_ORDER.find((s) => s.toLowerCase() === lower);
};

const PREFIX_MAP: Record<string, Section> = {
    add: "Added",
    bugfix: "Fixed",
    change: "Changed",
    changed: "Changed",
    chore: "Changed",
    deprecate: "Deprecated",
    deprecated: "Deprecated",
    feat: "Added",
    feature: "Added",
    fix: "Fixed",
    perf: "Changed",
    refactor: "Changed",
    remove: "Removed",
    removed: "Removed",
    sec: "Security",
    security: "Security",
};

const EXPLICIT_SECTION_RE = /^\s*\[(added|changed|deprecated|removed|fixed|security)\]\s*:?\s*(.*)$/i;

const stripBullet = (line: string): string => line.replace(/^[-*]\s+/, "").trim();

const sectionFromPrefix = (text: string): { rest: string; section: Section } | undefined => {
    const match = /^([a-z]+)(?:\([^)]+\))?!?\s*:\s*(.*)$/i.exec(text.trim());

    if (!match) {
        return undefined;
    }

    const key = match[1]!.toLowerCase();
    const section = PREFIX_MAP[key];

    if (!section) {
        return undefined;
    }

    return { rest: match[2]!.trim(), section };
};

const sectionFromBumpType = (bumpType: string): Section => {
    if (bumpType === "major") {
        return "Changed";
    }

    if (bumpType === "minor") {
        return "Added";
    }

    return "Fixed";
};

const isBreaking = (line: string, bumpType: string): boolean =>
    /\bBREAKING(?:\s+CHANGE)?\b/.test(line) || /^\s*[a-z]+(?:\([^)]+\))?!\s*:/i.test(line) || bumpType === "major";

const bucketEntry = (line: string, bumpType: string, buckets: Record<Section, string[]>, breaking: string[]): void => {
    const text = stripBullet(line);

    if (!text) {
        return;
    }

    const explicit = EXPLICIT_SECTION_RE.exec(text);

    if (explicit) {
        const section = normalizeSection(explicit[1]!);

        if (section) {
            buckets[section].push(`- ${explicit[2]!.trim()}`);

            return;
        }
    }

    const fromPrefix = sectionFromPrefix(text);

    if (fromPrefix) {
        if (isBreaking(text, bumpType)) {
            breaking.push(`- ${fromPrefix.rest || text}`);
        }

        buckets[fromPrefix.section].push(`- ${fromPrefix.rest || text}`);

        return;
    }

    if (isBreaking(text, bumpType)) {
        breaking.push(`- ${text}`);
    }

    buckets[sectionFromBumpType(bumpType)].push(`- ${text}`);
};

const renderCompareLink = (
    repo: string | undefined,
    compareUrlPrefix: string | undefined,
    _name: string,
    fromTag: string,
    toTag: string,
): string | undefined => {
    if (compareUrlPrefix) {
        return `${compareUrlPrefix}/compare/${fromTag}...${toTag}`;
    }

    if (!repo) {
        return undefined;
    }

    return `https://github.com/${repo}/compare/${fromTag}...${toTag}`;
};

export const createKeepAChangelogFormatter
    = (options: KeepAChangelogOptions = {}): ChangelogFormatter =>
        (context: ChangelogContext): string => {
            const { changeFiles, date, release, target } = context;

            const buckets: Record<Section, string[]> = {
                Added: [],
                Changed: [],
                Deprecated: [],
                Fixed: [],
                Removed: [],
                Security: [],
            };
            const breaking: string[] = [];
            const bumpType = release.type;

            for (const file of changeFiles) {
                for (const rawLine of file.body.trim().split(/\r?\n/)) {
                    if (!rawLine.trim()) {
                        continue;
                    }

                    bucketEntry(rawLine, bumpType, buckets, breaking);
                }
            }

            if (release.isCascadeBump || release.isGroupBump) {
                for (const source of release.sources) {
                    const verb = release.isCascadeBump ? "Cascade from" : "Group bump with";

                    buckets.Changed.push(`- ${verb} \`${source.name}\`@${source.newVersion}`);
                }
            } else if (release.isDependencyBump && changeFiles.length === 0) {
                for (const source of release.sources) {
                // F13: catalog REMOVALs surface as `newVersion === ""` (the
                // release-plan stores `entry.newVersion ?? ""` for the
                // synthetic catalog source). Route to the Removed section
                // rather than emitting a malformed trailing `@` in Changed.
                    if (source.newVersion === "") {
                        buckets.Removed.push(`- Removed dependency \`${source.name}\``);
                    } else {
                        buckets.Changed.push(`- Updated dependency \`${source.name}\`@${source.newVersion}`);
                    }
                }
            }

            const lines: string[] = [];

            if (target !== "github-release") {
                lines.push(`## [${release.newVersion}] - ${date}`);
                lines.push("");
            }

            if (breaking.length > 0) {
                lines.push("### ⚠ BREAKING CHANGES");
                lines.push("");

                for (const item of breaking) {
                    lines.push(item);
                }

                lines.push("");
            }

            for (const section of SECTIONS_IN_ORDER) {
                const items = buckets[section];

                if (items.length === 0) {
                    continue;
                }

                lines.push(`### ${section}`);
                lines.push("");

                for (const item of items) {
                    lines.push(item);
                }

                lines.push("");
            }

            // Comparison link footer (Keep-a-Changelog convention).
            if (target !== "github-release") {
                const fromTag = `${release.name}@${release.oldVersion}`;
                const toTag = `${release.name}@${release.newVersion}`;
                const link = renderCompareLink(options.repo, options.compareUrlPrefix, release.name, fromTag, toTag);

                if (link) {
                    lines.push(`[${release.newVersion}]: ${link}`);
                }
            }

            return lines
                .join("\n")
                .replaceAll(/\n{3,}/g, "\n\n")
                .trimEnd();
        };

export default createKeepAChangelogFormatter;
