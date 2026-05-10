import { Box } from "@visulima/tui/components/box";
import type { ScrollViewRef } from "@visulima/tui/components/scroll-view";
import { ScrollView } from "@visulima/tui/components/scroll-view";
import { Spinner } from "@visulima/tui/components/spinner";
import { Text } from "@visulima/tui/components/text";

import { formatMs } from "../pretty-time";
import { getStatusInfo, isCacheStatus } from "../status-utils";
import { DASH, ELLIPSIS } from "../symbols";
import type { TaskRowData } from "./task-row";

// ── Column widths (matching Nx constants) ───────────────────────────────

const STATUS_ICON_WIDTH = 6;
const CACHE_COLUMN_WIDTH = 8;
const DURATION_COLUMN_WIDTH = 12;

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

const getPinLabel = (taskId: string, pinnedTaskIds: [string | null, string | null]): string => {
    if (pinnedTaskIds[0] === taskId) {
        return "[1]";
    }

    if (pinnedTaskIds[1] === taskId) {
        return "[2]";
    }

    return "";
};

// ── Sub-components ──────────────────────────────────────────────────────

interface TaskListRowProps {
    compact?: boolean;
    focused: boolean;
    isSelected: boolean;
    pinLabel: string;
    row: TaskRowData;
}

const TaskListRow = ({ compact, focused, isSelected, pinLabel, row }: TaskListRowProps): React.JSX.Element => {
    const { persistent, status, taskId } = row;

    const isActiveRow = focused && isSelected;
    const selectChar = isActiveRow ? ">" : " ";
    const isPersistentRunning = status === "running" && persistent === true;

    let statusIcon: React.JSX.Element;

    if (isPersistentRunning) {
        statusIcon = (
            <Text bold color="green">
                {"  \u25CF  "}
            </Text>
        );
    } else if (status === "running") {
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

    if (isPersistentRunning) {
        durationText = "running";
    } else if (status !== "running" && status !== "pending") {
        durationText = row.duration === undefined ? DASH : formatMs(row.duration);
    } else if (status === "running" && row.elapsed !== undefined) {
        durationText = formatMs(row.elapsed);
    }

    return (
        <Box>
            <Text>{selectChar}</Text>
            <Box width={STATUS_ICON_WIDTH}>{statusIcon}</Box>
            <Box flexGrow={1}>
                <Text bold={isActiveRow} inverse={isActiveRow}>
                    {taskId}
                </Text>
                {pinLabel ? <Text dimColor>{` ${pinLabel}`}</Text> : null}
            </Box>
            {!compact && (
                <Box justifyContent="flex-end" width={CACHE_COLUMN_WIDTH}>
                    <Text dimColor={!isCacheStatus(status)}>{getCacheLabel(status)}</Text>
                </Box>
            )}
            {!compact && (
                <Box justifyContent="flex-end" width={DURATION_COLUMN_WIDTH}>
                    <Text color={isPersistentRunning ? "green" : undefined} dimColor={status === "pending" || isPersistentRunning}>
                        {durationText}
                    </Text>
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
    /** Number of parallel task slots to display at the bottom. */
    parallelSlots?: number;
    pinnedTaskIds: [string | null, string | null];
    rows: TaskRowData[];
    scrollRef: React.RefObject<ScrollViewRef | null>;
    selectedIndex: number;
    title: string;
}

const TaskListPanel = ({
    compact,
    filterActive,
    filterText,
    focused,
    headerStatus,
    parallelSlots = 3,
    pinnedTaskIds,
    rows,
    scrollRef,
    selectedIndex,
    title,
}: TaskListPanelProps): React.JSX.Element => {
    const borderColor = (() => {
        if (headerStatus === "error") {
            return "red";
        }

        if (headerStatus === "success") {
            return "green";
        }

        return focused ? "white" : "gray";
    })();

    const selectedTaskId = rows[selectedIndex]?.taskId;

    // All rows in original order in scrollable area (no reordering = no jumping)
    const runningRows: TaskRowData[] = [];
    let pendingCount = 0;

    for (const row of rows) {
        if (row.status === "running") {
            runningRows.push(row);
        } else if (row.status === "pending") {
            pendingCount += 1;
        }
    }

    // Cap displayed slots at the actual amount of in-flight work. Without
    // this, a single persistent task (e.g. `web:serve`) renders one row
    // here AND `parallelSlots - 1` "Waiting for task..." placeholders
    // that have nothing to fill them \u2014 pure visual noise that duplicates
    // the row already visible in the scroll list above.
    const slotCount = Math.min(parallelSlots, runningRows.length + pendingCount);
    // Only show the bottom panel when there's real contention \u2014 more
    // than one slot's worth of work, or anything pending. A lone running
    // task is already visible above; the panel just doubles it.
    const showParallelPanel = slotCount > 1;

    const parallelElements: React.JSX.Element[] = [];

    if (showParallelPanel) {
        for (let i = 0; i < slotCount; i++) {
            const row = runningRows[i];

            if (row) {
                parallelElements.push(
                    <TaskListRow
                        compact={compact}
                        focused={focused}
                        isSelected={row.taskId === selectedTaskId}
                        key={`par-${row.taskId}`}
                        pinLabel={getPinLabel(row.taskId, pinnedTaskIds)}
                        row={row}
                    />,
                );
            } else {
                parallelElements.push(
                    <Box key={`par-empty-${String(i)}`}>
                        <Text> </Text>
                        <Box width={STATUS_ICON_WIDTH}>
                            <Text bold color="gray">
                                {"  \u00B7  "}
                            </Text>
                        </Box>
                        <Text dimColor>Waiting for task...</Text>
                    </Box>,
                );
            }
        }
    }

    return (
        <Box borderColor={borderColor} borderStyle="single" flexDirection="column" flexGrow={1}>
            {/* Header */}
            <Box flexShrink={0} paddingX={1}>
                <Text bold inverse>
                    {" VIS "}
                </Text>
                <Text>{` ${title}`}</Text>
                {/* Column headers aligned right (hidden in compact/split mode) */}
                {!compact && (
                    <Box flexGrow={1} gap={0} justifyContent="flex-end">
                        <Box justifyContent="flex-end" width={CACHE_COLUMN_WIDTH}>
                            <Text dimColor>Cache</Text>
                        </Box>
                        <Box justifyContent="flex-end" width={DURATION_COLUMN_WIDTH}>
                            <Text dimColor>Duration</Text>
                        </Box>
                    </Box>
                )}
            </Box>

            {/* Scrollable completed task list */}
            <ScrollView flexGrow={1} flexShrink={1} paddingX={1} paddingY={1} ref={scrollRef} scrollbar scrollbarColor="gray" scrollbarStyle="block">
                {rows.map((row) => (
                    <TaskListRow
                        compact={compact}
                        focused={focused}
                        isSelected={row.taskId === selectedTaskId}
                        key={row.taskId}
                        pinLabel={getPinLabel(row.taskId, pinnedTaskIds)}
                        row={row}
                    />
                ))}
            </ScrollView>

            {/* Fixed parallel slots at bottom (only while tasks active) */}
            {showParallelPanel && (
                <Box
                    borderBottom={false}
                    borderColor="gray"
                    borderLeft={false}
                    borderRight={false}
                    borderStyle="single"
                    borderTop
                    flexDirection="column"
                    flexShrink={0}
                    paddingX={1}
                    paddingY={1}
                >
                    {parallelElements}
                </Box>
            )}

            {/* Filter bar */}
            {filterActive && (
                <Box borderBottom={false} borderColor="gray" borderLeft={false} borderRight={false} borderStyle="single" borderTop flexShrink={0} paddingX={1}>
                    <Text bold color="white">
                        {"/ "}
                    </Text>
                    <Text>{filterText}</Text>
                    <Text inverse> </Text>
                </Box>
            )}
        </Box>
    );
};

export default TaskListPanel;
