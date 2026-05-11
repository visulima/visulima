import { cwd } from "node:process";

import { loadHookConfig } from "./config";
import { PREK_STAGES_WITH_GIT_ARGS } from "./constants";
import type { DispatchContext } from "./dispatch";
import { runStage } from "./dispatch";
import type { DiscoverMode } from "./discover";
import { discoverFiles } from "./discover";

interface RunOptions {
    allFiles?: boolean;
    /** Trailing positional args forwarded from git (commit msg path, etc.). */
    extraArgs?: ReadonlyArray<string>;
    fromRef?: string;
    lastCommit?: boolean;
    stage?: string;
    toRef?: string;
}

interface RunLogger {
    error: (message: string) => void;
    info: (message: string) => void;
}

const DEFAULT_STAGE = "pre-commit";

/**
 * Translate run-command flags into a single `DiscoverMode`.
 *
 * `--last-commit` is a shortcut for `--from-ref HEAD~1 --to-ref HEAD`,
 * matching prek's convenience flag. Mixing it with explicit refs is
 * rejected so the caller's intent stays unambiguous.
 */
const resolveDiscoverMode = (options: RunOptions): DiscoverMode => {
    if (options.lastCommit && (options.fromRef || options.toRef)) {
        throw new Error("--last-commit cannot be combined with --from-ref or --to-ref");
    }

    const fromRef = options.lastCommit ? "HEAD~1" : options.fromRef;
    const toRef = options.lastCommit ? "HEAD" : options.toRef;

    if ((fromRef && !toRef) || (toRef && !fromRef)) {
        throw new Error("--from-ref and --to-ref must be specified together");
    }

    if (fromRef && toRef) {
        return { fromRef, kind: "range", toRef };
    }

    if (options.allFiles) {
        return { kind: "all" };
    }

    return { kind: "staged" };
};

/**
 * Load `<hooksDirectory>/config.json` and run every hook configured for
 * `stage` against the discovered files. Returns a non-zero exit code if
 * any hook fails or if the config is absent/invalid.
 */
const runHookStage = (
    root: string,
    hooksDirectory: string,
    options: RunOptions,
    logger: RunLogger,
): number => {
    const stage = options.stage ?? DEFAULT_STAGE;
    const config = loadHookConfig(root, hooksDirectory);

    if (!config) {
        throw new Error(`No hook config found at ${hooksDirectory}/config.json. Install or migrate hooks first.`);
    }

    const hooks = config.stages[stage];

    if (!hooks || hooks.length === 0) {
        logger.info(`No hooks configured for stage "${stage}".`);

        return 0;
    }

    // Stages where git supplies its own positional args (commit-msg's
    // message file, post-checkout's refs, …) don't get a discovered
    // file set. The runner forwards `argument.slice(1)` verbatim, and
    // each hook's `alwaysRun: true` keeps the dispatcher from skipping
    // them on an empty file list.
    const usesGitArgs = PREK_STAGES_WITH_GIT_ARGS.has(stage);
    const mode = usesGitArgs ? undefined : resolveDiscoverMode(options);
    const description = mode?.kind === "all" ? " (--all-files)" : mode?.kind === "range" ? ` (${mode.fromRef}..${mode.toRef})` : "";

    logger.info(`Running ${stage}${description}`);

    const candidateFiles = mode ? discoverFiles(mode, root) : [];

    const context: DispatchContext = {
        extraArgs: options.extraArgs ?? [],
        logger,
        root,
        stage,
    };

    return runStage(config, stage, candidateFiles, context);
};

const runRun = (hooksDirectory: string, options: RunOptions, logger: RunLogger): void => {
    const code = runHookStage(cwd(), hooksDirectory, options, logger);

    if (code !== 0) {
        throw new Error(`Hook stage exited with code ${code}`);
    }
};

export type { RunLogger, RunOptions };
export { DEFAULT_STAGE, runHookStage, runRun };
