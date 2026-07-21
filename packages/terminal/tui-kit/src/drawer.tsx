/* eslint-disable react/function-component-definition */
import type { AnsiColors } from "@visulima/colorize";
import Box from "@visulima/tui/components/box";
import Text from "@visulima/tui/components/text";
import useInput from "@visulima/tui/hooks/use-input";
import type { ReactElement, ReactNode } from "react";
import { useCallback } from "react";
import type { LiteralUnion } from "type-fest";

export type Props = {
    /**
     * Accent color for the border and title.
     * @default "blue"
     */
    readonly accentColor?: LiteralUnion<AnsiColors, string>;

    /**
     * Drawer body.
     */
    readonly children: ReactNode;

    /**
     * Whether the drawer is open. When false, nothing is rendered.
     */
    readonly isOpen: boolean;

    /**
     * Fires when Escape is pressed while open.
     */
    readonly onClose?: () => void;

    /**
     * Edge the drawer is anchored to. Left/right drawers take a fixed `size`
     * as width; top/bottom take it as height.
     * @default "right"
     */
    readonly side?: "bottom" | "left" | "right" | "top";

    /**
     * Fixed extent (width for left/right, height for top/bottom) in cells.
     * @default 32
     */
    readonly size?: number;

    /**
     * Optional title shown in the drawer header.
     */
    readonly title?: string;
};

/**
 * A slide-over panel anchored to a terminal edge. Rendered as a bordered box
 * sized along one axis; Escape fires `onClose`, and nothing renders while
 * closed. Terminals have no true overlay layer, so place the drawer where it
 * should appear in your layout.
 */
export default function Drawer({ accentColor = "blue", children, isOpen, onClose, side = "right", size = 32, title }: Props): ReactElement | null {
    const inputHandler = useCallback(
        (_input: string, key: { escape: boolean }) => {
            if (key.escape) {
                onClose?.();
            }
        },
        [onClose],
    );

    useInput(inputHandler, { isActive: isOpen });

    if (!isOpen) {
        return null;
    }

    const horizontal = side === "left" || side === "right";

    return (
        <Box
            borderColor={accentColor}
            borderStyle="round"
            flexDirection="column"
            height={horizontal ? undefined : size}
            paddingX={1}
            width={horizontal ? size : undefined}
        >
            {title === undefined
                ? undefined
                : (
                <Box justifyContent="space-between">
                    <Text bold color={accentColor}>
                        {title}
                    </Text>
                    <Text dimColor>esc</Text>
                </Box>
                )}
            <Box flexDirection="column" marginTop={title === undefined ? 0 : 1}>
                {children}
            </Box>
        </Box>
    );
}

export { Drawer };
export type { Props as DrawerProps };
