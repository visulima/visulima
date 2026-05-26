import type { DependabotIgnoreRules } from "../dependabot";
import { isIgnored } from "../dependabot";
import { classifyUpdate, parseTag, pickBestTag } from "../semver-helpers";
import type { EcosystemUpdate, EcosystemUpdateOptions } from "../types";
import type { DockerRegistryOptions } from "./registry";
import { DockerRegistry } from "./registry";
import type { ImageReference } from "./scanner";
import { scanDockerRepository } from "./scanner";

interface CheckDockerContext {
    readonly references: ImageReference[];
    readonly options: EcosystemUpdateOptions;
    readonly registryOptions?: DockerRegistryOptions;
    readonly ignoreRules?: DependabotIgnoreRules;
}

interface CheckDockerResult {
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
 * Composes the canonical display name for a reference (`namespace/name`
 * for namespaced images, `name` alone for the `library` namespace on
 * docker.io to match how users actually write `FROM node:22`).
 */
const displayName = (reference: ImageReference): string => {
    const local = reference.namespace === "library" ? reference.name : `${reference.namespace}/${reference.name}`;

    if (reference.registry === "docker.io") {
        return local;
    }

    return `${reference.registry}/${local}`;
};

/**
 * Returns true when the reference has a `@sha256:…` digest pin. Digest
 * pins are an explicit supply-chain guarantee from the user — we can't
 * cheaply resolve a fresh digest for the new tag (it would require a
 * `HEAD /v2/<name>/manifests/<tag>` call per update), so the safe
 * default is to skip the update with a clear reason rather than silently
 * strip the pin.
 */
const hasDigestPin = (reference: ImageReference): boolean => reference.digest !== undefined && reference.digest.length > 0;
/**
 * Best-effort registry browse URL for the report. Docker Hub uses a
 * different path shape for library vs. user images, and other registries
 * just don't have a canonical web URL — we return the `https://<host>/...`
 * form and let the report show it for navigability.
 */
const buildRegistryUrl = (reference: ImageReference): string => {
    if (reference.registry === "docker.io") {
        const path = reference.namespace === "library" ? `_/${reference.name}` : `r/${reference.namespace}/${reference.name}`;

        return `https://hub.docker.com/${path}/tags`;
    }

    const path = reference.namespace === "library" ? reference.name : `${reference.namespace}/${reference.name}`;

    return `https://${reference.registry}/${path}`;
};

const buildReplacement = (reference: ImageReference, newTag: string): string => {
    const local = reference.namespace === "library" ? reference.name : `${reference.namespace}/${reference.name}`;
    const head = reference.registry === "docker.io" ? local : `${reference.registry}/${local}`;

    return `${head}:${newTag}`;
};

export const checkDocker = async (_workspaceRoot: string, context: CheckDockerContext): Promise<CheckDockerResult> => {
    const { ignoreRules, options, references, registryOptions } = context;
    const updates: EcosystemUpdate[] = [];
    const ignoredList: EcosystemUpdate[] = [];
    const failed: { file: string; reason: string }[] = [];

    if (references.length === 0) {
        return { failed, ignored: ignoredList, updates };
    }

    const registry = new DockerRegistry({
        fetch: registryOptions?.fetch,
        tokens: registryOptions?.tokens,
    });

    // Group by `registry|namespace|name` to dedupe network calls.
    const grouped = new Map<string, ImageReference[]>();

    for (const reference of references) {
        const key = `${reference.registry}|${reference.namespace}|${reference.name}`;
        const bucket = grouped.get(key) ?? [];

        bucket.push(reference);
        grouped.set(key, bucket);
    }

    const concurrency = Math.max(1, options.maxConcurrentRequests);
    const groupKeys = [...grouped.keys()];
    let cursor = 0;

    const processGroup = async (key: string): Promise<void> => {
        const groupReferences = grouped.get(key) ?? [];
        const first = groupReferences[0];

        if (!first) {
            return;
        }

        let listing;

        try {
            listing = await registry.listTags(first.registry, first.namespace, first.name);
        } catch {
            for (const reference of groupReferences) {
                failed.push({ file: reference.file, reason: `failed to list tags for ${displayName(reference)}` });
            }

            return;
        }

        for (const reference of groupReferences) {
            const fullName = displayName(reference);
            let ignoreReason: string | undefined;

            if (reference.ignoreReason) {
                ignoreReason = reference.ignoreReason;
            } else if (matchesPattern(fullName, options.exclude)) {
                ignoreReason = "matched --exclude";
            } else if (options.include.length > 0 && !matchesPattern(fullName, options.include)) {
                ignoreReason = "not matched by --include";
            } else if (options.respectDependabotConfig && ignoreRules && isIgnored(fullName, "docker", ignoreRules)) {
                ignoreReason = "ignored by dependabot/renovate config";
            }

            if (ignoreReason) {
                ignoredList.push({
                    currentRef: reference.tag,
                    currentVersion: reference.tag,
                    ecosystem: "docker",
                    file: reference.file,
                    ignored: true,
                    line: reference.line,
                    name: fullName,
                    newRef: reference.tag,
                    newVersion: undefined,
                    original: reference.original,
                    reason: ignoreReason,
                    replacement: reference.original,
                    updateType: "unknown",
                });

                continue;
            }

            // Digest-pinned images (`image:tag@sha256:…`) carry an
            // explicit supply-chain pin from the user. Rewriting the tag
            // without re-resolving the digest would silently strip the
            // pin, so we skip with a clear reason rather than corrupt
            // the user's security posture.
            if (hasDigestPin(reference)) {
                ignoredList.push({
                    currentRef: reference.tag,
                    currentVersion: reference.tag,
                    ecosystem: "docker",
                    file: reference.file,
                    ignored: true,
                    line: reference.line,
                    name: fullName,
                    newRef: reference.tag,
                    newVersion: undefined,
                    original: reference.original,
                    reason: "digest-pinned image (refresh the pin manually to update)",
                    replacement: reference.original,
                    updateType: "digest",
                });

                continue;
            }

            // `latest` / branch-style tags have nothing meaningful to
            // compare against — skip them, unless include-branches is on
            // (we reuse the actions flag for symmetry).
            const currentParsed = parseTag(reference.tag);

            if (!currentParsed && !options.includeBranches) {
                ignoredList.push({
                    currentRef: reference.tag,
                    currentVersion: reference.tag,
                    ecosystem: "docker",
                    file: reference.file,
                    ignored: true,
                    line: reference.line,
                    name: fullName,
                    newRef: reference.tag,
                    newVersion: undefined,
                    original: reference.original,
                    reason: "non-semver tag (use --include-branches)",
                    replacement: reference.original,
                    updateType: "unknown",
                });

                continue;
            }

            const best = pickBestTag(listing.parsed, currentParsed, options.mode, false);

            if (!best) {
                continue;
            }

            const newTag = best.raw;
            const replacement = buildReplacement(reference, newTag);

            updates.push({
                currentRef: reference.tag,
                currentVersion: reference.tag,
                ecosystem: "docker",
                file: reference.file,
                line: reference.line,
                name: fullName,
                newRef: newTag,
                newVersion: newTag,
                original: reference.original,
                replacement,
                updateType: classifyUpdate(currentParsed, best),
                url: buildRegistryUrl(reference),
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

export { scanDockerRepository };
