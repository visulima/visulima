import { resolveConfig, validateConfig } from "./config";
import { ApplyEmptyCommitError, StagedError } from "./errors";
import { GitWorkflow } from "./git";
import { applyIgnore } from "./match";
import { pickRenderer } from "./renderer";
import { buildTaskGraph } from "./tasks/build";
import { runTasks } from "./tasks/run";
import type { RunOptions, RunResult } from "./types";

const DEFAULT_CONCURRENT = true;

/**
 * Runs staged tasks end-to-end: backup, hide unstaged, match files,
 * execute commands, re-stage fixes, reapply unstaged deltas, cleanup.
 * Returns `{ success, ranTasks, failedCommands }`.
 *
 * Throws on setup-level failures (no git repo, invalid config). Task
 * failures are reported via the return value when `continueOnError` is
 * enabled, otherwise they end the run with `success: false`.
 */
export const runStaged = async (options: RunOptions = {}): Promise<RunResult> => {
    const cwd = options.cwd ?? process.cwd();
    const renderer = await pickRenderer(options);

    const resolvedConfig = await resolveConfig(options);

    // Object configs validate up front; function configs defer until after `prepare()` collects staged files.
    if (typeof resolvedConfig !== "function") {
        validateConfig(resolvedConfig);
    }

    const workflow = new GitWorkflow({ ...options, cwd });

    // External abort — fired by SIGINT/SIGTERM handlers so in-flight tasks cancel and the cleanup/restore path runs.
    const externalAborter = new AbortController();
    let interrupted = false;

    const onInterrupt = (signal: NodeJS.Signals): void => {
        if (interrupted) {
            // Second Ctrl+C — fall through to default behaviour and exit the process.
            process.removeListener("SIGINT", onInterrupt);
            process.removeListener("SIGTERM", onInterrupt);
            process.kill(process.pid, signal);

            return;
        }

        interrupted = true;
        renderer.warn({ message: `Received ${signal} — cancelling staged tasks and restoring state. Press Ctrl+C again to abort.` });
        externalAborter.abort();
    };

    process.on("SIGINT", onInterrupt);
    process.on("SIGTERM", onInterrupt);

    let runResult: RunResult = { failedCommands: [], ranTasks: false, success: true };
    let workflowPrepared = false;
    let finalSuccess = false;

    try {
        await workflow.prepare();
        workflowPrepared = true;

        for (const message of workflow.warnings) {
            renderer.warn({ message });
        }

        if (workflow.stagedFiles.length === 0) {
            if (options.allowEmpty !== true) {
                renderer.info({ message: "No staged files found." });
            }

            finalSuccess = true;

            return { failedCommands: [], ranTasks: false, success: true };
        }

        const candidateFiles = applyIgnore(workflow.stagedFiles, options.ignore, cwd);

        if (candidateFiles.length === 0 && workflow.stagedFiles.length > 0) {
            renderer.info({ message: "Every staged file was excluded by the `ignore` list." });
            finalSuccess = true;

            return { failedCommands: [], ranTasks: false, success: true };
        }

        const staticConfig = typeof resolvedConfig === "function" ? validateConfig(await resolvedConfig([...candidateFiles])) : resolvedConfig;

        const patterns = await buildTaskGraph({
            config: staticConfig,
            cwd,
            files: candidateFiles,
            relative: options.relative,
        });

        renderer.start({ patterns });

        if (patterns.length === 0) {
            renderer.info({ message: "No staged files matched any pattern." });
            finalSuccess = true;

            return { failedCommands: [], ranTasks: false, success: true };
        }

        const { failedCommands, success } = await runTasks(patterns, renderer, {
            concurrent: options.concurrent ?? DEFAULT_CONCURRENT,
            continueOnError: options.continueOnError === true,
            cwd,
            externalSignal: externalAborter.signal,
            killSignal: options.killSignal,
            maxArgLength: options.maxArgLength,
            verbose: options.verbose,
        });

        runResult = { failedCommands, ranTasks: true, success };

        if (success) {
            // `--diff` operates on a git range, not the index, so there's nothing to re-stage and no meaningful empty-commit check.
            if (options.diff === undefined) {
                await workflow.applyModifications();

                if (options.failOnChanges === true && workflow.indexTreeChanged()) {
                    renderer.warn({ message: "Tasks modified staged content — failing because --fail-on-changes is set." });
                    runResult = { failedCommands: [...failedCommands], ranTasks: true, success: false };
                }

                if (options.allowEmpty !== true && workflow.postTaskIndexMatchesHead()) {
                    throw new ApplyEmptyCommitError("All staged changes were reverted by tasks. Re-stage changes or rerun with --allow-empty.");
                }
            }
        } else if (options.revert === true) {
            renderer.info({ message: "Reverting working tree from backup stash." });
            await workflow.revert();
        } else {
            const hint = workflow.recoveryHint();

            if (hint) {
                renderer.warn({ message: hint });
            }
        }

        await workflow.restoreUnstagedChanges();

        finalSuccess = runResult.success;

        return runResult;
    } catch (error_) {
        const message = error_ instanceof Error ? error_.message : String(error_);
        const error = error_ instanceof Error ? error_ : new Error(message);

        renderer.error({ error, message });

        if (error_ instanceof StagedError) {
            return { failedCommands: runResult.failedCommands, ranTasks: runResult.ranTasks, success: false };
        }

        throw error_;
    } finally {
        process.removeListener("SIGINT", onInterrupt);
        process.removeListener("SIGTERM", onInterrupt);

        if (workflowPrepared) {
            try {
                await workflow.cleanup(finalSuccess);
            } catch (error) {
                renderer.error({ error: error as Error, message: "Cleanup failed." });
            }
        }

        await renderer.stop();
    }
};

export { ApplyEmptyCommitError, ConfigError, GetBackupStashError, GitError, RestoreOriginalStateError, StagedError, TaskError } from "./errors";
export type { RunOptions, RunResult, StagedConfig } from "./types";
