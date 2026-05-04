/* eslint-disable react/function-component-definition */
import type { AnsiColors } from "@visulima/colorize";
import type { ReactElement } from "react";
import { useMemo } from "react";
import type { LiteralUnion } from "type-fest";

import type { CanvasContext } from "../canvas/buffer";
import Box from "./box";
import Canvas from "./canvas";
import Text from "./text";

export type BarDatum = {
    /**
     * Per-bar color override. Falls back to the chart-level palette.
     */
    readonly color?: LiteralUnion<AnsiColors, string>;
    readonly label?: string;
    readonly value: number;
};

export type Props = {
    /**
     * Bars to render.
     */
    readonly data: ReadonlyArray<BarDatum>;

    /**
     * Total height of the plot area in character rows.
     * @default 10
     */
    readonly height?: number;

    /**
     * Optional upper bound for the axis. When omitted the chart uses the
     * largest value in `data`.
     */
    readonly max?: number;

    /**
     * Orientation of the bars.
     * @default "vertical"
     */
    readonly orientation?: "horizontal" | "vertical";

    /**
     * Fallback palette cycled through when a bar does not provide its own color.
     * @default ["cyan", "magenta", "yellow", "green", "blue", "red"]
     */
    readonly palette?: ReadonlyArray<LiteralUnion<AnsiColors, string>>;

    /**
     * Render labels underneath vertical bars (or to the left of horizontal bars).
     * @default true
     */
    readonly showLabels?: boolean;

    /**
     * Render numeric values next to each bar.
     * @default false
     */
    readonly showValues?: boolean;

    /**
     * Total width of the plot area in character columns. Defaults to
     * `data.length * 3` for vertical charts, or `24` for horizontal.
     */
    readonly width?: number;
};

const DEFAULT_PALETTE: ReadonlyArray<LiteralUnion<AnsiColors, string>> = ["cyan", "magenta", "yellow", "green", "blue", "red"];

/**
 * Walk `data` once to find the maximum value. Avoids `Math.max(...values)`
 * which blows the call-stack on large arrays (same rule as Sparkline).
 */
const findMax = (data: ReadonlyArray<BarDatum>, userMax: number | undefined): number => {
    if (userMax !== undefined) {
        return userMax;
    }

    if (data.length === 0) {
        return 0;
    }

    // Seed from the first sample so all-negative datasets still yield a
    // sensible upper bound (otherwise initializing `max = 0` would wipe out
    // every datum < 0).
    let max = data[0]!.value;

    for (let index = 1; index < data.length; index += 1) {
        const { value } = data[index]!;

        if (value > max) {
            max = value;
        }
    }

    return max;
};

const colorFor = (index: number, palette: ReadonlyArray<LiteralUnion<AnsiColors, string>>, datum: BarDatum): LiteralUnion<AnsiColors, string> =>
    datum.color ?? palette[index % palette.length] ?? "cyan";

/**
 * Bar chart rendered on top of `Canvas`. Uses fractional block glyphs for
 * sub-cell precision (▁▂▃▄▅▆▇█ vertical, ▏▎▍▌▋▊▉█ horizontal).
 */
export default function BarChart({
    data,
    height = 10,
    max: maxOverride,
    orientation = "vertical",
    palette = DEFAULT_PALETTE,
    showLabels = true,
    showValues = false,
    width: widthOverride,
}: Props): ReactElement {
    const computedMax = useMemo(() => findMax(data, maxOverride), [data, maxOverride]);

    if (orientation === "horizontal") {
        const plotWidth = widthOverride ?? 24;

        return (
            <Box flexDirection="column">
                {data.map((datum, index) => {
                    const ratio = computedMax === 0 ? 0 : datum.value / computedMax;
                    const color = colorFor(index, palette, datum);

                    return (
                        // eslint-disable-next-line react-x/no-array-index-key -- chart bar index is stable for the render
                        <Box gap={1} key={index}>
                            {showLabels && datum.label !== undefined
                                ? (
                                <Box flexShrink={0} minWidth={8}>
                                    <Text dimColor wrap="truncate-end">
                                        {datum.label}
                                    </Text>
                                </Box>
                                )
                                : undefined}
                            <Box flexGrow={1} flexShrink={1}>
                                <Canvas
                                    // eslint-disable-next-line react-perf/jsx-no-new-function-as-prop -- canvas re-renders on `version` change, not draw identity
                                    draw={(context: CanvasContext) => {
                                        context.clear();
                                        context.drawHBar(0, 0, plotWidth, ratio, { color });
                                    }}
                                    height={1}
                                    // eslint-disable-next-line react-perf/jsx-no-new-array-as-prop -- version array is the canvas redraw key
                                    version={[datum.value, computedMax, color, plotWidth]}
                                    width={plotWidth}
                                />
                            </Box>
                            {showValues
                                ? (
                                <Box flexShrink={0}>
                                    <Text>{String(datum.value)}</Text>
                                </Box>
                                )
                                : undefined}
                        </Box>
                    );
                })}
            </Box>
        );
    }

    const barWidth = 2;
    const gap = 1;
    const plotWidth = widthOverride ?? Math.max(data.length * (barWidth + gap), 1);

    return (
        <Box flexDirection="column">
            <Canvas
                // eslint-disable-next-line react-perf/jsx-no-new-function-as-prop -- canvas re-renders on `version` change, not draw identity
                draw={(context: CanvasContext) => {
                    context.clear();

                    data.forEach((datum, index) => {
                        const ratio = computedMax === 0 ? 0 : datum.value / computedMax;
                        const color = colorFor(index, palette, datum);
                        const x = index * (barWidth + gap);

                        for (let column = 0; column < barWidth; column += 1) {
                            context.drawVBar(x + column, 0, height, ratio, { color });
                        }
                    });
                }}
                height={height}
                // eslint-disable-next-line react-perf/jsx-no-new-array-as-prop -- version array is the canvas redraw key
                version={[data, computedMax, palette, barWidth, gap, height]}
                width={plotWidth}
            />
            {showValues ? (
                <Box>
                    {data.map((datum, index) => (
                        // eslint-disable-next-line react-x/no-array-index-key -- chart column index is stable for the render
                        <Box key={index} width={barWidth + gap}>
                            <Text dimColor>{String(datum.value).padEnd(barWidth + gap, " ")}</Text>
                        </Box>
                    ))}
                </Box>
            ) : undefined}
            {showLabels ? (
                <Box>
                    {data.map((datum, index) => (
                        // eslint-disable-next-line react-x/no-array-index-key -- chart column index is stable for the render
                        <Box key={index} width={barWidth + gap}>
                            <Text dimColor wrap="truncate-end">
                                {(datum.label ?? "").padEnd(barWidth + gap, " ")}
                            </Text>
                        </Box>
                    ))}
                </Box>
            ) : undefined}
        </Box>
    );
}
