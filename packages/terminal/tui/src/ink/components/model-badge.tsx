/* eslint-disable react/function-component-definition */
import type { AnsiColors } from "@visulima/colorize";
import type { ReactElement, ReactNode } from "react";
import type { LiteralUnion } from "type-fest";

import Box from "./box";
import Text from "./text";

export type Props = {
    /**
     * Background color of the badge.
     * @default "magenta"
     */
    readonly color?: LiteralUnion<AnsiColors, string>;

    /**
     * Optional icon/symbol (e.g. `✨`, `◈`) shown before the label.
     */
    readonly icon?: ReactNode;

    /**
     * Short model identifier, e.g. `claude-opus-4.6`.
     */
    readonly model: string;

    /**
     * Optional provider name rendered as a separate chip before the model.
     */
    readonly provider?: string;

    /**
     * Visual style.
     * @default "solid"
     */
    readonly variant?: "outline" | "solid" | "subtle";
};

/**
 * Pill-shaped chip identifying the active model / provider. Pair with
 * `MessageBubble` to label assistant output.
 */
export default function ModelBadge({ color = "magenta", icon, model, provider, variant = "solid" }: Props): ReactElement {
    const chip = (content: ReactNode): ReactElement => {
        const renderedIcon = icon === undefined
            ? undefined
            : (
                <>
                    {icon}
                    {" "}
                </>
            );

        if (variant === "outline") {
            return (
                <Box borderColor={color} borderStyle="round" paddingX={1}>
                    <Text color={color}>
                        {renderedIcon}
                        {content}
                    </Text>
                </Box>
            );
        }

        if (variant === "subtle") {
            return (
                <Text color={color}>
                    {renderedIcon}
                    {content}
                </Text>
            );
        }

        return (
            <Text backgroundColor={color} color="black">
                {" "}
                {renderedIcon}
                {content}
                {" "}
            </Text>
        );
    };

    if (provider === undefined) {
        return chip(model);
    }

    return (
        <Box>
            <Text dimColor>{provider}</Text>
            <Text dimColor>/</Text>
            {chip(model)}
        </Box>
    );
}
