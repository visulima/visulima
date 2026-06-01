import { checkActions, scanActionsRepository } from "./actions/index";
import { applyEcosystemUpdates } from "./applier";
import { loadIgnoreRules } from "./dependabot";
import { checkDocker, scanDockerRepository } from "./docker/index";
import { checkGitlab, scanGitlabRepository } from "./gitlab/index";
import type { EcosystemId, EcosystemUpdate, EcosystemUpdateOptions, EcosystemUpdateResult } from "./types";

export type { ApplyResult } from "./applier";
export { applyEcosystemUpdates } from "./applier";
export type { EcosystemId, EcosystemUpdate, EcosystemUpdateOptions, EcosystemUpdateResult, EcosystemUpdateType } from "./types";

const DEFAULT_OPTIONS: EcosystemUpdateOptions = {
    disabled: new Set<EcosystemId>(),
    exclude: [],
    githubToken: undefined,
    gitlabToken: undefined,
    include: [],
    includeBranches: false,
    maxConcurrentRequests: 8,
    minAgeDays: undefined,
    mode: "latest",
    respectDependabotConfig: true,
    style: "sha",
};

export interface CheckEcosystemsContext {
    readonly options?: Partial<EcosystemUpdateOptions>;
    readonly workspaceRoot: string;
}

export interface EcosystemCheckResult extends EcosystemUpdateResult {
    /** Per-ecosystem breakdown so the report can group by source. */
    readonly perEcosystem: Record<EcosystemId, { failed: { file: string; reason: string }[]; ignored: EcosystemUpdate[]; updates: EcosystemUpdate[] }>;
}

/**
 * Public entry point used by `vis update`. Auto-detects which
 * ecosystems are present in the workspace and runs the matching
 * scanners/resolvers in parallel.
 *
 * The result is purely informational — no files are written. Pass the
 * `updates` field to {@link applyEcosystemUpdates} to commit changes.
 */
export const checkEcosystems = async (context: CheckEcosystemsContext): Promise<EcosystemCheckResult> => {
    const options: EcosystemUpdateOptions = { ...DEFAULT_OPTIONS, ...context.options, disabled: context.options?.disabled ?? new Set() };
    const ignoreRules = options.respectDependabotConfig ? loadIgnoreRules(context.workspaceRoot) : undefined;

    const perEcosystem: EcosystemCheckResult["perEcosystem"] = {
        actions: { failed: [], ignored: [], updates: [] },
        docker: { failed: [], ignored: [], updates: [] },
        gitlab: { failed: [], ignored: [], updates: [] },
    };

    const ecosystemPromises: Promise<void>[] = [];
    let scannedCount = 0;

    if (!options.disabled.has("actions")) {
        const refs = scanActionsRepository(context.workspaceRoot);

        if (refs.length > 0) {
            scannedCount += 1;
            ecosystemPromises.push(
                checkActions(context.workspaceRoot, { ignoreRules, options, references: refs }).then((result) => {
                    perEcosystem.actions = result;

                    return undefined;
                }),
            );
        }
    }

    if (!options.disabled.has("docker")) {
        const refs = scanDockerRepository(context.workspaceRoot);

        if (refs.length > 0) {
            scannedCount += 1;
            ecosystemPromises.push(
                checkDocker(context.workspaceRoot, { ignoreRules, options, references: refs }).then((result) => {
                    perEcosystem.docker = result;

                    return undefined;
                }),
            );
        }
    }

    if (!options.disabled.has("gitlab")) {
        const { images, includes } = scanGitlabRepository(context.workspaceRoot);

        if (images.length + includes.length > 0) {
            scannedCount += 1;
            ecosystemPromises.push(
                checkGitlab(context.workspaceRoot, {
                    ignoreRules,
                    imageReferences: images,
                    includes,
                    options,
                }).then((result) => {
                    perEcosystem.gitlab = result;

                    return undefined;
                }),
            );
        }
    }

    await Promise.all(ecosystemPromises);

    const updates: EcosystemUpdate[] = [...perEcosystem.actions.updates, ...perEcosystem.docker.updates, ...perEcosystem.gitlab.updates];

    const ignored: EcosystemUpdate[] = [...perEcosystem.actions.ignored, ...perEcosystem.docker.ignored, ...perEcosystem.gitlab.ignored];

    const failed: { file: string; reason: string }[] = [...perEcosystem.actions.failed, ...perEcosystem.docker.failed, ...perEcosystem.gitlab.failed];

    return {
        failed,
        ignored,
        perEcosystem,
        scanned: scannedCount,
        updates,
    };
};
