/* eslint-disable react/function-component-definition */
import type { AnsiColors } from "@visulima/colorize";
import type { CanvasContext } from "@visulima/tui/canvas";
import { createBrailleGrid } from "@visulima/tui/canvas";
import Box from "@visulima/tui/components/box";
import Canvas from "@visulima/tui/components/canvas";
import Text from "@visulima/tui/components/text";
import type { ReactElement } from "react";
import { useMemo } from "react";
import type { LiteralUnion } from "type-fest";

export type PieSlice = {
    /**
     * Per-slice color override. Falls back to the chart palette.
     */
    readonly color?: LiteralUnion<AnsiColors, string>;
    readonly label?: string;
    readonly value: number;
};

export type Props = {
    /**
     * Slices to render. Non-positive values are ignored.
     */
    readonly data: ReadonlyArray<PieSlice>;

    /**
     * Format a slice's legend value. Defaults to `value (percent%)`.
     */
    readonly formatLegend?: (slice: PieSlice, percent: number) => string;

    /**
     * Fallback palette cycled through when a slice has no color.
     * @default ["cyan", "magenta", "yellow", "green", "blue", "red"]
     */
    readonly palette?: ReadonlyArray<LiteralUnion<AnsiColors, string>>;

    /**
     * Render a legend with per-slice values and percentages.
     * @default true
     */
    readonly showLegend?: boolean;

    /**
     * Diameter of the disc in character rows. Width is derived to keep the
     * circle roughly round given the 2x4 braille cell aspect.
     * @default 8
     */
    readonly size?: number;
};

const DEFAULT_PALETTE: ReadonlyArray<LiteralUnion<AnsiColors, string>> = ["cyan", "magenta", "yellow", "green", "blue", "red"];

const colorFor = (index: number, palette: ReadonlyArray<LiteralUnion<AnsiColors, string>>, slice: PieSlice): LiteralUnion<AnsiColors, string> =>
    slice.color ?? palette[index % palette.length] ?? "cyan";

const defaultLegend = (slice: PieSlice, percent: number): string => `${slice.label ?? ""} ${slice.value} (${percent.toFixed(0)}%)`.trim();

/**
 * A filled pie chart rendered at 2x4 braille sub-cell resolution. Each pixel of
 * the disc is assigned to the slice whose angular wedge contains it, so slices
 * keep clean colors. An optional legend lists values and percentages.
 */
export default function PieChart({
    data,
    formatLegend = defaultLegend,
    palette = DEFAULT_PALETTE,
    showLegend = true,
    size = 8,
}: Props): ReactElement {
    const slices = useMemo(() => data.filter((slice) => slice.value > 0), [data]);
    const total = useMemo(() => slices.reduce((sum, slice) => sum + slice.value, 0), [slices]);

    const rows = Math.max(2, size);
    // Braille cells are 2 wide × 4 tall; double the columns so the disc reads round.
    const cols = Math.max(2, Math.round((rows * 4) / 2 / 2));

    return (
        <Box flexDirection="row" gap={2}>
            <Canvas
                // eslint-disable-next-line react-perf/jsx-no-new-function-as-prop -- canvas re-renders on `version` change, not draw identity
                draw={(context: CanvasContext) => {
                    context.clear();

                    if (total <= 0) {
                        return;
                    }

                    const pixelWidth = context.width * 2;
                    const pixelHeight = context.height * 4;
                    const cx = pixelWidth / 2;
                    const cy = pixelHeight / 2;
                    const radius = Math.max(1, Math.min(cx, cy) - 1);

                    // Precompute cumulative angle boundaries per slice (clockwise from top).
                    const bounds: { color: string; end: number; start: number }[] = [];
                    let accumulator = 0;

                    slices.forEach((slice, index) => {
                        const start = (accumulator / total) * Math.PI * 2;

                        accumulator += slice.value;

                        const end = (accumulator / total) * Math.PI * 2;

                        bounds.push({ color: colorFor(index, palette, slice), end, start });
                    });

                    const gridsByColor = new Map<string, ReturnType<typeof createBrailleGrid>>();
                    const gridFor = (color: string) => {
                        const existing = gridsByColor.get(color);

                        if (existing !== undefined) {
                            return existing;
                        }

                        const grid = createBrailleGrid(context.width, context.height);

                        gridsByColor.set(color, grid);

                        return grid;
                    };

                    for (let py = 0; py < pixelHeight; py += 1) {
                        for (let px = 0; px < pixelWidth; px += 1) {
                            const dx = px - cx;
                            const dy = py - cy;

                            if (dx * dx + dy * dy > radius * radius) {
                                continue;
                            }

                            // Angle clockwise from the top (12 o'clock).
                            let angle = Math.atan2(dx, -dy);

                            if (angle < 0) {
                                angle += Math.PI * 2;
                            }

                            const slice = bounds.find((bound) => angle >= bound.start && angle < bound.end) ?? bounds[bounds.length - 1];

                            if (slice) {
                                gridFor(slice.color).plotPoint(px, py);
                            }
                        }
                    }

                    for (const [color, grid] of gridsByColor) {
                        grid.flush(context, { color });
                    }
                }}
                height={rows}
                // eslint-disable-next-line react-perf/jsx-no-new-array-as-prop -- version array is the canvas redraw key
                version={[data, total, palette, rows, cols]}
                width={cols}
            />
            {/* eslint-disable-next-line @stylistic/multiline-ternary -- prettier formats JSX ternaries on one line */}
            {showLegend && slices.length > 0 ? (
                <Box flexDirection="column">
                    {slices.map((slice, index) => (
                        // eslint-disable-next-line react-x/no-array-index-key -- slice index is stable for the render
                        <Box gap={1} key={index}>
                            <Text color={colorFor(index, palette, slice)}>●</Text>
                            <Text dimColor>{formatLegend(slice, (slice.value / total) * 100)}</Text>
                        </Box>
                    ))}
                </Box>
            ) : undefined}
        </Box>
    );
}

export { PieChart };
export type { Props as PieChartProps };
