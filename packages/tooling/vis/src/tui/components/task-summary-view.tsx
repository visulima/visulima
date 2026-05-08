import type { TaskStatus } from "@visulima/task-runner";
import { Box } from "@visulima/tui/components/box";
import { StaticRender } from "@visulima/tui/components/static-render";
import { Text } from "@visulima/tui/components/text";

import { formatMs } from "../pretty-time";
import { getStatusIcon, isCacheStatus } from "../status-utils";
import { DASH } from "../symbols";

interface TaskSummaryEntry {
    elapsed?: number;
    status?: TaskStatus;
    taskId: string;
}

interface TaskSummaryViewProps {
    entries: TaskSummaryEntry[];
}

/**
 * Renders the task summary table at the end of execution.
 * Entries should already be sorted by status order.
 */
const TaskSummaryView = ({ entries }: TaskSummaryViewProps): React.JSX.Element => {
    const width = process.stdout.columns || 80;
    const separator = DASH.repeat(width);

    return (
        <StaticRender>
            {() => (
                <Box flexDirection="column">
                    <Text dimColor>{separator}</Text>
                    <Text bold> Task Summary</Text>
                    <Text dimColor>{separator}</Text>
                    <Text />
                    {entries.map((entry) => {
                        const icon = entry.status ? getStatusIcon(entry.status) : "?";
                        const elapsed = entry.elapsed === undefined ? "" : ` ${formatMs(entry.elapsed)}`;
                        const cacheLabel = entry.status && isCacheStatus(entry.status) ? " [cache]" : "";

                        return (
                            <Text key={entry.taskId}>
                                {"  "}
                                {icon}
                                {"  "}
                                {entry.taskId}
                                {cacheLabel ? <Text dimColor>{cacheLabel}</Text> : null}
                                {elapsed ? <Text dimColor>{elapsed}</Text> : null}
                            </Text>
                        );
                    })}
                    <Text />
                </Box>
            )}
        </StaticRender>
    );
};

export default TaskSummaryView;
