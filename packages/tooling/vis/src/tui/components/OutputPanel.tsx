import { Box, ScrollView, Text } from "@visulima/tui";

import { getStatusInfo } from "../status-utils";
import type { TaskRowData } from "./TaskRow";

// Extended status info for non-TaskStatus states (running, pending)
const getDisplayInfo = (status: TaskRowData["status"]): { color: string; icon: string } => {
    if (status === "running") {
        return { color: "white", icon: "\u2022" };
    }

    if (status === "pending") {
        return { color: "gray", icon: "\u00B7" };
    }

    return getStatusInfo(status);
};

// ── Component ───────────────────────────────────────────────────────────

interface OutputPanelProps {
    focused: boolean;
    output: string;
    scrollRef?: React.RefObject<import("@visulima/tui").ScrollViewRef>;
    status: TaskRowData["status"] | undefined;
    taskId: string | null;
}

const OutputPanel = ({ focused, output, scrollRef, status, taskId }: OutputPanelProps): React.JSX.Element => {
    const statusValue = status ?? "pending";
    const { color: statusColor, icon: statusIcon } = getDisplayInfo(statusValue);

    const borderStyle = "single";
    const borderColor = focused ? "white" : "gray";

    const titleElement = taskId
        ? (
            <Box gap={1}>
                <Text color={statusColor}>
                    {statusIcon}
                </Text>
                <Text bold={focused} dimColor={!focused}>
                    {taskId}
                </Text>
            </Box>
        )
        : null;

    // Empty state
    if (!taskId) {
        return (
            <Box
                alignItems="center"
                borderColor="gray"
                borderStyle="single"
                flexDirection="column"
                flexGrow={1}
                justifyContent="center"
                paddingX={2}
                paddingY={1}
            >
                <Text dimColor>Select a task to view output</Text>
                <Text dimColor>Press Enter or 1/2 to pin</Text>
            </Box>
        );
    }

    // Split output into lines for scrolling
    const lines = output ? output.split("\n") : [];

    // Waiting state
    if (!output && (statusValue === "running" || statusValue === "pending")) {
        return (
            <Box borderColor={borderColor} borderStyle={borderStyle} flexDirection="column" flexGrow={1} paddingX={2} paddingY={1}>
                {titleElement}
                <Box alignItems="center" flexGrow={1} justifyContent="center">
                    <Text dimColor>Waiting for task output...</Text>
                </Box>
            </Box>
        );
    }

    return (
        <Box borderColor={borderColor} borderStyle={borderStyle} flexDirection="column" flexGrow={1}>
            {/* Title bar — fixed */}
            <Box flexShrink={0} paddingX={2} paddingTop={1}>
                {titleElement}
            </Box>

            {/* Output content — scrollable */}
            <ScrollView ref={scrollRef} flexGrow={1} flexShrink={1} followOutput paddingX={2} scrollbar scrollbarColor="gray">
                {lines.map((line, i) => (
                    <Text key={String(i)}>{line}</Text>
                ))}
            </ScrollView>
        </Box>
    );
};

export default OutputPanel;
