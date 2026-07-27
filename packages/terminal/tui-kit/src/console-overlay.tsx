/* eslint-disable react/function-component-definition, sonarjs/no-nested-conditional */

/**
 * Console overlay component for Ink.
 *
 * Captures console.log/warn/error/debug output and displays it
 * in a dockable panel within the TUI, similar to browser devtools.
 */
import Box from "@visulima/tui/components/box";
import Text from "@visulima/tui/components/text";
import type { ConsoleLevel } from "@visulima/tui/hooks/use-console-capture";
import useConsoleCapture from "@visulima/tui/hooks/use-console-capture";
import type { ReactElement } from "react";
import { useMemo } from "react";

export type ConsoleOverlayDock = "bottom" | "top";

export type Props = {
    /**
     * Dock position within the parent container.
     * @default "bottom"
     */
    readonly dock?: ConsoleOverlayDock;

    /**
     * Which console levels to capture.
     * @default ["log", "info", "warn", "error", "debug"]
     */
    readonly filter?: ReadonlyArray<ConsoleLevel>;

    /**
     * Visible height in rows.
     * @default 8
     */
    readonly height?: number;

    /**
     * Maximum entries to keep in the buffer.
     * @default 200
     */
    readonly maxEntries?: number;

    /**
     * Show the log level label.
     * @default true
     */
    readonly showLevel?: boolean;

    /**
     * Show timestamps on each entry.
     * @default true
     */
    readonly showTimestamp?: boolean;
};

const LEVEL_COLORS: Record<ConsoleLevel, string> = {
    debug: "gray",
    error: "red",
    info: "blue",
    log: "white",
    warn: "yellow",
};

const LEVEL_LABELS: Record<ConsoleLevel, string> = {
    debug: "DBG",
    error: "ERR",
    info: "INF",
    log: "LOG",
    warn: "WRN",
};

const formatTimestamp = (ts: number): string => {
    const date = new Date(ts);
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    const seconds = String(date.getSeconds()).padStart(2, "0");

    return `${hours}:${minutes}:${seconds}`;
};

/**
 * A dockable console overlay that captures and displays console output.
 *
 * ```tsx
 * &lt;Box flexDirection="column" height="100%">
 *     &lt;Box flexGrow={1}>{mainContent}&lt;/Box>
 *     &lt;ConsoleOverlay dock="bottom" height={6} />
 * &lt;/Box>
 * ```
 */
export default function ConsoleOverlay({ dock = "bottom", filter, height = 8, maxEntries = 200, showLevel = true, showTimestamp = true }: Props): ReactElement {
    const { entries } = useConsoleCapture({ filter, maxEntries });

    // Show the last `height` entries (auto-scroll to bottom)
    const visibleEntries = useMemo(() => entries.slice(-height), [entries, height]);

    return (
        <Box
            borderBottom={dock === "top"}
            borderBottomColor="gray"
            borderTop={dock === "bottom"}
            borderTopColor="gray"
            flexDirection="column"
            height={height + 1}
        >
            {visibleEntries.length === 0
                ? (
                <Text dimColor>Console output will appear here...</Text>
                )
                : visibleEntries.map((entry) => (
                    <Box key={entry.id}>
                        {showTimestamp
                            ? (
<Text dimColor>
[
{formatTimestamp(entry.timestamp)}
]
{" "}
</Text>
                            )
                            : undefined}
                        {showLevel
                            ? (
<Text color={LEVEL_COLORS[entry.level]}>
{LEVEL_LABELS[entry.level]}
{" "}
</Text>
                            )
                            : undefined}
                        <Text color={entry.level === "error" ? "red" : entry.level === "warn" ? "yellow" : undefined}>{entry.message}</Text>
                    </Box>
                ))}
        </Box>
    );
}

export { ConsoleOverlay };
export type { Props as ConsoleOverlayProps };
