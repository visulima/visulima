import type { TaskStatus } from "@visulima/task-runner";

export interface TaskRowData {
    duration?: number;
    elapsed?: number;
    /** True for long-running tasks (dev/serve/watch). Rendered like a ready service: green dot + "running". */
    persistent?: boolean;

    /**
     * Number of times the restart controller restarted the task before it
     * produced this final status. `undefined` (or `0`) means it passed/failed
     * on the first attempt; `> 0` flags this row as "succeeded after retry"
     * (or "failed after exhausting retries") so the renderer can warn even
     * when the final status is `success`.
     */
    retryAttempts?: number;
    status: "pending" | "running" | TaskStatus;
    taskId: string;
}
