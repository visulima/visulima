/* eslint-disable react/function-component-definition */
import type { AnsiColors } from "@visulima/colorize";
import Box from "@visulima/tui/components/box";
import Text from "@visulima/tui/components/text";
import useAnimation from "@visulima/tui/hooks/use-animation";
import useWindowSize from "@visulima/tui/hooks/use-window-size";
import type { ReactElement } from "react";
import type { LiteralUnion } from "type-fest";

export type Props = {
    /**
     * Whether to pulse the skeleton blocks (shimmer).
     * @default true
     */
    readonly animated?: boolean;

    /**
     * Glyph repeated to fill each placeholder block.
     * @default "█" (full block)
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
     * Total width reference. When omitted, the block flexes to fill its
     * parent.
     */
    readonly width?: number;

    /**
     * Relative widths of each row (0–1). The list is sampled cyclically.
     * @default [1, 0.85, 0.6]
     */
    readonly widths?: ReadonlyArray<number>;
};

const DEFAULT_WIDTHS = [1, 0.85, 0.6] as const;

/**
 * Skeleton loading indicator. Renders a stack of solid blocks whose widths
 * vary to mimic text placeholders. Pair with `async` data fetching.
 * @returns A `ReactElement` rendering the skeleton rows.
 */
export default function Placeholder({
    animated = true,
    character = "█",
    color = "gray",
    interval = 500,
    rows = 3,
    width,
    widths = DEFAULT_WIDTHS,
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
                // Guard against an explicitly empty `widths` prop — modulo
                // by zero would yield NaN and the nullish fallback would
                // still force every row to full width, hiding the bug.
                const ratio = widths.length > 0 ? widths[index % widths.length] ?? 1 : 1;
                const effectiveWidth = Math.max(1, Math.round(baseWidth * ratio));
                const fill = character.repeat(effectiveWidth);

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

export { Placeholder };
export type { Props as PlaceholderProps };
