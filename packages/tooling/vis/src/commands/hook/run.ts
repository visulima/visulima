import { spawnSync } from "node:child_process";
import { cwd } from "node:process";

import { isAccessibleSync } from "@visulima/fs";
import { join } from "@visulima/path";

interface RunOptions {
    allFiles?: boolean;
    fromRef?: string;
    lastCommit?: boolean;
    stage?: string;
    toRef?: string;
}

interface RunLogger {
    info: (message: string) => void;
}

const DEFAULT_STAGE = "pre-commit";

/**
 * Invoke a previously-installed `.vis-hooks/{stage}` script directly,
 * forwarding --all-files / --from-ref / --to-ref through environment variables
 * that the bundled prek-runner honours. This makes CI usage trivial: run the
 * same hook logic that fires at commit time, but over an explicit file set.
 */
const runHookStage = (root: string, hooksDirectory: string, options: RunOptions, logger: RunLogger): number => {
    const stage = options.stage ?? DEFAULT_STAGE;
    const scriptPath = join(root, hooksDirectory, stage);

    if (!isAccessibleSync(scriptPath)) {
        throw new Error(`No script found at ${hooksDirectory}/${stage}. Install or migrate hooks first.`);
    }

    // --last-commit is a shortcut for --from-ref HEAD~1 --to-ref HEAD, matching
    // prek's convenience flag. Error if the user mixes it with explicit refs.
    if (options.lastCommit && (options.fromRef || options.toRef)) {
        throw new Error("--last-commit cannot be combined with --from-ref or --to-ref");
    }

    const fromRef = options.lastCommit ? "HEAD~1" : options.fromRef;
    const toRef = options.lastCommit ? "HEAD" : options.toRef;

    if (fromRef && !toRef) {
        throw new Error("--from-ref requires --to-ref");
    }

    if (toRef && !fromRef) {
        throw new Error("--to-ref requires --from-ref");
    }

    const env: NodeJS.ProcessEnv = { ...process.env };

    if (options.allFiles) {
        env["VIS_HOOK_ALL_FILES"] = "1";
    }

    if (fromRef) {
        env["VIS_HOOK_FROM_REF"] = fromRef;
    }

    if (toRef) {
        env["VIS_HOOK_TO_REF"] = toRef;
    }

    logger.info(`Running ${hooksDirectory}/${stage}${options.allFiles ? " (--all-files)" : ""}${fromRef ? ` (${fromRef}..${toRef})` : ""}`);

    const result = spawnSync("sh", ["-e", scriptPath], { cwd: root, env, stdio: "inherit" });

    if (result.error) {
        throw result.error;
    }

    return result.status ?? 1;
};

const runRun = (hooksDirectory: string, options: RunOptions, logger: RunLogger): void => {
    const code = runHookStage(cwd(), hooksDirectory, options, logger);

    if (code !== 0) {
        throw new Error(`Hook stage exited with code ${code}`);
    }
};

export type { RunLogger, RunOptions };
export { DEFAULT_STAGE, runHookStage, runRun };
