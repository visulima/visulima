/* eslint-disable react/function-component-definition */
import type { AnsiColors } from "@visulima/colorize";
import type { ReactElement } from "react";
import { useMemo } from "react";
import type { LiteralUnion } from "type-fest";

import type { CanvasContext } from "../canvas/buffer";
import Box from "./box";
import Canvas from "./canvas";
import Text from "./text";

export type HeatmapProps = {
    /**
     * Width of each cell in character columns.
     * @default 2
     */
    readonly cellWidth?: number;

    /**
     * Character used to paint each heatmap cell. Defaults to `█` so the
     * background color fills the cell.
     * @default "█"
     */
    readonly character?: string;

    /**
     * Column labels rendered below the grid.
     */
    readonly columnLabels?: ReadonlyArray<string>;

    /**
     * 2D matrix, rows × cols.
     */
    readonly data: ReadonlyArray<ReadonlyArray<number>>;

    /**
     * Fixed maximum (for consistent scales across multiple heatmaps).
     */
    readonly max?: number;

    /**
     * Fixed minimum.
     */
    readonly min?: number;

    /**
     * Color palette, lowest-to-highest intensity. Values are mapped into the
     * palette by their position in the [min, max] range.
     * @default ["#0b1e4f", "#1f3b96", "#3258c8", "#4e84ec", "#78b0ff"]
     */
    readonly palette?: ReadonlyArray<string>;

    /**
     * Row labels rendered to the left of the grid.
     */
    readonly rowLabels?: ReadonlyArray<string>;

    /**
     * Foreground color override (rarely needed since the character is a full block).
     */
    readonly textColor?: LiteralUnion<AnsiColors, string>;
};

const DEFAULT_PALETTE: ReadonlyArray<string> = ["#0b1e4f", "#1f3b96", "#3258c8", "#4e84ec", "#78b0ff"];

/**
 * 2D heatmap. Each cell's background color is derived from its value's
 * position in the [min, max] range mapped into `palette`.
 */
export default function Heatmap({
    cellWidth = 2,
    character = "█",
    columnLabels,
    data,
    max: maxOverride,
    min: minOverride,
    palette = DEFAULT_PALETTE,
    rowLabels,
    textColor,
}: HeatmapProps): ReactElement {
    const { cols, colWidth, extent, rows } = useMemo(() => {
        const rowCount = data.length;
        const colCount = data.reduce((widest, row) => Math.max(widest, row.length), 0);

        let min = minOverride ?? Infinity;
        let max = maxOverride ?? -Infinity;

        if (minOverride === undefined || maxOverride === undefined) {
            for (const row of data) {
                for (const value of row) {
                    if (minOverride === undefined && value < min) {
                        min = value;
                    }

                    if (maxOverride === undefined && value > max) {
                        max = value;
                    }
                }
            }
        }

        return {
            cols: colCount,
            colWidth: cellWidth,
            extent: { max, min },
            rows: rowCount,
        };
    }, [data, minOverride, maxOverride, cellWidth]);

    const width = cols * colWidth;
    const height = rows;

    return (
        <Box>
            {rowLabels === undefined
                ? undefined
                : (
                    <Box flexDirection="column" marginRight={1}>
                        {Array.from({ length: rows }, (_, index) => (
                            <Text dimColor key={index}>
                                {rowLabels[index] ?? ""}
                            </Text>
                        ))}
                    </Box>
                )}
            <Box flexDirection="column">
                <Canvas
                    draw={(context: CanvasContext) => {
                        context.clear();

                        const { max, min } = extent;
                        const range = max - min || 1;
                        const paletteLast = palette.length - 1;

                        for (let row = 0; row < rows; row += 1) {
                            for (let col = 0; col < cols; col += 1) {
                                const value = data[row]?.[col];
                                const background
                                    = value === undefined
                                        ? undefined
                                        : palette[Math.max(0, Math.min(paletteLast, Math.round(((value - min) / range) * paletteLast)))];

                                for (let offset = 0; offset < colWidth; offset += 1) {
                                    context.setCell(col * colWidth + offset, row, character, {
                                        background,
                                        color: textColor,
                                    });
                                }
                            }
                        }
                    }}
                    height={height}
                    version={[data, palette, cellWidth, minOverride, maxOverride]}
                    width={width}
                />
                {columnLabels === undefined
                    ? undefined
                    : (
                        <Box>
                            {columnLabels.map((label, index) => (
                                <Box key={index} width={colWidth}>
                                    <Text dimColor wrap="truncate-end">
                                        {label}
                                    </Text>
                                </Box>
                            ))}
                        </Box>
                    )}
            </Box>
        </Box>
    );
}
