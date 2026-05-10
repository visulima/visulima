import { mkdir, readFile, writeFile } from "node:fs/promises";

import { join } from "@visulima/path";

import type { OutputSpec, TaskGraph, TaskHashDetails, TaskResult, TaskResults } from "./types";
import { uniqueId } from "./utils";

/**
 * Summary of a single task execution.
 */
interface TaskSummary {
    /** Whether the task was cacheable */
    cacheable: boolean;
    /** Cache status */
    cacheStatus: "HIT" | "MISS" | "REMOTE_HIT" | "SKIPPED";
    /** Dependencies on other tasks */
    dependencies: string[];
    /** Duration in milliseconds */
    duration: number | undefined;
    /** End time (ISO 8601) */
    endTime: string | undefined;
    /** Exit code */
    exitCode: number | undefined;
    /** The computed cache hash */
    hash: string | undefined;
    /** Detailed hash information */
    hashDetails: TaskHashDetails | undefined;
    /** The task's declared outputs (glob patterns, literals, or `{ auto: true }`). */
    outputs: OutputSpec[];
    /**
     * Number of times the task was restarted before producing this final
     * exit code. Omitted when the task completed on its first attempt;
     * `> 0` means the result is post-retry (a "succeeded after N retries"
     * pass should still register as a flake observation).
     */
    retryAttempts: number | undefined;
    /** Start time (ISO 8601) */
    startTime: string | undefined;
    /** The task target */
    target: {
        configuration?: string;
        project: string;
        target: string;
    };
    /** The task ID (e.g., "app:build") */
    taskId: string;
}

/**
 * Complete summary of a task runner execution.
 */
interface RunSummary {
    /** Total duration in milliseconds */
    duration: number;
    /** Run end time (ISO 8601) */
    endTime: string;
    /** Environment info */
    environment: {
        /** Architecture */
        arch: string;
        /** Node.js version */
        nodeVersion: string;
        /** Platform */
        platform: string;
    };
    /** Unique run ID */
    id: string;
    /** Run start time (ISO 8601) */
    startTime: string;
    /** Overall execution statistics */
    stats: {
        /** Number of cached tasks (local + remote) */
        cached: number;
        /** Number of failed tasks */
        failed: number;
        /** Number of skipped tasks */
        skipped: number;
        /** Number of successful tasks */
        succeeded: number;
        /** Total number of tasks */
        total: number;
    };
    /** The task graph used for this run */
    taskGraph: {
        dependencies: Record<string, string[]>;
        roots: string[];
    };
    /** Summary of each task */
    tasks: TaskSummary[];
}

const getCacheStatus = (result: TaskResult): "HIT" | "MISS" | "REMOTE_HIT" | "SKIPPED" => {
    switch (result.status) {
        case "local-cache":
        case "local-cache-kept-existing": {
            return "HIT";
        }

        case "remote-cache": {
            return "REMOTE_HIT";
        }

        case "skipped": {
            return "SKIPPED";
        }

        default: {
            return "MISS";
        }
    }
};

/**
 * Generates a run summary from task results.
 */
const generateRunSummary = (results: TaskResults, taskGraph: TaskGraph, startTime: number): RunSummary => {
    const endTime = Date.now();
    const id = `${new Date(startTime).toISOString().replaceAll(/[:.]/g, "-")}_${uniqueId()}`;

    const tasks: TaskSummary[] = [];
    let succeeded = 0;
    let failed = 0;
    let cached = 0;
    let skipped = 0;

    for (const [taskId, result] of results) {
        const taskDeps = taskGraph.dependencies[taskId] ?? [];

        const summary: TaskSummary = {
            cacheable: result.task.cache !== false,
            cacheStatus: getCacheStatus(result),
            dependencies: taskDeps,
            duration: result.startTime && result.endTime ? result.endTime - result.startTime : undefined,
            endTime: result.endTime ? new Date(result.endTime).toISOString() : undefined,
            exitCode: result.code,
            hash: result.task.hash,
            hashDetails: result.task.hashDetails,
            outputs: result.task.outputs,
            retryAttempts: result.retryAttempts,
            startTime: result.startTime ? new Date(result.startTime).toISOString() : undefined,
            target: {
                configuration: result.task.target.configuration,
                project: result.task.target.project,
                target: result.task.target.target,
            },
            taskId,
        };

        tasks.push(summary);

        switch (result.status) {
            case "failure": {
                failed += 1;
                break;
            }

            case "local-cache":
            // falls through
            case "local-cache-kept-existing":
            case "remote-cache": {
                cached += 1;
                break;
            }
            case "skipped": {
                skipped += 1;
                break;
            }

            case "success": {
                succeeded += 1;
                break;
            }

            default: {
                break;
            }
        }
    }

    // Sort tasks by start time for readability
    const sortedTasks = tasks.toSorted((a, b) => {
        if (!a.startTime || !b.startTime) {
            return 0;
        }

        return a.startTime.localeCompare(b.startTime);
    });

    return {
        duration: endTime - startTime,
        endTime: new Date(endTime).toISOString(),
        environment: {
            arch: process.arch,
            nodeVersion: process.version,
            platform: process.platform,
        },
        id,
        startTime: new Date(startTime).toISOString(),
        stats: {
            cached,
            failed,
            skipped,
            succeeded,
            total: results.size,
        },
        taskGraph: {
            dependencies: taskGraph.dependencies,
            roots: taskGraph.roots,
        },
        tasks: sortedTasks,
    };
};

