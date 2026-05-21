/* eslint-disable react/function-component-definition */
import type { AnsiColors } from "@visulima/colorize";
import type { ReactElement, ReactNode } from "react";
import type { LiteralUnion } from "type-fest";

import Box from "./box";
import Text from "./text";

export type MessageRole = "assistant" | "system" | "tool" | "user";

export type Props = {
    /**
     * Bubble body.
     */
    readonly children: ReactNode;

    /**
     * Color override.
     */
    readonly color?: LiteralUnion<AnsiColors, string>;

    /**
     * When true, draws the bubble without a border.
     */
    readonly flat?: boolean;

    /**
     * Text rendered above the bubble (name, model, etc.).
     */
    readonly label?: string;

    /**
     * Optional metadata rendered next to the label (e.g. timestamp).
     */
    readonly meta?: string;

    /**
     * Determines the alignment, color, and icon of the bubble.
     * @default "assistant"
     */
    readonly role?: MessageRole;
};

const ROLE_CONFIG: Record<MessageRole, { align: "flex-start" | "flex-end"; color: string; icon: string }> = {
    assistant: { align: "flex-start", color: "blueBright", icon: "" },
    system: { align: "flex-start", color: "gray", icon: "" },
    tool: { align: "flex-start", color: "magentaBright", icon: "" },
    user: { align: "flex-end", color: "greenBright", icon: "" },
};

/**
 * Chat-style message bubble for AI agent UIs.
 */
export default function MessageBubble({ children, color, flat = false, label, meta, role = "assistant" }: Props): ReactElement {
    const preset = ROLE_CONFIG[role];
    const accent = color ?? preset.color;

    return (
        <Box alignSelf={preset.align} flexDirection="column" marginBottom={1}>
            {label === undefined && meta === undefined
                ? undefined
                : (
                <Box gap={1} paddingX={1}>
                    {label === undefined
                        ? undefined
                        : (
                        <Text bold color={accent}>
                            {label}
                        </Text>
                        )}
                    {meta === undefined ? undefined : <Text dimColor>{meta}</Text>}
                </Box>
                )}
            {flat
                ? (
                <Box paddingX={1}>
                    <Text color={accent}>│ </Text>
                    <Box flexDirection="column" flexGrow={1}>
                        {typeof children === "string" ? <Text>{children}</Text> : children}
                    </Box>
                </Box>
                )
                : (
                <Box borderColor={accent} borderStyle="round" flexDirection="column" paddingX={1}>
                    {typeof children === "string" ? <Text>{children}</Text> : children}
                </Box>
                )}
        </Box>
    );
}

export { MessageBubble };
export type { Props as MessageBubbleProps };
