/**
 * Default changelog formatter — plain Markdown, no GitHub-specific links.
 *
 * Header: `## &lt;version>\n&lt;sub>YYYY-MM-DD&lt;/sub>`.
 * Body: bulleted list of change-file bodies, with dependency-bump and
 * cascade entries synthesized when the release wasn't directly authored.
 *
 * Author credits: when the change file body contains an `author: \@user`
 * inline meta line, that author is appended as ` (@user)` to each entry
 * produced from that file. Set this on a workspace via
 * `release.changelog: ["default", { authorCredit: true }]` — defaults
 * to off so legacy changelogs don't gain unsolicited credit lines.
 *
 * `sections` opts into grouped output. It uses the shared renderer in
 * `sections.ts`, configured to this formatter's long-standing shape: entries
 * stay verbatim (no scope lifting), `-` bullets, `!`-marked headers re-typed
 * to a `breaking` pseudo-type rather than listed in a separate section, and a
 * `Miscellaneous` catch-all.
 */

import type { ChangelogContext, ChangelogFormatter } from "./api";
import { buildCompareUrl, renderReleaseHeading } from "./release-heading";
import type { ConventionalTypeRule, GroupableEntry } from "./sections";
import { renderGroupedEntries, withBullet } from "./sections";

/**
 * Section heading config — release-please parity. Each rule maps a
 * commit-conventional `type` (extracted from change-file body lines
 * like `feat: …` / `fix: …`) to a section heading. Use `hidden: true`
 * to drop entries of that type entirely (e.g. `chore:` noise).
 *
 * Default mapping (when `sections` is omitted) preserves the legacy
 * flat-list output.
 *
 * Structurally identical to — and an alias of — the `types` table the
 * `conventional` and `github` formatters take; the two option names are kept
 * apart only because `sections` shipped first.
 */
export type ChangelogSection = ConventionalTypeRule;

export interface DefaultFormatterOptions {
    /**
     * Append `(@username)` to each changelog entry produced from a
     * change file with an `author: \@user` inline-meta line. Default off.
     */
    authorCredit?: boolean;

    /** Override the URL prefix used by `{compareUrl}` (self-hosted GitLab, Gitea, …). */
    compareUrlPrefix?: string;

    /**
     * Release-heading template. Tokens: `{name}`, `{version}`, `{date}`,
     * `{compareUrl}` — the `[…]({compareUrl})` link syntax is unwrapped when
     * there is nothing to compare against (no `repo`/`compareUrlPrefix`, or a
     * first release), so the heading never degrades to `[1.0.0]()`.
     *
     * Omitted (the default) keeps the legacy two-line
     * `## &lt;version>` + `&lt;sub>&lt;date>&lt;/sub>` heading byte-for-byte.
     */
    heading?: string;

    /** `owner/name` slug used to build `{compareUrl}`. Not auto-detected — pass it explicitly. */
    repo?: string;

    /**
     * Group entries under section headings inferred from
     * conventional-commit type prefixes. When omitted, the formatter
     * emits a flat list (legacy behaviour). When `sections: []`,
     * grouping uses the release-please default mapping.
     */
    sections?: ChangelogSection[];

    /**
     * Tag template naming both ends of `{compareUrl}`. Should match the
     * workspace `releaseTagPattern`. Default `"{name}@{version}"`.
     */
    tagPattern?: string;
}

/**
 * Pseudo-type `feat!:` / `fix(scope)!:` entries are re-bucketed under, so the
 * table below can give them a section without the operator having to invent a
 * `breaking:` commit type.
 */
const BREAKING_PSEUDO_TYPE = "breaking";

/** Catch-all heading for entries no rule in `sections` claims. */
const MISCELLANEOUS_SECTION = "Miscellaneous";

/** List marker this formatter has always used. */
const BULLET = "-";

/**
 * Release-please's default mapping, used when `sections: []`. Deliberately not
 * the `conventional` formatter's table: this one shows `docs`, carries the
 * `breaking` pseudo-type, and leans on the `Miscellaneous` catch-all.
 */
