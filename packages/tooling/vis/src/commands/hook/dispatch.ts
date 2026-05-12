import { spawnSync } from "node:child_process";

import type { BuiltinContext, BuiltinLogger } from "./builtins";
import { getBuiltin } from "./builtins";
import type { HookConfig, HookEntry } from "./config";
import { PREK_STAGES_WITH_GIT_ARGS } from "./constants";
import { applyHookFilter } from "./filter";

/**
 * Conservative per-call argv budget. POSIX guarantees 4 KiB, Linux
 * gives ~2 MiB in practice. 32 KiB keeps us well clear of Windows'
 * 32767-char `CreateProcess` limit too.
 *
 * Note: shell `entry` strings are executed via `sh -c "&lt;entry> \"$@\""`,
 * which means Windows runners need a POSIX `sh` on PATH (Git for Windows
 * provides one). The dispatcher does not synthesise `cmd.exe` pipelines.
 */
const ARG_BUDGET = 32 * 1024;

/**
 * Split `files` into chunks whose combined argv bytes stay under
 * `ARG_BUDGET`. `overhead` is the byte cost of the fixed argv prefix
 * (sh, -c, the command string, the `sh` argv[0] placeholder, and any
 * `extraArgs`) so we don't blow the budget when callers tack on a
 * long command.
 */
const chunkFiles = (files: ReadonlyArray<string>, overhead: number): string[][] => {
    const chunks: string[][] = [];
    const budget = Math.max(1024, ARG_BUDGET - overhead);
    let current: string[] = [];
    let size = 0;

    for (const file of files) {
        const cost = Buffer.byteLength(file, "utf8") + 8;

        if (size + cost > budget && current.length > 0) {
            chunks.push(current);
            current = [];
            size = 0;
        }

        current.push(file);
        size += cost;
    }

    if (current.length > 0) {
        chunks.push(current);
    }

    return chunks;
};

export interface DispatchLogger {
    error: (message: string) => void;
    info: (message: string) => void;
}

const builtinLoggerFor = (parent: DispatchLogger): BuiltinLogger => {
    return {
        error: (message) => { parent.error(message); },
        info: (message) => { parent.info(message); },
    };
};

const describeSpawnFailure = (status: number | null, signal: NodeJS.Signals | null, error: Error | undefined): string => {
    if (error) {
        return error.message;
    }

    if (signal) {
        return `terminated by signal ${signal}`;
    }

    return `exited with status ${String(status)}`;
};

interface DispatchContext {
    /**
     * Forwarded as the trailing argv to user-supplied `entry`-style hooks
     * for git-arg stages (commit-msg, prepare-commit-msg, …). Empty
     * otherwise.
     */
    extraArgs: ReadonlyArray<string>;
    logger: DispatchLogger;

    /**
     * Working directory for child processes. Defaults to process.cwd()
     * when omitted but is taken from the run command in practice.
     */
    root: string;
    stage: string;
}

/**
 * Execute a user-supplied shell command via `sh -c`. We deliberately
 * hand the command to `sh` so that users keep their shell features
 * (pipes, redirections, env-var expansion). The trade-off is that
 * `entry` strings are trusted input — never load a `config.json` from
 * an untrusted source.
 */
const runShellCommand = (
    command: string,
    files: ReadonlyArray<string>,
    passFilenames: boolean,
    forwardExtraArgs: boolean,
    context: DispatchContext,
): number => {
    const extraArgs = forwardExtraArgs ? context.extraArgs : [];

    if (!passFilenames || files.length === 0) {
        const result = spawnSync("sh", ["-c", command, "sh", ...extraArgs], {
            cwd: context.root,
            stdio: "inherit",
        });

        if (result.status === null) {
            context.logger.error(`hook command failed: ${describeSpawnFailure(result.status, result.signal, result.error)}`);

            return 1;
        }

        return result.status;
    }

    const overhead
        = Buffer.byteLength(command, "utf8")
            + Buffer.byteLength("sh", "utf8")
            + Buffer.byteLength("-c", "utf8")
            + extraArgs.reduce((sum, a) => sum + Buffer.byteLength(a, "utf8") + 8, 0)
            + 64;

    let rc = 0;

    for (const chunk of chunkFiles(files, overhead)) {
        const result = spawnSync("sh", ["-c", `${command} "$@"`, "sh", ...extraArgs, ...chunk], {
            cwd: context.root,
            stdio: "inherit",
        });

        if (result.status === null) {
            context.logger.error(`hook command failed: ${describeSpawnFailure(result.status, result.signal, result.error)}`);
            rc ||= 1;
        } else {
            rc ||= result.status;
        }
    }

    return rc;
};

/**
 * Run a single hook entry against the discovered file set. Returns the
 * resulting exit code (0 = pass, non-zero = fail). The caller is
 * responsible for OR-folding return codes across hooks.
 */
export const runHookEntry = (entry: HookEntry, candidateFiles: ReadonlyArray<string>, context: DispatchContext): number => {
    if (entry.fail !== undefined) {
        context.logger.info(entry.fail);

        return 1;
    }

    // Git-arg stages (commit-msg, prepare-commit-msg, …) get an empty
    // candidate set by design — git supplies its own positional args.
    // Treat every hook in those stages as `alwaysRun` so hand-edited
    // configs that forgot the flag don't silently no-op.
    const stageForcesAlwaysRun = PREK_STAGES_WITH_GIT_ARGS.has(context.stage);
    let filtered: string[];

    try {
        filtered = applyHookFilter(candidateFiles, entry);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);

        context.logger.error(`hook "${entry.id}": ${message}`);

        return 2;
    }

    if (filtered.length === 0 && entry.alwaysRun !== true && !stageForcesAlwaysRun) {
        return 0;
    }

    const passFilenames = entry.passFilenames !== false;

    if (entry.verbose) {
        const label = entry.name ?? entry.id;

        context.logger.info(`+ ${label}`);
    }

    if (entry.builtin) {
        const fn = getBuiltin(entry.builtin);

        if (!fn) {
            context.logger.error(`unknown builtin "${entry.builtin}" referenced by hook "${entry.id}"`);

            return 2;
        }

        const builtinContext: BuiltinContext = {
            logger: builtinLoggerFor(context.logger),
            root: context.root,
        };

        try {
            return fn(filtered, entry.args ?? [], builtinContext);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);

            context.logger.error(`builtin "${entry.builtin}" crashed: ${message}`);

            return 1;
        }
    }

    if (entry.entry === undefined) {
        context.logger.error(`hook "${entry.id}" has no \`entry\`, \`builtin\`, or \`fail\` to run`);

        return 2;
    }

    const argString = (entry.args ?? []).map((a) => `'${a.replaceAll("'", String.raw`'\''`)}'`).join(" ");
    const command = argString ? `${entry.entry} ${argString}` : entry.entry;

    return runShellCommand(command, filtered, passFilenames, stageForcesAlwaysRun, context);
};

/**
 * Run every hook configured for `stage`. OR-folds exit codes (any
 * non-zero ⇒ failure) and short-circuits when `failFast` is set.
 */
export const runStage = (config: HookConfig, stage: string, candidateFiles: ReadonlyArray<string>, context: DispatchContext): number => {
    const hooks = config.stages[stage];

    if (!hooks || hooks.length === 0) {
        return 0;
    }

    let rc = 0;

    for (const hook of hooks) {
        const code = runHookEntry(hook, candidateFiles, context);

        if (code !== 0) {
            rc ||= code;

            if (config.failFast) {
                return rc;
            }
        }
    }

    return rc;
};

export type { DispatchContext };
