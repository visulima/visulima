/* eslint-disable react/function-component-definition */
import type { AnsiColors } from "@visulima/colorize";
import type { ReactElement } from "react";
import { useMemo } from "react";
import type { LiteralUnion } from "type-fest";

import { createBrailleGrid } from "../canvas/braille";
import type { CanvasContext } from "../canvas/buffer";
import Box from "./box";
import Canvas from "./canvas";
import Text from "./text";

export type GaugeThreshold = {
    /**
     * Color used for the arc segment and, when the current value falls into
     * this segment, for the value readout.
     */
    readonly color: LiteralUnion<AnsiColors, string>;

    /**
     * Optional label used by the legend under the gauge.
     */
    readonly label?: string;

    /**
     * Upper bound of this threshold segment (inclusive). Segments are sorted
     * ascending and painted in order.
     */
    readonly max: number;
};

export type GaugeSize = "large" | "medium" | "small";

export type Props = {
    /**
     * Color of the arc background (the portion beyond `value`).
     * @default "gray"
     */
    readonly backgroundColor?: LiteralUnion<AnsiColors, string>;

    /**
     * Format for the numeric readout. Defaults to rounding to an integer.
     */
    readonly formatValue?: (value: number) => string;

    /**
     * Optional label rendered above the readout.
     */
    readonly label?: string;

    /**
     * Upper bound of the range.
     * @default 100
     */
    readonly max?: number;

    /**
     * Lower bound of the range.
     * @default 0
     */
    readonly min?: number;

    /**
     * Show a legend listing thresholds below the gauge.
     * @default false
     */
    readonly showLegend?: boolean;

    /**
     * Show a numeric readout in the middle of the gauge.
     * @default true
     */
    readonly showValue?: boolean;

    /**
     * Overall dimension preset.
     * @default "medium"
     */
    readonly size?: GaugeSize;

    /**
     * Color threshold ramp. When provided, segments of the arc are painted in
     * the corresponding colors and the value readout picks up the color for
     * the segment `value` lands in.
     */
    readonly thresholds?: ReadonlyArray<GaugeThreshold>;

    /**
     * Current value. Clamped into the `[min, max]` range.
     */
    readonly value: number;
};

type Size = { readonly cols: number; readonly rows: number };

const SIZES: Record<GaugeSize, Size> = {
    large: { cols: 40, rows: 10 },
    medium: { cols: 24, rows: 6 },
    small: { cols: 16, rows: 4 },
};

const NEEDLE_RATIO = 0.9;
const ARC_ANGLE_STEPS_PER_PIXEL = 2;

const defaultFormat = (value: number): string => String(Math.round(value));

/**
 * Find the threshold segment that `ratio` lands in. `ratio` is in [0, 1] and
 * maps onto the [min, max] range.
 */
const thresholdAtRatio = (thresholds: ReadonlyArray<GaugeThreshold>, min: number, max: number, ratio: number): GaugeThreshold | undefined => {
    const value = min + (max - min) * ratio;

    for (const threshold of thresholds) {
        if (value <= threshold.max) {
            return threshold;
        }
    }

    return thresholds[thresholds.length - 1];
};

/**
 * Semi-circular gauge rendered at 2x4 sub-cell resolution. Supports colored
 * threshold segments and an optional needle.
 */
