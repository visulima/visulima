export type ProgressBarStyle = "shades_classic" | "shades_grey" | "rect" | "filled" | "solid" | "ascii" | "braille" | "custom";

/**
 * Callback used to transform the rendered bar segment (e.g. apply ANSI colors)
 * before it is interpolated into the `{bar}` token.
 * @param bar The fully rendered bar string (filled + incomplete characters).
 * @param state Live progress numbers for conditional formatting.
 * @returns The bar string to interpolate into the format template.
 */
export type FormatBarFunction = (bar: string, state: { percentage: number; total: number; value: number }) => string;

export interface ProgressBarOptions {
    barCompleteChar?: string | string[];
    barGlue?: string;
    barIncompleteChar?: string | string[];

    /**
     * Erase the rendered bar from the terminal when the bar is stopped.
     * Only has an effect when an `InteractiveManager` is attached.
     * @default false
     */
    clearOnComplete?: boolean;
    current?: number;

    /**
     * Format template. Supported tokens:
     * - `{bar}` — the rendered bar segment
     * - `{percentage}` — integer percentage (0-100)
     * - `{value}` — current value
     * - `{total}` — total value
     * - `{eta}` — estimated seconds remaining (raw number)
     * - `{eta_formatted}` — estimated time remaining, formatted (e.g. `1m30s`)
     * - `{duration}` — elapsed time since `start()`, formatted (e.g. `1m30s`)
     * - `{rate}` — processed items per second (rounded)
     * - any key present on the `payload` object
     * @default "progress [{bar}] {percentage}% | ETA: {eta}s | {value}/{total}"
     */
    format?: string;

    /**
     * Optional callback to transform the rendered bar segment (e.g. colorize it).
     */
    formatBar?: FormatBarFunction;

    /**
     * Maximum number of live renders per second. Renders that arrive faster than
     * this are coalesced; the final frame is always flushed on `stop()`.
     * Only throttles live (`InteractiveManager`) rendering — `render()` is never throttled.
     * @default 10
     */
    fps?: number;
    peak?: number;
    peakChar?: string;
    roundedCaps?: boolean;

    /**
     * Automatically clear the bar (if `clearOnComplete`) and stop it once the
     * current value reaches the total.
     * @default false
     */
    stopOnComplete?: boolean;
    style?: ProgressBarStyle;
    total: number;
    width?: number;
}

export interface MultiBarOptions {
    barCompleteChar?: string | string[];
    barGlue?: string;
    barIncompleteChar?: string | string[];

    /**
     * Render all bars stacked into a single composite bar instead of one line per bar.
     * Requires the `format` to contain a bracketed `[{bar}]` region.
     * @default false
     */
    composite?: boolean;
    format?: string;

    /**
     * Optional callback applied to every created bar's rendered segment.
     */
    formatBar?: FormatBarFunction;
    fps?: number;
    style?: ProgressBarStyle;
}

/**
 * Per-bar overrides for `MultiProgressBar.create()`. Any option omitted here
 * falls back to the `MultiProgressBar` defaults.
 */
export interface MultiBarCreateOptions {
    barCompleteChar?: string | string[];
    barGlue?: string;
    barIncompleteChar?: string | string[];
    format?: string;
    formatBar?: FormatBarFunction;
    fps?: number;
    style?: ProgressBarStyle;
    width?: number;
}

export interface ProgressBarPayload {
    [key: string]: string | number | boolean;
}
