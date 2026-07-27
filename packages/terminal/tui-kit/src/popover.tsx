/* eslint-disable react/function-component-definition */
import type { AnsiColors } from "@visulima/colorize";
import Box from "@visulima/tui/components/box";
import useInput from "@visulima/tui/hooks/use-input";
import type { ReactElement, ReactNode } from "react";
import { useCallback } from "react";
import type { LiteralUnion } from "type-fest";

export type Props = {
    /**
     * Accent color for the content border.
     * @default "blue"
     */
    readonly accentColor?: LiteralUnion<AnsiColors, string>;

    /**
     * The trigger element the popover is anchored to.
     */
    readonly anchor: ReactNode;

    /**
     * The floating content, shown in a bordered box while open.
     */
    readonly children: ReactNode;

    /**
     * Whether the popover content is shown.
     */
    readonly isOpen: boolean;

    /**
     * Fires when Escape is pressed while open.
     */
    readonly onClose?: () => void;

    /**
     * Whether the content sits above or below the anchor.
     * @default "bottom"
     */
    readonly placement?: "bottom" | "top";
};

/**
 * Floating content anchored to a trigger element. The anchor always renders;
 * the bordered content appears above or below it while `isOpen`, and Escape
 * fires `onClose`. Terminals have no true overlay layer, so the content takes
 * layout space rather than floating over other content.
 */
export default function Popover({ accentColor = "blue", anchor, children, isOpen, onClose, placement = "bottom" }: Props): ReactElement {
    const inputHandler = useCallback(
        (_input: string, key: { escape: boolean }) => {
            if (key.escape) {
                onClose?.();
            }
        },
        [onClose],
    );

    useInput(inputHandler, { isActive: isOpen });

    const content = isOpen
        ? (
        <Box alignSelf="flex-start" borderColor={accentColor} borderStyle="round" paddingX={1}>
            {children}
        </Box>
        )
        : undefined;

    return (
        <Box flexDirection="column">
            {placement === "top" ? content : undefined}
            {anchor}
            {placement === "bottom" ? content : undefined}
        </Box>
    );
}

export { Popover };
export type { Props as PopoverProps };
