import type { DependabotIgnoreRules } from "../dependabot";
import { isIgnored } from "../dependabot";
import { classifyUpdate, parseTag, pickBestTag } from "../semver-helpers";
import type { EcosystemUpdate, EcosystemUpdateOptions } from "../types";
import { decorateActionsAdvisories } from "./advisories";
import type { ActionsResolverOptions } from "./resolver";
import { ActionsResolver } from "./resolver";
import type { UsesReference } from "./scanner";

const SHA_LENGTH = 40;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const BRANCH_TOKENS = new Set(["develop", "edge", "main", "master", "stable", "trunk"]);

const looksLikeBranch = (ref: string): boolean => {
    if (ref.length === SHA_LENGTH && /^[a-f0-9]{40}$/i.test(ref)) {
        return false;
    }

    if (BRANCH_TOKENS.has(ref.toLowerCase())) {
        return true;
    }

    // A ref that fails both semver parsing and SHA detection is treated
    // as a branch by default. `parseTag` accepts `v3` / `v3.1` so tags
    // like that won't trip this.
    return parseTag(ref) === undefined;
};

interface CheckActionsContext {
    readonly ignoreRules?: DependabotIgnoreRules;
    readonly options: EcosystemUpdateOptions;
    readonly references: UsesReference[];
    readonly resolverOptions?: Partial<ActionsResolverOptions>;
}

interface CheckActionsResult {
    readonly failed: { file: string; reason: string }[];
    readonly ignored: EcosystemUpdate[];
    readonly updates: EcosystemUpdate[];
}

