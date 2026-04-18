/* eslint-disable react/function-component-definition */
import type { AnsiColors } from "@visulima/colorize";
import type { ReactElement } from "react";
import { useMemo } from "react";
import type { LiteralUnion } from "type-fest";

import useAnimation from "../hooks/use-animation";
import Text from "./text";

export type Props = {
    /**
     * Width of the highlighted band in characters.
     * @default 3
     */
    readonly bandWidth?: number;

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
};

/**
 * Text with an animated highlight band that sweeps across the characters.
 * Perfect for "generating…" states.
 * @param props.bandWidth Number of characters in the bright band.
 * @param props.color Color applied to characters outside the band.
 * @param props.highlightColor Color applied to characters inside the band.
 * @param props.interval Milliseconds between frames.
 * @param props.text Content to shimmer.
 * @returns A single `Text` element composed of per-character `Text` children.
 */
export default function ShimmerText({ bandWidth = 3, color, highlightColor = "white", interval = 60, text }: Props): ReactElement {
    const { frame } = useAnimation({ interval });

    // Split the raw text into codepoints once per `text` change. The
    // per-frame render reuses this array instead of re-splitting.
    const characters = useMemo(() => [...text], [text]);
    const total = characters.length;
    const cycle = total + bandWidth;
    const position = total === 0 ? 0 : frame % cycle;

    // Static (non-highlighted) Text elements are memoized keyed by
    // text + color so only the handful of elements inside the sweep band
    // are recreated per frame.
    const baseElements = useMemo(
        () =>
            characters.map((char, index) => (
                <Text color={color} dimColor={color === undefined} key={index}>
                    {char}
                </Text>
            )),
        [characters, color],
    );

    if (total === 0) {
        return <Text color={color}>{text}</Text>;
    }

    const parts: ReactElement[] = [];

    for (const [index, char] of characters.entries()) {
        const offset = position - index;
        const inBand = offset >= 0 && offset < bandWidth;

        if (!inBand) {
            parts.push(baseElements[index]!);

            continue;
        }

        parts.push(
            <Text bold color={highlightColor} key={`band-${index}`}>
                {char}
            </Text>,
        );
    }

    return <Text>{parts}</Text>;
}
