import { availableParallelism } from "node:os";

import { TaskError } from "../errors";
import type { CommandDescriptor, PatternDescriptor, Renderer, TaskStatus } from "../types";
import { execCommand } from "./exec";

export interface RunTasksOptions {
    readonly concurrent: boolean | number;
    readonly continueOnError: boolean;
    readonly cwd: string;
    /** External cancellation (e.g. SIGINT handler). When fired, cancels like a task failure. */
    readonly externalSignal?: AbortSignal;
    readonly maxArgLength?: number;
    readonly verbose?: boolean;
}

export interface RunTasksResult {
    readonly failedCommands: string[];
    readonly success: boolean;
}

/**
 * Runs pattern tasks with pattern-level concurrency and command-level
 * serial execution. Emits lifecycle events through the renderer.
 *
 * When a command fails and `continueOnError` is off, the shared
 * `AbortController` is aborted so any execa children currently running
 * in other workers exit promptly rather than running to completion on
 * a doomed run.
 */
export const runTasks = async (patterns: ReadonlyArray<PatternDescriptor>, renderer: Renderer, options: RunTasksOptions): Promise<RunTasksResult> => {
    const limit = concurrencyLimit(options.concurrent, patterns.length);
    const failedCommands: string[] = [];
    const abortController = new AbortController();
    let cancelled = false;
    let index = 0;

    const cancel = (): void => {
        if (cancelled) {
            return;
        }

        cancelled = true;

        if (!options.continueOnError) {
            abortController.abort();
        }
    };

    if (options.externalSignal) {
        if (options.externalSignal.aborted) {
            cancel();
        } else {
            options.externalSignal.addEventListener("abort", () => {
                cancel();
            }, { once: true });
        }
    }

    const emitSkippedCommands = (pattern: PatternDescriptor): void => {
        for (const command of pattern.commands) {
            renderer.commandEnd({
                commandId: command.id,
                durationMs: 0,
                patternId: pattern.id,
                status: "skipped",
            });
        }
    };

    const runOne = async (pattern: PatternDescriptor): Promise<void> => {
        if (cancelled) {
            emitSkippedCommands(pattern);
            renderer.patternEnd({ patternId: pattern.id, status: "skipped" });

            return;
        }

        renderer.patternStart({ patternId: pattern.id });

        let patternStatus: TaskStatus = "success";

        for (const command of pattern.commands) {
            if (cancelled) {
                renderer.commandEnd({
                    commandId: command.id,
                    durationMs: 0,
                    patternId: pattern.id,
                    status: "skipped",
                });
                patternStatus = patternStatus === "success" ? "skipped" : patternStatus;

                continue;
            }

            renderer.commandStart({ commandId: command.id, patternId: pattern.id });

            const outcome = await runCommand(command, options, abortController.signal);

            renderer.commandEnd({
                commandId: command.id,
                durationMs: outcome.durationMs,
                error: outcome.error,
                output: outcome.output,
                patternId: pattern.id,
                status: outcome.status,
            });

            if (outcome.status === "failed") {
                failedCommands.push(command.title);
                patternStatus = "failed";
                cancel();

                break;
            }
        }

        renderer.patternEnd({ patternId: pattern.id, status: patternStatus });
    };

    const pickNext = async (): Promise<void> => {
        while (index < patterns.length) {
            const slot = patterns[index];

            index += 1;

            if (slot) {
                await runOne(slot);
            }
        }
    };

    const workers: Promise<void>[] = [];

    for (let i = 0; i < Math.min(limit, patterns.length); i += 1) {
        workers.push(pickNext());
    }

    await Promise.all(workers);

    return { failedCommands, success: failedCommands.length === 0 };
};

interface CommandOutcome {
    readonly durationMs: number;
    readonly error?: Error;
    readonly output?: string;
    readonly status: TaskStatus;
}

const runCommand = async (command: CommandDescriptor, options: RunTasksOptions, signal: AbortSignal): Promise<CommandOutcome> => {
    const started = Date.now();

    try {
        if (command.source === "custom" && command.run) {
            await command.run([...command.files]);

            return { durationMs: Date.now() - started, status: "success" };
        }

        if (command.command) {
            const result = await execCommand(command.command, command.files, {
                cwd: options.cwd,
                maxArgLength: options.maxArgLength,
                signal,
            });

            return { durationMs: result.durationMs, output: options.verbose ? result.output : undefined, status: "success" };
        }

        return {
            durationMs: Date.now() - started,
            error: new TaskError(command.title, `Command has no invocation target.`),
            status: "failed",
        };
    } catch (error_) {
        const error = error_ instanceof Error ? error_ : new Error(String(error_));

        return {
            durationMs: Date.now() - started,
            error,
            output: error instanceof TaskError ? error.message : undefined,
            status: "failed",
        };
    }
};

const concurrencyLimit = (concurrent: boolean | number, patternCount: number): number => {
    if (concurrent === false) {
        return 1;
    }

    if (concurrent === true) {
        // Cap at available CPU parallelism to avoid spawning hundreds of concurrent execa processes on pattern-heavy configs.
        const reasonable = Math.max(1, typeof availableParallelism === "function" ? availableParallelism() : 4);

        return Math.min(Math.max(1, patternCount), reasonable);
    }

    const value = Math.floor(concurrent);

    return value > 0 ? value : 1;
};
