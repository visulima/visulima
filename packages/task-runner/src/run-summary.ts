import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type {
    Task,
    TaskHashDetails,
    TaskResult,
    TaskResults,
    TaskGraph,
} from "./types";

/**
 * Summary of a single task execution.
 */
export interface TaskSummary {
    /** The task ID (e.g., "app:build") */
    taskId: string;
    /** The task target */
    target: {
        project: string;
        target: string;
        configuration?: string;
    };
    /** The computed cache hash */
    hash: string | undefined;
    /** Detailed hash information */
    hashDetails: TaskHashDetails | undefined;
    /** The task's declared outputs */
    outputs: string[];
    /** Cache status (hit, miss, skipped) */
    cacheStatus: string;
    /** Exit code */
    exitCode: number | undefined;
    /** Start time (ISO 8601) */
    startTime: string | undefined;
    /** End time (ISO 8601) */
    endTime: string | undefined;
    /** Duration in milliseconds */
    duration: number | undefined;
    /** Dependencies on other tasks */
    dependencies: string[];
    /** Whether the task was cacheable */
    cacheable: boolean;
}

/**
 * Complete summary of a task runner execution.
 */
export interface RunSummary {
    /** Unique run ID */
    id: string;
    /** Run start time (ISO 8601) */
    startTime: string;
    /** Run end time (ISO 8601) */
    endTime: string;
    /** Total duration in milliseconds */
    duration: number;
    /** Summary of each task */
    tasks: TaskSummary[];
    /** Overall execution statistics */
    stats: {
        /** Total number of tasks */
        total: number;
        /** Number of successful tasks */
        succeeded: number;
        /** Number of failed tasks */
        failed: number;
        /** Number of cached tasks (local + remote) */
        cached: number;
        /** Number of skipped tasks */
        skipped: number;
    };
    /** The task graph used for this run */
    taskGraph: {
        roots: string[];
        dependencies: Record<string, string[]>;
    };
    /** Environment info */
    environment: {
        /** Node.js version */
        nodeVersion: string;
        /** Platform */
        platform: string;
        /** Architecture */
        arch: string;
    };
}

/**
 * Generates a run summary from task results.
 */
export const generateRunSummary = (
    results: TaskResults,
    taskGraph: TaskGraph,
    startTime: number,
): RunSummary => {
    const endTime = Date.now();
    const id = `${new Date(startTime).toISOString().replace(/[:.]/g, "-")}_${Math.random().toString(36).slice(2, 8)}`;

    const tasks: TaskSummary[] = [];
    let succeeded = 0;
    let failed = 0;
    let cached = 0;
    let skipped = 0;

    for (const [taskId, result] of results) {
        const taskDeps = taskGraph.dependencies[taskId] ?? [];

        const summary: TaskSummary = {
            taskId,
            target: {
                project: result.task.target.project,
                target: result.task.target.target,
                configuration: result.task.target.configuration,
            },
            hash: result.task.hash,
            hashDetails: result.task.hashDetails,
            outputs: result.task.outputs,
            cacheStatus: getCacheStatus(result),
            exitCode: result.code,
            startTime: result.startTime ? new Date(result.startTime).toISOString() : undefined,
            endTime: result.endTime ? new Date(result.endTime).toISOString() : undefined,
            duration: result.startTime && result.endTime
                ? result.endTime - result.startTime
                : undefined,
            dependencies: taskDeps,
            cacheable: result.task.cache !== false,
        };

        tasks.push(summary);

        switch (result.status) {
            case "success": {
                succeeded++;
                break;
            }

            case "failure": {
                failed++;
                break;
            }

            case "local-cache":
            case "local-cache-kept-existing":
            case "remote-cache": {
                cached++;
                break;
            }

            case "skipped": {
                skipped++;
                break;
            }
        }
    }

    // Sort tasks by start time for readability
    tasks.sort((a, b) => {
        if (!a.startTime || !b.startTime) {
            return 0;
        }

        return a.startTime.localeCompare(b.startTime);
    });

    return {
        id,
        startTime: new Date(startTime).toISOString(),
        endTime: new Date(endTime).toISOString(),
        duration: endTime - startTime,
        tasks,
        stats: {
            total: results.size,
            succeeded,
            failed,
            cached,
            skipped,
        },
        taskGraph: {
            roots: taskGraph.roots,
            dependencies: taskGraph.dependencies,
        },
        environment: {
            nodeVersion: process.version,
            platform: process.platform,
            arch: process.arch,
        },
    };
};

/**
 * Writes the run summary to a JSON file in the `.task-runner/runs/` directory.
 *
 * @param summary - The run summary to write
 * @param workspaceRoot - The workspace root directory
 * @returns The path to the written summary file
 */
export const writeRunSummary = async (
    summary: RunSummary,
    workspaceRoot: string,
): Promise<string> => {
    const runsDir = join(workspaceRoot, ".task-runner", "runs");

    await mkdir(runsDir, { recursive: true });

    const filename = `${summary.id}.json`;
    const filePath = join(runsDir, filename);

    await writeFile(filePath, JSON.stringify(summary, null, 2));

    return filePath;
};

/**
 * Returns a human-readable cache status string.
 */
const getCacheStatus = (result: TaskResult): string => {
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
