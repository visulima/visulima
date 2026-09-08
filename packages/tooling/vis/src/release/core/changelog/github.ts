/**
 * GitHub changelog formatter — adds PR / commit / author links.
 *
 * Resolution priority (matches bumpy):
 *   1. Inline meta in body header (`pr: 42`, `commit: abc1234`, `author: \@user`)
 *   2. `git log` for the commit that first added the change file
 *   3. (future) PR-search via the active RemoteReleaseClient
 *
 * Repo slug auto-detected via the active provider's `detectRepoSlug` when
 * not passed in options. Falls back to plain text when no provider is
 * available. The link *shapes* follow that detected provider rather than this
 * formatter's name, so pointing it at a GitLab remote emits
 * `/-/merge_requests/…` instead of a github.com URL addressing a different
 * repository.
 *
 * Honours `internalAuthors: string[]` to suppress "Thanks \@user!" lines for
 * team members (RFC §22 still-open question — defaults to empty list).
 *
 * Uses an injectable runner via `createShellRunner()` by default so the
 * formatter is provider-agnostic and testable.
 *
 * Opt-in conventional-commit rendering (both default to off, so existing
 * changelogs keep their exact shape):
 *   - `types: [...]`  — group entries by commit type under section
 *                       headings, bolding the lifted scope.
 *   - `heading: "..."`— template the release heading (`{name}`,
 *                       `{version}`, `{date}`, `{compareUrl}`).
 */

import type { CommandRunner } from "../package-managers/interface";
import type { RemoteWebUrls } from "../remote/web-urls";
import { remoteWebUrls } from "../remote/web-urls";
import { createShellRunner } from "../shell-runner";
import type { ChangelogContext, ChangelogFormatter } from "./api";
import { buildCompareUrl, renderReleaseHeading } from "./release-heading";
import type { DetectedRepo } from "./repo-slug";
import { detectRepo, linkifyHashRefs } from "./repo-slug";
import type { ConventionalTypeRule, GroupableEntry } from "./sections";
import { DEFAULT_CONVENTIONAL_TYPES, renderGroupedEntries, withBullet } from "./sections";
import { sourceBumpEntries } from "./source-bumps";

export interface GithubFormatterOptions {
    /**
     * Heading for breaking changes when `types` grouping is on. `false`
     * folds them into their type section. Default `"⚠ BREAKING CHANGES"`.
     * Ignored unless `types` is set.
     */
    breakingSection?: false | string;

    /**
     * Release-heading template. Tokens: `{name}`, `{version}`, `{date}`,
     * `{compareUrl}` — `[…]({compareUrl})` is unwrapped when there is no
     * compare URL (no remote, or a first release).
     *
     * Omitted (the default) keeps the legacy two-line
     * `## &lt;version>` + `&lt;sub>&lt;date>&lt;/sub>` heading byte-for-byte.
     */
    heading?: string;

    includeCommitLink?: boolean;
    internalAuthors?: ReadonlyArray<string>;
    repo?: string;
    /** Override the runner — used by tests. */
    runner?: CommandRunner;

    /**
     * Tag template naming both ends of `{compareUrl}`. Should match the
     * workspace `releaseTagPattern`. Default `"{name}@{version}"`.
     */
    tagPattern?: string;

    thankContributors?: boolean;

    /**
     * Group entries by conventional-commit type under these section
     * headings (`presetConfig.types` shape), lifting the scope out as a
     * bolded `**scope:**` prefix. Pass `[]` to use
     * {@link DEFAULT_CONVENTIONAL_TYPES}.
     *
     * Omitted (the default) keeps the legacy flat bullet list.
     */
    types?: ReadonlyArray<ConventionalTypeRule>;
}

const DEFAULT_OPTIONS: Required<
    Omit<GithubFormatterOptions, "breakingSection" | "heading" | "internalAuthors" | "repo" | "runner" | "tagPattern" | "types">
> & {
    internalAuthors: ReadonlyArray<string>;
} = {
    includeCommitLink: true,
    internalAuthors: [],
    thankContributors: true,
};

