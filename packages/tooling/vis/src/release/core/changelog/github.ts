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
 * available.
 *
 * Honours `internalAuthors: string[]` to suppress "Thanks \@user!" lines for
 * team members (RFC §22 still-open question — defaults to empty list).
 *
 * Uses an injectable runner via `createShellRunner()` by default so the
 * formatter is provider-agnostic and testable.
 */

import type { CommandRunner } from "../package-managers/interface";
import { createShellRunner } from "../shell-runner";
import type { ChangelogContext, ChangelogFormatter } from "./api";

export interface GithubFormatterOptions {
    includeCommitLink?: boolean;
    internalAuthors?: ReadonlyArray<string>;
    repo?: string;
    /** Override the runner — used by tests. */
    runner?: CommandRunner;
    thankContributors?: boolean;
}

const DEFAULT_OPTIONS: Required<Omit<GithubFormatterOptions, "repo" | "internalAuthors" | "runner">> & { internalAuthors: ReadonlyArray<string> } = {
    includeCommitLink: true,
    internalAuthors: [],
    thankContributors: true,
};

/**
 * Try to find the repo slug (owner/name) — used for inline links.
 * Order: option → active provider's `detectRepoSlug` → undefined.
 */
const detectRepoSlugSync = async (option: string | undefined, runner: CommandRunner, cwd: string): Promise<string | undefined> => {
    if (option) {
        return option;
    }

    const { createRemoteClient, detectRemoteProvider } = await import("../remote/detect");
    const provider = await detectRemoteProvider(cwd, runner, undefined);
    const client = createRemoteClient(provider);

    return client.detectRepoSlug(cwd, runner);
};

const resolveAuthorFromGit = async (runner: CommandRunner, cwd: string, changeFilePath: string): Promise<string | undefined> => {
    const result = await runner.run("git", ["log", "--diff-filter=A", "--pretty=format:%aN%n%aE", "--", changeFilePath], { cwd, silent: true });

    if (result.exitCode !== 0) {
        return undefined;
    }

    const lines = result.stdout.split("\n");

    return lines[0]?.trim() || undefined;
};

const linkifyHashRefs = (text: string, repo: string | undefined): string => {
    if (!repo) {
        return text;
    }

    return text.replaceAll(/(?<!\[)#(\d+)/g, (_match, num: string) => `[#${num}](https://github.com/${repo}/issues/${num})`);
};

export const createGithubFormatter = (options: GithubFormatterOptions = {}): ChangelogFormatter => {
    const cfg = { ...DEFAULT_OPTIONS, ...options };
    const runner = options.runner ?? createShellRunner();
    let repoCachePromise: Promise<string | undefined> | undefined;

    const formatter: ChangelogFormatter = async (context: ChangelogContext): Promise<string> => {
        const { changeFiles, date, release, target } = context;
        const lines: string[] = [];
        const authors = new Set<string>();
        const cwd = process.cwd();

        if (!repoCachePromise) {
            repoCachePromise = detectRepoSlugSync(options.repo, runner, cwd);
        }

        const repoCache = await repoCachePromise;

        if (target !== "github-release") {
            lines.push(`## ${release.newVersion}`);
            lines.push(`<sub>${date}</sub>`);
            lines.push("");
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

            if (meta.pr && repoCache) {
                refs.push(`[#${meta.pr}](https://github.com/${repoCache}/pull/${meta.pr})`);
            } else if (meta.pr) {
                refs.push(`#${meta.pr}`);
            }

            if (meta.commit && cfg.includeCommitLink && repoCache) {
                const short = meta.commit.slice(0, 7);

                refs.push(`[\`${short}\`](https://github.com/${repoCache}/commit/${meta.commit})`);
            }

            const refSuffix = refs.length > 0 ? ` (${refs.join(", ")})` : "";

            if (body) {
                for (const rawLine of body.split(/\r?\n/)) {
                    const line = rawLine.trim();

                    if (!line) {
                        continue;
                    }

                    const linkified = linkifyHashRefs(line, repoCache);

                    if (line.startsWith("-") || line.startsWith("*")) {
                        lines.push(`${linkified}${refSuffix}`);
                    } else {
                        lines.push(`- ${linkified}${refSuffix}`);
                    }
                }
            }
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

        if (cfg.thankContributors && authors.size > 0) {
            lines.push("");
            lines.push(`Thanks ${[...authors].join(", ")}!`);
        }

        return lines.join("\n");
    };

    return formatter;
};

export default createGithubFormatter;
