/* eslint-disable react/function-component-definition */
import type { AnsiColors } from "@visulima/colorize";
import type { ReactElement } from "react";
import { useMemo } from "react";
import type { LiteralUnion } from "type-fest";

import type { CanvasContext } from "../canvas/buffer";
import Box from "./box";
import Canvas from "./canvas";
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

const DEFAULT_PALETTE: ReadonlyArray<LiteralUnion<AnsiColors, string>> = [
    "cyan",
    "magenta",
    "yellow",
    "green",
    "blue",
    "red",
];

type Point = { readonly x: number; readonly y: number };

const toPoints = (data: LineSeries["data"]): ReadonlyArray<Point> => {
    if (data.length === 0) {
        return [];
    }

    return typeof data[0] === "number"
        ? (data as ReadonlyArray<number>).map((y, x) => ({ x, y }))
        : (data as ReadonlyArray<Point>);
};

const colorFor = (series: LineSeries, index: number, palette: ReadonlyArray<LiteralUnion<AnsiColors, string>>): LiteralUnion<AnsiColors, string> =>
    series.color ?? palette[index % palette.length] ?? "cyan";

/**
 * Scatter plot rendered on a braille pixel grid. Each sample lights one
 * sub-cell pixel; overlapping points merge into denser braille glyphs.
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
        const seriesList = series.map((input, index) => ({
            color: colorFor(input, index, palette),
            points: toPoints(input.data),
            series: input,
        }));

        let xMin = Infinity;
        let xMax = -Infinity;
        let yMin = Infinity;
        let yMax = -Infinity;

        for (const { points } of seriesList) {
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
            axisColor,
            palette,
            seriesList,
            xMax: maxX ?? (xMax === -Infinity ? 1 : xMax),
            xMin: minX ?? (xMin === Infinity ? 0 : xMin),
            yMax: maxY ?? (yMax === -Infinity ? 1 : yMax),
            yMin: minY ?? (yMin === Infinity ? 0 : yMin),
        };
    }, [series, axisColor, palette, minX, maxX, minY, maxY]);

    return (
        <Box flexDirection="column">
            <Canvas
                draw={(ctx: CanvasContext) => {
                    drawSeriesOnCanvas(ctx, "scatter", config);
                }}
                height={height}
                version={[series, width, height, minX, maxX, minY, maxY]}
                width={width}
            />
            {showLegend ? (
                <Box gap={2} marginTop={1}>
                    {config.seriesList.map(({ color, series: input }, index) => (
                        <Box gap={1} key={input.label ?? index}>
                            <Text color={color}>●</Text>
                            <Text>{input.label ?? `Series ${index + 1}`}</Text>
                        </Box>
                    ))}
                </Box>
            ) : undefined}
        </Box>
    );
}
