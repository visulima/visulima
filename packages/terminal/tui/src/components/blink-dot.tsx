/* eslint-disable react/function-component-definition */
import type { AnsiColors } from "@visulima/colorize";
import type { ReactElement } from "react";
import type { LiteralUnion } from "type-fest";

import useAnimation from "../ink/hooks/use-animation";
import Text from "./text";

export type Props = {
    /**
     * Glyph rendered as the blinking dot.
     * @default "●" (filled bullet)
     */
    readonly character?: string;

    /**
     * Dot color.
     * @default "red"
     */
    readonly color?: LiteralUnion<AnsiColors, string>;

    /**
     * Milliseconds per blink cycle. The dot is visible for half the cycle.
     * @default 800
     */
    readonly interval?: number;

    /**
     * When false, the dot stays solid (no animation).
     * @default true
     */
    readonly isActive?: boolean;
};

/**
 * Steady or blinking indicator dot. Pair with `StatusLine` or next to a
 * label to show a "live" / "recording" status.
 */
export default function BlinkDot({ character = "●", color = "red", interval = 800, isActive = true }: Props): ReactElement {
    const { frame } = useAnimation({ interval: Math.max(1, Math.floor(interval / 2)), isActive });
    // When the animation is paused, useAnimation freezes `frame` at 0 — the
    // dot stays solid. When running, even frames show the character and odd
    // frames show a space, producing the blink.
    const visible = !isActive || frame % 2 === 0;

    return <Text color={color}>{visible ? character : " "}</Text>;
}

export { BlinkDot };
export type { Props as BlinkDotProps };
