/* eslint-disable react/function-component-definition */
import type { AnsiColors } from "@visulima/colorize";
import type { ReactElement } from "react";
import { useMemo } from "react";
import type { LiteralUnion } from "type-fest";

import Text from "./text";

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
     * Optional fixed minimum for the vertical scale.
     * When omitted the minimum data value is used.
     */
    readonly min?: number;

    /**
     * Optional fixed maximum for the vertical scale.
     * When omitted the maximum data value is used.
     */
    readonly max?: number;
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

/**
 * Inline bar chart using Unicode block glyphs.
 */
export default function Sparkline({ color, data, max, min }: Props): ReactElement | null {
    const chart = useMemo(() => {
        if (data.length === 0) {
            return "";
        }

        const lo = min ?? Math.min(...data);
        const hi = max ?? Math.max(...data);
        const range = hi - lo;

        return data.map((value) => resolveGlyph(value, lo, range)).join("");
    }, [data, min, max]);

    if (chart.length === 0) {
        return null;
    }

    return <Text color={color}>{chart}</Text>;
}
