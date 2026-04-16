/* eslint-disable react/function-component-definition */
import type { AnsiColors } from "@visulima/colorize";
import type { ReactElement } from "react";
import type { LiteralUnion } from "type-fest";

import useAnimation from "../hooks/use-animation";
import Text from "./text";

export type Props = {
    /**
     * Dot character.
     * @default "●"
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
export default function BlinkDot({
    character = "●",
    color = "red",
    interval = 800,
    isActive = true,
}: Props): ReactElement {
    const { frame } = useAnimation({ interval: Math.max(1, Math.floor(interval / 2)), isActive });

    if (!isActive) {
        return <Text color={color}>{character}</Text>;
    }

    const visible = frame % 2 === 0;

    return (
        <Text color={color}>{visible ? character : " "}</Text>
    );
}
