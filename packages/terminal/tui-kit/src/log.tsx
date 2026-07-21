/* eslint-disable react/function-component-definition */
import type { AnsiColors } from "@visulima/colorize";
import Box from "@visulima/tui/components/box";
import Text from "@visulima/tui/components/text";
import type { ReactElement } from "react";
import type { LiteralUnion } from "type-fest";

export type LogLevel = "debug" | "error" | "info" | "success" | "warn";

export type LogEntry = {
    readonly level?: LogLevel;
    readonly message: string;
    readonly timestamp?: string;
};

const LEVEL_META: Record<LogLevel, { readonly color: LiteralUnion<AnsiColors, string>; readonly label: string }> = {
    debug: { color: "gray", label: "DBG" },
    error: { color: "red", label: "ERR" },
    info: { color: "blue", label: "INF" },
    success: { color: "green", label: "OK " },
    warn: { color: "yellow", label: "WRN" },
};

export type Props = {
    /**
     * The log entries, oldest first.
     */
    readonly entries: ReadonlyArray<LogEntry>;

    /**
     * Keep only the last N entries (tail). Omit to render all.
     */
    readonly maxLines?: number;

    /**
     * Render the `[LEVEL]` badge before each message.
     * @default true
     */
    readonly showLevel?: boolean;

    /**
     * Render each entry's timestamp, when present.
     * @default true
     */
    readonly showTimestamp?: boolean;
};

/**
 * A leveled log view. Renders entries with a colored level badge and optional
 * timestamp; `maxLines` tails the buffer to the most recent entries.
 */
export default function Log({ entries, maxLines, showLevel = true, showTimestamp = true }: Props): ReactElement {
    const visible = maxLines !== undefined && entries.length > maxLines ? entries.slice(entries.length - maxLines) : entries;

    return (
        <Box flexDirection="column">
            {visible.map((entry, index) => {
                const meta = LEVEL_META[entry.level ?? "info"];

                return (
                    // eslint-disable-next-line react-x/no-array-index-key -- entry index is stable for the render
                    <Box key={index}>
                        {showTimestamp && entry.timestamp !== undefined
                            ? (
                            <Box marginRight={1}>
                                <Text dimColor>{entry.timestamp}</Text>
                            </Box>
                            )
                            : undefined}
                        {showLevel
                            ? (
                            <Box marginRight={1}>
                                <Text bold color={meta.color}>
                                    {meta.label}
                                </Text>
                            </Box>
                            )
                            : undefined}
                        <Text>{entry.message}</Text>
                    </Box>
                );
            })}
        </Box>
    );
}

export { Log };
export type { Props as LogProps };