const resolveAuthorFromGit = async (runner: CommandRunner, cwd: string, changeFilePath: string): Promise<string | undefined> => {
    const result = await runner.run("git", ["log", "--diff-filter=A", "--pretty=format:%aN%n%aE", "--", changeFilePath], { cwd, silent: true });

    if (result.exitCode !== 0) {
        return undefined;
    }

    const lines = result.stdout.split("\n");

    return lines[0]?.trim() || undefined;
};

export const createGithubFormatter = (options: GithubFormatterOptions = {}): ChangelogFormatter => {
    const cfg = { ...DEFAULT_OPTIONS, ...options };
    const runner = options.runner ?? createShellRunner();
    let repoCachePromise: Promise<DetectedRepo> | undefined;

    const formatter: ChangelogFormatter = async (context: ChangelogContext): Promise<string> => {
        const { changeFiles, date, release, target } = context;
        const lines: string[] = [];
        const entries: GroupableEntry[] = [];
        const authors = new Set<string>();
        const cwd = process.cwd();

        if (!repoCachePromise) {
            repoCachePromise = detectRepo(options.repo, runner, cwd);
        }

        const repoCache = await repoCachePromise;
        // PR / commit links follow the detected forge, not this formatter's
        // name: a slug read off a GitLab remote must not be pasted into a
        // github.com URL, where it addresses somebody else's repository.
        const urls: RemoteWebUrls | undefined = repoCache.slug === undefined ? undefined : remoteWebUrls(repoCache.provider, repoCache.slug);

        if (target !== "github-release") {
            if (options.heading === undefined) {
                lines.push(`## ${release.newVersion}`);
                lines.push(`<sub>${date}</sub>`);
                lines.push("");
            } else {
                const compareUrl = buildCompareUrl({
                    name: release.name,
                    newVersion: release.newVersion,
                    oldVersion: release.oldVersion,
                    provider: repoCache.provider,
                    repo: repoCache.slug,
                    tagPattern: options.tagPattern,
                });

                lines.push(renderReleaseHeading(options.heading, { compareUrl, date, name: release.name, version: release.newVersion }), "");
            }
        }

        for (const file of changeFiles) {
            const body = file.body.trim();
            const meta = file.meta ?? {};

            // Resolve author: inline meta wins, else git log
            const author = meta.author ?? (await resolveAuthorFromGit(runner, cwd, file.path));

            if (author && cfg.thankContributors && !cfg.internalAuthors.includes(author.replace(/^@/, ""))) {
                authors.add(author.startsWith("@") ? author : `@${author}`);
            }

            const refs: string[] = [];

            if (meta.pr && urls) {
                refs.push(`[#${meta.pr}](${urls.pullRequest(String(meta.pr))})`);
            } else if (meta.pr) {
                refs.push(`#${meta.pr}`);
            }

            if (meta.commit && cfg.includeCommitLink && urls) {
                const short = meta.commit.slice(0, 7);

                refs.push(`[\`${short}\`](${urls.commit(meta.commit)})`);
            }

            const refSuffix = refs.length > 0 ? ` (${refs.join(", ")})` : "";

            if (body) {
                for (const rawLine of body.split(/\r?\n/)) {
                    const line = rawLine.trim();

                    if (!line) {
                        continue;
                    }

                    entries.push({ line: linkifyHashRefs(line, repoCache), suffix: refSuffix });
                }
            }
        }

        if (options.types === undefined) {
            for (const entry of entries) {
                lines.push(`${withBullet(entry.line, "-")}${entry.suffix ?? ""}`);
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
        } else {
            entries.push(...sourceBumpEntries(context));

            lines.push(
                ...renderGroupedEntries(entries, {
                    breakingSection: options.breakingSection,
                    types: options.types.length === 0 ? DEFAULT_CONVENTIONAL_TYPES : options.types,
                }),
            );
        }

        if (cfg.thankContributors && authors.size > 0) {
            lines.push("");
            lines.push(`Thanks ${[...authors].join(", ")}!`);
        }

        const output = lines.join("\n");

        // Legacy flat mode is byte-identical to what it always emitted;
        // grouped mode ends on a section separator that needs collapsing.
        return options.types === undefined ? output : output.replaceAll(/\n{3,}/g, "\n\n").trimEnd();
    };

    return formatter;
};
