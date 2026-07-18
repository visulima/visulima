/* eslint-disable react/function-component-definition */
import type { AnsiColors } from "@visulima/colorize";
import Box from "@visulima/tui/components/box";
import Text from "@visulima/tui/components/text";
import type { ReactElement } from "react";
import type { LiteralUnion } from "type-fest";

type Color = LiteralUnion<AnsiColors, string>;

export type ProgressItem = {
    readonly color?: Color;
    readonly label: string;

    /**
     * Progress in the range [0, 1]. Values outside are clamped.
     */
    readonly value: number;
};

export type Props = {
    /**
     * Width of each bar in cells.
     * @default 20
     */
    readonly barWidth?: number;

    /**
     * Fallback bar color when an item has none.
     * @default "cyan"
     */
    readonly color?: Color;

    /**
     * Character for the empty portion of each bar; defaults to a light shade.
     */
    readonly emptyChar?: string;

    /**
     * Character for the filled portion of each bar; defaults to a full block.
     */
    readonly filledChar?: string;

    /**
     * The bars to render, top to bottom.
     */
    readonly items: ReadonlyArray<ProgressItem>;

    /**
     * Render the percentage after each bar.
     * @default true
     */
    readonly showPercent?: boolean;
};

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

/**
 * A stack of labeled progress bars sharing one aligned column layout — useful
 * for parallel downloads, multi-step jobs, or per-file progress. Labels are
 * right-padded to the widest so the bars line up.
 */
export default function MultiProgress({
    barWidth = 20,
    color = "cyan",
    emptyChar = "░",
    filledChar = "█",
    items,
    showPercent = true,
}: Props): ReactElement {
    let labelWidth = 0;

    for (const item of items) {
        labelWidth = Math.max(labelWidth, item.label.length);
    }

    return (
        <Box flexDirection="column">
            {items.map((item, index) => {
                const ratio = clamp01(item.value);
                const filled = Math.round(ratio * barWidth);

                return (
                    // eslint-disable-next-line react-x/no-array-index-key -- item index is stable for the render
                    <Box gap={1} key={index}>
                        <Box flexShrink={0} width={labelWidth}>
                            <Text>{item.label.padEnd(labelWidth)}</Text>
                        </Box>
                        <Box>
                            <Text color={item.color ?? color}>{filledChar.repeat(filled)}</Text>
                            <Text dimColor>{emptyChar.repeat(Math.max(0, barWidth - filled))}</Text>
                        </Box>
                        {showPercent ? <Text dimColor>{`${Math.round(ratio * 100)}%`}</Text> : undefined}
                    </Box>
                );
            })}
        </Box>
    );
}

export { MultiProgress };
export type { Props as MultiProgressProps };
