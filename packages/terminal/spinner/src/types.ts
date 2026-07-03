import type { SpinnerName as CliSpinnerName } from "cli-spinners";

/**
 * Names of custom spinners from Rattles and unicode-animations.
 */
// eslint-disable-next-line @stylistic/operator-linebreak
export type CustomSpinnerName =
    | "breathe"
    | "cascade"
    | "checkerboard"
    | "columns"
    | "diagSwipe"
    | "dna"
    | "doubleArrow"
    | "fillSweep"
    | "helix"
    | "infinity"
    | "orbit"
    | "pulse"
    | "rain"
    | "scan"
    | "scanline"
    | "snake"
    | "sparkle"
    | "wave"
    | "waveRows";

/**
 * Union of all available spinner names.
 */
export type SpinnerName = CliSpinnerName | CustomSpinnerName;

/**
 * Represents a single frame-based spinner animation.
 */
export interface SpinnerFrame {
    /** Array of frame strings to display sequentially */
    frames: string[];
    /** Interval in milliseconds between frames */
    interval: number;
}

/**
 * Spinner style configuration.
 *
 * Describes visual styling to apply to spinner frames and icons.
 * Uses Node.js `util.styleText` by default.
 */
export interface SpinnerStyle {
    /** Background color name (e.g., "bgRed", "bgBlue") */
    bgColor?: string;
    /** Apply bold style */
    bold?: boolean;
    /** Foreground color name (e.g., "red", "blue", "green") */
    color?: string;
    /** Apply dim/faint style */
    dim?: boolean;
    /** Apply italic style */
    italic?: boolean;
    /** Apply strikethrough style */
    strikethrough?: boolean;
    /** Apply underline style */
    underline?: boolean;
}

/**
 * Spinner completion icons.
 */
export interface SpinnerIcons {
    /** Icon to show on failure (default: "✖") */
    error?: string;
    /** Icon to show on info (default: "ℹ") */
    info?: string;
    /** Icon to show on success (default: "✓") */
    success?: string;
    /** Icon to show on warning (default: "⚠") */
    warning?: string;
}

/**
 * Options for creating a Spinner instance.
 */
export interface SpinnerOptions {
    /**
     * Custom frame set, mirroring ora's `spinner` option.
     *
     * Provide an explicit {@link SpinnerFrame} (`{ frames, interval }`) to use a
     * brand-specific animation without registering it in the bundled catalog.
     * When set, this takes precedence over {@link SpinnerOptions.name}.
     * @example
     * ```typescript
     * new Spinner({ frames: { frames: ["-", "\\", "|", "/"], interval: 80 } });
     * ```
     */
    frames?: SpinnerFrame;
    /** Custom icons for completion states */
    icons?: SpinnerIcons;
    /** Name of the spinner from the registry */
    name?: SpinnerName;
    /** Prefix text to show before the spinner */
    prefixText?: string;

    /**
     * Stream the spinner writes to when no `InteractiveManager` is supplied.
     *
     * Used to derive TTY/CI awareness (animation is auto-disabled on non-TTY
     * streams) and as the direct-output target in standalone mode. Defaults to
     * `process.stderr`.
     */
    stream?: NodeJS.WriteStream;

    /**
     * Style applied to spinner frames and icons.
     *
     * - Pass a `SpinnerStyle` object to use the default Node.js `util.styleText` renderer.
     * - Pass a `(text: string) => string` function for full control (e.g., using `@visulima/colorize`).
     * @example
     * ```typescript
     * // Declarative — uses Node.js util.styleText
     * new Spinner({ style: { bold: true, color: "blue" } });
     *
     * // Function — full control
     * import colorize from '@visulima/colorize';
     * new Spinner({ style: (text) => colorize.bold.blue(text) });
     * ```
     */
    style?: ((text: string) => string) | SpinnerStyle;
    /** Whether to output spinner (default: true) */
    verbose?: boolean;
}

/**
 * Options for starting a spinner.
 */
export interface SpinnerStartOptions {
    /** Prefix text to show before the spinner */
    prefixText?: string;
}

/**
 * Options for `spinnerPromise`, the `oraPromise`-style helper.
 */
export interface SpinnerPromiseOptions extends SpinnerOptions {
    /**
     * Text (or a function receiving the rejection reason) shown when the promise
     * rejects. When omitted the in-progress `text` is kept.
     */
    failText?: ((error: unknown) => string) | string;

    /**
     * Text (or a function receiving the resolved value) shown when the promise
     * resolves. When omitted the in-progress `text` is kept.
     */
    successText?: ((result: never) => string) | string;
    /** Initial text shown while the promise is pending. */
    text?: string;
}
