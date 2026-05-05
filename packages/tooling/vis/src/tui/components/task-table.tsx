import { Box, StaticRender, Text } from "@visulima/tui";

import { ELLIPSIS } from "../symbols";
import type { TaskRowData } from "./task-row";
import TaskRow from "./task-row";

interface TaskTableProps {
    parallelSlots?: number;
    rows: TaskRowData[];
    totalCompleted: number;
    totalRows: number;
}

/**
 * Renders the live task table: running tasks with spinners,
 * completed tasks with status icons, and a pending task preview.
 */
const TaskTable = ({ parallelSlots, rows, totalCompleted, totalRows }: TaskTableProps): React.JSX.Element => {
    const running = rows.filter((r) => r.status === "running");
    const done = rows.filter((r) => r.status !== "pending" && r.status !== "running");
    const pending = rows.filter((r) => r.status === "pending");

    // Calculate padding rows to prevent layout jumping
    const paddingCount =
        totalCompleted !== totalRows && parallelSlots !== undefined ? Math.max(0, Math.min(parallelSlots, totalRows - totalCompleted) - running.length) : 0;

    return (
        <Box flexDirection="column">
            {/* Table header */}
            <StaticRender>
                {() => (
                    <Box>
                        <Box width={3} />
                        <Box flexGrow={1} />
                        <Box justifyContent="flex-end" width={7}>
                            <Text bold>Cache</Text>
                        </Box>
                        <Box justifyContent="flex-end" width={14}>
                            <Text bold>Duration</Text>
                        </Box>
                    </Box>
                )}
            </StaticRender>

            {/* Running tasks */}
            {running.map((r) => (
                <TaskRow key={r.taskId} row={r} />
            ))}

            {/* Padding rows */}
            {Array.from({ length: paddingCount }, (_, i) => (
                <Box key={`pad-${String(i)}`}>
                    <Text> </Text>
                </Box>
            ))}

            {/* Completed tasks */}
            {done.map((r) => (
                <TaskRow key={r.taskId} row={r} />
            ))}

            {/* Next pending task */}
            {pending.length > 0 && <TaskRow row={pending[0]!} />}

            {/* Remaining pending count */}
            {pending.length > 1 && (
                <Box>
                    <Box width={3} />
                    <Text dimColor>
                        {ELLIPSIS} {pending.length - 1} more
                    </Text>
                </Box>
            )}
        </Box>
    );
};

export default TaskTable;
