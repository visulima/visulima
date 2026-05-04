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
     * Auto-focus the dialog on mount. Set `false` if a parent already owns
     * focus and routes input here.
     * @default true
     */
    readonly autoFocus?: boolean;

    /**
     * Label for the cancel button.
     * @default "Cancel"
     */
    readonly cancelLabel?: string;

    /**
     * Body content (rendered between title and buttons).
     */
    readonly children?: ReactNode;

    /**
     * Label for the confirm button.
     * @default "Confirm"
     */
    readonly confirmLabel?: string;

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
     * Heading rendered at the top of the dialog.
     */
    readonly title?: string;

    /**
     * Controls the border color.
     * @default "info"
     */
    readonly tone?: ConfirmTone;

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

type ButtonLabelProps = {
    readonly color: LiteralUnion<AnsiColors, string>;
    readonly isFocused: boolean;
    readonly label: string;
};

/**
 * Pill-shaped button rendered as the dialog's primary / secondary action.
 * Lives at module scope so it isn't recreated on every dialog render.
 */
const ButtonLabel = ({ color, isFocused, label }: ButtonLabelProps): ReactElement => (
    <Box backgroundColor={isFocused ? color : undefined} borderColor={isFocused ? color : undefined} borderStyle="round" paddingX={1}>
        <Text bold={isFocused} color={isFocused ? "black" : undefined}>
            {label}
        </Text>
    </Box>
);

/**
 * Full-width modal-style confirm/cancel prompt. Unlike `ConfirmInput`, this
 * renders a visible two-button UI: ← / → to toggle focus, Enter to activate,
 * y/n as shortcuts, Esc to cancel.
 * @returns A bordered `ReactElement` with optional title, body, and two
 * buttons (cancel / confirm).
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
                    setFocus(focus === "confirm" ? "cancel" : "confirm");

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

    return (
        <Box borderColor={color} borderStyle="round" flexDirection="column" paddingX={1} paddingY={1} width={width}>
            {/* eslint-disable-next-line @stylistic/multiline-ternary -- prettier formats JSX ternaries on one line */}
            {title === undefined ? undefined : (
                <Box marginBottom={1}>
                    <Text bold color={color}>
                        {title}
                    </Text>
                </Box>
            )}
            {/* eslint-disable-next-line @stylistic/multiline-ternary -- prettier formats JSX ternaries on one line */}
            {children === undefined ? undefined : (
                <Box flexDirection="column" marginBottom={1}>
                    {typeof children === "string" ? <Text>{children}</Text> : children}
                </Box>
            )}
            <Box gap={2} justifyContent="flex-end">
                <ButtonLabel color={color} isFocused={focus === "cancel"} label={cancelLabel} />
                <ButtonLabel color={color} isFocused={focus === "confirm"} label={confirmLabel} />
            </Box>
        </Box>
    );
}
