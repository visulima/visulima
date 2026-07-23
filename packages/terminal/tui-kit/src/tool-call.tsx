/* eslint-disable react/function-component-definition */
import type { AnsiColors } from "@visulima/colorize";
import Box from "@visulima/tui/components/box";
import Text from "@visulima/tui/components/text";
import type { ReactElement, ReactNode } from "react";
import type { LiteralUnion } from "type-fest";

type Color = LiteralUnion<AnsiColors, string>;

export type ToolCallStatus = "error" | "pending" | "running" | "success";

const STATUS_META: Record<ToolCallStatus, { readonly color: Color; readonly icon: string }> = {
    error: { color: "red", icon: "✖" },
    pending: { color: "gray", icon: "○" },
    running: { color: "yellow", icon: "◐" },
    success: { color: "green", icon: "✔" },
};

export type Props = {
    /**
     * The tool arguments. Objects are shown as compact `key=value` pairs;
     * strings are shown verbatim.
     */
    readonly args?: Record<string, unknown> | string;

    /**
     * Rendered output/result of the call, shown indented beneath the header.
     */
    readonly children?: ReactNode;

    /**
     * The tool name.
     */
    readonly name: string;

    /**
     * Call status, driving the icon and color.
     * @default "pending"
     */
    readonly status?: ToolCallStatus;
};

const formatArgs = (args: Record<string, unknown> | string | undefined): string => {
    if (args === undefined) {
        return "";
    }

    if (typeof args === "string") {
        return args;
    }

    return Object.entries(args)
        .map(([key, value]) => `${key}=${typeof value === "string" ? value : JSON.stringify(value)}`)
        .join(" ");
};

/**
 * A single tool invocation: a status icon, the tool name, its arguments as
 * compact `key=value` pairs, and any result rendered as indented children.
 */
export default function ToolCall({ args, children, name, status = "pending" }: Props): ReactElement {
    const meta = STATUS_META[status];
    const argumentText = formatArgs(args);

    return (
        <Box flexDirection="column">
            <Box gap={1}>
                <Text color={meta.color}>{meta.icon}</Text>
                <Text bold>{name}</Text>
                {argumentText.length > 0 ? <Text dimColor>{argumentText}</Text> : undefined}
            </Box>
            {children === undefined
                ? undefined
                : (
                <Box marginLeft={2}>
                    <Text dimColor>{children}</Text>
                </Box>
                )}
        </Box>
    );
}

export { ToolCall };
export type { Props as ToolCallProps };
