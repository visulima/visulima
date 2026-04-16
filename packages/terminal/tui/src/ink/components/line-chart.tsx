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
import { DEFAULT_CHART_PALETTE, pickSeriesColor, toPoints } from "./chart-utils";
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
     * Render the legend row under the plot.
     * @default true
     */
    readonly showLegend?: boolean;

    /**
     * One or more line series.
     */
    readonly series: ReadonlyArray<LineSeries>;

    /**
     * Chart body width in character columns.
     * @default 40
     */
    readonly width?: number;
};

const DEFAULT_PALETTE = DEFAULT_CHART_PALETTE;

type Extent = { max: number; min: number };

const extendExtent = (extent: Extent, points: ReadonlyArray<Point>, axis: "x" | "y"): void => {
    for (const point of points) {
        const value = axis === "x" ? point.x : point.y;

        if (value < extent.min) {
            extent.min = value;
        }

        if (value > extent.max) {
            extent.max = value;
        }
    }
};

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
export const drawSeriesOnCanvas = (
    ctx: CanvasContext,
    mode: "line" | "scatter",
    config: RenderConfig,
): void => {
    ctx.clear();

    const { axisColor, seriesList } = config;
    const pixelWidth = Math.max(1, ctx.width * 2);
    const pixelHeight = Math.max(1, ctx.height * 4);

    // Dashed baseline at the bottom of the plot in axis color.
    for (let cellX = 0; cellX < ctx.width; cellX += 2) {
        ctx.setCell(cellX, ctx.height - 1, "·", { color: axisColor, dim: true });
    }

    for (const { color, points } of seriesList) {
        if (points.length === 0) {
            continue;
        }

        const grid = createBrailleGrid(ctx.width, ctx.height);

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

        grid.flush(ctx, { color });
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
    showLegend = true,
    series,
    width = 40,
}: LineChartProps): ReactElement {
    const config = useMemo<RenderConfig>(() => {
        const seriesList = series.map((input, index) => ({
            color: pickSeriesColor(input, index, palette),
            points: toPoints(input.data),
            series: input,
        }));

        const xExtent: Extent = { max: -Infinity, min: Infinity };
        const yExtent: Extent = { max: -Infinity, min: Infinity };

        for (const { points } of seriesList) {
            extendExtent(xExtent, points, "x");
            extendExtent(yExtent, points, "y");
        }

        return {
            axisColor,
            palette,
            seriesList,
            xMax: xExtent.max === -Infinity ? 1 : xExtent.max,
            xMin: xExtent.min === Infinity ? 0 : xExtent.min,
            yMax: maxY ?? (yExtent.max === -Infinity ? 1 : yExtent.max),
            yMin: minY ?? (yExtent.min === Infinity ? 0 : yExtent.min),
        };
    }, [series, axisColor, palette, minY, maxY]);

    return (
        <Box flexDirection="column">
            <Canvas
                draw={(ctx: CanvasContext) => {
                    drawSeriesOnCanvas(ctx, "line", config);
                }}
                height={height}
                version={[series, width, height, minY, maxY]}
                width={width}
            />
            {showLegend ? (
                <Box gap={2} marginTop={1}>
                    {series.map((input, index) => {
                        const color = pickSeriesColor(input, index, palette);

                        return (
                            <Box gap={1} key={input.label ?? index}>
                                <Text color={color}>●</Text>
                                <Text>{input.label ?? `Series ${index + 1}`}</Text>
                            </Box>
                        );
                    })}
                </Box>
            ) : undefined}
        </Box>
    );
}

export type { RenderConfig as LineChartRenderConfig };
