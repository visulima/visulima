import { Box, Spinner, Text } from "@visulima/tui";
import type { TaskStatus } from "@visulima/task-runner";

import { formatMs } from "../pretty-time";
import { getStatusInfo, isCacheStatus } from "../status-utils";
import { DASH, ELLIPSIS } from "../symbols";
import type { TaskRowData } from "./TaskRow";

// ── Column widths (matching Nx constants) ───────────────────────────────

const STATUS_ICON_WIDTH = 6;
const CACHE_COLUMN_WIDTH = 8;
const DURATION_COLUMN_WIDTH = 10;

// ── Helpers ─────────────────────────────────────────────────────────────

const getCacheLabel = (status: TaskRowData["status"]): string => {
    if (status === "running" || status === "pending") {
        return ELLIPSIS;
    }

    if (status === "local-cache" || status === "local-cache-kept-existing") {
        return "Local";
    }

    if (status === "remote-cache") {
        return "Remote";
    }

    return DASH;
};

const getPinLabel = (taskId: string, pinnedTaskIds: [string | null, string | null]): string =>
    pinnedTaskIds[0] === taskId ? "[1]" : pinnedTaskIds[1] === taskId ? "[2]" : "";

// ── Sub-components ──────────────────────────────────────────────────────

interface TaskListRowProps {
    isSelected: boolean;
    parallelConnector: boolean;
    pinLabel: string;
    row: TaskRowData;
}

const TaskListRow = ({ isSelected, parallelConnector, pinLabel, row }: TaskListRowProps): React.JSX.Element => {
    const { status, taskId } = row;

    const selectChar = isSelected ? ">" : " ";

    // Fixed width to prevent alignment drift
    const connector = (
        <Box width={1}>
            <Text color={parallelConnector ? "cyan" : undefined}>{parallelConnector ? "\u2502" : " "}</Text>
        </Box>
    );

    let statusIcon: React.JSX.Element;

    if (status === "running") {
        statusIcon = (
            <Text color="cyan" bold>
                {"  "}
                <Spinner type="dots" />
                {"  "}
            </Text>
        );
    } else if (status === "pending") {
        statusIcon = <Text color="gray" bold>{"  \u00B7  "}</Text>;
    } else {
        const { color, icon } = getStatusInfo(status as TaskStatus);

        statusIcon = <Text color={color} bold>{"  "}{icon}{"  "}</Text>;
    }

    let durationText = ELLIPSIS;

    if (status !== "running" && status !== "pending") {
        durationText = row.duration !== undefined ? formatMs(row.duration) : DASH;
    } else if (status === "running" && row.elapsed !== undefined) {
        durationText = formatMs(row.elapsed);
    }

    return (
        <Box>
            <Text>{selectChar}</Text>
            {connector}
            <Box width={STATUS_ICON_WIDTH}>{statusIcon}</Box>
            <Box flexGrow={1}>
                <Text bold={isSelected} inverse={isSelected}>
                    {taskId}
                </Text>
                {pinLabel ? <Text dimColor>{` ${pinLabel}`}</Text> : null}
            </Box>
            <Box width={CACHE_COLUMN_WIDTH} justifyContent="flex-end">
                <Text dimColor={!isCacheStatus(status as TaskStatus)}>{getCacheLabel(status)}</Text>
            </Box>
            <Box width={DURATION_COLUMN_WIDTH} justifyContent="flex-end">
                <Text dimColor={status === "pending"}>{durationText}</Text>
            </Box>
        </Box>
    );
};

// ── Main Component ──────────────────────────────────────────────────────

interface TaskListPanelProps {
    filterActive: boolean;
    filterText: string;
    focused: boolean;
    headerStatus: "error" | "running" | "success";
    parallelSlots: number;
    pinnedTaskIds: [string | null, string | null];
    rows: TaskRowData[];
    selectedIndex: number;
    title: string;
}

const TaskListPanel = ({
    filterActive,
    filterText,
    focused,
    headerStatus,
    parallelSlots,
    pinnedTaskIds,
    rows,
    selectedIndex,
    title,
}: TaskListPanelProps): React.JSX.Element => {
    const borderColor = focused ? "cyan" : "gray";

    // Rows are already filtered by the parent — use directly
    const running = rows.filter((r) => r.status === "running");
    const completed = rows.filter((r) => r.status !== "pending" && r.status !== "running");
    const pending = rows.filter((r) => r.status === "pending");

    const badgeColor = headerStatus === "error" ? "red" : headerStatus === "success" ? "green" : "cyan";
    const selectedTaskId = rows[selectedIndex]?.taskId;

    // Parallel section — only while tasks are still active
    const hasActiveWork = running.length > 0 || pending.length > 0;
    const parallelRows: React.JSX.Element[] = [];

    for (let i = 0; i < (hasActiveWork ? parallelSlots : 0); i++) {
        const row = running[i];
        const isLast = i === parallelSlots - 1;
        const connector = !isLast;

        if (row) {
            parallelRows.push(
                <TaskListRow
                    key={`par-${String(i)}`}
                    isSelected={row.taskId === selectedTaskId}
                    parallelConnector={connector}
                    pinLabel={getPinLabel(row.taskId, pinnedTaskIds)}
                    row={row}
                />,
            );
        } else {
            parallelRows.push(
                <Box key={`par-empty-${String(i)}`}>
                    <Text>{" "}</Text>
                    <Box width={1}>
                        <Text color={connector ? "cyan" : undefined}>{connector ? "\u2502" : " "}</Text>
                    </Box>
                    <Box width={STATUS_ICON_WIDTH}>
                        <Text>{" "}</Text>
                    </Box>
                    <Text dimColor>Waiting for task...</Text>
                </Box>,
            );
        }
    }

    const hasParallelSection = parallelSlots > 0 && hasActiveWork;

    // Completed + pending rows (merged into single loop)
    const listRows = [...completed, ...pending].map((row) => (
        <TaskListRow
            key={row.taskId}
            isSelected={row.taskId === selectedTaskId}
            parallelConnector={false}
            pinLabel={getPinLabel(row.taskId, pinnedTaskIds)}
            row={row}
        />
    ));

    return (
        <Box borderColor={borderColor} borderStyle="single" flexDirection="column" flexGrow={1}>
            <Box paddingX={1} gap={1}>
                <Text bold inverse color={badgeColor}>
                    {" VIS "}
                </Text>
                <Text>{title}</Text>
            </Box>

            {hasParallelSection && (
                <Box flexDirection="column" paddingLeft={1}>
                    {parallelRows}
                    <Box>
                        <Text>{" "}</Text>
                        <Box width={1}>
                            <Text color="cyan">{"\u2514"}</Text>
                        </Box>
                    </Box>
                </Box>
            )}

            <Box flexDirection="column" flexGrow={1} overflow="hidden" paddingLeft={1}>
                {listRows}
            </Box>

            {filterActive && (
                <Box paddingX={1} borderStyle="single" borderColor="yellow" borderTop borderBottom={false} borderLeft={false} borderRight={false}>
                    <Text color="yellow">{"/  "}</Text>
                    <Text>{filterText}</Text>
                    <Text inverse>{" "}</Text>
                </Box>
            )}
        </Box>
    );
};

export default TaskListPanel;
