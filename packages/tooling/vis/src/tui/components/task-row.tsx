import type { TaskStatus } from "@visulima/task-runner";
import { Box } from "@visulima/tui/components/box";
import { Spinner } from "@visulima/tui/components/spinner";
import { Text } from "@visulima/tui/components/text";

import { formatMs } from "../pretty-time";
import { isCacheStatus } from "../status-utils";
import { CROSS, DASH, ELLIPSIS, TICK } from "../symbols";

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

interface TaskRowProps {
    row: TaskRowData;
}

const TaskRow = ({ row }: TaskRowProps): React.JSX.Element => {
    const { status, taskId } = row;

    if (status === "running") {
        const ms = row.elapsed ?? 0;

        return (
            <Box>
                <Box width={3}>
                    <Text color="white">
                        <Spinner type="dots" />
                    </Text>
                </Box>
                <Box flexGrow={1}>
                    <Text>{taskId}</Text>
                </Box>
                <Box justifyContent="flex-end" width={7}>
                    <Text dimColor>{ELLIPSIS}</Text>
                </Box>
                <Box justifyContent="flex-end" width={14}>
                    <Text>{formatMs(ms)}</Text>
                </Box>
            </Box>
        );
    }

    if (status === "pending") {
        return (
            <Box>
                <Box width={3}>
                    <Text bold color="white">
                        {">"}
{" "}
                    </Text>
                    <Text dimColor>.</Text>
                </Box>
                <Box flexGrow={1}>
                    <Text>{taskId}</Text>
                </Box>
                <Box justifyContent="flex-end" width={7}>
                    <Text dimColor>{DASH}</Text>
                </Box>
                <Box justifyContent="flex-end" width={14}>
                    <Text dimColor>{ELLIPSIS}</Text>
                </Box>
            </Box>
        );
    }

    // Completed states: success, failure, cache, skipped
    const icon = status === "failure" ? <Text color="red">{CROSS}</Text> : <Text color="green">{TICK}</Text>;
    const dur = row.duration === undefined ? DASH : formatMs(row.duration);
    // Retry badge takes priority over the cache slot — a cached task can't
    // also be retried (cache hits skip the executor entirely), so the slot
    // is free to advertise the flake.
    const retried = row.retryAttempts && row.retryAttempts > 0;
    const cache = retried
        ? <Text color="yellow">{`↻${row.retryAttempts}x`}</Text>
        : isCacheStatus(status) ? <Text dimColor>cached</Text> : <Text dimColor>{DASH}</Text>;

    return (
        <Box>
            <Box width={3}>{icon}</Box>
            <Box flexGrow={1}>
                <Text>{taskId}</Text>
            </Box>
            <Box justifyContent="flex-end" width={7}>
                {cache}
            </Box>
            <Box justifyContent="flex-end" width={14}>
                <Text>{dur}</Text>
            </Box>
        </Box>
    );
};

export default TaskRow;
