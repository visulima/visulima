/* eslint-disable react/function-component-definition */
import type { AnsiColors } from "@visulima/colorize";
import type { ReactElement } from "react";
import { useMemo } from "react";
import type { LiteralUnion } from "type-fest";

import type { CanvasContext } from "../canvas/buffer";
import Box from "./box";
import Canvas from "./canvas";
import { computeExtents, DEFAULT_CHART_PALETTE, pickSeriesColor, toPoints } from "./chart-utils";
import type { LineSeries } from "./line-chart";
import { drawSeriesOnCanvas } from "./line-chart";
import Text from "./text";

export type Props = {
    readonly axisColor?: LiteralUnion<AnsiColors, string>;
    readonly height?: number;
    readonly maxX?: number;
    readonly maxY?: number;
    readonly minX?: number;
    readonly minY?: number;
    readonly palette?: ReadonlyArray<LiteralUnion<AnsiColors, string>>;
    readonly series: ReadonlyArray<LineSeries>;
    readonly showLegend?: boolean;
    readonly width?: number;
};

const DEFAULT_PALETTE = DEFAULT_CHART_PALETTE;

/**
 * Scatter plot rendered on a braille pixel grid. Each sample lights one
 * sub-cell pixel; overlapping points merge into denser braille glyphs.
 * @returns A `ReactElement` containing the plot and an optional legend.
 */
export default function ScatterPlot({
    axisColor = "gray",
    height = 10,
    maxX,
    maxY,
    minX,
    minY,
    palette = DEFAULT_PALETTE,
    series,
    showLegend = true,
    width = 40,
}: Props): ReactElement {
    const config = useMemo(() => {
        const seriesList = series.map((input, index) => {
            return {
                color: pickSeriesColor(input, index, palette),
                points: toPoints(input.data),
                series: input,
            };
        });

        const extents = computeExtents(seriesList);

        return {
            axisColor,
            palette,
            seriesList,
            xMax: maxX ?? (extents.xMax === Number.NEGATIVE_INFINITY ? 1 : extents.xMax),
            xMin: minX ?? (extents.xMin === Number.POSITIVE_INFINITY ? 0 : extents.xMin),
            yMax: maxY ?? (extents.yMax === Number.NEGATIVE_INFINITY ? 1 : extents.yMax),
            yMin: minY ?? (extents.yMin === Number.POSITIVE_INFINITY ? 0 : extents.yMin),
        };
    }, [series, axisColor, palette, minX, maxX, minY, maxY]);

    return (
        <Box flexDirection="column">
            <Canvas
                // eslint-disable-next-line react-perf/jsx-no-new-function-as-prop -- canvas re-renders on `version` change, not draw identity
                draw={(context: CanvasContext) => {
                    drawSeriesOnCanvas(context, "scatter", config);
                }}
                height={height}
                // eslint-disable-next-line react-perf/jsx-no-new-array-as-prop -- version array is the canvas redraw key
                version={[series, width, height, minX, maxX, minY, maxY, axisColor, palette]}
                width={width}
            />
            {/* eslint-disable-next-line @stylistic/multiline-ternary -- prettier formats JSX ternaries on one line */}
            {showLegend ? (
                <Box gap={2} marginTop={1}>
                    {config.seriesList.map(({ color, series: input }, index) => (
                        // Composite key: series index plus label so two
                        // series sharing a label don't collide.
                        // eslint-disable-next-line react-x/no-array-index-key -- series index is stable for the render
                        <Box gap={1} key={`${index}:${input.label ?? ""}`}>
                            <Text color={color}>●</Text>
                            <Text>{input.label ?? `Series ${index + 1}`}</Text>
                        </Box>
                    ))}
                </Box>
            ) : undefined}
        </Box>
    );
}
