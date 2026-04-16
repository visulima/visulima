/* eslint-disable react/function-component-definition */
import type { AnsiColors } from "@visulima/colorize";
import type { ReactElement, ReactNode } from "react";
import { useCallback, useState } from "react";
import type { LiteralUnion } from "type-fest";

import useFocus from "../hooks/use-focus";
import useInput from "../hooks/use-input";
import Box from "./box";
import Text from "./text";

export type ConfirmTone = "danger" | "info" | "warning";

export type Props = {
    /**
     * Body content (rendered between title and buttons).
     */
    readonly children?: ReactNode;

    /**
     * Label for the cancel button.
     * @default "Cancel"
     */
    readonly cancelLabel?: string;

    /**
     * Label for the confirm button.
     * @default "Confirm"
     */
    readonly confirmLabel?: string;

    /**
     * Auto-focus the dialog on mount. Set `false` if a parent already owns
     * focus and routes input here.
     * @default true
     */
    readonly autoFocus?: boolean;

    /**
     * Default button when opening the dialog.
     * @default "confirm"
     */
    readonly defaultFocus?: "cancel" | "confirm";

    /**
     * Disable input.
     */
    readonly isDisabled?: boolean;

    /**
     * Fired when the user declines.
     */
    readonly onCancel: () => void;

    /**
     * Fired when the user confirms.
     */
    readonly onConfirm: () => void;

    /**
     * Controls the border color.
     * @default "info"
     */
    readonly tone?: ConfirmTone;

    /**
     * Heading rendered at the top of the dialog.
     */
    readonly title?: string;

    /**
     * Dialog width.
     */
    readonly width?: number;
};

const TONE_COLOR: Record<ConfirmTone, LiteralUnion<AnsiColors, string>> = {
    danger: "red",
    info: "blue",
    warning: "yellow",
};

/**
 * Full-width modal-style confirm/cancel prompt. Unlike `ConfirmInput`, this
 * renders a visible two-button UI: ← / → to toggle focus, Enter to activate,
 * y/n as shortcuts, Esc to cancel.
 */
export default function ConfirmDialog({
    autoFocus = true,
    cancelLabel = "Cancel",
    children,
    confirmLabel = "Confirm",
    defaultFocus = "confirm",
    isDisabled = false,
    onCancel,
    onConfirm,
    title,
    tone = "info",
    width,
}: Props): ReactElement {
    const [focus, setFocus] = useState<"cancel" | "confirm">(defaultFocus);
    const color = TONE_COLOR[tone];
    const { isFocused } = useFocus({ autoFocus, isActive: !isDisabled });

    useInput(
        useCallback(
            (input, key) => {
                if (key.leftArrow || key.rightArrow || input === "h" || input === "l") {
                    setFocus((previous) => (previous === "confirm" ? "cancel" : "confirm"));

                    return;
                }

                if (key.return) {
                    if (focus === "confirm") {
                        onConfirm();
                    } else {
                        onCancel();
                    }

                    return;
                }

                if (key.escape || input === "n") {
                    onCancel();

                    return;
                }

                if (input === "y") {
                    onConfirm();
                }
            },
            [focus, onConfirm, onCancel],
        ),
        { isActive: !isDisabled && isFocused },
    );

    const buttonLabel = (label: string, isFocusedButton: boolean): ReactElement => (
        <Box
            backgroundColor={isFocusedButton ? color : undefined}
            borderColor={isFocusedButton ? color : undefined}
            borderStyle="round"
            paddingX={1}
        >
            <Text bold={isFocusedButton} color={isFocusedButton ? "black" : undefined}>
                {label}
            </Text>
        </Box>
    );

    return (
        <Box borderColor={color} borderStyle="round" flexDirection="column" paddingX={1} paddingY={1} width={width}>
            {title === undefined ? undefined : (
                <Box marginBottom={1}>
                    <Text bold color={color}>{title}</Text>
                </Box>
            )}
            {children === undefined ? undefined : (
                <Box flexDirection="column" marginBottom={1}>
                    {typeof children === "string" ? <Text>{children}</Text> : children}
                </Box>
            )}
            <Box gap={2} justifyContent="flex-end">
                {buttonLabel(cancelLabel, focus === "cancel")}
                {buttonLabel(confirmLabel, focus === "confirm")}
            </Box>
        </Box>
    );
}
