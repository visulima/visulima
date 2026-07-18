/* eslint-disable react/function-component-definition */
import type { AnsiColors } from "@visulima/colorize";
import Box from "@visulima/tui/components/box";
import Text from "@visulima/tui/components/text";
import type { ReactElement } from "react";
import type { LiteralUnion } from "type-fest";

type Color = LiteralUnion<AnsiColors, string>;

export type Props = {
    /**
     * Width of the input/output ratio bar in cells.
     * @default 20
     */
    readonly barWidth?: number;

    /**
     * Optional context-window size. When set, a `used / limit (pct%)` summary
     * and a fill bar are shown instead of the input/output split.
     */
    readonly contextLimit?: number;

    /**
     * Number of input (prompt) tokens.
     * @default 0
     */
    readonly input?: number;

    /**
     * Color for the input segment.
     * @default "cyan"
     */
    readonly inputColor?: Color;

    /**
     * Number of output (completion) tokens.
     * @default 0
     */
    readonly output?: number;

    /**
     * Color for the output segment.
     * @default "magenta"
     */
    readonly outputColor?: Color;
};

function fillColor(ratio: number): Color {
    if (ratio > 0.9) {
        return "red";
    }

    if (ratio > 0.7) {
        return "yellow";
    }

    return "green";
}

const formatCount = (value: number): string => {
    if (value >= 1_000_000) {
        return `${(value / 1_000_000).toFixed(1)}M`;
    }

    if (value >= 1000) {
        return `${(value / 1000).toFixed(1)}k`;
    }

    return String(value);
};

/**
 * A compact token-usage readout. By default it shows input vs output counts
 * with a proportional two-color bar; when `contextLimit` is set, it instead
 * shows how much of the context window is used.
 */
export default function TokenUsage({
    barWidth = 20,
    contextLimit,
    input = 0,
    inputColor = "cyan",
    output = 0,
    outputColor = "magenta",
}: Props): ReactElement {
    const total = input + output;

    if (contextLimit !== undefined && contextLimit > 0) {
        const ratio = Math.min(1, total / contextLimit);
        const filled = Math.round(ratio * barWidth);
        const barColor = fillColor(ratio);

        return (
            <Box gap={1}>
                <Text color={barColor}>{"█".repeat(filled)}</Text>
                <Text dimColor>{"░".repeat(Math.max(0, barWidth - filled))}</Text>
                <Text>
                    {formatCount(total)}
                    /
                    {formatCount(contextLimit)}
                    {" "}
                    (
                    {Math.round(ratio * 100)}
                    %)
                </Text>
            </Box>
        );
    }

    const inputCells = total === 0 ? 0 : Math.round((input / total) * barWidth);
    const outputCells = Math.max(0, barWidth - inputCells);

    return (
        <Box gap={1}>
            <Box>
                <Text color={inputColor}>{"█".repeat(inputCells)}</Text>
                <Text color={outputColor}>{"█".repeat(outputCells)}</Text>
            </Box>
            <Text color={inputColor}>{`↑${formatCount(input)}`}</Text>
            <Text color={outputColor}>{`↓${formatCount(output)}`}</Text>
            <Text dimColor>{`Σ${formatCount(total)}`}</Text>
        </Box>
    );
}

export { TokenUsage };
export type { Props as TokenUsageProps };
