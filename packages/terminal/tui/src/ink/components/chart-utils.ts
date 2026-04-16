import type { AnsiColors } from "@visulima/colorize";
import type { LiteralUnion } from "type-fest";

/**
 * A single 2D data point.
 */
export type Point = { readonly x: number; readonly y: number };

/**
 * Minimal shape every "series-like" chart entry conforms to. Used so chart
 * components share utilities without coupling to a specific Props type.
 */
export type SeriesLike = {
    readonly color?: LiteralUnion<AnsiColors, string>;
    readonly data: ReadonlyArray<number> | ReadonlyArray<Point>;
    readonly label?: string;
};

/**
 * Default palette cycled through when a series does not declare its own color.
 */
export const DEFAULT_CHART_PALETTE: ReadonlyArray<LiteralUnion<AnsiColors, string>> = [
    "cyan",
    "magenta",
    "yellow",
    "green",
    "blue",
    "red",
];

/**
 * Normalize the per-series `data` prop into a uniform `Point[]`. Numeric
 * arrays are treated as y-values with their index as x.
 *
 * @param data Either a numeric array or an array of `{x, y}` points.
 * @returns A uniform `Point[]` — empty when no samples were provided.
 */
export const toPoints = (data: SeriesLike["data"]): ReadonlyArray<Point> => {
    if (data.length === 0) {
        return [];
    }

    const first = data[0];

    if (typeof first === "number") {
        return (data as ReadonlyArray<number>).map((y, x) => ({ x, y }));
    }

    return data as ReadonlyArray<Point>;
};

/**
 * Pick the effective color for a series: per-series override, else palette
 * cycling by index, with a safe `"cyan"` fallback.
 *
 * @param series The series whose color we want.
 * @param index The series index for palette cycling.
 * @param palette Fallback palette.
 * @returns The resolved color string.
 */
export const pickSeriesColor = (
    series: SeriesLike,
    index: number,
    palette: ReadonlyArray<LiteralUnion<AnsiColors, string>>,
): LiteralUnion<AnsiColors, string> =>
    series.color ?? palette[index % palette.length] ?? "cyan";
