/* eslint-disable react/function-component-definition */
import type { AnsiColors } from "@visulima/colorize";
import Box from "@visulima/tui/components/box";
import Text from "@visulima/tui/components/text";
import useFocus from "@visulima/tui/hooks/use-focus";
import useInput from "@visulima/tui/hooks/use-input";
import type { ReactElement, ReactNode } from "react";
import { useCallback } from "react";
import type { LiteralUnion } from "type-fest";

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

/**
 * Pick the label color for a Button based on its variant, focus state, and
 * disabled state. Returns `undefined` when the default terminal color should
 * be used (disabled, or an unfocused non-primary button). The focused primary
 * variant uses `"black"` so the label is readable against the filled accent
 * background; every other focused variant just echoes `accentColor`.
 */
const resolveTextColor = (
    variant: ButtonVariant,
    isFocused: boolean,
    isDisabled: boolean,
    accentColor: LiteralUnion<AnsiColors, string>,
    // eslint-disable-next-line sonarjs/function-return-type -- legitimate union return based on variant/state
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
 * @returns A `ReactElement` rendering the button (bordered or ghost variant).
 */
export default function Button({ accentColor = "blue", autoFocus = false, children, isDisabled = false, onPress, variant = "primary" }: Props): ReactElement {
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

    // Visual tokens per variant:
    //
    //   primary   → filled accent background + accent border (highlighted when focused)
    //   secondary → transparent background + accent border always; bolder label on focus
    //   outline   → transparent background + neutral border, accent-colored when focused
    // eslint-disable-next-line sonarjs/function-return-type -- legitimate union return based on variant/focus
    const borderColor = (() => {
        if (variant === "outline") {
            return isFocused ? accentColor : "gray";
        }

        if (variant === "secondary") {
            // Secondary keeps the accent-colored border always; focus is
            // conveyed by the bold label alone.
            return accentColor;
        }

        // primary (and any future variants) — accent border when focused.
        return isFocused ? accentColor : undefined;
    })();
    const fillBackground = variant === "primary" && isFocused ? accentColor : undefined;

    return (
        <Box backgroundColor={fillBackground} borderColor={borderColor} borderStyle={BORDER_STYLE} paddingX={1}>
            <Text bold={isFocused} color={textColor} dimColor={isDisabled}>
                {children}
            </Text>
        </Box>
    );
}

export { Button };
export type { Props as ButtonProps };
