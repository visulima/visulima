import { Box } from "@visulima/tui/components/box";
import { Text } from "@visulima/tui/components/text";
import type { ScrollViewRef } from "@visulima/tui-kit/scroll-view";
import { ScrollView } from "@visulima/tui-kit/scroll-view";

import { formatMs } from "../pretty-time";
import { getStatusInfo, isCacheStatus } from "../status-utils";
import type { TaskRowData } from "./task-row";

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

export interface DeriveBottomTitleInput {
    autoScroll: boolean;
    focused: boolean;
    interactiveMode: boolean;
    showFullscreenHint: boolean;
    statusValue: TaskRowData["status"];
    supportsInteractive: boolean;
    taskId: string | null;
}

/**
 * Pure derivation of the panel's bottom-border hint. Extracted so the
 * keyboard-discoverable surface (`f FOLLOW`, `PAUSED`, `i INPUT`) can be
 * unit-tested without mounting the component.
 */
export const deriveBottomTitle = ({
    autoScroll,
    focused,
    interactiveMode,
    showFullscreenHint,
    statusValue,
    supportsInteractive,
    taskId,
}: DeriveBottomTitleInput): string | undefined => {
    if (!taskId) {
        return undefined;
    }

    if (interactiveMode) {
        return "Esc cancel | Enter send";
    }

    const followHint = autoScroll ? "" : "  PAUSED (f resume)";
    const inputHint = supportsInteractive ? "  i INPUT" : "";

    if (focused && statusValue === "running" && showFullscreenHint) {
        return `\u23CE FULLSCREEN${inputHint}  f FOLLOW${followHint}`;
    }

    if (focused && statusValue === "running") {
        return `f FOLLOW${inputHint}${followHint}`;
    }

    if (focused && showFullscreenHint) {
        return `<enter> full screen${followHint}`;
    }

    if (focused) {
        return followHint || undefined;
    }

    return "<tab> or <enter> to focus";
};

interface OutputPanelProps {
    /** Auto-follow output as new lines arrive. Defaults to true. */
    autoScroll?: boolean;
    /** Duration in ms (for top-right border display). */
    duration?: number;
    focused: boolean;
    /** Whether interactive input mode is active (keystrokes forwarded to PTY). */
    interactiveMode?: boolean;
    output: string;
    scrollRef?: React.RefObject<ScrollViewRef | null>;
    /** Whether to show "&lt;enter> full screen" hint in bottom border. */
    showFullscreenHint?: boolean;
    status: TaskRowData["status"] | undefined;

    /**
     * Whether the rendered stream supports `i` interactive input.
     * False for service log views (no PTY behind them). Defaults to true.
     */
    supportsInteractive?: boolean;
    taskId: string | null;
}

const OutputPanel = ({
    autoScroll = true,
    duration,
    focused,
    interactiveMode,
    output,
    scrollRef,
    showFullscreenHint,
    status,
    supportsInteractive = true,
    taskId,
}: OutputPanelProps): React.JSX.Element => {
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
    const topTitle = taskId ? `${statusIcon} ${taskId}` : undefined;

    // Duration on top-right
    const topRightTitle = duration === undefined ? undefined : formatMs(duration);

    const bottomTitle = deriveBottomTitle({
        autoScroll,
        focused,
        interactiveMode: interactiveMode ?? false,
        showFullscreenHint: showFullscreenHint ?? false,
        statusValue,
        supportsInteractive,
        taskId,
    });

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
    const lines: string[] = [];

    if (output) {
        for (const segment of output.split("\n")) {
            lines.push(segment.endsWith("\r") ? segment.slice(0, -1) : segment);
        }
    }

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
                    <Text dimColor>Waiting for task output…</Text>
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
            {/* Output content (scrollable). Rendered as a single Text
                node so we don't need per-line keys: log content is
                append-only and any content/index-based key would either
                collide on duplicate blank lines or be a synthetic stable
                id with no semantic meaning. ScrollView measures the
                resulting block as N lines for follow/scrollbar purposes. */}
            <Box flexGrow={1} flexShrink={1} paddingY={1}>
                <ScrollView flexGrow={1} followOutput={autoScroll} paddingX={2} ref={scrollRef} scrollbar scrollbarColor="gray" scrollbarStyle="block">
                    <Text>{lines.join("\n")}</Text>
                </ScrollView>
            </Box>
            {/* Interactive mode indicator: keystrokes are forwarded to the PTY */}
            {interactiveMode && (
                <Box flexShrink={0} justifyContent="center" paddingX={1}>
                    <Text bold color="yellow">
                        INTERACTIVE | keystrokes forwarded to task | Esc to exit
                    </Text>
                </Box>
            )}
        </Box>
    );
};

export default OutputPanel;
