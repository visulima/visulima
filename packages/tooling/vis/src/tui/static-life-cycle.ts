import { cyan, dim, green, red } from "@visulima/colorize";
import type { LifeCycleInterface, Task, TaskResult, TaskStatus } from "@visulima/task-runner";

import { formatFlags, formatTargetsAndProjects } from "./formatting-utils";
import { cliOutput } from "./output";
import { formatMs } from "./pretty-time";
import { CROSS, TICK } from "./symbols";

interface StaticOutputOptions {
    args: {
        targets: string[];
    };
    projectNames: string[];
    tasks: Task[];
}

/**
 * A lifecycle handler for CI environments that produces static, append-only output.
 * No cursor manipulation — just linear log lines.
 */
export class StaticOutputLifeCycle implements LifeCycleInterface {
    readonly #projectNames: string[];

    readonly #targets: string[];

    readonly #tasks: Task[];

    readonly #failedTasks: TaskResult[] = [];

    readonly #cachedTasks: TaskResult[] = [];

    readonly #allCompletedTasks = new Map<string, TaskResult>();

    #commandStartTime = 0;

    public constructor(options: StaticOutputOptions) {
        this.#projectNames = options.projectNames;
        this.#targets = options.args.targets;
        this.#tasks = options.tasks;
    }

    public startCommand(): void {
        this.#commandStartTime = Date.now();

        const header = cliOutput.applyPrefix(cyan, `Running ${formatTargetsAndProjects(this.#projectNames, this.#targets, this.#tasks)}`);

        process.stdout.write(header);

        // Print overrides if any (skip internal "command" key)
        const firstTask = this.#tasks[0];
        const overrideEntries = firstTask?.overrides ? Object.entries(firstTask.overrides).filter(([flag]) => flag !== "command") : [];

        if (overrideEntries.length > 0) {
            process.stdout.write(`\n  With additional flags:\n`);

            for (const [flag, value] of overrideEntries) {
                process.stdout.write(`${formatFlags("    ", flag, value)}\n`);
            }
        }

        process.stdout.write("\n");
    }

    public startTasks(tasks: Task[]): void {
        for (const task of tasks) {
            process.stdout.write(`${dim(">")} ${task.id}\n`);
        }
    }

    public endTasks(taskResults: TaskResult[]): void {
        for (const result of taskResults) {
            this.#allCompletedTasks.set(result.task.id, result);

            if (result.status === "failure") {
                this.#failedTasks.push(result);
            } else if (isCacheStatus(result.status)) {
                this.#cachedTasks.push(result);
            }

            const elapsed = result.startTime && result.endTime ? dim(` (${formatMs(result.endTime - result.startTime)})`) : "";

            const icon = cliOutput.getStatusIcon(result.status);
            const cacheLabel = isCacheStatus(result.status) ? cyan(" [cache]") : "";

            process.stdout.write(`${icon}  ${result.task.id}${cacheLabel}${elapsed}\n`);
        }
    }

    public printTaskTerminalOutput(task: Task, status: TaskStatus, terminalOutput: string): void {
        cliOutput.logCommandOutput(task.id, status, terminalOutput);
    }

    public endCommand(): void {
        const totalTime = formatMs(Date.now() - this.#commandStartTime);
        const totalTasks = this.#allCompletedTasks.size;

        // Detect skipped tasks (tasks that never completed due to dependency failures or bail)
        const skippedTasks = this.#tasks.filter((t) => !this.#allCompletedTasks.has(t.id));

        // Empty line between task output and summary
        process.stdout.write("\n");

        if (this.#failedTasks.length === 0 && skippedTasks.length === 0) {
            const cacheNote = this.#cachedTasks.length > 0 ? dim(` (${this.#cachedTasks.length} read from cache)`) : "";

            process.stdout.write(
                cliOutput.success(`Successfully ran ${formatTargetsAndProjects(this.#projectNames, this.#targets, this.#tasks)}`, [
                    ` ${green(TICK)}  ${totalTasks} tasks completed${cacheNote}`,
                    `    ${dim(`Took ${totalTime}`)}`,
                ]),
            );
        } else {
            const bodyLines: string[] = [];

            if (skippedTasks.length > 0) {
                bodyLines.push(` ${dim(`${skippedTasks.length} task${skippedTasks.length === 1 ? "" : "s"} skipped`)} (dependency failed or --bail)`);

                for (const task of skippedTasks) {
                    bodyLines.push(`   ${dim("-")}  ${dim(task.id)}`);
                }

                bodyLines.push("");
            }

            if (this.#failedTasks.length > 0) {
                bodyLines.push(` ${red(String(this.#failedTasks.length))} task${this.#failedTasks.length === 1 ? "" : "s"} failed:`);

                for (const result of this.#failedTasks) {
                    bodyLines.push(`   ${red(CROSS)}  ${result.task.id}`);
                }

                bodyLines.push("");
            }

            bodyLines.push(`    ${dim(`Took ${totalTime}`)}`);

            process.stdout.write(cliOutput.error(`Ran ${formatTargetsAndProjects(this.#projectNames, this.#targets, this.#tasks)}`, bodyLines));
        }
    }
}

const isCacheStatus = (status: TaskStatus): boolean => status === "local-cache" || status === "local-cache-kept-existing" || status === "remote-cache";
