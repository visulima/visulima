/* eslint-disable react/function-component-definition */
import type { AnsiColors } from "@visulima/colorize";
import type { ReactElement } from "react";
import { useMemo } from "react";
import type { LiteralUnion } from "type-fest";

import BarChart from "./bar-chart";

export type Props = {
    /**
     * Number of equal-width buckets. Ignored if `thresholds` is set.
     * @default 10
     */
    readonly bins?: number;

    /**
     * Bar color.
     */
    readonly color?: LiteralUnion<AnsiColors, string>;

    /**
     * Raw values to bin.
     */
    readonly data: ReadonlyArray<number>;

    /**
     * Plot height in character rows.
     * @default 10
     */
    readonly height?: number;

    /**
     * Optional fixed maximum.
     */
    readonly max?: number;

    /**
     * Optional fixed minimum.
     */
    readonly min?: number;

    /**
     * Render a numeric count above each bucket.
     * @default false
     */
    readonly showValues?: boolean;

    /**
     * Explicit bin edges. When provided, `bins`, `min`, and `max` are ignored.
     * Must be strictly increasing.
     */
    readonly thresholds?: ReadonlyArray<number>;

    /**
     * Plot width in character columns.
     */
    readonly width?: number;
};

type Bucket = {
    readonly count: number;
    readonly label: string;
};

const computeThresholds = (min: number, max: number, bins: number): ReadonlyArray<number> => {
    if (bins <= 0 || min >= max) {
        return [min, max];
    }

    const step = (max - min) / bins;

    return Array.from({ length: bins + 1 }, (_, index) => min + index * step);
};

const binData = (data: ReadonlyArray<number>, thresholds: ReadonlyArray<number>): ReadonlyArray<Bucket> => {
    if (thresholds.length < 2) {
        return [];
    }

    const counts: number[] = Array.from({ length: thresholds.length - 1 }, () => 0);
    const lowerBound = thresholds[0]!;
    const upperBound = thresholds[thresholds.length - 1]!;

    for (const value of data) {
        // Skip values that fall outside the configured range — both
        // underflow and overflow are dropped symmetrically.
        if (value < lowerBound || value > upperBound) {
            continue;
        }

        // Find the bucket via linear scan (fine for typical bin counts).
        for (let index = 0; index < thresholds.length - 1; index += 1) {
            const isLastBin = index === thresholds.length - 2;
            const upper = thresholds[index + 1]!;
            const withinBin = value < upper || (isLastBin && value <= upper);

            if (withinBin) {
                counts[index] = (counts[index] ?? 0) + 1;
                break;
            }
        }
    }

    return counts.map((count, index) => {
        const low = thresholds[index]!;
        const high = thresholds[index + 1]!;

        return {
            count,
            label: `${Math.round(low)}-${Math.round(high)}`,
        };
    });
};

/**
 * Histogram built on top of BarChart. Bins the raw values (via explicit
 * thresholds or equal-width bins) and hands the counts off to BarChart.
 * @param props See {@link Props}.
 * @returns A `ReactElement` rendering a BarChart of bucket counts.
 */
export default function Histogram({
    bins = 10,
    color,
    data,
    height = 10,
    max: maxOverride,
    min: minOverride,
    showValues = false,
    thresholds,
    width,
}: Props): ReactElement {
    const buckets = useMemo(() => {
        if (thresholds && thresholds.length >= 2) {
            return binData(data, thresholds);
        }

        if (data.length === 0) {
            return [];
        }

        let min = minOverride ?? Infinity;
        let max = maxOverride ?? -Infinity;

        if (minOverride === undefined || maxOverride === undefined) {
            for (const value of data) {
                if (minOverride === undefined && value < min) {
                    min = value;
                }

                if (maxOverride === undefined && value > max) {
                    max = value;
                }
            }
        }

        if (min === max) {
            return [{ count: data.length, label: `${min}` }];
        }

        return binData(data, computeThresholds(min, max, bins));
    }, [data, thresholds, bins, minOverride, maxOverride]);

    return (
        <BarChart
            data={buckets.map((bucket) => {
                return { color, label: bucket.label, value: bucket.count };
            })}
            height={height}
            orientation="vertical"
            showLabels
            showValues={showValues}
            width={width}
        />
    );
}
