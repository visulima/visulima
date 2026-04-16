/* eslint-disable react/function-component-definition */
import type { AnsiColors } from "@visulima/colorize";
import type { ReactElement } from "react";
import type { LiteralUnion } from "type-fest";

import useAnimation from "../hooks/use-animation";
import Text from "./text";

export type Props = {
    /**
     * Base color of the non-highlighted text.
     */
    readonly color?: LiteralUnion<AnsiColors, string>;

    /**
     * Highlight color of the sweeping band.
     * @default "white"
     */
    readonly highlightColor?: LiteralUnion<AnsiColors, string>;

    /**
     * Milliseconds between frames of the shimmer.
     * @default 60
     */
    readonly interval?: number;

    /**
     * Text to render with a shimmer sweep.
     */
    readonly text: string;

    /**
     * Width of the highlighted band in characters.
     * @default 3
     */
    readonly bandWidth?: number;
};

/**
 * Text with an animated highlight band that sweeps across the characters.
 * Perfect for "generating…" states.
 */
export default function ShimmerText({
    bandWidth = 3,
    color,
    highlightColor = "white",
    interval = 60,
    text,
}: Props): ReactElement {
    const { frame } = useAnimation({ interval });
    const total = text.length;
    const cycle = total + bandWidth;

    // Position of the leading edge of the band (wraps around).
    const position = total === 0 ? 0 : frame % cycle;

    if (total === 0) {
        return <Text color={color}>{text}</Text>;
    }

    const parts: Array<ReactElement> = [];

    for (const [index, char] of [...text].entries()) {
        const offset = position - index;
        const inBand = offset >= 0 && offset < bandWidth;

        parts.push(
            <Text
                bold={inBand}
                color={inBand ? highlightColor : color}
                dimColor={!inBand && color === undefined}
                key={index}
            >
                {char}
            </Text>,
        );
    }

    return <Text>{parts}</Text>;
}
