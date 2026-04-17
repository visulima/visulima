import type { ScrollViewRef } from "@visulima/tui";
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
    /** Whether interactive input mode is active (keystrokes forwarded to PTY). */
    interactiveMode?: boolean;
    output: string;
    scrollRef?: React.RefObject<ScrollViewRef>;
    /** Whether to show "&lt;enter> full screen" hint in bottom border. */
    showFullscreenHint?: boolean;
    status: TaskRowData["status"] | undefined;
    taskId: string | null;
}

const OutputPanel = ({ duration, focused, interactiveMode, output, scrollRef, showFullscreenHint, status, taskId }: OutputPanelProps): React.JSX.Element => {
    const statusValue = status ?? "pending";
    const { icon: statusIcon } = getDisplayInfo(statusValue);

    const borderStyle = focused ? "bold" : "single";
    const borderColor = (() => {
        if (statusValue === "failure") {
            return "red";
        }

        if (statusValue === "success" || isCacheStatus(statusValue)) {
            return focused ? "green" : "gray";
        }

        if (statusValue === "running") {
            return focused ? "white" : "cyan";
        }

        return focused ? "white" : "gray";
    })();

    // Build border title: "✓ task-name" on top-left (always short)
    const topTitle = taskId ? `${statusIcon}  ${taskId}` : undefined;

    // Duration on top-right
    const topRightTitle = duration === undefined ? undefined : formatMs(duration);

    // Bottom hint: context-dependent
    const bottomTitle = taskId
        ? interactiveMode
            ? "Esc cancel | Enter send"
            : focused && statusValue === "running" && showFullscreenHint
                ? "\u23CE FULLSCREEN  i INPUT"
                : focused && statusValue === "running"
                    ? "i INPUT"
                    : focused && showFullscreenHint
                        ? "<enter> full screen"
                        : focused
                            ? undefined
                            : "<tab> or <enter> to focus"
        : undefined;

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
    const lines = output ? output.split("\n").map((l) => l.replace(/\r$/, "")) : [];

    // Waiting state
    if (!output && (statusValue === "running" || statusValue === "pending")) {
        return (
            <Box
                borderBottomTitle={bottomTitle}
                borderColor={borderColor}
                borderStyle={borderStyle}
                borderTopRightTitle={topRightTitle}
                borderTopTitle={topTitle}
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
            borderBottomTitle={bottomTitle}
            borderColor={interactiveMode ? "yellow" : borderColor}
            borderStyle={borderStyle}
            borderTopRightTitle={topRightTitle}
            borderTopTitle={topTitle}
            flexDirection="column"
            flexGrow={1}
        >
            {/* Output content — scrollable */}
            <Box flexGrow={1} flexShrink={1} paddingY={1}>
                <ScrollView flexGrow={1} followOutput paddingX={2} ref={scrollRef} scrollbar scrollbarColor="gray" scrollbarStyle="block">
                    {lines.map((line, i) => (
                        <Text key={String(i)}>{line}</Text>
                    ))}
                </ScrollView>
            </Box>
            {/* Interactive mode indicator — keystrokes are forwarded to the PTY */}
            {interactiveMode && (
                <Box flexShrink={0} justifyContent="center" paddingX={1}>
                    <Text bold color="yellow">
                        INTERACTIVE — keystrokes forwarded to task — Esc to exit
                    </Text>
                </Box>
            )}
        </Box>
    );
};

export default OutputPanel;
