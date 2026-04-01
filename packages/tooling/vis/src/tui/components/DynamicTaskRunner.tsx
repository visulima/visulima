import type { Task } from "@visulima/task-runner";
import { useSyncExternalStore } from "react";

import { formatMs } from "../pretty-time";
import CommandSummary from "./CommandSummary";
import type { TaskRowData } from "./TaskRow";
import { TaskStore } from "./TaskStore";
import TaskTable from "./TaskTable";

// Re-export for backwards compatibility
export { TaskStore, type TaskState } from "./TaskStore";

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
        const failedIds = state.rows.filter((r: TaskRowData) => r.status === "failure").map((r: TaskRowData) => r.taskId);

        return (
            <CommandSummary
                cached={state.cached}
                failed={state.failed}
                failedIds={failedIds}
                projectNames={projectNames}
                succeeded={state.succeeded}
                targets={targets}
                tasks={tasks}
                took={took}
            />
        );
    }

    return (
        <TaskTable
            parallelSlots={parallelSlots}
            rows={state.rows}
            totalCompleted={state.completed}
            totalRows={state.rows.length}
        />
    );
};

export default DynamicTaskRunner;