const DEFAULT_DATA_DIRECTORY_NAME = ".task-runner";
const LAST_SUMMARY_FILE = "last-summary.json";

/**
 * Resolves the directory that holds run summaries (`runs/`) and
 * `last-summary.json`. Defaults to `{workspaceRoot}/.task-runner` when no
 * override is supplied so standalone task-runner consumers keep their
 * existing layout; vis injects `{workspaceRoot}/.vis` to share the
 * top-level vis data directory.
 */
const resolveDataDirectory = (workspaceRoot: string, override: string | undefined): string =>
    override && override.length > 0 ? override : join(workspaceRoot, DEFAULT_DATA_DIRECTORY_NAME);

interface RunSummaryPathOptions {
    /**
     * Absolute path to the directory that holds `runs/` and
     * `last-summary.json`. When omitted, falls back to
     * `{workspaceRoot}/.task-runner`.
     */
    dataDirectory?: string;
}

/**
 * Writes the run summary to a JSON file in the `runs/` subdirectory of the
 * resolved data directory (defaults to `.task-runner/runs/`).
 * @param summary The run summary to write
 * @param workspaceRoot The workspace root directory
 * @param options Optional overrides — pass `dataDirectory` to redirect away from `.task-runner/`
 * @returns The path to the written summary file
 */
const writeRunSummary = async (summary: RunSummary, workspaceRoot: string, options: RunSummaryPathOptions = {}): Promise<string> => {
    const runsDirectory = join(resolveDataDirectory(workspaceRoot, options.dataDirectory), "runs");

    await mkdir(runsDirectory, { recursive: true });

    const filename = `${summary.id}.json`;
    const filePath = join(runsDirectory, filename);

    await writeFile(filePath, JSON.stringify(summary, undefined, 2));

    return filePath;
};

/**
 * Path where the most-recent run summary is persisted.
 * Consumers (e.g. CLIs exposing `--last-details`) read this file
 * to replay or render the previous run without re-executing.
 */
const getLastRunSummaryPath = (workspaceRoot: string, options: RunSummaryPathOptions = {}): string =>
    join(resolveDataDirectory(workspaceRoot, options.dataDirectory), LAST_SUMMARY_FILE);

/**
 * Persists `summary` as the most-recent run summary at
 * `{dataDirectory}/last-summary.json`, overwriting any previous entry.
 *
 * This is the companion to {@link readLastRunSummary} and powers
 * CLI surfaces that display "last run" details without re-running tasks.
 * @returns The path to the written summary file
 */
const writeLastRunSummary = async (summary: RunSummary, workspaceRoot: string, options: RunSummaryPathOptions = {}): Promise<string> => {
    const dataDirectory = resolveDataDirectory(workspaceRoot, options.dataDirectory);

    await mkdir(dataDirectory, { recursive: true });

    const filePath = getLastRunSummaryPath(workspaceRoot, options);

    await writeFile(filePath, JSON.stringify(summary, undefined, 2));

    return filePath;
};

/**
 * Reads the most-recent run summary written by {@link writeLastRunSummary}.
 * Returns `undefined` when no previous run has been recorded or the file
 * cannot be parsed — callers should render an informational message
 * instead of treating this as an error.
 */
const readLastRunSummary = async (workspaceRoot: string, options: RunSummaryPathOptions = {}): Promise<RunSummary | undefined> => {
    try {
        const content = await readFile(getLastRunSummaryPath(workspaceRoot, options), "utf8");

        return JSON.parse(content) as RunSummary;
    } catch {
        return undefined;
    }
};

export type { RunSummary, RunSummaryPathOptions, TaskSummary };
export { generateRunSummary, getLastRunSummaryPath, readLastRunSummary, writeLastRunSummary, writeRunSummary };
