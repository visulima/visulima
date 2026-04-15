/* eslint-disable react/function-component-definition */
import type { AnsiColors } from "@visulima/colorize";
import type { ReactElement } from "react";
import type { LiteralUnion } from "type-fest";

import Box from "./box";
import Text from "./text";

export type Props = {
    /**
     * Custom character to use instead of the default line character.
     */
    readonly character?: string;

    /**
     * Color of the divider line.
     */
    readonly color?: LiteralUnion<AnsiColors, string>;

    /**
     * Render the divider with dim color.
     */
    readonly dimColor?: boolean;

    /**
     * Optional label rendered in the middle of a horizontal divider.
     */
    readonly label?: string;

    /**
     * Padding around the label.
     * @default 1
     */
    readonly labelPadding?: number;

    /**
     * Total length of the divider. When omitted, horizontal dividers stretch to
     * fill the available space and vertical dividers require a length.
     */
    readonly length?: number;

    /**
     * Orientation of the divider.
     * @default "horizontal"
     */
    readonly orientation?: "horizontal" | "vertical";
};

/**
 * Horizontal or vertical divider line, optionally with a centered label.
 */
export default function Divider({
    character,
    color,
    dimColor = false,
    label,
    labelPadding = 1,
    length,
    orientation = "horizontal",
}: Props): ReactElement {
    const char = character ?? (orientation === "horizontal" ? "─" : "│");

    if (orientation === "vertical") {
        const rows = length ?? 1;

        return (
            <Box flexDirection="column" height={rows}>
                {Array.from({ length: rows }, (_, index) => (
                    <Text color={color} dimColor={dimColor} key={index}>
                        {char}
                    </Text>
                ))}
            </Box>
        );
    }

    if (label === undefined) {
        return (
            <Box flexGrow={length === undefined ? 1 : 0} width={length}>
                <Text color={color} dimColor={dimColor} wrap="truncate">
                    {char.repeat(length ?? 256)}
                </Text>
            </Box>
        );
    }

    const padding = " ".repeat(labelPadding);

    return (
        <Box flexGrow={length === undefined ? 1 : 0} width={length}>
            <Box flexGrow={1} flexShrink={1}>
                <Text color={color} dimColor={dimColor} wrap="truncate">
                    {char.repeat(256)}
                </Text>
            </Box>
            <Box flexShrink={0}>
                <Text color={color} dimColor={dimColor}>
                    {padding}
                    {label}
                    {padding}
                </Text>
            </Box>
            <Box flexGrow={1} flexShrink={1}>
                <Text color={color} dimColor={dimColor} wrap="truncate">
                    {char.repeat(256)}
                </Text>
            </Box>
        </Box>
    );
}
