/* eslint-disable react/function-component-definition */
import type { AnsiColors } from "@visulima/colorize";
import type { ReactElement, ReactNode } from "react";
import type { LiteralUnion } from "type-fest";

import Box from "./box";
import Text from "./text";

export type Props = {
    /**
     * Key cap content.
     */
    readonly children: ReactNode;

    /**
     * Background color of the key cap.
     * @default "gray"
     */
    readonly color?: LiteralUnion<AnsiColors, string>;

    /**
     * Visual style.
     * - `solid` (default): background filled
     * - `outline`: border only
     * - `bare`: no decoration, just dimmed text
     */
    readonly variant?: "bare" | "outline" | "solid";
};

/**
 * Render a keyboard key (e.g. `&lt;Kbd>Enter&lt;/Kbd>`).
 * @returns A `ReactElement` styled as a key cap (solid / outline / bare).
 */
export default function Kbd({ children, color = "gray", variant = "solid" }: Props): ReactElement {
    if (variant === "solid") {
        return (
            <Text backgroundColor={color} color="black">
                {" "}
                {children}
{" "}
            </Text>
        );
    }

    if (variant === "outline") {
        return (
            <Box borderColor={color} borderStyle="round" paddingX={1}>
                <Text color={color}>{children}</Text>
            </Box>
        );
    }

    return <Text dimColor>{children}</Text>;
}

export { Kbd };
export type { Props as KbdProps };