const matchesPattern = (name: string, patterns: string[]): boolean => {
    for (const raw of patterns) {
        try {
            // Patterns may be plain substrings, regex, or globs. We treat
            // them as regex first (with try/catch) and fall back to
            // substring on parse error.
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
 * Builds the full token (slug + ref + optional version comment) that
 * replaces the original `uses:` value. SHA pinning appends a version
 * hint comment so the bumped line stays readable.
 *
 * When the user wrote the value quoted (`uses: 'actions/checkout@v3'`),
 * the version-hint comment is appended **outside** the closing quote so
 * YAML doesn't try to parse `# vN.M.P` as part of the action reference.
 */
const buildReplacement = (reference: UsesReference, newSha: string, newTag: string, style: "preserve" | "sha"): string => {
    const pinToSha = style === "sha" || reference.isSha;
    const { quote } = reference;

    if (pinToSha) {
        return `${quote}${reference.slug}@${newSha}${quote} # ${newTag}`;
    }

    return `${quote}${reference.slug}@${newTag}${quote}`;
};

/**
 * Runs the actions ecosystem against a workspace: scans the workflows /
 * composite actions, dedupes references, resolves each unique
 * `owner/repo@ref` via the GitHub API, and returns a list of updates.
 *
 * The returned updates are not applied — `applyEcosystemUpdates` does
 * that in a separate pass so dry-run / interactive modes can preview.
 */
export const checkActions = async (workspaceRoot: string, context: CheckActionsContext): Promise<CheckActionsResult> => {
    const { ignoreRules, options, references, resolverOptions } = context;
    const updates: EcosystemUpdate[] = [];
    const ignoredList: EcosystemUpdate[] = [];
    const failed: { file: string; reason: string }[] = [];

    if (references.length === 0) {
        return { failed, ignored: ignoredList, updates };
    }

    const resolver = new ActionsResolver({
        apiBase: resolverOptions?.apiBase,
        fetch: resolverOptions?.fetch,
        token: options.githubToken ?? resolverOptions?.token,
    });

    // Group references by `owner/repo` so the resolver fan-out is keyed
    // by repo, not by occurrence.
    const grouped = new Map<string, UsesReference[]>();

    for (const reference of references) {
        const key = `${reference.owner}/${reference.repo}`;
        const bucket = grouped.get(key) ?? [];

        bucket.push(reference);
        grouped.set(key, bucket);
    }

    const concurrency = Math.max(1, options.maxConcurrentRequests);
    const groupKeys = [...grouped.keys()];
    let cursor = 0;

    const processGroup = async (key: string): Promise<void> => {
        const groupReferences = grouped.get(key) ?? [];
        const [owner, repo] = key.split("/");

        if (!owner || !repo) {
            return;
        }

        let tagsResult;

        try {
            tagsResult = await resolver.listTags(owner, repo);
        } catch {
            for (const reference of groupReferences) {
                failed.push({ file: reference.file, reason: `failed to list tags for ${key}` });
            }

            return;
        }

        for (const reference of groupReferences) {
            // `slug` already contains the subpath when present
            // (e.g. `actions/cache/restore`); subpath is just the trailing
            // segment used by other consumers.
            const fullName = reference.slug;

            // Per-reference ignore precedence:
            //   1. inline / next-line comment (set on the reference itself)
            //   2. --exclude pattern
            //   3. --include pattern (when set, miss == ignored)
            //   4. dependabot/renovate ignoreDeps
            let ignoreReason: string | undefined;

            if (reference.ignoreReason) {
                ignoreReason = reference.ignoreReason;
            } else if (matchesPattern(fullName, options.exclude)) {
                ignoreReason = "matched --exclude";
            } else if (options.include.length > 0 && !matchesPattern(fullName, options.include)) {
                ignoreReason = "not matched by --include";
            } else if (options.respectDependabotConfig && ignoreRules && isIgnored(fullName, "actions", ignoreRules)) {
                ignoreReason = "ignored by dependabot/renovate config";
            }

            if (ignoreReason) {
                ignoredList.push({
                    currentRef: reference.ref,
                    currentVersion: reference.isSha ? reference.trailingComment?.replace(/^#\s*/, "") : reference.ref,
                    ecosystem: "actions",
                    file: reference.file,
                    ignored: true,
                    line: reference.line,
                    name: fullName,
                    newRef: reference.ref,
                    newVersion: undefined,
                    original: reference.original,
                    reason: ignoreReason,
                    replacement: reference.original,
                    updateType: "unknown",
                });

                continue;
            }

            // Skip branch refs unless --include-branches.
            if (!options.includeBranches && !reference.isSha && looksLikeBranch(reference.ref)) {
                ignoredList.push({
                    currentRef: reference.ref,
                    currentVersion: reference.ref,
                    ecosystem: "actions",
                    file: reference.file,
                    ignored: true,
                    line: reference.line,
                    name: fullName,
                    newRef: reference.ref,
                    newVersion: undefined,
                    original: reference.original,
                    reason: "branch reference (use --include-branches)",
                    replacement: reference.original,
                    updateType: "unknown",
                });

                continue;
            }

            // For SHA references, fall back to the trailing version-hint
            // comment when present (`actions/checkout@<sha> # v3.5.3`).
            const currentTagSource = reference.isSha ? (reference.trailingComment?.replace(/^#\s*/, "").split(/\s+/)[0] ?? "") : reference.ref;
            const currentParsed = parseTag(currentTagSource);

            // A SHA pin without a parseable version hint can't be
            // constrained by mode=minor/patch — `pickBestTag` returns
            // undefined in that case (so an unconstrained --target=patch
            // run can't silently major-bump it). Surface it as an
            // ignored entry with a clear reason so the user knows why
            // the pin was left alone.
            if (reference.isSha && !currentParsed && options.mode !== "latest") {
                ignoredList.push({
                    currentRef: reference.ref,
                    currentVersion: undefined,
                    ecosystem: "actions",
                    file: reference.file,
                    ignored: true,
                    line: reference.line,
                    name: fullName,
                    newRef: reference.ref,
                    newVersion: undefined,
                    original: reference.original,
                    reason: `SHA pin has no version-hint comment; cannot apply --target=${options.mode}`,
                    replacement: reference.original,
                    updateType: "unknown",
                });

                continue;
            }

            const best = pickBestTag(tagsResult.parsed, currentParsed, options.mode, false);

            if (!best) {
                continue;
            }

            // min-age gate — we only run the commit lookup when the gate
            // is active, since it costs an extra round-trip per
            // candidate.
            if (options.minAgeDays !== undefined) {
                const commit = await resolver.resolveRef(owner, repo, best.sha);
                const committedAt = commit?.committedAt ? new Date(commit.committedAt).getTime() : undefined;

                if (committedAt) {
                    const ageDays = (Date.now() - committedAt) / MS_PER_DAY;

                    if (ageDays < options.minAgeDays) {
                        ignoredList.push({
                            currentRef: reference.ref,
                            currentVersion: currentParsed?.raw,
                            ecosystem: "actions",
                            file: reference.file,
                            ignored: true,
                            line: reference.line,
                            name: fullName,
                            newRef: reference.ref,
                            newVersion: best.raw,
                            original: reference.original,
                            reason: `release younger than ${String(options.minAgeDays)} days`,
                            replacement: reference.original,
                            updateType: "unknown",
                        });

                        continue;
                    }
                }
            }

            // SHA pinning resolves the target tag to its commit SHA and
            // appends a `# vN` comment so the line is human-readable.
            // `preserve` keeps the original style — a tag stays a tag,
            // and a SHA pin stays a SHA pin (because we want to KEEP
            // existing security wins).
            const newRef = options.style === "sha" || reference.isSha ? best.sha : best.raw;
            const replacement = buildReplacement(reference, best.sha, best.raw, options.style);

            updates.push({
                currentRef: reference.ref,
                currentVersion: currentParsed?.raw ?? reference.trailingComment?.replace(/^#\s*/, ""),
                ecosystem: "actions",
                file: reference.file,
                line: reference.line,
                name: fullName,
                newRef,
                newVersion: best.raw,
                original: reference.original,
                replacement,
                updateType: classifyUpdate(currentParsed, best),
                url: `https://github.com/${owner}/${repo}/releases/tag/${best.raw}`,
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

    const decoratedUpdates = decorateActionsAdvisories(workspaceRoot, updates);

    return { failed, ignored: ignoredList, updates: decoratedUpdates };
};

export { scanActionsRepository } from "./scanner";
