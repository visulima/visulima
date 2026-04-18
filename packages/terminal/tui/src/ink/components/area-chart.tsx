/* eslint-disable react/function-component-definition */
import type { AnsiColors } from "@visulima/colorize";
import type { ReactElement } from "react";
import { useMemo } from "react";
import type { LiteralUnion } from "type-fest";

import { createBrailleGrid } from "../canvas/braille";
import type { CanvasContext } from "../canvas/buffer";
import Box from "./box";
import Canvas from "./canvas";
import { computeExtents, DEFAULT_CHART_PALETTE, pickSeriesColor, toPoints } from "./chart-utils";
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
     * Series to plot.
     */
    readonly series: ReadonlyArray<LineSeries>;

    /**
     * Render the legend below the plot.
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

const FILL_GLYPH: Record<Required<Props>["fillDensity"], string> = {
    heavy: "▓",
    light: "░",
    medium: "▒",
};

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
    series,
    showLegend = true,
    width = 40,
}: Props): ReactElement {
    const prepared = useMemo(() => {
        const list = series.map((input, index) => {
            return {
                color: pickSeriesColor(input, index, palette),
                points: toPoints(input.data),
                series: input,
            };
        });

        const extents = computeExtents(list);

        return {
            list,
            xMax: extents.xMax === Number.NEGATIVE_INFINITY ? 1 : extents.xMax,
            xMin: extents.xMin === Number.POSITIVE_INFINITY ? 0 : extents.xMin,
            yMax: maxY ?? (extents.yMax === Number.NEGATIVE_INFINITY ? 1 : extents.yMax),
            yMin: minY ?? (extents.yMin === Number.POSITIVE_INFINITY ? 0 : extents.yMin),
        };
    }, [series, palette, minY, maxY]);

    const glyph = FILL_GLYPH[fillDensity];

    return (
        <Box flexDirection="column">
            <Canvas
                draw={(context: CanvasContext) => {
                    context.clear();

                    const pixelWidth = context.width * 2;
                    const pixelHeight = context.height * 4;
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
                        for (let cellX = 0; cellX < context.width; cellX += 1) {
                            // Find the data point that projects into this column.
                            // Linear scan is fine for reasonable point counts;
                            // larger datasets should pre-resample. One
                            // projection per point — reuse px AND py.
                            let sampleY: number | undefined;

                            for (const point of points) {
                                const { px, py } = projectPoint(point, config, pixelWidth, pixelHeight);
                                const candidateCellX = Math.floor(px / 2);

                                if (candidateCellX === cellX) {
                                    const candidateCellY = Math.floor(py / 4);

                                    if (sampleY === undefined || candidateCellY < sampleY) {
                                        sampleY = candidateCellY;
                                    }
                                }
                            }

                            if (sampleY === undefined) {
                                continue;
                            }

                            for (let cellY = sampleY + 1; cellY < context.height; cellY += 1) {
                                context.setCell(cellX, cellY, glyph, { color, dim: true });
                            }
                        }
                    }

                    // Dashed baseline.
                    for (let cellX = 0; cellX < context.width; cellX += 2) {
                        context.setCell(cellX, context.height - 1, "·", { color: axisColor, dim: true });
                    }

                    // Line overlay using braille.
                    for (const { color, points } of prepared.list) {
                        if (points.length === 0) {
                            continue;
                        }

                        const grid = createBrailleGrid(context.width, context.height);
                        let previous = projectPoint(points[0]!, config, pixelWidth, pixelHeight);

                        grid.plotPoint(previous.px, previous.py);

                        for (let index = 1; index < points.length; index += 1) {
                            const current = projectPoint(points[index]!, config, pixelWidth, pixelHeight);

                            grid.plotLine(previous.px, previous.py, current.px, current.py);
                            previous = current;
                        }

                        grid.flush(context, { bold: true, color });
                    }
                }}
                height={height}
                version={[series, width, height, minY, maxY, fillDensity, axisColor, palette]}
                width={width}
            />
            {showLegend ? (
                <Box gap={2} marginTop={1}>
                    {prepared.list.map(({ color, series: input }, index) => (
                        // Composite key: series index plus label so two
                        // series sharing a label don't collide.
                        <Box gap={1} key={`${index}:${input.label ?? ""}`}>
                            <Text color={color}>{glyph}</Text>
                            <Text>{input.label ?? `Series ${index + 1}`}</Text>
                        </Box>
                    ))}
                </Box>
            ) : undefined}
        </Box>
    );
}
