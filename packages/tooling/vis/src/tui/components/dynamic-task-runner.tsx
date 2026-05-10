import type { Task } from "@visulima/task-runner";
import { useSyncExternalStore } from "react";

import { formatMs } from "../pretty-time";
import CommandSummary from "./command-summary";
import type { TaskRowData } from "./task-row";
import type { TaskStore } from "./task-store";
import TaskTable from "./task-table";

// Re-export for backwards compatibility
export { type TaskState, TaskStore } from "./task-store";

interface DynamicTaskRunnerProps {
    parallelSlots?: number;
    projectNames: string[];
    store: TaskStore;
    targets: string[];
    tasks: Task[];
}

const DynamicTaskRunner = ({ parallelSlots, projectNames, store, targets, tasks }: DynamicTaskRunnerProps): React.JSX.Element => {
    const state = useSyncExternalStore(store.subscribe, store.getSnapshot);

    if (state.done) {
        const took = formatMs(Date.now() - state.startTime);
        const failedIds: string[] = [];

        for (const row of state.rows as TaskRowData[]) {
            if (row.status === "failure") {
                failedIds.push(row.taskId);
            }
        }

        return (
            <CommandSummary
                cached={state.cached}
                failed={state.failed}
                failedIds={failedIds}
                projectNames={projectNames}
                retriedIds={state.retriedIds.length > 0 ? state.retriedIds : undefined}
                succeeded={state.succeeded}
                targets={targets}
                tasks={tasks}
                took={took}
            />
        );
    }

    return <TaskTable parallelSlots={parallelSlots} rows={state.rows} totalCompleted={state.completed} totalRows={state.rows.length} />;
};

export default DynamicTaskRunner;
