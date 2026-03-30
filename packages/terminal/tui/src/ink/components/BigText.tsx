/* eslint-disable react/function-component-definition, unicorn/filename-case */
import CFonts from "cfonts";
import type { ReactElement } from "react";

import Text from "./Text";

/**
 * Available CFonts font faces.
 */
export type Font =
    | "3d"
    | "block"
    | "chrome"
    | "grid"
    | "huge"
    | "pallet"
    | "shade"
    | "simple"
    | "simple3d"
    | "simpleBlock"
    | "slick"
    | "tiny";

/**
 * Horizontal text alignment.
 */
export type Align = "center" | "left" | "right";

/**
 * Terminal background color names supported by CFonts.
 */
export type BackgroundColor =
    | "black"
    | "blue"
    | "cyan"
    | "green"
    | "magenta"
    | "red"
    | "transparent"
    | "white"
    | "yellow";

export type Props = {
    /**
     * Horizontal alignment of the text.
     *
     * @default "left"
     */
    readonly align?: Align;

    /**
     * Background color.
     *
     * @default "transparent"
     */
    readonly backgroundColor?: BackgroundColor;

    /**
     * Colors to use for the font. Accepts color names, hex values, or `"system"` for terminal default.
     *
     * @default ["system"]
     */
    readonly colors?: string[];

    /**
     * Font face to use.
     *
     * @default "block"
     * @see https://github.com/dominikwilkowski/cfonts#supported-fonts
     */
    readonly font?: Font;

    /**
     * Letter spacing.
     *
     * @default 1
     */
    readonly letterSpacing?: number;

    /**
     * Line height.
     *
     * @default 1
     */
    readonly lineHeight?: number;

    /**
     * Maximum character length per line. `0` means no limit.
     *
     * @default 0
     */
    readonly maxLength?: number;

    /**
     * Whether to add an empty line on top and at the bottom of the output.
     *
     * @default true
     */
    readonly space?: boolean;

    /**
     * The text to render in a large font.
     */
    readonly text: string;
};

const defaults = {
    align: "left" as const,
    backgroundColor: "transparent" as const,
    colors: ["system"],
    font: "block" as const,
    letterSpacing: 1,
    lineHeight: 1,
    maxLength: 0,
    space: true,
};

/**
 * Render large terminal text using CFonts.
 *
 * @example
 * ```tsx
 * import { BigText } from "@visulima/tui/ink";
 *
 * <BigText text="Hello" font="block" />
 * ```
 */
export default function BigText({ text, ...props }: Props): ReactElement | null {
    const options = { ...defaults, ...props };
    const rendered = CFonts.render(text, options);

    return <Text>{rendered.string}</Text>;
}
