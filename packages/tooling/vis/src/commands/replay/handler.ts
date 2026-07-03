import type { Toolbox } from "@visulima/cerebro";
import type { RunSummary, TaskSummary } from "@visulima/task-runner";
import { getLastRunSummaryPath, readLastRunSummary } from "@visulima/task-runner";

import { pail } from "../../io/logger";
import { listRunSummaries, readRunSummaryById } from "../../report/run-summary-utils";
import { getVisRunsDir, getVisWorkspaceDataDir } from "../../util/vis-paths";
import type { ReplayOptions } from "./index";

const VALID_FORMATS = new Set(["json", "table"]);

const resolveWorkspaceRoot = (workspaceRoot: string | undefined, fallbackCwd: string): string => workspaceRoot ?? fallbackCwd;

const formatDuration = (ms: number | undefined): string => {
    if (ms === undefined) {
        return "-";
    }

    if (ms < 1000) {
        return `${String(ms)}ms`;
    }

    return `${(ms / 1000).toFixed(2)}s`;
};

const formatStatus = (task: TaskSummary): string => {
    if (task.exitCode === undefined) {
        return task.cacheStatus;
    }

    if (task.exitCode === 0) {
        return task.cacheStatus === "MISS" ? "OK" : task.cacheStatus;
    }

    return `FAIL(${String(task.exitCode)})`;
};

const padCell = (value: string, width: number): string => {
    if (value.length >= width) {
        return value;
    }

    return value + " ".repeat(width - value.length);
};

const isFailedTask = (task: TaskSummary): boolean => task.exitCode !== undefined && task.exitCode !== 0;

const renderRunHeader = (summary: RunSummary, logger: Console): void => {
    logger.info(`Run ${summary.id}`);
    logger.info(`  start:    ${summary.startTime}`);
    logger.info(`  end:      ${summary.endTime}`);
    logger.info(`  duration: ${formatDuration(summary.duration)}`);
    logger.info(
        `  totals:   ${String(summary.stats.total)} total · ${String(summary.stats.succeeded)} ok · `
        + `${String(summary.stats.cached)} cached · ${String(summary.stats.skipped)} skipped · ${String(summary.stats.failed)} failed`,
    );
    logger.info(`  env:      node ${summary.environment.nodeVersion} · ${summary.environment.platform}/${summary.environment.arch}`);
    logger.info("");
};

const renderTaskTable = (tasks: TaskSummary[], logger: Console): void => {
    if (tasks.length === 0) {
        logger.info("(no tasks match the current filter)");

        return;
    }

    const rows = tasks.map((task) => {
        return {
            duration: formatDuration(task.duration),
            hash: task.hash ? task.hash.slice(0, 12) : "-",
            status: formatStatus(task),
            taskId: task.taskId,
        };
    });

    const widths = {
        duration: Math.max("duration".length, ...rows.map((r) => r.duration.length)),
        hash: Math.max("hash".length, ...rows.map((r) => r.hash.length)),
        status: Math.max("status".length, ...rows.map((r) => r.status.length)),
        taskId: Math.max("task".length, ...rows.map((r) => r.taskId.length)),
    };

    logger.info(
        `  ${padCell("task", widths.taskId)}  ${padCell("status", widths.status)}  ${padCell("duration", widths.duration)}  ${padCell("hash", widths.hash)}`,
    );
    logger.info(`  ${"-".repeat(widths.taskId)}  ${"-".repeat(widths.status)}  ${"-".repeat(widths.duration)}  ${"-".repeat(widths.hash)}`);

    for (const row of rows) {
        logger.info(
            `  ${padCell(row.taskId, widths.taskId)}  ${padCell(row.status, widths.status)}  ${padCell(row.duration, widths.duration)}  ${padCell(row.hash, widths.hash)}`,
        );
    }
};

const renderTaskDetail = (summary: RunSummary, task: TaskSummary, logger: Console): void => {
    renderRunHeader(summary, logger);
    logger.info(`Task ${task.taskId}`);
    logger.info(`  status:    ${formatStatus(task)}`);
    logger.info(`  cache:     ${task.cacheStatus}`);
    logger.info(`  duration:  ${formatDuration(task.duration)}`);
    logger.info(`  exit:      ${task.exitCode === undefined ? "-" : String(task.exitCode)}`);
    logger.info(`  hash:      ${task.hash ?? "(none)"}`);
    logger.info(`  start:     ${task.startTime ?? "-"}`);
    logger.info(`  end:       ${task.endTime ?? "-"}`);

    if (task.dependencies.length > 0) {
        logger.info(`  deps:      ${task.dependencies.join(", ")}`);
    }

    logger.info("");
    pail.info(`Drill into hash inputs with: vis cache why ${task.taskId} --run ${summary.id}`);
};

const renderListJson = (entries: { id: string; mtimeMs: number; path: string }[]): void => {
    process.stdout.write(
        `${JSON.stringify(
            entries.map((entry) => {
                return {
                    id: entry.id,
                    mtime: new Date(entry.mtimeMs).toISOString(),
                    path: entry.path,
                };
            }),
            undefined,
            2,
        )}\n`,
    );
};

