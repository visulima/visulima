/* eslint-disable react/function-component-definition */
import type { AnsiColors } from "@visulima/colorize";
import type { ReactElement } from "react";
import { useMemo } from "react";
import type { LiteralUnion } from "type-fest";

import { createBrailleGrid } from "../canvas/braille";
import type { CanvasContext } from "../canvas/buffer";
import Box from "./box";
import Canvas from "./canvas";
import type { Point } from "./chart-utils";
import { computeExtents, DEFAULT_CHART_PALETTE, pickSeriesColor, toPoints } from "./chart-utils";
import Text from "./text";

export type LineSeries = {
    /**
     * Per-series color override. Falls back to the chart-level palette.
     */
    readonly color?: LiteralUnion<AnsiColors, string>;

    /**
     * Numeric samples to plot. Pass either a list of y-values (x is the
     * index) or {x, y} tuples.
     */
    readonly data: ReadonlyArray<number> | ReadonlyArray<{ readonly x: number; readonly y: number }>;

    /**
     * Optional label shown in the legend.
     */
    readonly label?: string;
};

export type LineChartProps = {
    /**
     * Color for axis ticks / labels.
     * @default "gray"
     */
    readonly axisColor?: LiteralUnion<AnsiColors, string>;

    /**
     * Chart body height in character rows.
     * @default 10
     */
    readonly height?: number;

    /**
     * Upper bound for the y-axis. When omitted the chart auto-scales.
     */
    readonly maxY?: number;

    /**
     * Lower bound for the y-axis. When omitted the chart auto-scales.
     */
    readonly minY?: number;

    /**
     * Fallback palette cycled through when a series does not set `color`.
     * @default ["cyan", "magenta", "yellow", "green", "blue", "red"]
     */
    readonly palette?: ReadonlyArray<LiteralUnion<AnsiColors, string>>;

    /**
     * One or more line series.
     */
    readonly series: ReadonlyArray<LineSeries>;

    /**
     * Render the legend row under the plot.
     * @default true
     */
    readonly showLegend?: boolean;

    /**
     * Chart body width in character columns.
     * @default 40
     */
    readonly width?: number;
};

const DEFAULT_PALETTE = DEFAULT_CHART_PALETTE;

type RenderConfig = {
    readonly axisColor: LiteralUnion<AnsiColors, string>;
    readonly palette: ReadonlyArray<LiteralUnion<AnsiColors, string>>;
    readonly seriesList: ReadonlyArray<{ color: LiteralUnion<AnsiColors, string>; points: ReadonlyArray<Point>; series: LineSeries }>;
    readonly xMax: number;
    readonly xMin: number;
    readonly yMax: number;
    readonly yMin: number;
};

/**
 * Project an (x, y) data point into pixel-grid coordinates for the given
 * canvas size. Used by every chart that paints on top of a braille grid.
 */
// eslint-disable-next-line react-refresh/only-export-components -- shared chart helper used by area-chart and scatter-plot
export const projectPoint = (
    point: Point,
    config: Pick<RenderConfig, "xMax" | "xMin" | "yMax" | "yMin">,
    pixelWidth: number,
    pixelHeight: number,
): { px: number; py: number } => {
    const xRange = config.xMax - config.xMin || 1;
    const yRange = config.yMax - config.yMin || 1;
    const nx = (point.x - config.xMin) / xRange;
    const ny = (point.y - config.yMin) / yRange;

    return {
        px: Math.max(0, Math.min(pixelWidth - 1, Math.round(nx * (pixelWidth - 1)))),
        py: Math.max(0, Math.min(pixelHeight - 1, Math.round((1 - ny) * (pixelHeight - 1)))),
    };
};

/**
 * Shared drawing path used by LineChart and ScatterPlot. AreaChart wraps
 * this with a fill pass.
 */
// eslint-disable-next-line react-refresh/only-export-components -- shared chart helper used by area-chart and scatter-plot
export const drawSeriesOnCanvas = (context: CanvasContext, mode: "line" | "scatter", config: RenderConfig): void => {
    context.clear();

    const { axisColor, seriesList } = config;
    const pixelWidth = Math.max(1, context.width * 2);
    const pixelHeight = Math.max(1, context.height * 4);

    // Dashed baseline at the bottom of the plot in axis color.
    for (let cellX = 0; cellX < context.width; cellX += 2) {
        context.setCell(cellX, context.height - 1, "·", { color: axisColor, dim: true });
    }

    for (const { color, points } of seriesList) {
        if (points.length === 0) {
            continue;
        }

        const grid = createBrailleGrid(context.width, context.height);

        if (mode === "scatter") {
            for (const point of points) {
                const projected = projectPoint(point, config, pixelWidth, pixelHeight);

                grid.plotPoint(projected.px, projected.py);
            }
        } else {
            let previous = projectPoint(points[0]!, config, pixelWidth, pixelHeight);

            grid.plotPoint(previous.px, previous.py);

            for (let index = 1; index < points.length; index += 1) {
                const current = projectPoint(points[index]!, config, pixelWidth, pixelHeight);

                grid.plotLine(previous.px, previous.py, current.px, current.py);
                previous = current;
            }
        }

        grid.flush(context, { color });
    }
};

/**
 * Smooth multi-series line chart rendered at 2x4 sub-cell resolution using
 * Unicode braille patterns. Auto-scales both axes by default.
 */
export default function LineChart({
    axisColor = "gray",
    height = 10,
    maxY,
    minY,
    palette = DEFAULT_PALETTE,
    series,
    showLegend = true,
    width = 40,
}: LineChartProps): ReactElement {
    const config = useMemo<RenderConfig>(() => {
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
            xMax: extents.xMax === Number.NEGATIVE_INFINITY ? 1 : extents.xMax,
            xMin: extents.xMin === Number.POSITIVE_INFINITY ? 0 : extents.xMin,
            yMax: maxY ?? (extents.yMax === Number.NEGATIVE_INFINITY ? 1 : extents.yMax),
            yMin: minY ?? (extents.yMin === Number.POSITIVE_INFINITY ? 0 : extents.yMin),
        };
    }, [series, axisColor, palette, minY, maxY]);

    return (
        <Box flexDirection="column">
            <Canvas
                // eslint-disable-next-line react-perf/jsx-no-new-function-as-prop -- canvas re-renders on `version` change, not draw identity
                draw={(context: CanvasContext) => {
                    drawSeriesOnCanvas(context, "line", config);
                }}
                height={height}
                // eslint-disable-next-line react-perf/jsx-no-new-array-as-prop -- version array is the canvas redraw key
                version={[series, width, height, minY, maxY, axisColor, palette]}
                width={width}
            />
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

export type { RenderConfig as LineChartRenderConfig };
