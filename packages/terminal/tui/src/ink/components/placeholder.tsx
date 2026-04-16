/* eslint-disable react/function-component-definition */
import type { AnsiColors } from "@visulima/colorize";
import type { ReactElement } from "react";
import type { LiteralUnion } from "type-fest";

import useAnimation from "../hooks/use-animation";
import useWindowSize from "../hooks/use-window-size";
import Box from "./box";
import Text from "./text";

export type Props = {
    /**
     * Whether to pulse the skeleton blocks (shimmer).
     * @default true
     */
    readonly animated?: boolean;

    /**
     * Fill character used for each block.
     * @default "█"
     */
    readonly character?: string;

    /**
     * Block color.
     * @default "gray"
     */
    readonly color?: LiteralUnion<AnsiColors, string>;

    /**
     * Milliseconds between pulses.
     * @default 500
     */
    readonly interval?: number;

    /**
     * Number of skeleton rows to render.
     * @default 3
     */
    readonly rows?: number;

    /**
     * Relative widths of each row (0–1). The list is sampled cyclically.
     * @default [1, 0.85, 0.6]
     */
    readonly widths?: ReadonlyArray<number>;

    /**
     * Total width reference. When omitted, the block flexes to fill its
     * parent.
     */
    readonly width?: number;
};

const DEFAULT_WIDTHS = [1, 0.85, 0.6] as const;

/**
 * Skeleton loading indicator. Renders a stack of solid blocks whose widths
 * vary to mimic text placeholders. Pair with `async` data fetching.
 *
 * @param props - See {@link Props}.
 * @returns A `ReactElement` rendering the skeleton rows.
 */
export default function Placeholder({
    animated = true,
    character = "█",
    color = "gray",
    interval = 500,
    rows = 3,
    widths = DEFAULT_WIDTHS,
    width,
}: Props): ReactElement {
    const { frame } = useAnimation({ interval, isActive: animated });
    const { columns } = useWindowSize();
    const dim = animated && frame % 2 === 0;
    // When `width` is omitted, fall back to the terminal width so the
    // skeleton actually fills its parent rather than truncating to 40 cells.
    const baseWidth = width ?? Math.max(1, columns);

    return (
        <Box flexDirection="column" width={width}>
            {Array.from({ length: rows }, (_, index) => {
                const ratio = widths[index % widths.length] ?? 1;
                const effectiveWidth = Math.max(1, Math.round(baseWidth * ratio));
                const boxWidth = width === undefined ? effectiveWidth : effectiveWidth;
                const fill = character.repeat(effectiveWidth);

                return (
                    <Box key={index} width={boxWidth}>
                        <Text color={color} dimColor={dim} wrap="truncate-end">
                            {fill}
                        </Text>
                    </Box>
                );
            })}
        </Box>
    );
}
