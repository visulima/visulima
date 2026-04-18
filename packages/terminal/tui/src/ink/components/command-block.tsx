/* eslint-disable react/function-component-definition */
import type { AnsiColors } from "@visulima/colorize";
import type { ReactElement, ReactNode } from "react";
import type { LiteralUnion } from "type-fest";

import Box from "./box";
import Spinner from "./spinner";
import Text from "./text";

export type CommandStatus = "error" | "idle" | "running" | "success";

export type Props = {
    /**
     * Shell command rendered in the header.
     */
    readonly command: string;

    /**
     * Optional working directory shown after the command name.
     */
    readonly cwd?: string;

    /**
     * Duration in ms; shown when finished.
     */
    readonly durationMs?: number;

    /**
     * Exit code of the completed command.
     */
    readonly exitCode?: number;

    /**
     * Max output rows rendered before truncation. Use `Infinity` to disable.
     */
    readonly maxOutputRows?: number;

    /**
     * Command output. Either a string (rendered as-is) or arbitrary children.
     */
    readonly output?: ReactNode;

    /**
     * Lifecycle state. Controls the header icon and color.
     * @default "idle"
     */
    readonly status?: CommandStatus;
};

const STATUS_COLOR: Record<CommandStatus, LiteralUnion<AnsiColors, string>> = {
    error: "red",
    idle: "gray",
    running: "cyan",
    success: "green",
};

const formatDuration = (ms: number): string => {
    if (ms < 1000) {
        return `${Math.round(ms)}ms`;
    }

    return `${(ms / 1000).toFixed(2)}s`;
};

/**
 * Resolve the header icon for a given status. `running` returns a live
 * Spinner; every other value maps to a static glyph.
 */
const resolveStatusIcon = (status: CommandStatus): ReactNode => {
    if (status === "running") {
        return <Spinner type="dots" />;
    }

    const ICONS: Record<Exclude<CommandStatus, "running">, string> = {
        error: "✖",
        idle: "$",
        success: "✔",
    };

    return ICONS[status];
};

const truncateOutput = (output: string, maxRows: number): string => {
    if (!Number.isFinite(maxRows)) {
        return output;
    }

    const rows = output.split("\n");

    if (rows.length <= maxRows) {
        return output;
    }

    const kept = rows.slice(0, maxRows).join("\n");
    const hidden = rows.length - maxRows;

    return `${kept}\n… ${hidden} more line${hidden === 1 ? "" : "s"}`;
};

/**
 * Renders a shell command with its output and a status header. Designed for
 * coding-agent UIs that stream terminal operations.
 */
export default function CommandBlock({ command, cwd, durationMs, exitCode, maxOutputRows = 12, output, status = "idle" }: Props): ReactElement {
    const color = STATUS_COLOR[status];
    const statusIcon = resolveStatusIcon(status);

    const trailing: ReactNode[] = [];

    if (durationMs !== undefined) {
        trailing.push(
            <Text dimColor key="duration">
                {" "}
                {formatDuration(durationMs)}
            </Text>,
        );
    }

    if (exitCode !== undefined && status !== "running") {
        trailing.push(
            <Text color={exitCode === 0 ? "green" : "red"} key="exit">
                {" "}
                exit
                {" "}
                {exitCode}
            </Text>,
        );
    }

    return (
        <Box borderColor={color} borderStyle="round" flexDirection="column" paddingX={1}>
            <Box>
                <Text color={color}>{statusIcon}</Text>
                <Text> </Text>
                <Box flexGrow={1} flexShrink={1} minWidth={0}>
                    <Text bold wrap="truncate-end">
                        {command}
                    </Text>
                </Box>
                {cwd === undefined
                    ? undefined
                    : (
                        <Text dimColor>
                            {" "}
                            @
                            {cwd}
                        </Text>
                    )}
                {trailing.length === 0 ? undefined : <Box flexShrink={0}>{trailing}</Box>}
            </Box>
            {output === undefined
                ? undefined
                : (
                    <Box flexDirection="column" marginTop={1}>
                        {typeof output === "string" ? <Text>{truncateOutput(output, maxOutputRows)}</Text> : output}
                    </Box>
                )}
        </Box>
    );
}
