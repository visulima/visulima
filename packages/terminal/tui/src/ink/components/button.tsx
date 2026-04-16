/* eslint-disable react/function-component-definition */
import type { AnsiColors } from "@visulima/colorize";
import type { ReactElement, ReactNode } from "react";
import { useCallback } from "react";
import type { LiteralUnion } from "type-fest";

import useFocus from "../hooks/use-focus";
import useInput from "../hooks/use-input";
import Box from "./box";
import Text from "./text";

export type ButtonVariant = "ghost" | "outline" | "primary" | "secondary";

export type Props = {
    /**
     * Accent color used when the button is focused.
     * @default "blue"
     */
    readonly accentColor?: LiteralUnion<AnsiColors, string>;

    /**
     * Focus this button when mounted if nothing else is focused.
     */
    readonly autoFocus?: boolean;

    /**
     * Button label.
     */
    readonly children: ReactNode;

    /**
     * When true, the button ignores input and is rendered dim.
     */
    readonly isDisabled?: boolean;

    /**
     * Called when the user presses Enter or Space while the button has focus.
     */
    readonly onPress?: () => void;

    /**
     * Visual style.
     * @default "primary"
     */
    readonly variant?: ButtonVariant;
};

const BORDER_STYLE = "round" as const;

const resolveTextColor = (
    variant: ButtonVariant,
    isFocused: boolean,
    isDisabled: boolean,
    accentColor: LiteralUnion<AnsiColors, string>,
): LiteralUnion<AnsiColors, string> | undefined => {
    if (isDisabled) {
        return undefined;
    }

    if (variant === "primary" && isFocused) {
        return "black";
    }

    if (isFocused) {
        return accentColor;
    }

    return undefined;
};

/**
 * Focusable button. Triggers `onPress` on Enter / Space.
 */
export default function Button({
    accentColor = "blue",
    autoFocus = false,
    children,
    isDisabled = false,
    onPress,
    variant = "primary",
}: Props): ReactElement {
    const { isFocused } = useFocus({ autoFocus, isActive: !isDisabled });

    useInput(
        useCallback(
            (input, key) => {
                if (!isFocused) {
                    return;
                }

                if (key.return || input === " ") {
                    onPress?.();
                }
            },
            [isFocused, onPress],
        ),
        { isActive: !isDisabled && isFocused },
    );

    const borderColor = isFocused ? accentColor : undefined;
    const fillBackground = variant === "primary" && isFocused ? accentColor : undefined;
    const textColor = resolveTextColor(variant, isFocused, isDisabled, accentColor);

    if (variant === "ghost") {
        return (
            <Box paddingX={1}>
                <Text bold={isFocused} color={textColor} dimColor={isDisabled}>
                    {isFocused ? "▸ " : "  "}
                    {children}
                </Text>
            </Box>
        );
    }

    return (
        <Box
            backgroundColor={fillBackground}
            borderColor={borderColor}
            borderStyle={BORDER_STYLE}
            paddingX={1}
        >
            <Text bold={isFocused} color={textColor} dimColor={isDisabled}>
                {children}
            </Text>
        </Box>
    );
}
