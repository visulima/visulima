/** Horizontal alignment of text/title within the box. */
export type Alignment = "center" | "left" | "right";

/** Vertical alignment of the content when a fixed `height` leaves spare rows. */
export type VerticalAlignment = "bottom" | "center" | "top";

/** Position of a single border character, passed to `borderColor`. */
export type BorderPosition = "bottom" | "bottomLeft" | "bottomRight" | "horizontal" | "left" | "right" | "top" | "topLeft" | "topRight";

/** Name of a built-in border style shipped in the vendored catalog. */
export type BorderStyleName = "arrow" | "bold" | "classic" | "double" | "doubleSingle" | "none" | "round" | "single" | "singleDouble";

/** Tuple form returned by a `fullscreen` callback: `[width, height]`. */
export type FullscreenDimensions = [width: number, height: number];

export interface BaseOptions {
    /**
     * Fill the interior of each content line (including padding) with a color.
     *
     * Receives the already-padded interior of a single line and must return it
     * re-styled. Useful for solid-fill status banners.
     * @example
     * ```js
     * import { bgRed } from "@visulima/colorize";
     *
     * boxen("alert", { backgroundColor: (line) => bgRed(line) });
     * ```
     */
    backgroundColor?: (line: string) => string;

    /**
     * Color the box border.
     *
     * Receives the border substring, its {@link BorderPosition}, and its visible
     * length, and must return the colored string.
     */
    borderColor?: (border: string, position: BorderPosition, length: number) => string;

    /**
     * Float the box within the available terminal width.
     * @default "left"
     */
    float?: Alignment;

    /** Text rendered in the bottom border. The box expands to fit it if needed. */
    footerText?: string;

    /** Color the footer text. */
    footerTextColor?: (text: string) => string;

    /**
     * Expand the box to fill the terminal.
     *
     * Pass `true` to use the full terminal size, or a callback receiving the
     * current `width`/`height` and returning either a `[width, height]` tuple or
     * a `{ columns, rows }` object to control the final dimensions.
     * @example
     * ```js
     * boxen("foo", { fullscreen: (width, height) => [width, height - 1] });
     * ```
     */
    fullscreen?: boolean | ((width: number, height: number) => FullscreenDimensions | { columns: number; rows: number });

    /** Text rendered in the top border. The box expands to fit it if needed. */
    headerText?: string;

    /** Color the header text. */
    headerTextColor?: (text: string) => string;

    /** Fixed box height (in rows). Overflowing content is cropped. */
    height?: number;

    /**
     * Number of columns the box may occupy. When omitted, the current terminal
     * width is probed via `terminal-size`.
     *
     * Providing this skips the (potentially blocking) terminal probe and makes
     * rendering deterministic for snapshot tests.
     */
    terminalColumns?: number;

    /**
     * Number of rows the terminal has, used only by `fullscreen`. When omitted,
     * the current terminal height is probed via `terminal-size`.
     */
    terminalRows?: number;

    /** Color each content line of text. */
    textColor?: (text: string) => string;

    /**
     * Replace tab characters with this many spaces. Set to `false` to disable.
     * @default 4
     */
    transformTabToSpace?: number | false;

    /**
     * Vertical alignment of content when `height` exceeds the content height.
     * @default "top"
     */
    verticalAlignment?: VerticalAlignment;

    /** Fixed box width (in columns). Disables terminal-overflow handling. */
    width?: number;
}

export type Spacer = {
    bottom: number;
    left: number;
    right: number;
    top: number;
};

export interface BorderStyle {
    bottom?: string;
    bottomLeft?: string;
    bottomRight?: string;
    horizontal?: string;
    left?: string;
    right?: string;
    top?: string;
    topLeft?: string;
    topRight?: string;
    vertical?: string;
}

export interface Options extends BaseOptions {
    /**
     * Border style: a built-in {@link BorderStyleName} or a custom
     * {@link BorderStyle} object.
     * @default "single"
     */
    borderStyle?: BorderStyle | BorderStyleName;

    /**
     * Footer text alignment.
     * @default "right"
     */
    footerAlignment?: Alignment;

    /**
     * Header text alignment.
     * @default "left"
     */
    headerAlignment?: Alignment;

    /**
     * Space around the box. A number sets all sides (left/right are 3x top/bottom).
     * @default 0
     */
    margin?: Partial<Spacer> | number;

    /**
     * Space between the text and the border. A number sets all sides
     * (left/right are 3x top/bottom).
     * @default 0
     */
    padding?: Partial<Spacer> | number;

    /**
     * Text alignment within the box.
     * @default "left"
     */
    textAlignment?: Alignment;
}

export interface DimensionOptions extends BaseOptions {
    borderStyle: BorderStyle | string;
    footerAlignment: Alignment;
    headerAlignment: Alignment;
    margin: Spacer;
    padding: Spacer;
    textAlignment: Alignment;
    verticalAlignment: VerticalAlignment;
}
