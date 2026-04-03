import { Box, ScrollView, Text } from "@visulima/tui";

import { formatMs } from "../pretty-time";
import { getStatusInfo, isCacheStatus } from "../status-utils";
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
    /** Duration in ms (for top-right border display). */
    duration?: number;
    focused: boolean;
    output: string;
    scrollRef?: React.RefObject<import("@visulima/tui").ScrollViewRef>;
    /** Whether to show "<enter> full screen" hint in bottom border. */
    showFullscreenHint?: boolean;
    status: TaskRowData["status"] | undefined;
    taskId: string | null;
}

const OutputPanel = ({ duration, focused, output, scrollRef, showFullscreenHint, status, taskId }: OutputPanelProps): React.JSX.Element => {
    const statusValue = status ?? "pending";
    const { icon: statusIcon } = getDisplayInfo(statusValue);

    const borderStyle = "single";
    const borderColor = (() => {
        if (statusValue === "failure") return "red";
        if (statusValue === "success" || isCacheStatus(statusValue)) return "green";
        if (statusValue === "running") return focused ? "white" : "cyan";
        return focused ? "white" : "gray";
    })();

    // Build border title: "✓ task-name" on top-left
    const topTitle = taskId ? `${statusIcon}  ${taskId}` : undefined;

    // Duration on top-right
    const topRightTitle = duration !== undefined ? formatMs(duration) : undefined;

    // Bottom hint
    const bottomTitle = showFullscreenHint ? "<enter> full screen" : undefined;

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
            <Box
                borderColor={borderColor}
                borderStyle={borderStyle}
                borderTopTitle={topTitle}
                borderTopRightTitle={topRightTitle}
                borderBottomTitle={bottomTitle}
                flexDirection="column"
                flexGrow={1}
                paddingX={2}
                paddingY={1}
            >
                <Box alignItems="center" flexGrow={1} justifyContent="center">
                    <Text dimColor>Waiting for task output...</Text>
                </Box>
            </Box>
        );
    }

    return (
        <Box
            borderColor={borderColor}
            borderStyle={borderStyle}
            borderTopTitle={topTitle}
            borderTopRightTitle={topRightTitle}
            borderBottomTitle={bottomTitle}
            flexDirection="column"
            flexGrow={1}
        >
            {/* Output content — scrollable */}
            <ScrollView ref={scrollRef} flexGrow={1} flexShrink={1} followOutput paddingX={2} scrollbar scrollbarColor="gray" scrollbarStyle="block">
                {lines.map((line, i) => (
                    <Text key={String(i)}>{line}</Text>
                ))}
            </ScrollView>
        </Box>
    );
};

export default OutputPanel;
