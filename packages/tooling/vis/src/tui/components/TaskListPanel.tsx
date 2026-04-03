import type { TaskStatus } from "@visulima/task-runner";
import type { ScrollViewRef } from "@visulima/tui";
import { Box, ScrollView, Spinner, Text } from "@visulima/tui";

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
    (pinnedTaskIds[0] === taskId ? "[1]" : pinnedTaskIds[1] === taskId ? "[2]" : "");

// ── Sub-components ──────────────────────────────────────────────────────

interface TaskListRowProps {
    compact?: boolean;
    isSelected: boolean;
    pinLabel: string;
    row: TaskRowData;
}

const TaskListRow = ({ compact, isSelected, pinLabel, row }: TaskListRowProps): React.JSX.Element => {
    const { status, taskId } = row;

    const selectChar = isSelected ? ">" : " ";

    let statusIcon: React.JSX.Element;

    if (status === "running") {
        statusIcon = (
            <Text bold color="white">
                {"  "}
                <Spinner type="dots" />
                {"  "}
            </Text>
        );
    } else if (status === "pending") {
        statusIcon = (
            <Text bold color="gray">
                {"  \u00B7  "}
            </Text>
        );
    } else {
        const { color, icon } = getStatusInfo(status);

        statusIcon = (
            <Text bold color={color}>
                {"  "}
                {icon}
                {"  "}
            </Text>
        );
    }

    let durationText = ELLIPSIS;

    if (status !== "running" && status !== "pending") {
        durationText = row.duration === undefined ? DASH : formatMs(row.duration);
    } else if (status === "running" && row.elapsed !== undefined) {
        durationText = formatMs(row.elapsed);
    }

    return (
        <Box>
            <Text>{selectChar}</Text>
            <Box width={STATUS_ICON_WIDTH}>{statusIcon}</Box>
            <Box flexGrow={1}>
                <Text bold={isSelected} inverse={isSelected}>
                    {taskId}
                </Text>
                {pinLabel ? <Text dimColor>{` ${pinLabel}`}</Text> : null}
            </Box>
            {!compact && (
                <Box justifyContent="flex-end" width={CACHE_COLUMN_WIDTH}>
                    <Text dimColor={!isCacheStatus(status as TaskStatus)}>{getCacheLabel(status)}</Text>
                </Box>
            )}
            {!compact && (
                <Box justifyContent="flex-end" width={DURATION_COLUMN_WIDTH}>
                    <Text dimColor={status === "pending"}>{durationText}</Text>
                </Box>
            )}
        </Box>
    );
};

// ── Main Component ──────────────────────────────────────────────────────

interface TaskListPanelProps {
    /** Hide Cache + Duration columns (used in split view where output panel shows them). */
    compact?: boolean;
    filterActive: boolean;
    filterText: string;
    focused: boolean;
    headerStatus: "error" | "running" | "success";
    pinnedTaskIds: [string | null, string | null];
    rows: TaskRowData[];
    scrollRef: React.RefObject<ScrollViewRef>;
    selectedIndex: number;
    title: string;
}

const TaskListPanel = ({
    compact,
    filterActive,
    filterText,
    focused,
    headerStatus,
    pinnedTaskIds,
    rows,
    scrollRef,
    selectedIndex,
    title,
}: TaskListPanelProps): React.JSX.Element => {
    const borderColor = (() => {
        if (headerStatus === "error") return "red";
        if (headerStatus === "success") return "green";
        return focused ? "white" : "gray";
    })();

    const selectedTaskId = rows[selectedIndex]?.taskId;

    // Single flat list: running tasks first, then completed, then pending
    const sorted = [
        ...rows.filter((r) => r.status === "running"),
        ...rows.filter((r) => r.status !== "pending" && r.status !== "running"),
        ...rows.filter((r) => r.status === "pending"),
    ];

    return (
        <Box borderColor={borderColor} borderStyle="single" flexDirection="column" flexGrow={1}>
            {/* Header */}
            <Box gap={1} paddingX={1} flexShrink={0}>
                <Text bold inverse>
                    {" VIS "}
                </Text>
                <Text>{title}</Text>
                {/* Column headers aligned right (hidden in compact/split mode) */}
                {!compact && (
                    <Box flexGrow={1} justifyContent="flex-end" gap={0}>
                        <Box justifyContent="flex-end" width={CACHE_COLUMN_WIDTH}>
                            <Text dimColor>Cache</Text>
                        </Box>
                        <Box justifyContent="flex-end" width={DURATION_COLUMN_WIDTH}>
                            <Text dimColor>Duration</Text>
                        </Box>
                    </Box>
                )}
            </Box>

            {/* Scrollable task list */}
            <ScrollView
                ref={scrollRef}
                flexGrow={1}
                flexShrink={1}
                paddingLeft={1}
                paddingY={1}
                scrollbar
                scrollbarColor="gray"
                scrollbarStyle="block"
            >
                {sorted.map((row) => (
                    <TaskListRow
                        compact={compact}
                        isSelected={row.taskId === selectedTaskId}
                        key={row.taskId}
                        pinLabel={getPinLabel(row.taskId, pinnedTaskIds)}
                        row={row}
                    />
                ))}
            </ScrollView>

            {/* Filter bar */}
            {filterActive && (
                <Box borderBottom={false} borderColor="gray" borderLeft={false} borderRight={false} borderStyle="single" borderTop flexShrink={0} paddingX={1}>
                    <Text color="white" bold>{"/ "}</Text>
                    <Text>{filterText}</Text>
                    <Text inverse> </Text>
                </Box>
            )}
        </Box>
    );
};

export default TaskListPanel;