const renderListTable = (entries: { id: string; mtimeMs: number }[], workspaceRoot: string, logger: Console): void => {
    if (entries.length === 0) {
        pail.info(`No recorded runs found in ${getVisRunsDir(workspaceRoot)}/. Run with --summarize to record a run.`);

        return;
    }

    const widths = {
        id: Math.max("id".length, ...entries.map((entry) => entry.id.length)),
        mtime: 24,
    };

    logger.info(`  ${padCell("id", widths.id)}  ${padCell("mtime", widths.mtime)}`);
    logger.info(`  ${"-".repeat(widths.id)}  ${"-".repeat(widths.mtime)}`);

    for (const entry of entries) {
        logger.info(`  ${padCell(entry.id, widths.id)}  ${new Date(entry.mtimeMs).toISOString()}`);
    }
};

const filterTasks = (summary: RunSummary, options: { failed: boolean; task: string | undefined }): TaskSummary[] => {
    let { tasks } = summary;

    if (options.task !== undefined) {
        tasks = tasks.filter((t) => t.taskId === options.task);
    }

    if (options.failed) {
        tasks = tasks.filter((t) => isFailedTask(t));
    }

    return tasks;
};

interface RunReplayOptions {
    failed: boolean;
    format: "json" | "table";
    runId: string | undefined;
    task: string | undefined;
    workspaceRoot: string;
}

export const runReplay = async (options: RunReplayOptions, logger: Console): Promise<void> => {
    const { failed, format, runId, task: taskFilter, workspaceRoot } = options;

    const summary
        = runId === undefined
            ? await readLastRunSummary(workspaceRoot, { dataDirectory: getVisWorkspaceDataDir(workspaceRoot) })
            : await readRunSummaryById(workspaceRoot, runId);

    if (!summary) {
        if (format === "json") {
            process.stdout.write(`${JSON.stringify({ error: "no-summary", runId: runId ?? null }, undefined, 2)}\n`);
            process.exitCode = 1;

            return;
        }

        if (runId === undefined) {
            pail.error(
                `No previous run summary found. Run a task first to populate \`${getLastRunSummaryPath(workspaceRoot, { dataDirectory: getVisWorkspaceDataDir(workspaceRoot) })}\`.`,
            );
        } else {
            pail.error(`Run summary "${runId}" not found in ${getVisRunsDir(workspaceRoot)}/.`);
        }

        process.exitCode = 1;

        return;
    }

    const filteredTasks = filterTasks(summary, { failed, task: taskFilter });

    if (taskFilter !== undefined && filteredTasks.length === 0) {
        if (format === "json") {
            process.stdout.write(`${JSON.stringify({ error: "task-not-in-summary", runId: summary.id, taskId: taskFilter }, undefined, 2)}\n`);
            process.exitCode = 1;

            return;
        }

        pail.error(`Task "${taskFilter}" was not part of run ${summary.id}.`);
        process.exitCode = 1;

        return;
    }

    // Reflect the run's overall outcome in the exit code so CI scripts
    // can `vis replay --failed` as a status check, not just a viewer.
    if (summary.stats.failed > 0) {
        process.exitCode = 1;
    }

    if (format === "json") {
        process.stdout.write(
            `${JSON.stringify(
                {
                    duration: summary.duration,
                    endTime: summary.endTime,
                    environment: summary.environment,
                    runId: summary.id,
                    startTime: summary.startTime,
                    stats: summary.stats,
                    tasks: filteredTasks.map((t) => {
                        return {
                            cacheStatus: t.cacheStatus,
                            dependencies: t.dependencies,
                            duration: t.duration,
                            endTime: t.endTime,
                            exitCode: t.exitCode,
                            hash: t.hash ?? null,
                            startTime: t.startTime,
                            taskId: t.taskId,
                        };
                    }),
                },
                undefined,
                2,
            )}\n`,
        );

        return;
    }

    if (taskFilter !== undefined) {
        renderTaskDetail(summary, filteredTasks[0]!, logger);

        return;
    }

    renderRunHeader(summary, logger);
    renderTaskTable(filteredTasks, logger);
};

const replayExecute = async ({ logger, options, process: proc, workspaceRoot: wsRoot }: Toolbox<Console, ReplayOptions>): Promise<void> => {
    const workspaceRoot = resolveWorkspaceRoot(wsRoot, proc.cwd);
    const format = options.format ?? "table";

    if (!VALID_FORMATS.has(format)) {
        pail.error(`Invalid --format: ${format}. Expected "table" or "json".`);
        process.exitCode = 1;

        return;
    }

    if (options.list === true) {
        const entries = await listRunSummaries(workspaceRoot);

        if (format === "json") {
            renderListJson(entries);

            return;
        }

        renderListTable(entries, workspaceRoot, logger);

        return;
    }

    await runReplay(
        {
            failed: options.failed === true,
            format: format as "json" | "table",
            runId: options.run,
            task: options.task,
            workspaceRoot,
        },
        logger,
    );
};

export { replayExecute };
export default replayExecute;
