import type { DependabotIgnoreRules } from "../dependabot";
import { isIgnored } from "../dependabot";
import { checkDocker } from "../docker/index";
import type { DockerRegistryOptions } from "../docker/registry";
import type { ImageReference } from "../docker/scanner";
import { classifyUpdate, parseTag, pickBestTag } from "../semver-helpers";
import type { EcosystemUpdate, EcosystemUpdateOptions } from "../types";
import type { GitlabResolverOptions } from "./resolver";
import { GitlabResolver } from "./resolver";
import type { GitLabInclude } from "./scanner";
import { scanGitlabRepository } from "./scanner";

interface CheckGitlabContext {
    readonly includes: GitLabInclude[];
    readonly imageReferences: ImageReference[];
    readonly options: EcosystemUpdateOptions;
    readonly resolverOptions?: Partial<GitlabResolverOptions>;
    readonly registryOptions?: DockerRegistryOptions;
    readonly ignoreRules?: DependabotIgnoreRules;
}

interface CheckGitlabResult {
    readonly updates: EcosystemUpdate[];
    readonly failed: { file: string; reason: string }[];
    readonly ignored: EcosystemUpdate[];
}

const matchesPattern = (name: string, patterns: string[]): boolean => {
    for (const raw of patterns) {
        try {
            if (new RegExp(raw).test(name)) {
                return true;
            }
        } catch {
            if (name.includes(raw)) {
                return true;
            }
        }
    }

    return false;
};

/**
 * Best-effort GitLab release URL for a project include / component. When
 * the project slug embeds a self-hosted host (`gitlab.example.com/group/project`)
 * we route the URL there; otherwise we point at gitlab.com. The releases
 * page is the closest analog to a changelog for tagged refs.
 */
const buildReleaseUrl = (project: string, ref: string, defaultHost: string): string => {
    const firstSlash = project.indexOf("/");

    if (firstSlash > 0 && project.slice(0, firstSlash).includes(".")) {
        return `https://${project.slice(0, firstSlash)}/${project.slice(firstSlash + 1)}/-/releases/${ref}`;
    }

    return `${defaultHost}/${project}/-/releases/${ref}`;
};

export const checkGitlab = async (workspaceRoot: string, context: CheckGitlabContext): Promise<CheckGitlabResult> => {
    const { ignoreRules, imageReferences, includes, options, registryOptions, resolverOptions } = context;
    const updates: EcosystemUpdate[] = [];
    const ignoredList: EcosystemUpdate[] = [];
    const failed: { file: string; reason: string }[] = [];

    // GitLab CI image/services entries use the same Docker registry
    // resolution, so we delegate. Their `ecosystem` is rewritten to
    // `gitlab` so the report groups them under one heading.
    if (imageReferences.length > 0) {
        const dockerResult = await checkDocker(workspaceRoot, {
            ignoreRules,
            options,
            references: imageReferences,
            registryOptions,
        });

        // checkDocker labels updates with `ecosystem: "docker"` and a
        // docker.io / GHCR registry URL. When re-attributing to gitlab we
        // keep the URL — for `image:` / `services:` entries the registry
        // tag page is still the right link to click for release notes.
        for (const update of dockerResult.updates) {
            updates.push({ ...update, ecosystem: "gitlab" });
        }

        for (const update of dockerResult.ignored) {
            ignoredList.push({ ...update, ecosystem: "gitlab" });
        }

        failed.push(...dockerResult.failed);
    }

    if (includes.length === 0) {
        return { failed, ignored: ignoredList, updates };
    }

    const resolver = new GitlabResolver({
        apiBase: resolverOptions?.apiBase,
        fetch: resolverOptions?.fetch,
        token: options.gitlabToken ?? resolverOptions?.token,
    });

    const defaultHost = resolverOptions?.apiBase ?? "https://gitlab.com";

    // Group by project path so identical includes share a single API call.
    const grouped = new Map<string, GitLabInclude[]>();

    for (const include of includes) {
        const bucket = grouped.get(include.project) ?? [];

        bucket.push(include);
        grouped.set(include.project, bucket);
    }

    const concurrency = Math.max(1, options.maxConcurrentRequests);
    const groupKeys = [...grouped.keys()];
    let cursor = 0;

    const processGroup = async (project: string): Promise<void> => {
        const groupIncludes = grouped.get(project) ?? [];

        let listing;

        try {
            listing = await resolver.listTags(project);
        } catch {
            for (const include of groupIncludes) {
                failed.push({ file: include.file, reason: `failed to list tags for ${project}` });
            }

            return;
        }

        for (const include of groupIncludes) {
            const fullName = include.project;
            let ignoreReason: string | undefined;

            if (include.ignoreReason) {
                ignoreReason = include.ignoreReason;
            } else if (matchesPattern(fullName, options.exclude)) {
                ignoreReason = "matched --exclude";
            } else if (options.include.length > 0 && !matchesPattern(fullName, options.include)) {
                ignoreReason = "not matched by --include";
            } else if (options.respectDependabotConfig && ignoreRules && isIgnored(fullName, "gitlab", ignoreRules)) {
                ignoreReason = "ignored by dependabot/renovate config";
            }

            const buildIgnored = (reason: string): EcosystemUpdate => ({
                currentRef: include.ref,
                currentVersion: include.ref,
                ecosystem: "gitlab",
                file: include.file,
                ignored: true,
                line: include.line,
                name: fullName,
                newRef: include.ref,
                newVersion: undefined,
                original: include.original,
                reason,
                replacement: include.original,
                updateType: "unknown",
            });

            if (ignoreReason) {
                ignoredList.push(buildIgnored(ignoreReason));
                continue;
            }

            const currentParsed = parseTag(include.ref);

            if (!currentParsed && !options.includeBranches) {
                ignoredList.push(buildIgnored("branch reference (use --include-branches)"));
                continue;
            }

            const best = pickBestTag(listing.parsed, currentParsed, options.mode, false);

            if (!best) {
                continue;
            }

            const newRef = include.kind === "component" ? `${include.project}@${best.raw}` : best.raw;

            updates.push({
                currentRef: include.ref,
                currentVersion: currentParsed?.raw ?? include.ref,
                ecosystem: "gitlab",
                file: include.file,
                line: include.line,
                name: fullName,
                newRef: best.raw,
                newVersion: best.raw,
                original: include.original,
                replacement: newRef,
                updateType: classifyUpdate(currentParsed, best),
                url: buildReleaseUrl(include.project, best.raw, defaultHost),
            });
        }
    };

    const workers: Promise<void>[] = [];

    for (let index = 0; index < Math.min(concurrency, groupKeys.length); index++) {
        workers.push(
            (async () => {
                while (cursor < groupKeys.length) {
                    const next = groupKeys[cursor];

                    cursor += 1;

                    if (next !== undefined) {
                        await processGroup(next);
                    }
                }
            })(),
        );
    }

    await Promise.all(workers);

    return { failed, ignored: ignoredList, updates };
};

export { scanGitlabRepository };
