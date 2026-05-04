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
    pinnedTaskIds[0] === taskId ? "[1]" : pinnedTaskIds[1] === taskId ? "[2]" : "";

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
                    <Text dimColor={!isCacheStatus(status)}>{getCacheLabel(status)}</Text>
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
    const runningRows = rows.filter((r) => r.status === "running");
    const hasActiveWork = runningRows.length > 0 || rows.some((r) => r.status === "pending");

    // Build parallel section slots
    const parallelElements: React.JSX.Element[] = [];

    if (hasActiveWork) {
        for (let i = 0; i < parallelSlots; i++) {
            const row = runningRows[i];

            if (row) {
                parallelElements.push(
                    <TaskListRow
                        compact={compact}
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
            <Box flexShrink={0} gap={1} paddingX={1}>
                <Text bold inverse>
                    {" VIS "}
                </Text>
                <Text>{title}</Text>
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
            <ScrollView flexGrow={1} flexShrink={1} paddingLeft={1} paddingY={1} ref={scrollRef} scrollbar scrollbarColor="gray" scrollbarStyle="block">
                {rows.map((row) => (
                    <TaskListRow
                        compact={compact}
                        isSelected={row.taskId === selectedTaskId}
                        key={row.taskId}
                        pinLabel={getPinLabel(row.taskId, pinnedTaskIds)}
                        row={row}
                    />
                ))}
            </ScrollView>

            {/* Fixed parallel slots at bottom (only while tasks active) */}
            {hasActiveWork && (
                <Box
                    borderBottom={false}
                    borderColor="gray"
                    borderLeft={false}
                    borderRight={false}
                    borderStyle="single"
                    borderTop
                    flexDirection="column"
                    flexShrink={0}
                    paddingLeft={1}
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
