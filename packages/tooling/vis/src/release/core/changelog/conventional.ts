/**
 * Conventional-commit changelog formatter — the shape
 * `conventional-changelog` / `semantic-release` produce, so a package
 * migrating off `multi-semantic-release` keeps writing into the same
 * CHANGELOG.md without the heading and section style visibly changing hands.
 *
 * Three differences from the `default` formatter:
 *
 *   1. Entries are grouped by conventional-commit type under configurable
 *      section headings (`presetConfig.types` parity — see
 *      {@link DEFAULT_CONVENTIONAL_TYPES}).
 *   2. The scope is lifted out and bolded: `fix(client,react): encode …`
 *      renders as `* **client,react:** encode …`.
 *   3. The release heading is a template (`{name}`, `{version}`, `{date}`,
 *      `{compareUrl}`), defaulting to the semantic-release-monorepo shape
 *      `## &lt;pkg> [&lt;version>](&lt;compare-url>) (&lt;date>)`.
 *
 * Use:
 *   release.changelog: "conventional"
 *   release.changelog: ["conventional", { repo: "owner/name", types: [...] }]
 */

import type { CommandRunner } from "../package-managers/interface";
import { createShellRunner } from "../shell-runner";
import type { ChangelogContext, ChangelogFormatter } from "./api";
import { buildCompareUrl, renderReleaseHeading } from "./release-heading";
import type { DetectedRepo } from "./repo-slug";
import { detectRepo, linkifyHashRefs } from "./repo-slug";
import type { ConventionalTypeRule, GroupableEntry } from "./sections";
import { DEFAULT_CONVENTIONAL_TYPES, renderGroupedEntries } from "./sections";
import { sourceBumpEntries } from "./source-bumps";

export interface ConventionalFormatterOptions {
    /**
     * Heading for breaking changes, rendered above every type section.
     * `false` folds them into their type section instead.
     * Default: `"⚠ BREAKING CHANGES"`.
     */
    breakingSection?: false | string;

    /** List marker. Default `"*"` — what conventional-changelog emits. */
    bullet?: string;

    /**
     * Base URL for `{compareUrl}` (self-hosted GitLab / Gitea). Wins over
     * `repo`. The formatter appends `/compare/&lt;fromTag>...&lt;toTag>`.
     */
    compareUrlPrefix?: string;

    /**
     * Release-heading template. Tokens: `{name}`, `{version}`, `{date}`,
     * `{compareUrl}`. `[...]({compareUrl})` link syntax is unwrapped when
     * there is no compare URL (no remote, or a first release), so the
     * heading never degrades into a dangling `[1.0.0]()`.
     *
     * Default: `"## {name} [{version}]({compareUrl}) ({date})"`.
     */
    heading?: string;

    /**
     * `owner/name` slug for `{compareUrl}` and `#123` issue links.
     * Auto-detected from the active remote provider when omitted; when
     * detection fails the links are simply not emitted. The provider itself
     * is always detected, so a GitLab remote gets GitLab link shapes.
     */
    repo?: string;

    /** Override the runner — used by tests. */
    runner?: CommandRunner;

    /**
     * Tag template naming both ends of `{compareUrl}`. Should match the
     * workspace `releaseTagPattern`. Default `"{name}@{version}"`.
     */
    tagPattern?: string;

    /**
     * Ordered `type → section` table, `presetConfig.types` shaped.
     * Default: {@link DEFAULT_CONVENTIONAL_TYPES}.
     */
    types?: ReadonlyArray<ConventionalTypeRule>;
}

export const DEFAULT_CONVENTIONAL_HEADING = "## {name} [{version}]({compareUrl}) ({date})";

export const createConventionalFormatter = (options: ConventionalFormatterOptions = {}): ChangelogFormatter => {
    const runner = options.runner ?? createShellRunner();
    const heading = options.heading ?? DEFAULT_CONVENTIONAL_HEADING;
    const types = options.types ?? DEFAULT_CONVENTIONAL_TYPES;
    let repoCachePromise: Promise<DetectedRepo> | undefined;

    const formatter: ChangelogFormatter = async (context: ChangelogContext): Promise<string> => {
        const { changeFiles, date, release, target } = context;

        // Detected once per formatter instance — the slug feeds both
        // `{compareUrl}` and the `#123` issue links.
        repoCachePromise ??= detectRepo(options.repo, runner, process.cwd());

        const repo = await repoCachePromise;

        const entries: GroupableEntry[] = [];

        for (const file of changeFiles) {
            const body = file.body.trim();

            if (!body) {
                continue;
            }

            for (const rawLine of body.split(/\r?\n/)) {
                const line = rawLine.trim();

                if (line) {
                    entries.push({ line: linkifyHashRefs(line, repo) });
                }
            }
        }

        entries.push(...sourceBumpEntries(context));

        const lines: string[] = [];

        if (target !== "github-release") {
            const compareUrl = buildCompareUrl({
                compareUrlPrefix: options.compareUrlPrefix,
                name: release.name,
                newVersion: release.newVersion,
                oldVersion: release.oldVersion,
                provider: repo.provider,
                repo: repo.slug,
                tagPattern: options.tagPattern,
            });

            lines.push(renderReleaseHeading(heading, { compareUrl, date, name: release.name, version: release.newVersion }), "");
        }

        lines.push(...renderGroupedEntries(entries, { breakingSection: options.breakingSection, bullet: options.bullet, types }));

        return lines
            .join("\n")
            .replaceAll(/\n{3,}/g, "\n\n")
            .trim();
    };

    return formatter;
};
