/* eslint-disable react/function-component-definition */
import type { AnsiColors } from "@visulima/colorize";
import type { ReactElement } from "react";
import type { LiteralUnion } from "type-fest";

import useWindowSize from "../ink/hooks/use-window-size";
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
     * fill the available space and vertical dividers default to one row.
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
export default function Divider({ character, color, dimColor = false, label, labelPadding = 1, length, orientation = "horizontal" }: Props): ReactElement {
    const { columns } = useWindowSize();
    const char = character ?? (orientation === "horizontal" ? "─" : "│");

    if (orientation === "vertical") {
        const rows = length ?? 1;

        return (
            <Box flexDirection="column" height={rows}>
                {Array.from({ length: rows }, (_, index) => (
                    <Text color={color} dimColor={dimColor} key={`divider-row-${index}`}>
                        {char}
                    </Text>
                ))}
            </Box>
        );
    }

    // Repeat long enough to fill the widest reasonable viewport; Yoga + Text
    // `truncate` wrapping will clip the excess. Cap the allocation so a
    // multi-thousand-column terminal (or a pathological `length` prop) can't
    // blow up the string size.
    const MAX_FILL = 500;
    const fillLength = Math.min(MAX_FILL, length ?? Math.max(columns, 1));

    if (label === undefined) {
        return (
            <Box flexGrow={length === undefined ? 1 : 0} width={length}>
                <Text color={color} dimColor={dimColor} wrap="truncate">
                    {char.repeat(fillLength)}
                </Text>
            </Box>
        );
    }

    const padding = " ".repeat(labelPadding);

    return (
        <Box flexGrow={length === undefined ? 1 : 0} width={length}>
            <Box flexGrow={1} flexShrink={1}>
                <Text color={color} dimColor={dimColor} wrap="truncate">
                    {char.repeat(fillLength)}
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
                    {char.repeat(fillLength)}
                </Text>
            </Box>
        </Box>
    );
}

export { Divider };
export type { Props as DividerProps };