const DEFAULT_SECTIONS: ChangelogSection[] = [
    { section: "Breaking Changes", type: BREAKING_PSEUDO_TYPE },
    { section: "Features", type: "feat" },
    { section: "Bug Fixes", type: "fix" },
    { section: "Performance Improvements", type: "perf" },
    { section: "Reverts", type: "revert" },
    { section: "Documentation", type: "docs" },
    { hidden: true, section: "Styles", type: "style" },
    { hidden: true, section: "Code Refactoring", type: "refactor" },
    { hidden: true, section: "Tests", type: "test" },
    { hidden: true, section: "Build System", type: "build" },
    { hidden: true, section: "Continuous Integration", type: "ci" },
    { hidden: true, section: "Miscellaneous Chores", type: "chore" },
];

const formatAuthor = (author: string): string => `(${author.startsWith("@") ? author : `@${author}`})`;

const renderFlat = (lines: string[], entries: ReadonlyArray<GroupableEntry>): void => {
    for (const entry of entries) {
        lines.push(`${withBullet(entry.line, BULLET)}${entry.suffix ?? ""}`);
    }
};

export const createDefaultFormatter
    = (options: DefaultFormatterOptions = {}): ChangelogFormatter =>
        (context: ChangelogContext): string => {
            const { changeFiles, date, release, target } = context;
            const lines: string[] = [];

            if (target !== "github-release") {
                if (options.heading === undefined) {
                    lines.push(`## ${release.newVersion}`);
                    lines.push(`<sub>${date}</sub>`);
                    lines.push("");
                } else {
                    const compareUrl = buildCompareUrl({
                        compareUrlPrefix: options.compareUrlPrefix,
                        name: release.name,
                        newVersion: release.newVersion,
                        oldVersion: release.oldVersion,
                        repo: options.repo,
                        tagPattern: options.tagPattern,
                    });

                    lines.push(renderReleaseHeading(options.heading, { compareUrl, date, name: release.name, version: release.newVersion }), "");
                }
            }

            const entries: GroupableEntry[] = [];

            for (const file of changeFiles) {
                const body = file.body.trim();

                if (!body) {
                    continue;
                }

                const author = options.authorCredit ? file.meta?.author : undefined;
                const suffix = author ? ` ${formatAuthor(author)}` : "";

                for (const rawLine of body.split(/\r?\n/)) {
                    const line = rawLine.trim();

                    if (line) {
                        entries.push({ line, suffix });
                    }
                }
            }

            const sections = options.sections === undefined ? undefined : options.sections.length === 0 ? DEFAULT_SECTIONS : options.sections;

            if (sections) {
                lines.push(
                    ...renderGroupedEntries(entries, {
                        breakingSection: false,
                        breakingType: BREAKING_PSEUDO_TYPE,
                        bullet: BULLET,
                        entryStyle: "verbatim",
                        types: sections,
                        uncategorizedSection: MISCELLANEOUS_SECTION,
                    }),
                );
            } else {
                renderFlat(lines, entries);
            }

            if (release.isCascadeBump || release.isGroupBump) {
                for (const source of release.sources) {
                    const verb = release.isCascadeBump ? "Cascade from" : "Group bump with";

                    lines.push(`- ${verb} ${source.name}@${source.newVersion}`);
                }
            } else if (release.isDependencyBump && changeFiles.length === 0) {
                for (const source of release.sources) {
                // F13: catalog REMOVALs surface as `newVersion === ""`
                // (the release-plan stores `entry.newVersion ?? ""` for
                // the synthetic catalog source). Render as a removal
                // line so we don't emit a malformed trailing `@`.
                    if (source.newVersion === "") {
                        lines.push(`- Removed dependency ${source.name}`);
                    } else {
                        lines.push(`- Updated dependency ${source.name}@${source.newVersion}`);
                    }
                }
            }

            return lines
                .join("\n")
                .replaceAll(/\n{3,}/g, "\n\n")
                .trim();
        };

export const defaultFormatter: ChangelogFormatter = createDefaultFormatter();
