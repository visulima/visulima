/* eslint-disable react/function-component-definition */
import type { AnsiColors } from "@visulima/colorize";
import type { ReactElement } from "react";
import { useMemo } from "react";
import type { LiteralUnion } from "type-fest";

import { createBrailleGrid } from "../canvas/braille";
import type { CanvasContext } from "../canvas/buffer";
import Box from "./box";
import Canvas from "./canvas";
import type { LineSeries } from "./line-chart";
import { projectPoint } from "./line-chart";
import Text from "./text";

export type Props = {
    /**
     * Axis label color.
     * @default "gray"
     */
    readonly axisColor?: LiteralUnion<AnsiColors, string>;

    /**
     * Density of the shaded fill below each line.
     * - `light` → `░`
     * - `medium` → `▒` (default)
     * - `heavy` → `▓`
     */
    readonly fillDensity?: "heavy" | "light" | "medium";

    /**
     * Chart body height in character rows.
     * @default 10
     */
    readonly height?: number;

    /**
     * Upper bound for the y-axis.
     */
    readonly maxY?: number;

    /**
     * Lower bound for the y-axis.
     */
    readonly minY?: number;

    /**
     * Fallback palette.
     */
    readonly palette?: ReadonlyArray<LiteralUnion<AnsiColors, string>>;

    /**
     * Render the legend below the plot.
     * @default true
     */
    readonly showLegend?: boolean;

    /**
     * Series to plot.
     */
    readonly series: ReadonlyArray<LineSeries>;

    /**
     * Chart body width in character columns.
     * @default 40
     */
    readonly width?: number;
};

const DEFAULT_PALETTE: ReadonlyArray<LiteralUnion<AnsiColors, string>> = [
    "cyan",
    "magenta",
    "yellow",
    "green",
    "blue",
    "red",
];

const FILL_GLYPH: Record<Required<Props>["fillDensity"], string> = {
    heavy: "▓",
    light: "░",
    medium: "▒",
};

type Point = { readonly x: number; readonly y: number };

const toPoints = (data: LineSeries["data"]): ReadonlyArray<Point> => {
    if (data.length === 0) {
        return [];
    }

    const first = data[0];

    if (typeof first === "number") {
        return (data as ReadonlyArray<number>).map((y, x) => ({ x, y }));
    }

    return data as ReadonlyArray<Point>;
};

const colorFor = (series: LineSeries, index: number, palette: ReadonlyArray<LiteralUnion<AnsiColors, string>>): LiteralUnion<AnsiColors, string> =>
    series.color ?? palette[index % palette.length] ?? "cyan";

/**
 * Area chart: line chart with the area between the line and the baseline
 * filled with shaded blocks.
 */
export default function AreaChart({
    axisColor = "gray",
    fillDensity = "medium",
    height = 10,
    maxY,
    minY,
    palette = DEFAULT_PALETTE,
    showLegend = true,
    series,
    width = 40,
}: Props): ReactElement {
    const prepared = useMemo(() => {
        const list = series.map((input, index) => ({
            color: colorFor(input, index, palette),
            points: toPoints(input.data),
            series: input,
        }));

        let xMin = Infinity;
        let xMax = -Infinity;
        let yMin = Infinity;
        let yMax = -Infinity;

        for (const { points } of list) {
            for (const point of points) {
                if (point.x < xMin) {
                    xMin = point.x;
                }

                if (point.x > xMax) {
                    xMax = point.x;
                }

                if (point.y < yMin) {
                    yMin = point.y;
                }

                if (point.y > yMax) {
                    yMax = point.y;
                }
            }
        }

        return {
            list,
            xMax: xMax === -Infinity ? 1 : xMax,
            xMin: xMin === Infinity ? 0 : xMin,
            yMax: maxY ?? (yMax === -Infinity ? 1 : yMax),
            yMin: minY ?? (yMin === Infinity ? 0 : yMin),
        };
    }, [series, palette, minY, maxY]);

    const glyph = FILL_GLYPH[fillDensity];

    return (
        <Box flexDirection="column">
            <Canvas
                draw={(ctx: CanvasContext) => {
                    ctx.clear();

                    const pixelWidth = ctx.width * 2;
                    const pixelHeight = ctx.height * 4;
                    const config = {
                        xMax: prepared.xMax,
                        xMin: prepared.xMin,
                        yMax: prepared.yMax,
                        yMin: prepared.yMin,
                    };

                    // Fill layer — drawn below the line so the braille overlay stays crisp.
                    for (const { color, points } of prepared.list) {
                        if (points.length === 0) {
                            continue;
                        }

                        // Sample the line once per character column and fill from
                        // that row down to the baseline.
                        for (let cellX = 0; cellX < ctx.width; cellX += 1) {
                            // Find the data point that projects into this column.
                            // Linear scan is fine for reasonable point counts;
                            // larger datasets should pre-resample.
                            let sampleY: number | undefined;

                            for (const point of points) {
                                const { px } = projectPoint(point, config, pixelWidth, pixelHeight);
                                const candidateCellX = Math.floor(px / 2);

                                if (candidateCellX === cellX) {
                                    const { py } = projectPoint(point, config, pixelWidth, pixelHeight);
                                    const candidateCellY = Math.floor(py / 4);

                                    if (sampleY === undefined || candidateCellY < sampleY) {
                                        sampleY = candidateCellY;
                                    }
                                }
                            }

                            if (sampleY === undefined) {
                                continue;
                            }

                            for (let cellY = sampleY + 1; cellY < ctx.height; cellY += 1) {
                                ctx.setCell(cellX, cellY, glyph, { color, dim: true });
                            }
                        }
                    }

                    // Dashed baseline.
                    for (let cellX = 0; cellX < ctx.width; cellX += 2) {
                        ctx.setCell(cellX, ctx.height - 1, "·", { color: axisColor, dim: true });
                    }

                    // Line overlay using braille.
                    for (const { color, points } of prepared.list) {
                        if (points.length === 0) {
                            continue;
                        }

                        const grid = createBrailleGrid(ctx.width, ctx.height);
                        let previous = projectPoint(points[0]!, config, pixelWidth, pixelHeight);

                        grid.plotPoint(previous.px, previous.py);

                        for (let index = 1; index < points.length; index += 1) {
                            const current = projectPoint(points[index]!, config, pixelWidth, pixelHeight);

                            grid.plotLine(previous.px, previous.py, current.px, current.py);
                            previous = current;
                        }

                        grid.flush(ctx, { bold: true, color });
                    }
                }}
                height={height}
                version={[series, width, height, minY, maxY, fillDensity]}
                width={width}
            />
            {showLegend ? (
                <Box gap={2} marginTop={1}>
                    {series.map((input, index) => {
                        const color = colorFor(input, index, palette);

                        return (
                            <Box gap={1} key={input.label ?? index}>
                                <Text color={color}>{glyph}</Text>
                                <Text>{input.label ?? `Series ${index + 1}`}</Text>
                            </Box>
                        );
                    })}
                </Box>
            ) : undefined}
        </Box>
    );
}
