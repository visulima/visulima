/* eslint-disable react/function-component-definition */
import type { AnsiColors } from "@visulima/colorize";
import Text from "@visulima/tui/components/text";
import type { ReactElement } from "react";
import { useMemo } from "react";
import type { LiteralUnion } from "type-fest";

export type Props = {
    /**
     * Color applied to the chart glyphs.
     */
    readonly color?: LiteralUnion<AnsiColors, string>;

    /**
     * Data points to plot. Values may be any real numbers.
     */
    readonly data: ReadonlyArray<number>;

    /**
     * Optional fixed maximum for the vertical scale.
     * When omitted the maximum data value is used.
     */
    readonly max?: number;

    /**
     * Optional fixed minimum for the vertical scale.
     * When omitted the minimum data value is used.
     */
    readonly min?: number;
};

const GLYPHS = "▁▂▃▄▅▆▇█";

const resolveGlyph = (value: number, min: number, range: number): string => {
    if (range === 0) {
        return GLYPHS[0] as string;
    }

    const ratio = (value - min) / range;
    const index = Math.max(0, Math.min(GLYPHS.length - 1, Math.floor(ratio * GLYPHS.length)));

    return GLYPHS[index] as string;
};

type Extent = {
    readonly max: number;
    readonly min: number;
};

/**
 * Walk `data` once to find the min/max, falling back to user-supplied bounds.
 * Avoids `Math.min(...data)` which blows the call-stack on large arrays.
 */
const computeExtent = (data: ReadonlyArray<number>, minOverride: number | undefined, maxOverride: number | undefined): Extent => {
    let min = minOverride ?? Number.POSITIVE_INFINITY;
    let max = maxOverride ?? Number.NEGATIVE_INFINITY;

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

    return { max, min };
};

/**
 * Inline bar chart using Unicode block glyphs.
 * @returns A `ReactElement` containing the glyph string, or `null` when
 * `data` is empty.
 */
export default function Sparkline({ color, data, max, min }: Props): ReactElement | null {
    const chart = useMemo(() => {
        if (data.length === 0) {
            return "";
        }

        const { max: hi, min: lo } = computeExtent(data, min, max);
        const range = hi - lo;

        return data.map((value) => resolveGlyph(value, lo, range)).join("");
    }, [data, min, max]);

    if (chart.length === 0) {
        return null;
    }

    return <Text color={color}>{chart}</Text>;
}

export { Sparkline };
export type { Props as SparklineProps };