export default function Gauge({
    backgroundColor = "gray",
    formatValue = defaultFormat,
    label,
    max = 100,
    min = 0,
    showLegend = false,
    showValue = true,
    size = "medium",
    thresholds,
    value,
}: Props): ReactElement {
    const { cols, rows } = SIZES[size];
    const clampedValue = Math.max(min, Math.min(max, value));
    const range = max - min || 1;
    const ratio = (clampedValue - min) / range;

    // Sort once per threshold change; reused by both the active-threshold
    // lookup and the draw loop below.
    const sortedThresholds = useMemo(() => {
        if (thresholds === undefined || thresholds.length === 0) {
            return undefined;
        }

        return [...thresholds].toSorted((a, b) => a.max - b.max);
    }, [thresholds]);

    const activeThreshold = useMemo(() => {
        if (sortedThresholds === undefined) {
            return undefined;
        }

        return thresholdAtRatio(sortedThresholds, min, max, ratio);
    }, [sortedThresholds, min, max, ratio]);

    const readout = formatValue(clampedValue);

    return (
        <Box flexDirection="column">
            <Canvas
                // eslint-disable-next-line react-perf/jsx-no-new-function-as-prop -- canvas re-renders on `version` change, not draw identity
                draw={(context: CanvasContext) => {
                    context.clear();

                    const pixelWidth = context.width * 2;
                    const pixelHeight = context.height * 4;
                    // Center at bottom middle of the grid.
                    const cx = pixelWidth / 2;
                    const cy = pixelHeight - 1;
                    // Leave 1 pixel of padding around the arc.
                    const rx = pixelWidth / 2 - 1;
                    const ry = pixelHeight - 1;
                    const radius = Math.max(1, Math.min(rx, ry));

                    // One braille grid per color so different segments keep
                    // their colors cleanly (each flush paints its own color).
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

                    const arcSteps = Math.max(32, Math.round(Math.PI * radius) * ARC_ANGLE_STEPS_PER_PIXEL);

                    for (let step = 0; step <= arcSteps; step += 1) {
                        // θ from π (left) to 0 (right)
                        const stepRatio = step / arcSteps;
                        const angle = Math.PI * (1 - stepRatio);
                        const px = Math.round(cx + radius * Math.cos(angle));
                        const py = Math.round(cy - radius * Math.sin(angle));

                        let color: string;

                        if (stepRatio > ratio) {
                            color = backgroundColor;
                        } else if (sortedThresholds) {
                            const segment = thresholdAtRatio(sortedThresholds, min, max, stepRatio);

                            color = segment?.color ?? "cyan";
                        } else {
                            color = "cyan";
                        }

                        const grid = gridFor(color);

                        grid.plotPoint(px, py);
                    }

                    // Needle: from center to current position at NEEDLE_RATIO of the radius.
                    const needleRadius = radius * NEEDLE_RATIO;
                    const needleAngle = Math.PI * (1 - ratio);
                    const nx = Math.round(cx + needleRadius * Math.cos(needleAngle));
                    const ny = Math.round(cy - needleRadius * Math.sin(needleAngle));
                    const needleColor = (activeThreshold?.color ?? "white") as string;
                    const needleGrid = gridFor(needleColor);

                    needleGrid.plotLine(Math.round(cx), Math.round(cy), nx, ny);

                    for (const [color, grid] of gridsByColor) {
                        grid.flush(context, { color });
                    }
                }}
                height={rows}
                // eslint-disable-next-line react-perf/jsx-no-new-array-as-prop -- version array is the canvas redraw key
                version={[value, min, max, size, thresholds, backgroundColor]}
                width={cols}
            />
            {showValue || label
                ? (
                <Box flexDirection="column">
                    {label === undefined
                        ? undefined
                        : (
                        <Box justifyContent="center">
                            <Text dimColor>{label}</Text>
                        </Box>
                        )}
                    {showValue
                        ? (
                        <Box justifyContent="center">
                            <Text bold color={activeThreshold?.color ?? "white"}>
                                {readout}
                            </Text>
                        </Box>
                        )
                        : undefined}
                </Box>
                )
                : undefined}
            {showLegend && thresholds && thresholds.length > 0 ? (
                <Box gap={2} justifyContent="center" marginTop={1}>
                    {thresholds.map((threshold, index) => (
                        // eslint-disable-next-line react-x/no-array-index-key -- threshold index is stable for the render
                        <Box gap={1} key={index}>
                            <Text color={threshold.color}>●</Text>
                            <Text dimColor>{threshold.label ?? `≤ ${threshold.max}`}</Text>
                        </Box>
                    ))}
                </Box>
            ) : undefined}
        </Box>
    );
}
