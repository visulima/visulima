/* eslint-disable react/function-component-definition */
import type { AnsiColors } from "@visulima/colorize";
import type { ReactElement, ReactNode } from "react";
import type { LiteralUnion } from "type-fest";

import Box from "./box";
import Text from "./text";

export type TooltipPlacement = "bottom" | "left" | "right" | "top";

export type Props = {
    /**
     * The element the tooltip is attached to.
     */
    readonly children: ReactNode;

    /**
     * Border color.
     * @default "gray"
     */
    readonly color?: LiteralUnion<AnsiColors, string>;

    /**
     * Tooltip body content.
     */
    readonly content: ReactNode;

    /**
     * Controls whether the tooltip is rendered.
     * @default true
     */
    readonly isVisible?: boolean;

    /**
     * Relative position. Terminal rendering does not support floating layers,
     * so the tooltip is placed inline next to (or above / below) the anchor.
     * @default "right"
     */
    readonly placement?: TooltipPlacement;
};

const PLACEMENT_STYLE: Record<TooltipPlacement, { flexDirection: "column" | "row"; orderFirst: boolean }> = {
    bottom: { flexDirection: "column", orderFirst: false },
    left: { flexDirection: "row", orderFirst: true },
    right: { flexDirection: "row", orderFirst: false },
    top: { flexDirection: "column", orderFirst: true },
};

/**
 * Renders supplementary text next to an anchor. Because terminals don't have
 * a floating-layer concept, the tooltip lives inline in the layout. Hide it
 * by toggling `isVisible`.
 */
export default function Tooltip({ children, color = "gray", content, isVisible = true, placement = "right" }: Props): ReactElement {
    const { flexDirection, orderFirst } = PLACEMENT_STYLE[placement];

    const tooltip = isVisible
        ? (
        <Box
            borderColor={color}
            borderStyle="round"
            flexShrink={0}
            marginLeft={placement === "right" ? 1 : 0}
            marginRight={placement === "left" ? 1 : 0}
            paddingX={1}
        >
            {typeof content === "string" ? <Text color={color}>{content}</Text> : content}
        </Box>
        )
        : undefined;

    return (
        <Box alignItems="center" flexDirection={flexDirection}>
            {orderFirst ? tooltip : undefined}
            <Box>{children}</Box>
            {orderFirst ? undefined : tooltip}
        </Box>
    );
}

export { Tooltip };
export type { Props as TooltipProps };
