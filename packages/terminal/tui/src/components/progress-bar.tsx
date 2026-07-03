/* eslint-disable react/function-component-definition */

/**
 * Progress bar component for Ink.
 *
 * Based on ink-progress-bar by Frankie Bagnardi (brigand).
 * @see https://github.com/brigand/ink-progress-bar
 *
 * MIT License
 * Copyright (c) Frankie Bagnardi
 */
import type { ReactElement } from "react";

import useWindowSize from "../ink/hooks/use-window-size";
import type { Props as TextProps } from "./text";
import Text from "./text";

export type Props = {
    /** Fill glyph repeated across the completed portion of the progress bar. Defaults to "█". */
    readonly character?: string;

    /**
     * Override the terminal width used for calculation.
     * When 0, uses the actual terminal width.
     * @default 0
     */
    readonly columns?: number;

    /**
     * Number of columns reserved on the left side (e.g. for labels).
     * @default 0
     */
    readonly left?: number;

    /**
     * Completion percentage between 0 and 1.
     * @default 1
     */
    readonly percent?: number;

    /**
     * Number of columns reserved on the right side (e.g. for percentage text).
     * @default 0
     */
    readonly right?: number;

    /**
     * Whether to pad the remaining space with whitespace.
     * Useful when rendering the bar over a background color.
     * @default false
     */
    readonly rightPad?: boolean;
} & Omit<TextProps, "children">;

/**
 * A terminal progress bar that fills proportionally to a percentage value.
 *
 * ```tsx
 * &lt;ProgressBar percent={0.5} />
 * &lt;ProgressBar percent={0.75} color="green" left={10} right={5} />
 * ```
 */
export default function ProgressBar({
    character = "\u2588",
    columns: columnsProp = 0,
    left = 0,
    percent = 1,
    right = 0,
    rightPad = false,
    ...textProps
}: Props): ReactElement {
    const { columns: terminalColumns } = useWindowSize();

    const screen = columnsProp || terminalColumns || 80;
    const space = Math.max(0, screen - right - left);
    const filled = Math.min(Math.floor(space * Math.max(0, Math.min(1, percent))), space);
    const bar = character.repeat(filled) + (rightPad ? " ".repeat(space - filled) : "");

    return <Text {...textProps}>{bar}</Text>;
}

export { ProgressBar };
export type { Props as ProgressBarProps };
