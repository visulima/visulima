import { mkdir, writeFile } from "node:fs/promises";
import { join } from "@visulima/path";

import type { TaskGraph, TaskHashDetails, TaskResult, TaskResults } from "./types";

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
    /** The task's declared outputs */
    outputs: string[];
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
    // eslint-disable-next-line sonarjs/pseudo-random
    const id = `${new Date(startTime).toISOString().replaceAll(/[:.]/g, "-")}_${Math.random().toString(36).slice(2, 8)}`;

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

/**
 * Writes the run summary to a JSON file in the `.task-runner/runs/` directory.
 * @param summary The run summary to write
 * @param workspaceRoot The workspace root directory
 * @returns The path to the written summary file
 */
const writeRunSummary = async (summary: RunSummary, workspaceRoot: string): Promise<string> => {
    const runsDirectory = join(workspaceRoot, ".task-runner", "runs");

    await mkdir(runsDirectory, { recursive: true });

    const filename = `${summary.id}.json`;
    const filePath = join(runsDirectory, filename);

    await writeFile(filePath, JSON.stringify(summary, undefined, 2));

    return filePath;
};

export type { RunSummary, TaskSummary };
export { generateRunSummary, writeRunSummary };
