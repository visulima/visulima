/* eslint-disable react/function-component-definition */
import type { AnsiColors } from "@visulima/colorize";
import type { ReactElement } from "react";
import type { LiteralUnion } from "type-fest";

import useAnimation from "../hooks/use-animation";
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
    const dim = animated && frame % 2 === 0;

    return (
        <Box flexDirection="column" width={width}>
            {Array.from({ length: rows }, (_, index) => {
                const ratio = widths[index % widths.length] ?? 1;
                const effectiveWidth = width === undefined ? undefined : Math.max(1, Math.round(width * ratio));
                const fill = character.repeat(effectiveWidth ?? 40);

                return (
                    <Box key={index} width={effectiveWidth}>
                        <Text color={color} dimColor={dim} wrap="truncate-end">
                            {fill}
                        </Text>
                    </Box>
                );
            })}
        </Box>
    );
}
